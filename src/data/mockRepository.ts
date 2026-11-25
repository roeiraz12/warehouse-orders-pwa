import type { OrdersRepository } from './repository';
import { buildSeed } from './seed';
import { MemoryDb, type MemoryState } from '../../supabase/functions/_shared/memoryDb.ts';
import { createOrderService } from '../../supabase/functions/_shared/service.ts';

/**
 * Demo mode: the same business rules as the cloud API, running in the browser
 * on top of seed data saved in localStorage (this device only).
 */

const STORAGE_KEY = 'order-manager.db.v2';

// Small delay so loading states behave like the network.
const latency = () => new Promise((r) => setTimeout(r, 60));

function read(): Partial<MemoryState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MemoryState;
  } catch {
    // Storage blocked or corrupted — fall through to a fresh seed.
  }
  return buildSeed();
}

function write(state: MemoryState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota — the in-memory copy still works for this session.
  }
}

let db = new MemoryDb(read(), write);
let service = createOrderService(db);

const delayed = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
  async (...a: A): Promise<R> => {
    await latency();
    return fn(...a);
  };

export const mockRepository: OrdersRepository = {
  loadAll: delayed(() => service.loadAll()),
  createOrder: delayed((input, by) => service.createOrder(input, by)),
  setItemState: delayed((itemId, state, by, qty) => service.setItemState(itemId, state, by, qty)),
  touchOrder: delayed((orderId, by) => service.touchOrder(orderId, by)),
  reportIssue: delayed((orderId, message, by) => service.reportIssue(orderId, message, by)),
  completeOrder: delayed((orderId, by) => service.completeOrder(orderId, by)),
  markShipped: delayed((orderId, by) => service.markShipped(orderId, by)),
  acknowledgeAlert: delayed((alertId) => service.acknowledgeAlert(alertId)),

  subscribe(onExternalChange) {
    // Another tab on this device changed the data (manager + employee side by side).
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      db = new MemoryDb(read(), write);
      service = createOrderService(db);
      onExternalChange();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  },

  async reset() {
    db = new MemoryDb(buildSeed(), write);
    service = createOrderService(db);
    write(db.state);
  },
};
