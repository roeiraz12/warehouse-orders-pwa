import { describe, expect, it } from 'vitest';
import { missingMessage, orderNumber, whatsappLink } from './whatsapp';
import type { Order, OrderItem } from '../types';

const order: Order = {
  id: 'ord_1', externalId: '10235', source: 'rivahit', clientName: 'סופר כהן ובניו',
  createdAt: '2026-10-08T11:30:00.000Z', deliveryDeadline: '2026-10-13T11:30:00.000Z',
  businessDaysToDeliver: 3, status: 'in_progress', updatedAt: '',
};
const item: OrderItem = { id: 'i', orderId: 'ord_1', name: 'פתיתים אפויים', quantityOrdered: 6, unit: 'קרטון', state: 'pending', updatedAt: '' };

describe('WhatsApp missing-item message', () => {
  it('follows the template "חסר X ממוצר Y הזמנה ZZZZ של לקוח W"', () => {
    expect(missingMessage(order, item, 2)).toBe('חסר 2 קרטון ממוצר פתיתים אפויים הזמנה 10235 של לקוח סופר כהן ובניו');
  });

  it('works without a unit', () => {
    expect(missingMessage(order, { ...item, unit: undefined }, 3)).toBe('חסר 3 ממוצר פתיתים אפויים הזמנה 10235 של לקוח סופר כהן ובניו');
  });

  it('gives manual orders a short numeric tag', () => {
    expect(orderNumber({ ...order, externalId: undefined })).toMatch(/^ידנית-\d{4}$/);
  });

  it('builds a wa.me link with the encoded text', () => {
    const url = whatsappLink('חסר 2');
    // Goes to the configured manager number (VITE_WHATSAPP_PHONE), or lets WhatsApp ask when unset.
    expect(url).toMatch(/^https:\/\/wa\.me\/(\d+)?\?text=/);
    expect(decodeURIComponent(url.split('text=')[1])).toBe('חסר 2');
  });
});
