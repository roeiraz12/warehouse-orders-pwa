import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { NewOrderFab } from '../../components/ui/NewOrderFab';
import { OrderCard } from '../../components/orders/OrderCard';
import { useActiveOrders, useItemsByOrder } from '../../hooks/useOrderData';
import { useSession } from '../../store/sessionStore';
import { he } from '../../i18n/he';

export function ActiveOrdersScreen() {
  const orders = useActiveOrders();
  const itemsByOrder = useItemsByOrder();
  const isManager = useSession((s) => s.role === 'manager');

  return (
    <>
      <ScreenHeader title={`${he.list.title} (${orders.length})`} backTo={isManager ? '/manager' : undefined} />
      {/* Bottom padding keeps the last card clear of the floating button. */}
      <main className="space-y-3 px-3 pb-28 pt-3">
        {orders.length === 0 ? (
          <div className="rounded-2xl border-2 border-ok bg-ok-soft p-6 text-center">
            <p aria-hidden="true" className="text-4xl">✓</p>
            <p className="mt-2 text-xl font-bold text-ok-ink">{he.list.empty}</p>
            <p className="mt-1 text-base text-ok-ink">{he.list.emptyHint}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} items={itemsByOrder.get(o.id) ?? []} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <NewOrderFab />
    </>
  );
}
