export type Role = 'manager' | 'employee';

export type OrderStatus = 'new' | 'in_progress' | 'ready_to_ship' | 'shipped' | 'cancelled';
export type OrderSource = 'rivahit' | 'manual';

export interface Order {
  id: string;
  /** Order number in Rivahit (Phase 2). */
  externalId?: string;
  source: OrderSource;
  clientName: string;
  supplierName?: string;
  /** ISO timestamp — the "Order Time". */
  createdAt: string;
  /** ISO timestamp — createdAt + businessDaysToDeliver Israeli business days. */
  deliveryDeadline: string;
  businessDaysToDeliver: number;
  status: OrderStatus;
  notes?: string;
  completedAt?: string;
  completedBy?: Role;
  updatedAt: string;
}

export type ItemState = 'pending' | 'packed' | 'missing';

export interface OrderItem {
  id: string;
  orderId: string;
  sku?: string;
  name: string;
  quantityOrdered: number;
  unit?: string;
  state: ItemState;
  quantityMissing?: number;
  updatedAt: string;
}

export type AlertType = 'missing_item' | 'issue_report' | 'deadline_near' | 'overdue';

export interface Alert {
  id: string;
  orderId: string;
  itemId?: string;
  type: AlertType;
  message: string;
  createdAt: string;
  createdBy: Role;
  acknowledged: boolean;
}

export type ActivityAction =
  | 'created'
  | 'item_packed'
  | 'item_missing'
  | 'item_reset'
  | 'issue_reported'
  | 'updated'
  | 'completed'
  | 'shipped';

export interface ActivityLog {
  id: string;
  orderId: string;
  action: ActivityAction;
  role: Role;
  details?: string;
  at: string;
}

/** Health of the Rivhit import, shown to the manager when something is wrong. */
export interface SyncStatus {
  /** False while Rivhit isn't connected (no API token configured) — no warnings then. */
  enabled?: boolean;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
}

/** Everything the UI needs, loaded in one go. */
export interface Snapshot {
  orders: Order[];
  items: OrderItem[];
  alerts: Alert[];
  logs: ActivityLog[];
  /** Increases on every change; clients poll it to know when to reload. */
  version?: number;
  sync?: SyncStatus | null;
}

export interface NewOrderInput {
  clientName: string;
  businessDaysToDeliver: number;
  notes?: string;
  items: { name: string; quantityOrdered: number; unit?: string }[];
}
