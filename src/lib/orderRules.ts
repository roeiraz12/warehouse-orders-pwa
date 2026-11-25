import type { Order, OrderItem } from '../types';
import { businessDaysUntil } from './businessDays';

export const DEFAULT_BUSINESS_DAYS = 3;

export function isActive(order: Order): boolean {
  return order.status === 'new' || order.status === 'in_progress';
}

export function isDone(order: Order): boolean {
  return order.status === 'ready_to_ship' || order.status === 'shipped';
}

/** All items were handled — either packed or flagged as missing. */
export function isChecklistComplete(items: OrderItem[]): boolean {
  return items.length > 0 && items.every((i) => i.state !== 'pending');
}

export interface Progress {
  total: number;
  packed: number;
  missing: number;
  pending: number;
}

export function progressOf(items: OrderItem[]): Progress {
  const packed = items.filter((i) => i.state === 'packed').length;
  const missing = items.filter((i) => i.state === 'missing').length;
  return { total: items.length, packed, missing, pending: items.length - packed - missing };
}

export type DeadlineStatus = 'overdue' | 'near' | 'ok';

/** Business days left until delivery (0 = today, negative = late). Staff see days only, never times. */
export function daysLeft(order: Order, now: Date = new Date()): number {
  return businessDaysUntil(new Date(order.deliveryDeadline), now);
}

/** Overdue = deadline day has passed. Near = due today or on the next business day. */
export function deadlineStatus(order: Order, now: Date = new Date()): DeadlineStatus {
  const days = daysLeft(order, now);
  if (days < 0) return 'overdue';
  if (days <= 1) return 'near';
  return 'ok';
}

export type SortMode = 'createdAt' | 'deadline';
/** asc = closest deadline / oldest order first. */
export type SortDir = 'asc' | 'desc';

export function sortOrders(orders: Order[], mode: SortMode, dir: SortDir = 'asc'): Order[] {
  const key = (o: Order) => new Date(mode === 'createdAt' ? o.createdAt : o.deliveryDeadline).getTime();
  const sign = dir === 'asc' ? 1 : -1;
  return [...orders].sort((a, b) => sign * (key(a) - key(b)));
}
