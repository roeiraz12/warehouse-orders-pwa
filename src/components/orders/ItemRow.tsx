import type { OrderItem } from '../../types';
import { he } from '../../i18n/he';

interface Props {
  item: OrderItem;
  disabled?: boolean;
  onPacked: () => void;
  onMissing: () => void;
  /** Tapping the already-selected button asks to undo. */
  onUndo: () => void;
}

const ROW = {
  pending: 'border-slate-200 bg-white',
  packed: 'border-ok bg-ok-soft',
  missing: 'border-bad bg-bad-soft',
} as const;

/** One line per item: name + quantity, with the two action buttons beside it. */
export function ItemRow({ item, disabled, onPacked, onMissing, onUndo }: Props) {
  const isPacked = item.state === 'packed';
  const isMissing = item.state === 'missing';
  const btn =
    'flex h-16 w-[68px] shrink-0 flex-col items-center justify-center rounded-xl border-[3px] text-base font-extrabold leading-tight active:scale-[0.96] disabled:opacity-40';

  return (
    <li className={`flex items-center gap-2 rounded-2xl border-2 py-2 pe-2 ps-3 ${ROW[item.state]}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-lg font-bold leading-snug ${isPacked ? 'text-slate-500 line-through decoration-ok decoration-2' : 'text-slate-900'}`}>
          {item.name}
        </p>
        <p className="text-base text-slate-700">
          {he.checklist.qty} <span className="text-xl font-extrabold text-slate-900">{item.quantityOrdered}</span> {item.unit}
        </p>
        {isMissing && (
          <p className="text-sm font-bold text-bad">
            <span aria-hidden="true">✗ </span>
            {he.checklist.statusMissing(item.quantityMissing ?? item.quantityOrdered, item.unit)}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={disabled}
        aria-pressed={isPacked}
        aria-label={`${he.checklist.packed} – ${item.name}`}
        onClick={isPacked ? onUndo : onPacked}
        className={`${btn} ${isPacked ? 'border-ok bg-ok text-white' : 'border-ok bg-white text-ok-ink'}`}
      >
        <span aria-hidden="true" className="text-2xl leading-none">✓</span>
        {he.checklist.packed}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isMissing}
        aria-label={`${he.checklist.missing} – ${item.name}`}
        onClick={isMissing ? onUndo : onMissing}
        className={`${btn} ${isMissing ? 'border-bad bg-bad text-white' : 'border-bad bg-white text-bad-ink'}`}
      >
        <span aria-hidden="true" className="text-2xl leading-none">✗</span>
        {he.checklist.missing}
      </button>
    </li>
  );
}
