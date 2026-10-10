import { format, parseISO, formatDistanceToNow, differenceInCalendarDays } from "date-fns";

export const money = (n: number) =>
  n.toLocaleString("en-NZ", { style: "currency", currency: "NZD", minimumFractionDigits: 2 });

export const moneyShort = (n: number) =>
  n.toLocaleString("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 });

export function fmtDate(s?: string | null, pattern = "d MMM yyyy"): string {
  if (!s) return "—";
  try {
    return format(parseISO(s), pattern);
  } catch {
    return s;
  }
}

export function ago(s: string): string {
  try {
    return formatDistanceToNow(parseISO(s), { addSuffix: true });
  } catch {
    return s;
  }
}

// Days from `today` (server-anchored YYYY-MM-DD) until date `s`; null when no date.
export function daysUntil(s: string, today: string): number | null {
  if (!s) return null;
  return differenceInCalendarDays(parseISO(s), parseISO(today));
}

export function fmtTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function lineAmount(qty: number, price: number, discount: number) {
  return qty * price * (1 - discount / 100);
}

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
