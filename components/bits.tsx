import type { Subscription } from "@/lib/types";
import { daysUntil } from "@/lib/calc";

/** Color-hashed avatar tile per service name */
export function Avatar({ name }: { name: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <div
      className="avatar"
      style={{ background: `linear-gradient(135deg, hsl(${h},62%,52%), hsl(${(h + 40) % 360},62%,42%))` }}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export function StatusBadge({ status }: { status: Subscription["status"] }) {
  if (status === "payment-issue") return <span className="badge b-issue">payment issue</span>;
  if (status === "canceled") return <span className="badge b-canceled">canceled</span>;
  if (status === "trial") return <span className="badge b-trial">trial</span>;
  return <span className="badge b-active">active</span>;
}

export function DueBadge({ sub }: { sub: Subscription }) {
  if (sub.status === "canceled") return null;
  const d = daysUntil(sub.nextDate);
  if (d < 0) return <span className="badge b-overdue">overdue {-d}d</span>;
  if (d === 0) return <span className="badge b-overdue">due today</span>;
  if (d <= 14) return <span className="badge b-due">in {d} days</span>;
  return null;
}

export function PriceBadge({ price }: { price: number | null }) {
  return price == null ? <span className="badge b-price">set price</span> : null;
}
