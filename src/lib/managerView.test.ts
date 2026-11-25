import { describe, expect, it } from 'vitest';
import { countFilters, filterOrders, missingByProduct } from './managerView';
import type { Order, OrderItem } from '../types';

const now = new Date('2026-10-14T09:00:00Z'); // Wednesday

const order = (id: string, status: Order['status'], deadline: string, extra: Partial<Order> = {}): Order => ({
  id, source: 'manual', clientName: id, createdAt: '2026-10-10T09:00:00Z', deliveryDeadline: deadline,
  businessDaysToDeliver: 3, status, updatedAt: '2026-10-14T08:00:00Z', ...extra,
});
const item = (orderId: string, name: string, state: OrderItem['state'], missing?: number): OrderItem => ({
  id: `${orderId}-${name}`, orderId, name, quantityOrdered: 10, unit: 'קרטון', state, quantityMissing: missing, updatedAt: '',
});

const orders = [
  order('late', 'in_progress', '2026-10-12T09:00:00Z'),
  order('today', 'new', '2026-10-14T15:00:00Z'),
  order('later', 'new', '2026-10-20T09:00:00Z'),
  order('ready', 'ready_to_ship', '2026-10-15T09:00:00Z', { completedAt: '2026-10-14T07:00:00Z' }),
  order('gone', 'shipped', '2026-10-13T09:00:00Z', { completedAt: '2026-10-13T07:00:00Z' }),
];
const itemsByOrder = new Map<string, OrderItem[]>([
  ['late', [item('late', 'במבה', 'missing', 3), item('late', 'ביסלי', 'packed')]],
  ['ready', [item('ready', 'במבה', 'missing', 2), item('ready', 'קפה', 'packed')]],
  ['gone', [item('gone', 'במבה', 'missing', 5)]], // shipped — no longer counts as open shortage
]);

describe('manager view', () => {
  it('counts each pipeline stage and attention bucket', () => {
    expect(countFilters(orders, itemsByOrder, now)).toEqual({
      new: 2, picking: 1, ready: 1, shipped: 1,
      late: 1, soon: 1, missing: 2,
    });
  });

  it('lists matching orders in a useful order', () => {
    expect(filterOrders(orders, itemsByOrder, 'new', now).map((o) => o.id)).toEqual(['today', 'later']);
    expect(filterOrders(orders, itemsByOrder, 'missing', now).map((o) => o.id)).toEqual(['late', 'ready']);
  });

  it('sums open shortages per product', () => {
    expect(missingByProduct(orders, itemsByOrder)).toEqual([
      { name: 'במבה', unit: 'קרטון', quantity: 5, orders: 2 },
    ]);
  });
});
