import Link from "next/link";
import Nav from "@/components/Nav";
import { Avatar, StatusBadge, DueBadge, PriceBadge } from "@/components/bits";
import { getRepo } from "@/lib/db";
import { dashboardStats, fmtMoney, fmtDate, cycleName } from "@/lib/calc";
import type { Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

function Row({ sub }: { sub: Subscription }) {
  return (
    <Link href="/subscriptions" className="item">
      <Avatar name={sub.name} />
      <div className="grow">
        <div className="name">
          {sub.name} <StatusBadge status={sub.status} /> <DueBadge sub={sub} /> <PriceBadge price={sub.price} />
        </div>
        <div className="meta">
          Next: {fmtDate(sub.nextDate)}
          {sub.notes ? ` · ${sub.notes}` : ""}
        </div>
      </div>
      <div className="amount">
        <div className={`price${sub.price == null ? " unknown" : ""}`}>{fmtMoney(sub.price)}</div>
        <div className="cycle">{cycleName(sub.cycleMonths)}</div>
      </div>
    </Link>
  );
}

export default async function Dashboard() {
  const subs = await getRepo().listSubscriptions();
  const { active, totalMonthly, unknownCount, upcoming, due30, issues, overdue } = dashboardStats(subs);

  return (
    <div className="wrap">
      <Nav />
      <div className="cards">
        <div className="stat">
          <div className="icon">📊</div>
          <div className="label">Recurring cost / month</div>
          <div className="value">~{fmtMoney(totalMonthly)}</div>
          <div className="sub">
            {unknownCount
              ? `${unknownCount} subscription(s) missing a price — real total is higher`
              : `across ${active.length} active subscriptions`}
          </div>
        </div>
        <div className="stat s-warn">
          <div className="icon">📅</div>
          <div className="label">Due in next 30 days</div>
          <div className="value">{fmtMoney(due30)}</div>
          <div className="sub">{upcoming.length} payment(s) coming up</div>
        </div>
        <div className="stat s-ok">
          <div className="icon">🔁</div>
          <div className="label">Active subscriptions</div>
          <div className="value">{active.length}</div>
          <div className="sub">{subs.length - active.length} canceled</div>
        </div>
        <div className={`stat ${issues.length ? "s-danger" : "s-ok"}`}>
          <div className="icon">{issues.length ? "⚠️" : "✅"}</div>
          <div className="label">Payment issues</div>
          <div className="value" style={{ color: issues.length ? "var(--red)" : "var(--green)" }}>
            {issues.length}
          </div>
          <div className="sub">{issues.length ? "need your attention" : "all good"}</div>
        </div>
      </div>

      {issues.length > 0 && (
        <section>
          <h2>Needs attention</h2>
          {issues.map((s) => (
            <div className="alert" key={s.id}>
              <div className="a-icon">⚠️</div>
              <div>
                <div className="name">
                  {s.name} — {fmtMoney(s.price)}
                </div>
                <div className="meta">{s.notes || "Payment failing"}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {overdue.length > 0 && (
        <section>
          <h2>Possibly already charged (date passed)</h2>
          {overdue.map((s) => (
            <Row sub={s} key={s.id} />
          ))}
        </section>
      )}

      <section>
        <h2>Upcoming payments — 30 days</h2>
        {upcoming.length ? (
          upcoming.map((s) => <Row sub={s} key={s.id} />)
        ) : (
          <div className="empty">Nothing due in the next 30 days 🎉</div>
        )}
      </section>

      <footer>PayPilot · Phase 1 · data {process.env.MONGODB_URI ? "on MongoDB Atlas" : "in local file (dev mode)"}</footer>
    </div>
  );
}
