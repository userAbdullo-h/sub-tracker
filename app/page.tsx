import Link from "next/link";
import { ChartLineUp, CalendarBlank, ArrowsClockwise, Warning, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import Nav from "@/components/Nav";
import Logo from "@/components/Logo";
import { StatusBadge, DueBadge, PriceBadge } from "@/components/bits";
import { getRepo } from "@/lib/db";
import { dashboardStats, fmtMoney, fmtDate, cycleName } from "@/lib/calc";
import type { Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

function Row({ sub }: { sub: Subscription }) {
  return (
    <Link href="/subscriptions" className="item">
      <Logo name={sub.name} domain={sub.logoDomain} category={sub.category} />
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
      <section className="hero">
        <div className="hero-copy">
          <div className="hello">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h2>
            Your money, <em>on autopilot</em>.
          </h2>
          <p>
            {issues.length > 0 ? (
              <>You have <b>{issues.length} payment issue{issues.length > 1 ? "s" : ""}</b> and <b>{fmtMoney(due30)}</b> due in the next 30 days.</>
            ) : (
              <>Every payment is healthy. <b>{fmtMoney(due30)}</b> is due in the next 30 days.</>
            )}
          </p>
          <Link href="/subscriptions" className="btn-primary">Review subscriptions</Link>
        </div>
      </section>
      <div className="cards">
        <div className="stat">
          <div className="icon"><ChartLineUp size={17} weight="bold" /></div>
          <div className="label">Recurring cost / month</div>
          <div className="value">~{fmtMoney(totalMonthly)}</div>
          <div className="sub">
            {unknownCount
              ? `${unknownCount} ${unknownCount === 1 ? "subscription has" : "subscriptions have"} no price yet, so the real total is higher`
              : `across ${active.length} active subscriptions`}
          </div>
        </div>
        <div className="stat s-warn">
          <div className="icon"><CalendarBlank size={17} weight="bold" /></div>
          <div className="label">Due in next 30 days</div>
          <div className="value">{fmtMoney(due30)}</div>
          <div className="sub">{upcoming.length} {upcoming.length === 1 ? "payment" : "payments"} coming up</div>
        </div>
        <div className="stat s-ok">
          <div className="icon"><ArrowsClockwise size={17} weight="bold" /></div>
          <div className="label">Active subscriptions</div>
          <div className="value">{active.length}</div>
          <div className="sub">{subs.length - active.length} canceled</div>
        </div>
        <div className={`stat ${issues.length ? "s-danger" : "s-ok"}`}>
          <div className="icon">{issues.length ? <Warning size={17} weight="bold" /> : <CheckCircle size={17} weight="bold" />}</div>
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
              <Logo name={s.name} domain={s.logoDomain} category={s.category} />
              <div>
                <div className="name">
                  {s.name} · {fmtMoney(s.price)}
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
        <h2>Upcoming payments, next 30 days</h2>
        {upcoming.length ? (
          upcoming.map((s) => <Row sub={s} key={s.id} />)
        ) : (
          <div className="empty">Nothing due in the next 30 days 🎉</div>
        )}
      </section>

      <footer>Data stored {process.env.MONGODB_URI ? "on MongoDB Atlas" : "in a local file (development mode)"}</footer>
    </div>
  );
}
