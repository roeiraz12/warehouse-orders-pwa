import type { ActivityLog, Alert, Order, OrderItem, Snapshot, SyncStatus } from './types.ts';

/**
 * Storage used by the order service. Two implementations:
 *  - MemoryDb   (./memoryDb.ts)          — demo mode in the browser, the local dev server, tests
 *  - SupabaseDb (../api/supabaseDb.ts)   — production (Postgres)
 */
export interface Db {
  /** Active orders, orders completed since `completedSince`, their items, and open alerts. */
  snapshot(completedSince: Date): Promise<Snapshot>;
  getOrder(id: string): Promise<Order | undefined>;
  findOrderByExternalId(externalId: string): Promise<Order | undefined>;
  getItem(id: string): Promise<OrderItem | undefined>;
  listItems(orderId: string): Promise<OrderItem[]>;
  /** Must fail if an order with the same externalId already exists. */
  insertOrder(order: Order, items: OrderItem[]): Promise<void>;
  updateOrder(id: string, patch: Partial<Order>): Promise<void>;
  updateItem(id: string, patch: Partial<OrderItem>): Promise<void>;
  insertAlert(alert: Alert): Promise<void>;
  /** Removes unacknowledged "missing" alerts for an item (it was re-marked or undone). */
  deleteOpenMissingAlerts(itemId: string): Promise<void>;
  acknowledgeAlert(id: string): Promise<void>;
  insertLog(log: ActivityLog): Promise<void>;
  getSyncStatus(): Promise<SyncStatus>;
  /** `bump` = also bump the version so open screens reload (used when the error state flips). */
  setSyncStatus(status: SyncStatus, bump: boolean): Promise<void>;
  version(): Promise<number>;
}
