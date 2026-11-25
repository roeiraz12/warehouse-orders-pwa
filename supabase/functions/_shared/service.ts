import type { Db } from './db.ts';
import type { ActivityLog, Alert, ItemState, NewOrderInput, Order, OrderItem, Role, Snapshot } from './types.ts';
import { addIsraeliBusinessDays } from './businessDays.ts';
import { newId } from './ids.ts';

/** How long finished orders stay visible to the manager. */
export const COMPLETED_WINDOW_DAYS = 7;

export class NotFoundError extends Error {}
export class RuleError extends Error {}

/**
 * All order business rules, independent of where data is stored.
 * Used by the browser demo (MemoryDb + localStorage) and by the cloud API (SupabaseDb).
 */
export function createOrderService(db: Db, now: () => Date = () => new Date()) {
  const iso = () => now().toISOString();

  const log = (orderId: string, action: ActivityLog['action'], role: Role, details?: string) =>
    db.insertLog({ id: newId('log'), orderId, action, role, details, at: iso() });

  const mustGetOrder = async (id: string) => {
    const order = await db.getOrder(id);
    if (!order) throw new NotFoundError(`Order ${id} not found`);
    return order;
  };

  return {
    loadAll(): Promise<Snapshot> {
      return db.snapshot(new Date(now().getTime() - COMPLETED_WINDOW_DAYS * 86_400_000));
    },

    async createOrder(input: NewOrderInput, by: Role): Promise<Order> {
      const clientName = input.clientName?.trim();
      const lines = (input.items ?? []).filter((i) => i.name?.trim() && i.quantityOrdered > 0);
      if (!clientName || lines.length === 0) throw new RuleError('Client name and at least one item are required');
      const days = Math.min(30, Math.max(1, Math.floor(input.businessDaysToDeliver || 3)));

      const created = now();
      const order: Order = {
        id: newId('ord'),
        source: 'manual',
        clientName,
        createdAt: created.toISOString(),
        deliveryDeadline: addIsraeliBusinessDays(created, days).toISOString(),
        businessDaysToDeliver: days,
        status: 'new',
        notes: input.notes?.trim() || undefined,
        updatedAt: created.toISOString(),
      };
      const items: OrderItem[] = lines.map((l) => ({
        id: newId('itm'),
        orderId: order.id,
        name: l.name.trim(),
        quantityOrdered: l.quantityOrdered,
        unit: l.unit,
        state: 'pending',
        updatedAt: order.createdAt,
      }));
      await db.insertOrder(order, items);
      await log(order.id, 'created', by, 'הזמנה ידנית');
      return order;
    },

    async setItemState(itemId: string, state: ItemState, by: Role, quantityMissing?: number): Promise<OrderItem> {
      const item = await db.getItem(itemId);
      if (!item) throw new NotFoundError(`Item ${itemId} not found`);
      const order = await mustGetOrder(item.orderId);
      if (order.status !== 'new' && order.status !== 'in_progress') {
        throw new RuleError('Order is no longer active');
      }
      const at = iso();
      const missing = state === 'missing'
        ? Math.min(item.quantityOrdered, Math.max(1, quantityMissing ?? item.quantityOrdered))
        : undefined;

      const patch: Partial<OrderItem> = { state, quantityMissing: missing, updatedAt: at };
      await db.updateItem(itemId, patch);
      // Any previous open "missing" alert is replaced (or cleared on undo / packed).
      await db.deleteOpenMissingAlerts(itemId);

      if (state === 'missing') {
        const alert: Alert = {
          id: newId('al'),
          orderId: order.id,
          itemId,
          type: 'missing_item',
          message: `חסר: ${item.name} — ${missing} ${item.unit ?? ''} מתוך ${item.quantityOrdered}`.replace(/\s+/g, ' '),
          createdAt: at,
          createdBy: by,
          acknowledged: false,
        };
        await db.insertAlert(alert);
        await log(order.id, 'item_missing', by, `${item.name}: ${missing}`);
      } else {
        await log(order.id, state === 'packed' ? 'item_packed' : 'item_reset', by, item.name);
      }

      await db.updateOrder(order.id, {
        status: order.status === 'new' ? 'in_progress' : order.status,
        updatedAt: at,
      });
      return { ...item, ...patch };
    },

    async touchOrder(orderId: string, by: Role): Promise<void> {
      await mustGetOrder(orderId);
      await db.updateOrder(orderId, { updatedAt: iso() });
      await log(orderId, 'updated', by);
    },

    async reportIssue(orderId: string, message: string, by: Role): Promise<Alert> {
      await mustGetOrder(orderId);
      const text = message?.trim();
      if (!text) throw new RuleError('Message is required');
      const alert: Alert = {
        id: newId('al'),
        orderId,
        type: 'issue_report',
        message: text.slice(0, 1000),
        createdAt: iso(),
        createdBy: by,
        acknowledged: false,
      };
      await db.insertAlert(alert);
      await log(orderId, 'issue_reported', by, text);
      return alert;
    },

    async completeOrder(orderId: string, by: Role): Promise<Order> {
      const order = await mustGetOrder(orderId);
      if (order.status !== 'new' && order.status !== 'in_progress') {
        throw new RuleError('Order is no longer active');
      }
      const items = await db.listItems(orderId);
      if (items.length === 0 || items.some((i) => i.state === 'pending')) {
        throw new RuleError('Cannot finish an order with unchecked items');
      }
      const at = iso();
      const patch: Partial<Order> = { status: 'ready_to_ship', completedAt: at, completedBy: by, updatedAt: at };
      await db.updateOrder(orderId, patch);
      await log(orderId, 'completed', by);
      return { ...order, ...patch };
    },

    /** Manager closes the loop: a packed order has left the warehouse. */
    async markShipped(orderId: string, by: Role): Promise<Order> {
      const order = await mustGetOrder(orderId);
      if (order.status !== 'ready_to_ship') throw new RuleError('Only orders that are ready to ship can be shipped');
      const patch: Partial<Order> = { status: 'shipped', updatedAt: iso() };
      await db.updateOrder(orderId, patch);
      await log(orderId, 'shipped', by);
      return { ...order, ...patch };
    },

    acknowledgeAlert(alertId: string): Promise<void> {
      return db.acknowledgeAlert(alertId);
    },

    version(): Promise<number> {
      return db.version();
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
