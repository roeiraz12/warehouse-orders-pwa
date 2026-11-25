// Israeli work week: Sunday–Thursday. Friday and Saturday are the weekend.
// Weekdays are always judged on the Israeli calendar, so this gives the same
// answer on a phone in Israel and on a cloud server running in UTC.

const ZONE = 'Asia/Jerusalem';

const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short' });
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

export function isIsraeliBusinessDay(date: Date): boolean {
  const wd = weekdayFmt.format(date);
  return wd !== 'Fri' && wd !== 'Sat';
}

/**
 * Adds `days` Israeli business days to `from`, keeping the time of day.
 * An order placed on a weekend starts counting from the next business day.
 */
export function addIsraeliBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    result.setTime(result.getTime() + 86_400_000);
    if (isIsraeliBusinessDay(result)) remaining--;
  }
  return result;
}

/** The Israeli calendar date of an instant, as noon UTC on that date. */
function israeliDay(d: Date): Date {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 12));
}

/**
 * Whole Israeli business days from `from` until `to`, by Israeli calendar date (time ignored).
 * 0 = due today, negative = overdue by that many business days.
 * A future date always counts as at least 1, even if it falls on a weekend.
 */
export function businessDaysUntil(to: Date, from: Date = new Date()): number {
  const a = israeliDay(from);
  const b = israeliDay(to);
  if (a.getTime() === b.getTime()) return 0;
  const forward = b > a;
  const [start, end] = forward ? [a, b] : [b, a];
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    // Noon UTC is the same calendar day in Israel, so the weekday check is exact.
    if (isIsraeliBusinessDay(cur)) count++;
  }
  return forward ? Math.max(1, count) : -Math.max(1, count);
}

/** Minutes Israel is ahead of UTC at the given instant (120 or 180). */
function israelOffsetMinutes(at: Date): number {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** Converts an Israeli wall-clock time (as written in Rivhit) to a real instant. */
export function fromIsraeliWallClock(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = israelOffsetMinutes(new Date(guess - 2 * 3_600_000));
  return new Date(guess - offset * 60_000);
}
