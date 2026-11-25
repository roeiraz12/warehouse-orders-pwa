import type { OrdersRepository } from './repository';
import { API_URL, AuthError, POLL_MS, businessCode } from './config';
import type { Snapshot } from '../types';

let lastVersion: number | undefined;

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-business-code': businessCode.get() ?? '',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('offline');
  }
  if (res.status === 401) throw new AuthError('unauthorized');
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
  return data as T;
}

/** Live data: the cloud API (Supabase Edge Function) in front of Postgres + Rivhit. */
export const apiRepository: OrdersRepository = {
  async loadAll() {
    const snap = await call<Snapshot>('/snapshot');
    lastVersion = snap.version;
    return snap;
  },
  createOrder: (input, by) => call('/orders', { input, by }),
  setItemState: (itemId, state, by, quantityMissing) =>
    call(`/items/${encodeURIComponent(itemId)}/state`, { state, by, quantityMissing }),
  touchOrder: (orderId, by) => call(`/orders/${encodeURIComponent(orderId)}/touch`, { by }),
  reportIssue: (orderId, message, by) => call(`/orders/${encodeURIComponent(orderId)}/issues`, { message, by }),
  completeOrder: (orderId, by) => call(`/orders/${encodeURIComponent(orderId)}/complete`, { by }),
  markShipped: (orderId, by) => call(`/orders/${encodeURIComponent(orderId)}/ship`, { by }),
  acknowledgeAlert: (alertId) => call(`/alerts/${encodeURIComponent(alertId)}/ack`, {}),

  subscribe(onExternalChange) {
    let stopped = false;

    // Cheap check: only reload the full snapshot when the server's version moved.
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible' || !businessCode.get()) return;
      try {
        const { version } = await call<{ version: number }>('/version');
        if (version !== lastVersion) onExternalChange();
      } catch {
        // Offline for a moment — try again on the next tick.
      }
    };

    const timer = setInterval(check, POLL_MS);
    // A phone coming back from the pocket / lock screen reloads straight away.
    const onWake = () => document.visibilityState === 'visible' && onExternalChange();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
    };
  },
};
