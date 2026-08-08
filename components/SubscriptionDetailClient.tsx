"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { StatusBadge, DueBadge } from "@/components/bits";
import Logo from "@/components/Logo";
import ReceiptsPanel from "@/components/ReceiptsPanel";
import { fmtMoney, fmtDate, cycleName, stageOf, monthlyCost } from "@/lib/calc";
import { CATEGORIES } from "@/lib/vendors";
import type { Subscription, SubscriptionInput, SubStatus } from "@/lib/types";

const STAGE_LABEL: Record<string, string> = {
  red: "Payment overdue / failed",
  yellow: "Due soon",
  green: "Paid recently",
  normal: "All good",
};

export default function SubscriptionDetailClient({ initial }: { initial: Subscription }) {
  const router = useRouter();
  const [sub, setSub] = useState(initial);
  const [form, setForm] = useState<SubscriptionInput | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stage = stageOf(sub);

  function openEdit() {
    setForm({ name: sub.name, price: sub.price, cycleMonths: sub.cycleMonths, nextDate: sub.nextDate, status: sub.status, notes: sub.notes, category: sub.category ?? "Other" });
    dialogRef.current?.showModal();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSub((await res.json()) as Subscription);
      dialogRef.current?.close();
    } finally {
      setBusy(false);
    }
  }

  async function markPaid() {
    const res = await fetch(`/api/subscriptions/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markPaid" }),
    });
    setSub((await res.json()) as Subscription);
  }

  async function remove() {
    if (!confirm(`Delete "${sub.name}" and its history?`)) return;
    await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
    router.push("/subscriptions");
  }

  return (
    <>
      <Link href="/subscriptions" className="back-link">← All subscriptions</Link>

      <div className={`detail-head stage-${stage}`}>
        <Logo name={sub.name} domain={sub.logoDomain} category={sub.category} />
        <div className="grow">
          <div className="d-name">{sub.name}</div>
          <div className="d-meta">
            {sub.category ?? "Other"} · {cycleName(sub.cycleMonths)} <StatusBadge status={sub.status} /> <DueBadge sub={sub} />
          </div>
        </div>
        <div className={`stage-pill sp-${stage}`}>{STAGE_LABEL[stage]}</div>
      </div>

      <div className="detail-grid">
        <div className="stat"><div className="label">Price</div>
          <div className="value">{fmtMoney(sub.price)}</div>
          <div className="sub">≈ {fmtMoney(monthlyCost(sub))}/month</div></div>
        <div className="stat"><div className="label">Next payment</div>
          <div className="value" style={{ fontSize: "1.3rem" }}>{fmtDate(sub.nextDate)}</div>
          <div className="sub">{cycleName(sub.cycleMonths)}</div></div>
        <div className="stat"><div className="label">Last paid</div>
          <div className="value" style={{ fontSize: "1.3rem" }}>{sub.lastPaidAt ? fmtDate(sub.lastPaidAt) : "—"}</div>
          <div className="sub">{(sub.receipts ?? []).length} payment record(s)</div></div>
      </div>

      <div className="toolbar">
        <button className="btn-primary" onClick={markPaid}>✓ Mark paid</button>
        <button className="btn-secondary" onClick={openEdit}>Edit</button>
        <button className="btn-secondary" onClick={remove} style={{ color: "var(--red)" }}>Delete</button>
      </div>

      {sub.notes && (
        <div className="panel">
          <div className="panel-title">Notes</div>
          <p className="panel-text">{sub.notes}</p>
        </div>
      )}

      <ReceiptsPanel
        kind="subscriptions"
        entityId={sub.id}
        receipts={sub.receipts ?? []}
        onChanged={(u) => setSub(u as Subscription)}
      />

      <dialog ref={dialogRef}>
        <h3>Edit subscription</h3>
        {form && (
          <form onSubmit={submit}>
            <div className="field"><label>Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Price (USD) — leave empty if unknown</label>
              <input type="number" step="0.01" min="0" value={form.price ?? ""}
                onChange={(e) => setForm({ ...form, price: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div className="field"><label>Category</label>
              <select value={form.category ?? "Other"} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="field"><label>Billing cycle</label>
              <select value={form.cycleMonths} onChange={(e) => setForm({ ...form, cycleMonths: Number(e.target.value) })}>
                <option value={1}>Monthly</option><option value={3}>Every 3 months</option>
                <option value={6}>Every 6 months</option><option value={12}>Yearly</option>
                <option value={14}>Every 14 months</option><option value={24}>Every 2 years</option>
              </select></div>
            <div className="field"><label>Next payment date *</label>
              <input type="date" required value={form.nextDate} onChange={(e) => setForm({ ...form, nextDate: e.target.value })} /></div>
            <div className="field"><label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SubStatus })}>
                <option value="active">Active</option><option value="payment-issue">Payment issue</option>
                <option value="trial">Trial</option><option value="canceled">Canceled</option>
              </select></div>
            <div className="field"><label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="dialog-actions">
              <button type="button" className="btn-secondary" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
