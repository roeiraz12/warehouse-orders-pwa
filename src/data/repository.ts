import type { Alert, ItemState, NewOrderInput, Order, OrderItem, Role, Snapshot } from '../types';
import { mockRepository } from './mockRepository';
import { apiRepository } from './apiRepository';
import { API_URL } from './config';

export { AuthError } from './config';

/**
 * The single seam between the UI and wherever orders live.
 *
 * Demo (no VITE_API_URL): `mockRepository` — seed data in this browser only.
 * Live (VITE_API_URL set): `apiRepository` — the cloud API, which imports orders
 *                          from Rivhit Online and shares state between all phones.
 */
export interface OrdersRepository {
  loadAll(): Promise<Snapshot>;
  createOrder(input: NewOrderInput, by: Role): Promise<Order>;
  setItemState(itemId: string, state: ItemState, by: Role, quantityMissing?: number): Promise<OrderItem>;
  /** "Update Order" — saves progress and records who touched it. */
  touchOrder(orderId: string, by: Role): Promise<void>;
  reportIssue(orderId: string, message: string, by: Role): Promise<Alert>;
  completeOrder(orderId: string, by: Role): Promise<Order>;
  markShipped(orderId: string, by: Role): Promise<Order>;
  acknowledgeAlert(alertId: string): Promise<void>;
  /** Fires when data changed elsewhere (another phone, a Rivhit import, another tab). */
  subscribe(onExternalChange: () => void): () => void;
  /** Demo only: wipe and re-seed. */
  reset?(): Promise<void>;
}

export const isLive = !!API_URL;
export const repository: OrdersRepository = isLive ? apiRepository : mockRepository;
