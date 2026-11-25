import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { OrderCard } from '../../components/orders/OrderCard';
import { useToast } from '../../components/ui/Toast';
import { useFilteredOrders, useItemsByOrder } from '../../hooks/useOrderData';
import { useOrders } from '../../store/ordersStore';
import { isOrderFilter } from '../../lib/managerView';
import { progressOf } from '../../lib/orderRules';
import type { Order, OrderItem } from '../../types';
import { he } from '../../i18n/he';

/** A packed order: what went in, and (when ready) the button that closes the loop. */
function PackedOrderRow({ order, items, canShip }: { order: Order; items: OrderItem[]; canShip: boolean }) {
  const markShipped = useOrders((s) => s.markShipped);
  const showToast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);
  const p = progressOf(items);

  return (
    <div className={`flex items-center gap-3 rounded-2xl border-2 border-s-[10px] bg-white px-3 py-3 ${canShip ? 'border-slate-200 border-s-brand' : 'border-slate-200 border-s-ok'}`}>
      <Link to={`/orders/${order.id}`} className="min-w-0 flex-1">
        <span className="block text-xl font-extrabold leading-tight text-slate-900">{order.clientName}</span>
        <span className={`block text-sm ${p.missing > 0 ? 'font-bold text-bad' : 'text-slate-600'}`}>
          {he.manager.itemsSummary(p.packed, p.missing)}
        </span>
      </Link>
      {canShip ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await markShipped(order.id);
              showToast(he.manager.shippedToast);
            } catch {
              // The red connection banner explains what went wrong.
            } finally {
              setBusy(false);
            }
          }}
          className="min-h-touch shrink-0 rounded-xl bg-ok px-3 text-base font-extrabold text-white active:scale-[0.97] disabled:opacity-40"
        >
          🚚 {he.manager.markShipped}
        </button>
      ) : (
        <span className="shrink-0 text-base font-bold text-ok">✓ {he.manager.filters.shipped}</span>
      )}
    </div>
  );
}

/** One pipeline stage or attention bucket, opened from the manager dashboard. */
export function ManagerOrdersScreen() {
  const { filter } = useParams();
  const valid = isOrderFilter(filter);
  const orders = useFilteredOrders(valid ? filter : 'new');
  const itemsByOrder = useItemsByOrder();

  if (!valid) return <Navigate to="/manager" replace />;
  const packed = filter === 'ready' || filter === 'shipped';

  return (
    <>
      <ScreenHeader title={`${he.manager.filters[filter]} (${orders.length})`} backTo="/manager" />
      <main className="space-y-3 px-3 pb-10 pt-3">
        {orders.length === 0 && <p className="rounded-2xl bg-white p-4 text-lg text-slate-500">{he.manager.emptyFilter}</p>}
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              {packed || o.status === 'ready_to_ship' ? (
                <PackedOrderRow order={o} items={itemsByOrder.get(o.id) ?? []} canShip={o.status === 'ready_to_ship'} />
              ) : (
                <OrderCard order={o} items={itemsByOrder.get(o.id) ?? []} />
              )}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
