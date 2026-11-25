import type { Order } from '../../types';
import { daysLeft, deadlineStatus, type DeadlineStatus } from '../../lib/orderRules';
import { he } from '../../i18n/he';

const STYLES: Record<DeadlineStatus, { cls: string; icon: string }> = {
  overdue: { cls: 'bg-bad text-white', icon: '⚠' },
  near: { cls: 'bg-warn-bar text-warn-ink', icon: '⏰' },
  ok: { cls: 'bg-ok-soft text-ok-ink', icon: '✓' },
};

/** "עוד X ימים לאספקה" — colour is always paired with an icon and words (colour-blind safe). */
export function DeadlineBadge({ order }: { order: Order }) {
  const s = STYLES[deadlineStatus(order)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-bold ${s.cls}`}>
      <span aria-hidden="true">{s.icon}</span>
      {he.deadline.daysLeft(daysLeft(order))}
    </span>
  );
}
