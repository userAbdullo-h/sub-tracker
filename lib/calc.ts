import type { Subscription } from "./types";

export const fmtMoney = (n: number | null | undefined) =>
  n == null ? "?" : "$" + Number(n).toFixed(2);

export const cycleName = (m: number) =>
  ({ 1: "monthly", 3: "every 3 mo", 6: "every 6 mo", 12: "yearly", 14: "every 14 mo", 24: "every 2 yr" } as Record<number, string>)[m] ?? `every ${m} mo`;

export function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function monthlyCost(s: Subscription): number {
  if (s.price == null || s.status === "canceled") return 0;
  return s.price / s.cycleMonths;
}

export function advanceDate(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + months);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dashboardStats(subs: Subscription[]) {
  const active = subs.filter((s) => s.status !== "canceled");
  const totalMonthly = active.reduce((a, s) => a + monthlyCost(s), 0);
  const unknownCount = active.filter((s) => s.price == null).length;
  const upcoming = active
    .filter((s) => daysUntil(s.nextDate) >= 0 && daysUntil(s.nextDate) <= 30)
    .sort((a, b) => daysUntil(a.nextDate) - daysUntil(b.nextDate));
  const due30 = upcoming.reduce((a, s) => a + (s.price ?? 0), 0);
  const issues = subs.filter((s) => s.status === "payment-issue");
  const overdue = active.filter((s) => daysUntil(s.nextDate) < 0 && s.status !== "payment-issue");
  return { active, totalMonthly, unknownCount, upcoming, due30, issues, overdue };
}
