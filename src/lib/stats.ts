import { DAY_MS, dayKey, fmtShortDay, startOfDay } from './format';
import type { Point } from '../components/charts';

/** Last n calendar days (oldest first), as {key,label,start}. */
export function lastDays(n: number) {
  const today = startOfDay();
  return Array.from({ length: n }, (_, i) => {
    const start = today - (n - 1 - i) * DAY_MS;
    return { key: dayKey(start), label: fmtShortDay(start), start };
  });
}

export function sumByDay<T extends { at: number }>(rows: T[], n: number, value: (r: T) => number): Point[] {
  const days = lastDays(n);
  const map: Record<string, number> = {};
  for (const r of rows) {
    const k = dayKey(r.at);
    map[k] = (map[k] || 0) + value(r);
  }
  return days.map((d) => ({ label: d.label, value: map[d.key] || 0 }));
}

export function sumByWeek<T extends { at: number }>(rows: T[], weeks: number, value: (r: T) => number): Point[] {
  const now = startOfDay();
  const out: Point[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = now - i * 7 * DAY_MS + DAY_MS;
    const start = end - 7 * DAY_MS;
    const label = new Date(start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    out.push({ label, value: rows.filter((r) => r.at >= start && r.at < end).reduce((s, r) => s + value(r), 0) });
  }
  return out;
}

export function sinceDays(n: number) {
  return startOfDay() - (n - 1) * DAY_MS;
}
