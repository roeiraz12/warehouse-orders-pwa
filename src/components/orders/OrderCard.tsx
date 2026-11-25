import { Link } from 'react-router-dom';
import type { Order, OrderItem } from '../../types';
import { deadlineStatus, progressOf } from '../../lib/orderRules';
import { DeadlineBadge } from '../ui/StatusBadge';
import { he } from '../../i18n/he';

/** Coloured stripe on the leading edge shows urgency at a glance. */
const STRIPE = { overdue: 'border-s-bad', near: 'border-s-warn-bar', ok: 'border-s-ok' } as const;

export function OrderCard({ order, items }: { order: Order; items: OrderItem[] }) {
  const p = progressOf(items);
  const done = p.packed + p.missing;
  const pct = p.total ? Math.round((done / p.total) * 100) : 0;

  return (
    <Link
      to={`/orders/${order.id}`}
      className={`flex items-center gap-3 rounded-2xl border-2 border-s-[10px] border-slate-200 bg-white px-3 py-3 shadow-sm active:bg-slate-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-400 ${STRIPE[deadlineStatus(order)]}`}
      aria-label={`${order.clientName} – ${he.list.open}`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="text-xl font-extrabold leading-tight text-slate-900">{order.clientName}</h2>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <DeadlineBadge order={order} />
          <span className="text-sm text-slate-700">{he.list.progress(done, p.total)}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
        </div>
        {p.missing > 0 && (
          <p className="text-sm font-bold text-bad">
            <span aria-hidden="true">✗ </span>
            {he.list.missingCount(p.missing)}
          </p>
        )}
      </div>
      <span aria-hidden="true" className="shrink-0 text-3xl font-bold text-brand">‹</span>
    </Link>
  );
}
