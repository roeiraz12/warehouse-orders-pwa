import type { Alert, ItemState, Order, OrderItem, Snapshot } from '../types';
import { addIsraeliBusinessDays } from '../lib/businessDays';

const HOUR = 3600_000;

interface SeedOrder {
  ref: string;
  client: string;
  supplier: string;
  hoursAgo: number;
  /** Override the deadline (hours from now) to demo overdue / near orders. */
  deadlineInHours?: number;
  status?: Order['status'];
  items: [name: string, qty: number, unit: string, state?: ItemState, missing?: number][];
}

const SEED: SeedOrder[] = [
  {
    ref: '10231', client: 'מכולת השכונה – רמת גן', supplier: 'תנובה', hoursAgo: 80, deadlineInHours: -24,
    items: [['חלב 3% קרטון 1 ליטר', 24, 'יח׳'], ['גבינה לבנה 5%', 12, 'יח׳'], ['יוגורט טבעי', 30, 'יח׳'], ['חמאה 200 גרם', 10, 'יח׳']],
  },
  {
    ref: '10235', client: 'סופר כהן ובניו', supplier: 'אסם', hoursAgo: 50, deadlineInHours: 6,
    items: [
      ['במבה 80 גרם', 10, 'קרטון', 'packed'],
      ['ביסלי גריל', 8, 'קרטון', 'packed'],
      ['פתיתים אפויים', 6, 'קרטון', 'missing', 2],
      ['קטשופ 750 גרם', 12, 'יח׳'],
      ['מרק עוף אבקה', 5, 'קרטון'],
    ],
  },
  {
    ref: '10240', client: 'מינימרקט הדקל', supplier: 'שטראוס', hoursAgo: 20,
    items: [['שוקולד פרה', 40, 'יח׳'], ['קפה עלית 200 גרם', 15, 'יח׳'], ['מילקי', 48, 'יח׳']],
  },
  {
    ref: '10244', client: 'קיוסק יוסי', supplier: 'קוקה קולה', hoursAgo: 6,
    items: [['קוקה קולה 1.5 ליטר', 6, 'שישייה'], ['ספרייט 1.5 ליטר', 4, 'שישייה'], ['מים מינרליים', 10, 'שישייה'], ['פיוז טי אפרסק', 3, 'שישייה']],
  },
  {
    ref: '10247', client: 'מעדניית גולן', supplier: 'זוגלובק', hoursAgo: 2,
    items: [['נקניק פסטרמה', 5, 'ק״ג'], ['נקניקיות', 20, 'אריזה'], ['שניצל תירס', 10, 'אריזה']],
  },
  {
    ref: '10220', client: 'סופר דוד', supplier: 'תנובה', hoursAgo: 30, status: 'ready_to_ship',
    items: [['קוטג׳ 5%', 20, 'יח׳', 'packed'], ['שמנת חמוצה', 10, 'יח׳', 'packed']],
  },
  {
    ref: '10218', client: 'מכולת רחל', supplier: 'אסם', hoursAgo: 40, status: 'ready_to_ship',
    items: [['ביסלי בצל', 6, 'קרטון', 'packed'], ['במבה נוגט', 4, 'קרטון', 'packed']],
  },
];

export function buildSeed(now = new Date()): Pick<Snapshot, 'orders' | 'items' | 'alerts' | 'logs'> {
  const orders: Order[] = [];
  const items: OrderItem[] = [];
  const alerts: Alert[] = [];

  for (const s of SEED) {
    const createdAt = new Date(now.getTime() - s.hoursAgo * HOUR);
    const deadline = s.deadlineInHours !== undefined
      ? new Date(now.getTime() + s.deadlineInHours * HOUR)
      : addIsraeliBusinessDays(createdAt, 3);
    const orderId = `ord_${s.ref}`;
    const anyTouched = s.items.some(([, , , st]) => st && st !== 'pending');
    const done = s.status === 'ready_to_ship';

    orders.push({
      id: orderId,
      externalId: s.ref,
      source: 'rivahit',
      clientName: s.client,
      supplierName: s.supplier,
      createdAt: createdAt.toISOString(),
      deliveryDeadline: deadline.toISOString(),
      businessDaysToDeliver: 3,
      status: s.status ?? (anyTouched ? 'in_progress' : 'new'),
      completedAt: done ? new Date(now.getTime() - 2 * HOUR).toISOString() : undefined,
      completedBy: done ? 'employee' : undefined,
      updatedAt: createdAt.toISOString(),
    });

    s.items.forEach(([name, qty, unit, state = 'pending', missing], idx) => {
      const itemId = `${orderId}_i${idx}`;
      items.push({
        id: itemId, orderId, name, quantityOrdered: qty, unit, state,
        quantityMissing: state === 'missing' ? missing ?? qty : undefined,
        updatedAt: createdAt.toISOString(),
      });
      if (state === 'missing') {
        alerts.push({
          id: `al_${itemId}`, orderId, itemId, type: 'missing_item',
          message: `חסר: ${name} — ${missing ?? qty} ${unit} מתוך ${qty}`,
          createdAt: new Date(now.getTime() - HOUR).toISOString(),
          createdBy: 'employee', acknowledged: false,
        });
      }
    });
  }

  return { orders, items, alerts, logs: [] };
}
