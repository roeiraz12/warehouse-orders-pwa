import { useState } from 'react';

interface Props {
  value: number;
  min: number;
  max?: number;
  onChange: (v: number) => void;
  label: string;
  plusLabel: string;
  minusLabel: string;
}

/** Big − [ value ] + control. The number can also be typed with the phone keyboard. */
export function NumberStepper({ value, min, max, onChange, label, plusLabel, minusLabel }: Props) {
  const clamp = (v: number) => Math.max(min, max !== undefined ? Math.min(max, v) : v);
  // While typing we keep the raw text, so the field can be empty for a moment without snapping back.
  const [draft, setDraft] = useState<string | null>(null);
  // +/− always win over half-typed text (on iPhone, tapping a button doesn't blur the field).
  const step = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta));
  };
  const btn =
    'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-4xl font-extrabold text-slate-900 active:bg-slate-300 disabled:opacity-30';

  return (
    <div className="flex items-center justify-between gap-3" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label={plusLabel} disabled={max !== undefined && value >= max} onClick={() => step(1)}>
        +
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        aria-label={label}
        value={draft ?? String(value)}
        onFocus={(e) => {
          setDraft(String(value));
          e.target.select(); // typing replaces the number instead of adding to it
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
          setDraft(digits);
          const n = parseInt(digits, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-16 w-full min-w-0 rounded-2xl border-4 border-slate-300 bg-white text-center text-4xl font-extrabold text-slate-900 focus:border-brand focus:outline-none"
      />
      <button type="button" className={btn} aria-label={minusLabel} disabled={value <= min} onClick={() => step(-1)}>
        −
      </button>
    </div>
  );
}
