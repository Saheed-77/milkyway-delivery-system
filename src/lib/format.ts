/**
 * Formatting helpers. All money is INR and formatted for en-IN (lakh
 * grouping). Dates are handled in the *local* timezone: never use
 * `toISOString().split("T")[0]`, which shifts IST dates back a day.
 */
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCurrency = (value: number | null | undefined): string =>
  inr.format(Number(value) || 0);

export const formatCurrencyCompact = (value: number | null | undefined): string =>
  inrCompact.format(Number(value) || 0);

/** Plain-ASCII money for PDFs (the built-in PDF fonts have no rupee glyph). */
export const formatCurrencyPdf = (value: number | null | undefined): string =>
  `Rs. ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)}`;

export const round2 = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

export const formatLiters = (value: number | null | undefined, digits = 2): string => {
  const n = Number(value) || 0;
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(n)} L`;
};

export const formatNumber = (value: number | null | undefined, digits = 0): string =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number(value) || 0);

export const formatPercent = (value: number, digits = 0): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;

/** Percentage change that is well-defined when the previous value is 0. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD in the local timezone. */
export function toLocalISODate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse YYYY-MM-DD as a local date (not UTC midnight). */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfLocalDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const toDate = (value: string | Date) =>
  value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseLocalDate(value)
      : new Date(value);

export const formatDate = (value: string | Date | null | undefined): string =>
  value
    ? toDate(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

export const formatShortDate = (value: string | Date | null | undefined): string =>
  value ? toDate(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

export const formatDateTime = (value: string | Date | null | undefined): string =>
  value
    ? toDate(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export const formatTime = (value: string | Date | null | undefined): string =>
  value ? toDate(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—";

export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const diff = (now.getTime() - toDate(value).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return formatDate(value);
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return "< 1 min";
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export const fullName = (
  p: { first_name?: string | null; last_name?: string | null } | null | undefined
) => [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || "Unnamed";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export const MILK_LABELS: Record<string, string> = {
  cow: "Cow milk",
  buffalo: "Buffalo milk",
  goat: "Goat milk",
};
