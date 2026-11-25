import type { Db } from './db.ts';
import type { ActivityLog, Alert, Order, OrderItem, Snapshot, SyncStatus } from './types.ts';

export interface MemoryState {
  orders: Order[];
  items: OrderItem[];
  alerts: Alert[];
  logs: ActivityLog[];
  sync: SyncStatus;
  version: number;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** In-memory Db. `onChange` lets the browser demo persist to localStorage. */
export class MemoryDb implements Db {
  state: MemoryState;

  constructor(initial?: Partial<MemoryState>, private onChange?: (s: MemoryState) => void) {
    this.state = {
      orders: [], items: [], alerts: [], logs: [], sync: {}, version: 0,
      ...clone(initial ?? {}),
    };
  }

  private changed(bump = true) {
    if (bump) this.state.version++;
    this.onChange?.(this.state);
  }

  async snapshot(completedSince: Date): Promise<Snapshot> {
    const since = completedSince.getTime();
    const orders = this.state.orders.filter(
      (o) => o.status === 'new' || o.status === 'in_progress' ||
        (o.completedAt !== undefined && new Date(o.completedAt).getTime() >= since),
    );
    const ids = new Set(orders.map((o) => o.id));
    return clone({
      orders,
      items: this.state.items.filter((i) => ids.has(i.orderId)),
      alerts: this.state.alerts.filter((a) => !a.acknowledged),
      logs: [],
      version: this.state.version,
      sync: this.state.sync,
    });
  }

  async getOrder(id: string) {
    const o = this.state.orders.find((x) => x.id === id);
    return o && clone(o);
  }

  async findOrderByExternalId(externalId: string) {
    const o = this.state.orders.find((x) => x.externalId === externalId);
    return o && clone(o);
  }

  async getItem(id: string) {
    const i = this.state.items.find((x) => x.id === id);
    return i && clone(i);
  }

  async listItems(orderId: string) {
    return clone(this.state.items.filter((i) => i.orderId === orderId));
  }

  async insertOrder(order: Order, items: OrderItem[]) {
    if (order.externalId && this.state.orders.some((o) => o.externalId === order.externalId)) {
      throw new Error(`duplicate externalId ${order.externalId}`);
    }
    this.state.orders.push(clone(order));
    this.state.items.push(...clone(items));
    this.changed();
  }

  async updateOrder(id: string, patch: Partial<Order>) {
    const o = this.state.orders.find((x) => x.id === id);
    if (o) Object.assign(o, clone(patch));
    this.changed();
  }

  async updateItem(id: string, patch: Partial<OrderItem>) {
    const i = this.state.items.find((x) => x.id === id);
    if (i) Object.assign(i, clone(patch));
    this.changed();
  }

  async insertAlert(alert: Alert) {
    this.state.alerts.push(clone(alert));
    this.changed();
  }

  async deleteOpenMissingAlerts(itemId: string) {
    this.state.alerts = this.state.alerts.filter(
      (a) => !(a.itemId === itemId && a.type === 'missing_item' && !a.acknowledged),
    );
    this.changed();
  }

  async acknowledgeAlert(id: string) {
    const a = this.state.alerts.find((x) => x.id === id);
    if (a) a.acknowledged = true;
    this.changed();
  }

  async insertLog(log: ActivityLog) {
    this.state.logs.push(clone(log));
    this.changed(false);
  }

  async getSyncStatus() {
    return clone(this.state.sync);
  }

  async setSyncStatus(status: SyncStatus, bump: boolean) {
    this.state.sync = { ...this.state.sync, ...clone(status) };
    this.changed(bump);
  }

  async version() {
    return this.state.version;
  }
}
