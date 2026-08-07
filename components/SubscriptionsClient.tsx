"use client";

import { useRef, useState } from "react";
import { Avatar, StatusBadge, DueBadge, PriceBadge } from "@/components/bits";
import { fmtMoney, fmtDate, cycleName, daysUntil } from "@/lib/calc";
import type { Subscription, SubscriptionInput, SubStatus } from "@/lib/types";

const emptyForm: SubscriptionInput = {
  name: "",
  price: null,
  cycleMonths: 1,
  nextDate: new Date().toISOString().slice(0, 10),
  status: "active",
  notes: "",
};

export default function SubscriptionsClient({ initial }: { initial: Subscription[] }) {
  const [subs, setSubs] = useState(initial);
  const [form, setForm] = useState<SubscriptionInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const sorted = [...subs].sort((a, b) => {
    if ((a.status === "canceled") !== (b.status === "canceled")) return a.status === "canceled" ? 1 : -1;
    return daysUntil(a.nextDate) - daysUntil(b.nextDate);
  });

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, nextDate: new Date().toISOString().slice(0, 10) });
    dialogRef.current?.showModal();
  }

  function openEdit(sub: Subscription) {
    setEditingId(sub.id);
    setForm({ name: sub.name, price: sub.price, cycleMonths: sub.cycleMonths, nextDate: sub.nextDate, status: sub.status, notes: sub.notes });
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
      <div className="toolbar">
        <button className="btn-primary" onClick={openAdd}>+ Add subscription</button>
      </div>

      {sorted.length === 0 && <div className="empty">No subscriptions yet.</div>}
      {sorted.map((sub) => (
        <div className="item" key={sub.id}>
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
          <div className="actions">
            <button className="paid" title="Advance next date by one cycle" onClick={() => markPaid(sub.id)}>✓ Paid</button>
            <button onClick={() => openEdit(sub)}>Edit</button>
            <button className="del" onClick={() => remove(sub)}>✕</button>
          </div>
        </div>
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
