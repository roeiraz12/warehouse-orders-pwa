import { describe, expect, it } from 'vitest';
import { addIsraeliBusinessDays } from './businessDays';
import { daysLeft, deadlineStatus, isChecklistComplete, progressOf, sortOrders } from './orderRules';
import type { Order, OrderItem } from '../types';

// 2026-10-08 is a Thursday.
const thursday = new Date(2026, 9, 8, 10, 0);

describe('addIsraeliBusinessDays', () => {
  it('skips Friday and Saturday', () => {
    const r = addIsraeliBusinessDays(thursday, 3);
    expect(r.getDay()).toBe(2); // Sun, Mon, Tue -> Tuesday
    expect(r.getDate()).toBe(13);
    expect(r.getHours()).toBe(10);
  });

  it('counts within the week', () => {
    const sunday = new Date(2026, 9, 4, 9, 0);
    expect(addIsraeliBusinessDays(sunday, 3).getDate()).toBe(7); // Wednesday
  });

  it('an order placed on Friday counts from Sunday', () => {
    const friday = new Date(2026, 9, 9, 12, 0);
    expect(addIsraeliBusinessDays(friday, 1).getDate()).toBe(11); // Sunday
  });

  it('zero days returns the same moment', () => {
    expect(addIsraeliBusinessDays(thursday, 0).getTime()).toBe(thursday.getTime());
  });
});

const item = (state: OrderItem['state']): OrderItem => ({
  id: Math.random().toString(),
  orderId: 'o',
  name: 'x',
  quantityOrdered: 1,
  state,
  updatedAt: '',
});

describe('order rules', () => {
  it('checklist is complete only when nothing is pending', () => {
    expect(isChecklistComplete([item('packed'), item('missing')])).toBe(true);
    expect(isChecklistComplete([item('packed'), item('pending')])).toBe(false);
    expect(isChecklistComplete([])).toBe(false);
  });

  it('counts progress', () => {
    expect(progressOf([item('packed'), item('missing'), item('pending')])).toEqual({
      total: 3, packed: 1, missing: 1, pending: 1,
    });
  });

  const order = (deadline: Date, createdAt = thursday): Order => ({
    id: deadline.toISOString(),
    source: 'manual',
    clientName: 'c',
    createdAt: createdAt.toISOString(),
    deliveryDeadline: deadline.toISOString(),
    businessDaysToDeliver: 3,
    status: 'new',
    updatedAt: '',
  });

  it('classifies deadlines by day, ignoring the hour', () => {
    expect(deadlineStatus(order(new Date(2026, 9, 7)), thursday)).toBe('overdue');
    // Earlier today is still "today", not overdue.
    expect(deadlineStatus(order(new Date(2026, 9, 8, 6)), thursday)).toBe('near');
    // Next business day after Thursday is Sunday — still "near".
    expect(deadlineStatus(order(new Date(2026, 9, 11, 9)), thursday)).toBe('near');
    expect(deadlineStatus(order(new Date(2026, 9, 14)), thursday)).toBe('ok');
  });

  it('counts business days left', () => {
    expect(daysLeft(order(new Date(2026, 9, 13, 23)), thursday)).toBe(3); // Thu → Tue
    expect(daysLeft(order(new Date(2026, 9, 8, 1)), thursday)).toBe(0);
    expect(daysLeft(order(new Date(2026, 9, 6)), thursday)).toBe(-2); // Tue, two days late
    expect(daysLeft(order(new Date(2026, 9, 9)), thursday)).toBe(1); // Friday deadline counts as 1
  });

  it('sorts by deadline or by creation time', () => {
    const a = order(new Date(2026, 9, 20), new Date(2026, 9, 1));
    const b = order(new Date(2026, 9, 10), new Date(2026, 9, 5));
    expect(sortOrders([a, b], 'deadline')[0]).toBe(b);
    expect(sortOrders([b, a], 'createdAt')[0]).toBe(a);
    expect(sortOrders([b, a], 'deadline', 'desc')[0]).toBe(a); // furthest deadline first
    expect(sortOrders([a, b], 'createdAt', 'desc')[0]).toBe(b); // newest first
  });
});
