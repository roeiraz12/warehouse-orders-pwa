import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { NewOrderFab } from '../../components/ui/NewOrderFab';
import { useManagerNotices, useManagerOverview } from '../../hooks/useOrderData';
import { useOrders } from '../../store/ordersStore';
import { isLive } from '../../data/repository';
import { STAGES, type OrderFilter } from '../../lib/managerView';
import { he } from '../../i18n/he';

/** Live mode only: loud warning when orders stop flowing in from Rivhit. */
function SyncWarning() {
  const sync = useOrders((s) => s.sync);
  if (!isLive || !sync?.enabled) return null;
  if (sync?.lastError) {
    return (
      <div role="alert" className="space-y-1 rounded-2xl border-2 border-bad bg-bad-soft p-3 text-bad-ink">
        <p className="text-lg font-extrabold">⚠ {he.sync.error}</p>
        <p className="text-sm">
          {he.sync.errorHint} <span dir="ltr">{sync.lastError}</span>
        </p>
      </div>
    );
  }
  if (!sync?.lastSuccessAt) {
    return <p className="rounded-2xl bg-warn-soft p-3 text-base font-bold text-warn-ink">⏳ {he.sync.never}</p>;
  }
  return null;
}

const SectionTitle = ({ children, hint }: { children: string; hint?: string }) => (
  <div className="mb-2">
    <h2 className="text-xl font-extrabold leading-tight text-slate-900">{children}</h2>
    {hint && <p className="text-sm text-slate-500">{hint}</p>}
  </div>
);

const ATTENTION_STYLE: Record<'late' | 'soon' | 'missing', { icon: string; on: string }> = {
  late: { icon: '⚠', on: 'border-bad bg-bad text-white' },
  soon: { icon: '⏰', on: 'border-warn-bar bg-warn-bar text-warn-ink' },
  missing: { icon: '✗', on: 'border-bad bg-bad-soft text-bad-ink' },
};

const STAGE_STYLE: Record<OrderFilter, string> = {
  new: 'bg-slate-500',
  picking: 'bg-warn-bar text-warn-ink',
  ready: 'bg-brand',
  shipped: 'bg-ok',
  late: '', soon: '', missing: '',
};

export function ManagerDashboardScreen() {
  const { counts, shortages } = useManagerOverview();
  const notices = useManagerNotices();
  const orders = useOrders((s) => s.orders);
  const { acknowledgeAlert, resetDemo } = useOrders();
  const clientOf = (orderId: string) => orders.find((o) => o.id === orderId)?.clientName ?? '';
  const attentionTotal = counts.late + counts.soon + counts.missing;

  return (
    <>
      <ScreenHeader title={he.manager.title} />
      <main className="space-y-6 px-3 pb-28 pt-3">
        <SyncWarning />

        {/* Things only a person can resolve: Rivhit cancellations, orders without items */}
        {notices.length > 0 && (
          <section>
            <SectionTitle>{he.manager.notices}</SectionTitle>
            <ul className="space-y-2">
              {notices.map((a) => (
                <li key={a.id} className="space-y-2 rounded-2xl border-2 border-bad bg-bad-soft p-3">
                  <p className="text-lg font-extrabold text-slate-900">{clientOf(a.orderId)}</p>
                  <p className="text-base text-bad-ink">⚠ {a.message}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => acknowledgeAlert(a.id).catch(() => {})}
                      className="min-h-12 rounded-xl bg-ok text-lg font-bold text-white active:scale-[0.98]"
                    >
                      {he.manager.ack}
                    </button>
                    <Link
                      to={`/orders/${a.orderId}`}
                      className="flex min-h-12 items-center justify-center rounded-xl border-2 border-brand bg-white text-lg font-bold text-brand"
                    >
                      {he.manager.openOrder}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Needs attention */}
        <section>
          <SectionTitle>{he.manager.attention}</SectionTitle>
          {attentionTotal === 0 ? (
            <p className="rounded-2xl border-2 border-ok bg-ok-soft p-3 text-lg font-bold text-ok-ink">✓ {he.manager.allGood}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(['late', 'soon', 'missing'] as const).map((f) => {
                const n = counts[f];
                const s = ATTENTION_STYLE[f];
                const body = (
                  <>
                    <span className="text-3xl font-extrabold leading-none">{n}</span>
                    <span className="mt-1 text-sm font-bold leading-tight">
                      <span aria-hidden="true">{s.icon} </span>
                      {he.manager.filters[f]}
                    </span>
                  </>
                );
                const cls = 'flex min-h-[88px] flex-col items-center justify-center rounded-2xl border-2 p-2 text-center';
                return n > 0 ? (
                  <Link key={f} to={`/manager/orders/${f}`} className={`${cls} ${s.on} active:scale-[0.97]`}>
                    {body}
                  </Link>
                ) : (
                  <div key={f} className={`${cls} border-slate-200 bg-white text-slate-400`}>{body}</div>
                );
              })}
            </div>
          )}
        </section>

        {/* The pipeline: new → picking → ready → shipped */}
        <section>
          <SectionTitle>{he.manager.pipeline}</SectionTitle>
          <ol className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white">
            {STAGES.map((stage, i) => (
              <li key={stage} className={i > 0 ? 'border-t border-slate-200' : ''}>
                <Link to={`/manager/orders/${stage}`} className="flex min-h-[64px] items-center gap-3 px-3 py-2 active:bg-slate-50">
                  <span
                    aria-hidden="true"
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white ${STAGE_STYLE[stage]}`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold leading-tight text-slate-900">{he.manager.filters[stage]}</span>
                    <span className="block text-sm leading-tight text-slate-500">{he.manager.stageHints[stage as keyof typeof he.manager.stageHints]}</span>
                  </span>
                  <span className="text-3xl font-extrabold text-slate-900">{counts[stage]}</span>
                  <span aria-hidden="true" className="text-2xl font-bold text-brand">‹</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* What has to be sourced */}
        <section>
          <SectionTitle hint={he.manager.shortagesHint}>{he.manager.shortages}</SectionTitle>
          {shortages.length === 0 ? (
            <p className="rounded-2xl bg-white p-3 text-lg text-slate-500">✓ {he.manager.noShortages}</p>
          ) : (
            <ul className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white">
              {shortages.map((s, i) => (
                <li key={`${s.name}|${s.unit}`} className={`flex items-center gap-3 px-3 py-2 ${i > 0 ? 'border-t border-slate-200' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold leading-tight text-slate-900">{s.name}</span>
                    <span className="block text-sm text-slate-500">{he.manager.inOrders(s.orders)}</span>
                  </span>
                  <span className="shrink-0 text-lg font-extrabold text-bad">
                    {s.quantity} {s.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!isLive && (
          <button
            type="button"
            className="min-h-touch w-full rounded-2xl text-base text-slate-500 underline"
            onClick={() => window.confirm(he.manager.resetConfirm) && resetDemo()}
          >
            {he.manager.resetDemo}
          </button>
        )}
      </main>

      <NewOrderFab />
    </>
  );
}
