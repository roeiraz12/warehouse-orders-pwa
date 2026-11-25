import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Db } from '../_shared/db.ts';
import type { ActivityLog, Alert, Order, OrderItem, Snapshot, SyncStatus } from '../_shared/types.ts';

// ---- row <-> model mapping (Postgres is snake_case, the app is camelCase) ----

type Row = Record<string, unknown>;
const opt = <T>(v: unknown): T | undefined => (v === null || v === undefined ? undefined : (v as T));

const orderFromRow = (r: Row): Order => ({
  id: r.id as string,
  externalId: opt(r.external_id),
  source: r.source as Order['source'],
  clientName: r.client_name as string,
  supplierName: opt(r.supplier_name),
  createdAt: r.created_at as string,
  deliveryDeadline: r.delivery_deadline as string,
  businessDaysToDeliver: r.business_days_to_deliver as number,
  status: r.status as Order['status'],
  notes: opt(r.notes),
  completedAt: opt(r.completed_at),
  completedBy: opt(r.completed_by),
  updatedAt: r.updated_at as string,
});

const ORDER_COLS: Record<keyof Order, string> = {
  id: 'id', externalId: 'external_id', source: 'source', clientName: 'client_name',
  supplierName: 'supplier_name', createdAt: 'created_at', deliveryDeadline: 'delivery_deadline',
  businessDaysToDeliver: 'business_days_to_deliver', status: 'status', notes: 'notes',
  completedAt: 'completed_at', completedBy: 'completed_by', updatedAt: 'updated_at',
};

const itemFromRow = (r: Row): OrderItem => ({
  id: r.id as string,
  orderId: r.order_id as string,
  sku: opt(r.sku),
  name: r.name as string,
  quantityOrdered: Number(r.quantity_ordered),
  unit: opt(r.unit),
  state: r.state as OrderItem['state'],
  quantityMissing: r.quantity_missing === null ? undefined : Number(r.quantity_missing),
  updatedAt: r.updated_at as string,
});

const ITEM_COLS: Record<keyof OrderItem, string> = {
  id: 'id', orderId: 'order_id', sku: 'sku', name: 'name', quantityOrdered: 'quantity_ordered',
  unit: 'unit', state: 'state', quantityMissing: 'quantity_missing', updatedAt: 'updated_at',
};

const alertFromRow = (r: Row): Alert => ({
  id: r.id as string,
  orderId: r.order_id as string,
  itemId: opt(r.item_id),
  type: r.type as Alert['type'],
  message: r.message as string,
  createdAt: r.created_at as string,
  createdBy: r.created_by as Alert['createdBy'],
  acknowledged: r.acknowledged as boolean,
});

