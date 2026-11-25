import type { Order, OrderItem } from '../types';
import { daysLeft, isActive, sortOrders } from './orderRules';

/**
 * The manager's view of the order pipeline:
 *   new → picking → ready to ship → shipped
 * plus cross-cutting "needs attention" filters.
 */
export type OrderFilter = 'late' | 'soon' | 'missing' | 'new' | 'picking' | 'ready' | 'shipped';

export const STAGES: OrderFilter[] = ['new', 'picking', 'ready', 'shipped'];
export const ATTENTION: OrderFilter[] = ['late', 'soon', 'missing'];

export function isOrderFilter(v: string | undefined): v is OrderFilter {
  return !!v && [...STAGES, ...ATTENTION].includes(v as OrderFilter);
}

const hasMissing = (items: OrderItem[]) => items.some((i) => i.state === 'missing');

export function matchesFilter(order: Order, items: OrderItem[], filter: OrderFilter, now = new Date()): boolean {
  switch (filter) {
    case 'late':
      return isActive(order) && daysLeft(order, now) < 0;
    case 'soon': {
      const d = daysLeft(order, now);
      return isActive(order) && d >= 0 && d <= 1;
    }
    case 'missing':
      return (isActive(order) || order.status === 'ready_to_ship') && hasMissing(items);
    case 'new':
      return order.status === 'new';
    case 'picking':
      return order.status === 'in_progress';
    case 'ready':
      return order.status === 'ready_to_ship';
    case 'shipped':
      return order.status === 'shipped';
  }
}

const time = (iso?: string) => (iso ? new Date(iso).getTime() : 0);

export function filterOrders(
  orders: Order[],
  itemsByOrder: Map<string, OrderItem[]>,
  filter: OrderFilter,
  now = new Date(),
): Order[] {
  const list = orders.filter((o) => matchesFilter(o, itemsByOrder.get(o.id) ?? [], filter, now));
  // Ready: whoever has waited longest first. Shipped: most recent first. Everything else: by deadline.
  if (filter === 'ready') return list.sort((a, b) => time(a.completedAt) - time(b.completedAt));
  if (filter === 'shipped') return list.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
  return sortOrders(list, 'deadline');
}

export function countFilters(orders: Order[], itemsByOrder: Map<string, OrderItem[]>, now = new Date()) {
  const counts = {} as Record<OrderFilter, number>;
  for (const f of [...STAGES, ...ATTENTION]) counts[f] = 0;
  for (const o of orders) {
    const items = itemsByOrder.get(o.id) ?? [];
    for (const f of [...STAGES, ...ATTENTION]) if (matchesFilter(o, items, f, now)) counts[f]++;
  }
  return counts;
}

export interface MissingProduct {
  name: string;
  unit?: string;
  quantity: number;
  orders: number;
}

/** What still has to be sourced: missing quantities summed per product, across orders not yet shipped. */
export function missingByProduct(orders: Order[], itemsByOrder: Map<string, OrderItem[]>): MissingProduct[] {
  const open = orders.filter((o) => isActive(o) || o.status === 'ready_to_ship');
  const map = new Map<string, MissingProduct>();
  for (const o of open) {
    for (const i of itemsByOrder.get(o.id) ?? []) {
      if (i.state !== 'missing') continue;
      const key = `${i.name}|${i.unit ?? ''}`;
      const row = map.get(key) ?? { name: i.name, unit: i.unit, quantity: 0, orders: 0 };
      row.quantity += i.quantityMissing ?? i.quantityOrdered;
      row.orders += 1;
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => b.orders - a.orders || b.quantity - a.quantity);
}
