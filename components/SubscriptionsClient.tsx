"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { StatusBadge, DueBadge } from "@/components/bits";
import Logo from "@/components/Logo";
import { fmtMoney, fmtDate, cycleName, daysUntil, monthlyCost, stageOf } from "@/lib/calc";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/vendors";
import type { Subscription, SubscriptionInput, SubStatus } from "@/lib/types";

const emptyForm: SubscriptionInput = {
  name: "",
  price: null,
  cycleMonths: 1,
  nextDate: new Date().toISOString().slice(0, 10),
  status: "active",
  notes: "",
  category: "Other",
};

export default function SubscriptionsClient({ initial }: { initial: Subscription[] }) {
  const [subs, setSubs] = useState(initial);
  const [form, setForm] = useState<SubscriptionInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const activeCount = subs.filter((s) => s.status !== "canceled").length;
  const totalMo = subs.reduce((a, s) => a + monthlyCost(s), 0);

  // Group by category, categories ordered by monthly spend (unknown-price groups keep their position by count)
  const groups = new Map<string, Subscription[]>();
  for (const s of subs) {
    const cat = s.category ?? "Other";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(s);
  }
  const orderedGroups = [...groups.entries()]
    .map(([cat, list]) => ({
      cat,
      list: list.sort((a, b) => {
        if ((a.status === "canceled") !== (b.status === "canceled")) return a.status === "canceled" ? 1 : -1;
        return daysUntil(a.nextDate) - daysUntil(b.nextDate);
      }),
      spend: list.reduce((a, s) => a + monthlyCost(s), 0),
    }))
    .sort((a, b) => b.spend - a.spend || b.list.length - a.list.length);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, nextDate: new Date().toISOString().slice(0, 10) });
    dialogRef.current?.showModal();
  }

  function openEdit(sub: Subscription) {
    setEditingId(sub.id);
    setForm({ name: sub.name, price: sub.price, cycleMonths: sub.cycleMonths, nextDate: sub.nextDate, status: sub.status, notes: sub.notes, category: sub.category ?? "Other" });
    dialogRef.current?.showModal();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/subscriptions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const updated = (await res.json()) as Subscription;
        setSubs((cur) => cur.map((s) => (s.id === editingId ? updated : s)));
      } else {
        const res = await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const created = (await res.json()) as Subscription;
        setSubs((cur) => [...cur, created]);
      }
      dialogRef.current?.close();
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markPaid" }),
    });
    const updated = (await res.json()) as Subscription;
    setSubs((cur) => cur.map((s) => (s.id === id ? updated : s)));
  }

  async function remove(sub: Subscription) {
    if (!confirm(`Delete "${sub.name}"?`)) return;
    await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
    setSubs((cur) => cur.filter((s) => s.id !== sub.id));
  }

  return (
    <>
      <div className="page-head">
        <h2>Subscriptions</h2>
        <div className="sub">
          <b>{activeCount}</b> active · recurring <b>~{fmtMoney(totalMo)}</b>/month
        </div>
      </div>

      <div className="toolbar">
        <button className="btn-primary" onClick={openAdd}>+ Add subscription</button>
        <div className="legend">
          <span><i className="dot d-red" /> overdue / failed</span>
          <span><i className="dot d-yellow" /> due ≤ 5 days</span>
          <span><i className="dot d-green" /> paid recently</span>
          <span><i className="dot d-normal" /> all good</span>
        </div>
      </div>

      {subs.length === 0 && <div className="empty">No subscriptions yet.</div>}

      {orderedGroups.map(({ cat, list, spend }) => (
        <section key={cat}>
          <div className="cat-head">
            {CATEGORY_ICONS[cat] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={CATEGORY_ICONS[cat]} alt="" />
            )}
            <span className="t">{cat}</span>
            <span className="m">
              {list.length} · {spend > 0 ? `~${fmtMoney(spend)}/mo` : "—"}
            </span>
          </div>
          <div className="card-grid">
            {list.map((sub) => (
              <div
                key={sub.id}
                className={`sub-card stage-${stageOf(sub)}${sub.status === "canceled" ? " muted-card" : ""}`}
              >
                <div className="card-top">
                  <Logo name={sub.name} domain={sub.logoDomain} category={sub.category} />
                  <div className="who">
                    <Link href={`/subscriptions/${sub.id}`} className="name name-link">{sub.name}</Link>
                    <div className="cat">{cycleName(sub.cycleMonths)}</div>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>

                <div className="price-line">
                  <span className={`p${sub.price == null ? " unknown" : ""}`}>{fmtMoney(sub.price)}</span>
                  <span className="per">/ {cycleName(sub.cycleMonths).replace("every ", "")}</span>
                  {sub.price == null && (
                    <button className="badge b-price" onClick={() => openEdit(sub)}>+ set price</button>
                  )}
                </div>

                <div className="next-line">
                  <span>Renews {fmtDate(sub.nextDate)}</span>
                  <DueBadge sub={sub} />
                </div>

                {sub.notes && <div className="notes" title={sub.notes}>{sub.notes}</div>}

                <div className="card-foot">
                  <button className="paid" title="Advance next date by one cycle" onClick={() => markPaid(sub.id)}>✓ Paid</button>
                  <button onClick={() => openEdit(sub)}>Edit</button>
                  <button className="del" onClick={() => remove(sub)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <dialog ref={dialogRef}>
        <h3>{editingId ? "Edit subscription" : "Add subscription"}</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label>Name *</label>
            <input required value={form.name} placeholder="e.g. Netflix"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Price (USD) — leave empty if unknown</label>
            <input type="number" step="0.01" min="0" placeholder="9.99"
              value={form.price ?? ""}
              onChange={(e) => setForm({ ...form, price: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={form.category ?? "Other"} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Billing cycle</label>
            <select value={form.cycleMonths} onChange={(e) => setForm({ ...form, cycleMonths: Number(e.target.value) })}>
              <option value={1}>Monthly</option>
              <option value={3}>Every 3 months</option>
              <option value={6}>Every 6 months</option>
              <option value={12}>Yearly</option>
              <option value={14}>Every 14 months</option>
              <option value={24}>Every 2 years</option>
            </select>
          </div>
          <div className="field">
            <label>Next payment date *</label>
            <input type="date" required value={form.nextDate}
              onChange={(e) => setForm({ ...form, nextDate: e.target.value })} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SubStatus })}>
              <option value="active">Active</option>
              <option value="payment-issue">Payment issue</option>
              <option value="trial">Trial</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={form.notes} placeholder="Anything to remember"
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
