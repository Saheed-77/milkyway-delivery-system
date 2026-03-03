/**
 * Delivery windows and subscription schedules. Pure functions shared by the
 * demo backend and the UI so both agree on what is bookable and when a
 * subscription delivers. The live database mirrors these rules in SQL.
 */
import { addDays, parseLocalDate, toLocalISODate } from "./format";

/** Default daily windows; slots are created on demand from these. */
export const DEFAULT_WINDOWS: { start: string; end: string }[] = [
  { start: "06:00", end: "08:00" },
  { start: "08:00", end: "10:00" },
  { start: "17:00", end: "19:00" },
  { start: "19:00", end: "21:00" },
];
export const DEFAULT_SLOT_CAPACITY = 25;
/** A slot stops taking orders this many minutes before it starts. */
export const SLOT_CUTOFF_MIN = 30;
/** Slots can be booked for today plus this many days ahead. */
export const SLOT_DAYS_AHEAD = 3;
/** Skips/vacations can be planned this far ahead. */
export const MAX_SKIP_AHEAD_DAYS = 90;
export const MAX_VACATION_DAYS = 60;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Local Date for a slot's start. */
export function slotStartDate(date: string, start: string): Date {
  const d = parseLocalDate(date);
  d.setMinutes(toMinutes(start));
  return d;
}

/** True once the booking cutoff for the slot has passed. */
export function isSlotClosed(date: string, start: string, now: Date = new Date()): boolean {
  return slotStartDate(date, start).getTime() - SLOT_CUTOFF_MIN * 60_000 <= now.getTime();
}

const fmt12 = (hhmm: string) => {
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
};

/** "6 – 8 AM" / "5 – 7 PM" */
export function windowLabel(start: string, end: string): string {
  const s = fmt12(start);
  const e = fmt12(end);
  const [sv, ss] = s.split(" ");
  const [ev, es] = e.split(" ");
  return ss === es ? `${sv} – ${ev} ${es}` : `${s} – ${e}`;
}

/** "Today", "Tomorrow", or "Sat, 2 May" */
export function dayLabel(date: string, today: string = toLocalISODate()): string {
  if (date === today) return "Today";
  if (date === toLocalISODate(addDays(parseLocalDate(today), 1))) return "Tomorrow";
  return parseLocalDate(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function slotLabel(slot: { date: string; start: string; end: string } | null | undefined): string {
  if (!slot) return "Express · within the hour";
  return `${dayLabel(slot.date)} · ${windowLabel(slot.start, slot.end)}`;
}

/** Morning or evening, for icons and grouping. */
export const isMorning = (start: string) => toMinutes(start) < 12 * 60;

/* ---------------------------------------------------------------- subscriptions */

export interface ScheduleSubscription {
  frequency: "daily" | "weekly" | "monthly";
  created_at: string;
  status: "active" | "paused" | "cancelled";
}

/** Whether a subscription is due on a date (ignoring skips and status). */
export function isDueOn(sub: Pick<ScheduleSubscription, "frequency" | "created_at">, date: string): boolean {
  const d = parseLocalDate(date);
  const start = new Date(sub.created_at);
  if (toLocalISODate(d) < toLocalISODate(start)) return false;
  if (sub.frequency === "daily") return true;
  if (sub.frequency === "weekly") return d.getDay() === start.getDay();
  // monthly: same day of month, clamped to the month's last day
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === Math.min(start.getDate(), last);
}

export interface ScheduleDay {
  date: string;
  due: boolean;
  skipped: boolean;
}

/** Next `days` days from `from` with due/skipped flags. */
export function subscriptionSchedule(
  sub: ScheduleSubscription,
  skipDates: string[],
  from: string = toLocalISODate(),
  days = 14
): ScheduleDay[] {
  const skips = new Set(skipDates);
  const start = parseLocalDate(from);
  return Array.from({ length: days }, (_, i) => {
    const date = toLocalISODate(addDays(start, i));
    return { date, due: sub.status !== "cancelled" && isDueOn(sub, date), skipped: skips.has(date) };
  });
}

/** First due, non-skipped date on or after `from` (searching up to 120 days). */
export function nextDeliveryDate(sub: ScheduleSubscription, skipDates: string[], from: string = toLocalISODate()): string | null {
  if (sub.status !== "active") return null;
  const day = subscriptionSchedule(sub, skipDates, from, 120).find((d) => d.due && !d.skipped);
  return day?.date ?? null;
}

/** Inclusive list of dates between two YYYY-MM-DD values. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let d = parseLocalDate(from);
  const end = parseLocalDate(to);
  while (d <= end && out.length < 400) {
    out.push(toLocalISODate(d));
    d = addDays(d, 1);
  }
  return out;
}

/** The current vacation (contiguous skipped run that includes today/tomorrow), if any. */
export function activeVacation(skipDates: string[], today: string = toLocalISODate()): { from: string; to: string } | null {
  const skips = new Set(skipDates);
  const tomorrow = toLocalISODate(addDays(parseLocalDate(today), 1));
  const anchor = skips.has(today) ? today : skips.has(tomorrow) ? tomorrow : null;
  if (!anchor) return null;
  let end = parseLocalDate(anchor);
  while (skips.has(toLocalISODate(addDays(end, 1)))) end = addDays(end, 1);
  const to = toLocalISODate(end);
  return to === anchor ? null : { from: anchor, to }; // a single day is a skip, not a vacation
}
