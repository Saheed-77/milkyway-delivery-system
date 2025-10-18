/**
 * Small, dependency-free aggregation helpers for dashboard charts. Buckets are
 * built from local dates so every day in the window appears (zero-filled)
 * instead of only days that happen to have data.
 */
import { addDays, formatShortDate, round2, startOfLocalDay, toLocalISODate } from "./format";

export interface Point {
  key: string;
  label: string;
  [series: string]: number | string;
}

const dayKey = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toLocalISODate(new Date(value)));

/** One bucket per day for the last `days` days (oldest first). */
export function dailyBuckets<T>(
  days: number,
  rows: T[],
  dateOf: (row: T) => string | null | undefined,
  series: Record<string, (row: T) => number>,
  end: Date = new Date()
): Point[] {
  const last = startOfLocalDay(end);
  const buckets = new Map<string, Point>();
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(last, -i);
    const key = toLocalISODate(d);
    const point: Point = { key, label: formatShortDate(d) };
    for (const s of Object.keys(series)) point[s] = 0;
    buckets.set(key, point);
  }
  for (const row of rows) {
    const raw = dateOf(row);
    if (!raw) continue;
    const point = buckets.get(dayKey(raw));
    if (!point) continue;
    for (const [s, fn] of Object.entries(series)) point[s] = round2((point[s] as number) + fn(row));
  }
  return [...buckets.values()];
}

/** Monday-start week key. */
export function weekStart(date: Date): Date {
  const d = startOfLocalDay(date);
  const dow = (d.getDay() + 6) % 7;
  return addDays(d, -dow);
}

/** One bucket per week for the last `weeks` weeks (oldest first). */
export function weeklyBuckets<T>(
  weeks: number,
  rows: T[],
  dateOf: (row: T) => string | null | undefined,
  series: Record<string, (row: T) => number>,
  end: Date = new Date()
): Point[] {
  const current = weekStart(end);
  const buckets = new Map<string, Point>();
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    const key = toLocalISODate(start);
    const point: Point = { key, label: formatShortDate(start) };
    for (const s of Object.keys(series)) point[s] = 0;
    buckets.set(key, point);
  }
  for (const row of rows) {
    const raw = dateOf(row);
    if (!raw) continue;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
    const point = buckets.get(toLocalISODate(weekStart(d)));
    if (!point) continue;
    for (const [s, fn] of Object.entries(series)) point[s] = round2((point[s] as number) + fn(row));
  }
  return [...buckets.values()];
}

export const sum = <T,>(rows: T[], fn: (r: T) => number) => round2(rows.reduce((s, r) => s + (fn(r) || 0), 0));

/** Sum of a window [fromDaysAgo, toDaysAgo) — used for "this week vs last week" deltas. */
export function windowSum<T>(rows: T[], dateOf: (r: T) => string | null | undefined, value: (r: T) => number, fromDaysAgo: number, toDaysAgo: number) {
  const today = startOfLocalDay();
  const from = toLocalISODate(addDays(today, -fromDaysAgo + 1));
  const to = toLocalISODate(addDays(today, -toDaysAgo));
  return sum(
    rows.filter((r) => {
      const raw = dateOf(r);
      if (!raw) return false;
      const k = dayKey(raw);
      return k >= from && k <= to;
    }),
    value
  );
}

export function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    const k = key(r);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}
