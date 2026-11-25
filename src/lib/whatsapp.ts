import type { Order, OrderItem } from '../types';
import { WHATSAPP_PHONE } from '../data/config';

/** The number staff say out loud: Rivhit's order number, or a short numeric tag for manual orders. */
export function orderNumber(order: Order): string {
  if (order.externalId) return order.externalId;
  return `ידנית-${String(Math.floor(new Date(order.createdAt).getTime() / 1000)).slice(-4)}`;
}

/** "חסר X ממוצר Y הזמנה ZZZZ של לקוח W" */
export function missingMessage(order: Order, item: OrderItem, quantity: number): string {
  const qty = item.unit ? `${quantity} ${item.unit}` : String(quantity);
  return `חסר ${qty} ממוצר ${item.name} הזמנה ${orderNumber(order)} של לקוח ${order.clientName}`;
}

/**
 * Opens WhatsApp with the message ready — the user only taps "send".
 * With VITE_WHATSAPP_PHONE set it goes straight to that chat; otherwise WhatsApp asks who to send to.
 */
export function whatsappLink(text: string): string {
  return `https://wa.me/${WHATSAPP_PHONE ?? ''}?text=${encodeURIComponent(text)}`;
}
