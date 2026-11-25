import { useOrders } from '../../store/ordersStore';
import { he } from '../../i18n/he';

/** Red bar at the bottom whenever a save or load failed — nobody should think a tap "went through" when it didn't. */
export function ConnectionBanner() {
  const error = useOrders((s) => s.error);
  const load = useOrders((s) => s.load);
  if (!error) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-[55] mx-auto max-w-md bg-bad px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-white shadow-2xl"
    >
      <p className="mb-3 text-xl font-bold">⚠ {he.connection.offline}</p>
      <button
        type="button"
        onClick={() => void load()}
        className="min-h-touch w-full rounded-2xl bg-white text-xl font-extrabold text-bad active:scale-[0.98]"
      >
        {he.connection.retry}
      </button>
    </div>
  );
}
