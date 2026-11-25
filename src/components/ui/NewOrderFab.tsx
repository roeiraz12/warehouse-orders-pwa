import { useNavigate } from 'react-router-dom';
import { he } from '../../i18n/he';

/** Floating "new order" button — bottom right, always reachable, never pushes content down. */
export function NewOrderFab() {
  const navigate = useNavigate();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md justify-start px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={() => navigate('/orders/new')}
        className="pointer-events-auto min-h-touch rounded-full bg-brand px-6 text-lg font-extrabold text-white shadow-xl active:scale-[0.97] focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-400"
      >
        {he.list.newOrder}
      </button>
    </div>
  );
}
