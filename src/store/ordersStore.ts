import { create } from 'zustand';
import type { ItemState, NewOrderInput, Order, Role, Snapshot } from '../types';
import { AuthError, isLive, repository } from '../data/repository';
import { businessCode } from '../data/config';
import { useSession } from './sessionStore';

interface OrdersState extends Snapshot {
  loaded: boolean;
  /** Last failed save/load, shown as a red banner until the next success. */
  error: string | null;
  /** Live mode: no business code yet, or the code was rejected. */
  needsCode: boolean;
  load: () => Promise<void>;
  /** Live mode: try a business code. The code screen stays up until the server answers. */
  submitCode: (code: string) => Promise<'ok' | 'wrong' | 'offline'>;
  setItemState: (itemId: string, state: ItemState, quantityMissing?: number) => Promise<void>;
  touchOrder: (orderId: string) => Promise<void>;
  reportIssue: (orderId: string, message: string) => Promise<void>;
  completeOrder: (orderId: string) => Promise<void>;
  markShipped: (orderId: string) => Promise<void>;
  createOrder: (input: NewOrderInput) => Promise<Order>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const currentRole = (): Role => useSession.getState().role ?? 'employee';

export const useOrders = create<OrdersState>()((set, get) => {
  const fail = (e: unknown) => {
    if (e instanceof AuthError) {
      businessCode.clear();
      set({ needsCode: true, loaded: false });
    } else {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  };

  /** Run a repository write, then re-read everything so all screens stay in sync. */
  const mutate = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      const result = await fn();
      await get().load();
      return result;
    } catch (e) {
      fail(e);
      throw e;
    }
  };

  return {
    orders: [],
    items: [],
    alerts: [],
    logs: [],
    sync: null,
    loaded: false,
    error: null,
    needsCode: isLive && !businessCode.get(),

    async load() {
      if (get().needsCode) return;
      try {
        const snap = await repository.loadAll();
        set({ ...snap, loaded: true, error: null });
      } catch (e) {
        fail(e);
      }
    },

    async submitCode(code) {
      businessCode.set(code.trim());
      try {
        const snap = await repository.loadAll();
        set({ ...snap, loaded: true, needsCode: false, error: null });
        return 'ok';
      } catch (e) {
        businessCode.clear();
        return e instanceof AuthError ? 'wrong' : 'offline';
      }
    },

    setItemState: (itemId, state, quantityMissing) =>
      mutate(() => repository.setItemState(itemId, state, currentRole(), quantityMissing)).then(() => {}),

    touchOrder: (orderId) => mutate(() => repository.touchOrder(orderId, currentRole())),

    reportIssue: (orderId, message) =>
      mutate(() => repository.reportIssue(orderId, message, currentRole())).then(() => {}),

    completeOrder: (orderId) =>
      mutate(() => repository.completeOrder(orderId, currentRole())).then(() => {}),

    markShipped: (orderId) =>
      mutate(() => repository.markShipped(orderId, currentRole())).then(() => {}),

    createOrder: (input) => mutate(() => repository.createOrder(input, currentRole())),

    acknowledgeAlert: (alertId) => mutate(() => repository.acknowledgeAlert(alertId)),

    resetDemo: () => mutate(async () => repository.reset?.()),
  };
});

// Keep this screen in sync when data changes elsewhere.
repository.subscribe(() => {
  void useOrders.getState().load();
});