/** Converts a camelCase patch to a snake_case row; `undefined` becomes SQL null. */
function toRow<T extends object>(obj: Partial<T>, cols: Record<keyof T, string>): Row {
  const row: Row = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (cols[key]) row[cols[key]] = obj[key] ?? null;
  }
  return row;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export class SupabaseDb implements Db {
  constructor(private sb: SupabaseClient) {}

  async snapshot(completedSince: Date): Promise<Snapshot> {
    const [active, done, alerts, state] = await Promise.all([
      this.sb.from('orders').select('*').in('status', ['new', 'in_progress']),
      this.sb.from('orders').select('*').gte('completed_at', completedSince.toISOString()),
      this.sb.from('alerts').select('*').eq('acknowledged', false),
      this.sb.from('app_state').select('*').eq('id', 1).single(),
    ]);
    const orders = [...check(active), ...check(done)].map(orderFromRow);
    const ids = [...new Set(orders.map((o) => o.id))];
    const items = ids.length
      ? check(await this.sb.from('order_items').select('*').in('order_id', ids).order('order_id').order('position'))
      : [];
    const s = check(state) as Row;
    return {
      orders,
      items: items.map(itemFromRow),
      alerts: check(alerts).map(alertFromRow),
      logs: [],
      version: Number(s.version),
      sync: {
        lastSuccessAt: opt(s.last_sync_success_at) ?? null,
        lastError: opt(s.last_sync_error) ?? null,
        lastErrorAt: opt(s.last_sync_error_at) ?? null,
      },
    };
  }

  async getOrder(id: string) {
    const row = check(await this.sb.from('orders').select('*').eq('id', id).maybeSingle());
    return row ? orderFromRow(row) : undefined;
  }

  async findOrderByExternalId(externalId: string) {
    const row = check(await this.sb.from('orders').select('*').eq('external_id', externalId).maybeSingle());
    return row ? orderFromRow(row) : undefined;
  }

  async getItem(id: string) {
    const row = check(await this.sb.from('order_items').select('*').eq('id', id).maybeSingle());
    return row ? itemFromRow(row) : undefined;
  }

  async listItems(orderId: string) {
    return check(await this.sb.from('order_items').select('*').eq('order_id', orderId).order('position')).map(itemFromRow);
  }

  async insertOrder(order: Order, items: OrderItem[]) {
    check(await this.sb.from('orders').insert(toRow(order, ORDER_COLS)));
    if (items.length) {
      const res = await this.sb.from('order_items').insert(
        items.map((it, position) => ({ ...toRow(it, ITEM_COLS), position })),
      );
      if (res.error) {
        // Keep it all-or-nothing: an order without its items must never appear.
        await this.sb.from('orders').delete().eq('id', order.id);
        throw new Error(res.error.message);
      }
    }
  }

  async updateOrder(id: string, patch: Partial<Order>) {
    check(await this.sb.from('orders').update(toRow(patch, ORDER_COLS)).eq('id', id));
  }

  async updateItem(id: string, patch: Partial<OrderItem>) {
    check(await this.sb.from('order_items').update(toRow(patch, ITEM_COLS)).eq('id', id));
  }

  async insertAlert(a: Alert) {
    check(await this.sb.from('alerts').insert({
      id: a.id, order_id: a.orderId, item_id: a.itemId ?? null, type: a.type, message: a.message,
      created_at: a.createdAt, created_by: a.createdBy, acknowledged: a.acknowledged,
    }));
  }

  async deleteOpenMissingAlerts(itemId: string) {
    check(await this.sb.from('alerts').delete()
      .eq('item_id', itemId).eq('type', 'missing_item').eq('acknowledged', false));
  }

  async acknowledgeAlert(id: string) {
    check(await this.sb.from('alerts').update({ acknowledged: true }).eq('id', id));
  }

  async insertLog(l: ActivityLog) {
    check(await this.sb.from('activity_log').insert({
      id: l.id, order_id: l.orderId, action: l.action, role: l.role, details: l.details ?? null, at: l.at,
    }));
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const s = check(await this.sb.from('app_state').select('*').eq('id', 1).single()) as Row;
    return { lastSuccessAt: opt(s.last_sync_success_at), lastError: opt(s.last_sync_error), lastErrorAt: opt(s.last_sync_error_at) };
  }

  async setSyncStatus(status: SyncStatus, bump: boolean) {
    const row: Row = {};
    if ('lastSuccessAt' in status) row.last_sync_success_at = status.lastSuccessAt ?? null;
    if ('lastError' in status) row.last_sync_error = status.lastError ?? null;
    if ('lastErrorAt' in status) row.last_sync_error_at = status.lastErrorAt ?? null;
    if (bump) {
      const cur = check(await this.sb.from('app_state').select('version').eq('id', 1).single()) as Row;
      row.version = Number(cur.version) + 1;
    }
    check(await this.sb.from('app_state').update(row).eq('id', 1));
  }

  async version() {
    const s = check(await this.sb.from('app_state').select('version').eq('id', 1).single()) as Row;
    return Number(s.version);
  }
}
