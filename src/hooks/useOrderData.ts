import { useMemo } from 'react';
import { useOrders } from '../store/ordersStore';
import { isActive, sortOrders } from '../lib/orderRules';
import { countFilters, filterOrders, missingByProduct, type OrderFilter } from '../lib/managerView';
import type { Order, OrderItem } from '../types';

/** Items grouped by order id. */
export function useItemsByOrder(): Map<string, OrderItem[]> {
  const items = useOrders((s) => s.items);
  return useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    for (const it of items) {
      const list = map.get(it.orderId);
      if (list) list.push(it);
      else map.set(it.orderId, [it]);
    }
    return map;
  }, [items]);
}

export function useActiveOrders(): Order[] {
  const orders = useOrders((s) => s.orders);
  // Always newest order first.
  return useMemo(() => sortOrders(orders.filter(isActive), 'createdAt', 'desc'), [orders]);
}

export function useOrder(id: string | undefined) {
  const order = useOrders((s) => s.orders.find((o) => o.id === id));
  const allItems = useOrders((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => i.orderId === id), [allItems, id]);
  return { order, items };
}

/**
 * Notices for the manager that need a human: Rivhit cancelled an order, an order arrived without items.
 * "Missing item" alerts are left out — those go to the manager on WhatsApp.
 */
export function useManagerNotices() {
  const alerts = useOrders((s) => s.alerts);
  return useMemo(
    () =>
      alerts
        .filter((a) => !a.acknowledged && a.type !== 'missing_item')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [alerts],
  );
}

export function useManagerOverview() {
  const orders = useOrders((s) => s.orders);
  const itemsByOrder = useItemsByOrder();
  return useMemo(
    () => ({
      counts: countFilters(orders, itemsByOrder),
      shortages: missingByProduct(orders, itemsByOrder),
    }),
    [orders, itemsByOrder],
  );
}

export function useFilteredOrders(filter: OrderFilter) {
  const orders = useOrders((s) => s.orders);
  const itemsByOrder = useItemsByOrder();
  return useMemo(() => filterOrders(orders, itemsByOrder, filter), [orders, itemsByOrder, filter]);
}
