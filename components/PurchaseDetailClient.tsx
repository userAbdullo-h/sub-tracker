"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import ReceiptsPanel from "@/components/ReceiptsPanel";
import { inferVendor } from "@/lib/vendors";
import { fmtMoney, fmtDate } from "@/lib/calc";
import type { Purchase, PurchaseInput } from "@/lib/types";

export default function PurchaseDetailClient({ initial }: { initial: Purchase }) {
  const router = useRouter();
  const [pur, setPur] = useState(initial);
  const [form, setForm] = useState<PurchaseInput | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openEdit() {
    setForm({ name: pur.name, price: pur.price, date: pur.date, category: pur.category, notes: pur.notes });
    dialogRef.current?.showModal();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/purchases/${pur.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setPur((await res.json()) as Purchase);
      dialogRef.current?.close();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${pur.name}" and its receipts?`)) return;
    await fetch(`/api/purchases/${pur.id}`, { method: "DELETE" });
    router.push("/purchases");
  }

  return (
    <>
      <Link href="/purchases" className="back-link"><ArrowLeft size={14} weight="bold" /> All purchases</Link>

      <div className="detail-head stage-normal">
        <Logo name={pur.name} domain={inferVendor(pur.name).domain} category={pur.category} kind="purchase" />
        <div className="grow">
          <div className="d-name">{pur.name}</div>
          <div className="d-meta">{pur.category} · bought {fmtDate(pur.date)}</div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="stat"><div className="label">Price</div>
          <div className="value">{fmtMoney(pur.price)}</div>
          <div className="sub">one-time purchase</div></div>
        <div className="stat"><div className="label">Purchase date</div>
          <div className="value date">{fmtDate(pur.date)}</div>
          <div className="sub">{(pur.receipts ?? []).length} {(pur.receipts ?? []).length === 1 ? "receipt" : "receipts"}</div></div>
      </div>

      <div className="toolbar">
        <button className="btn-secondary" onClick={openEdit}>Edit</button>
        <button className="btn-secondary" onClick={remove} style={{ color: "var(--red)" }}>Delete</button>
      </div>

      {pur.notes && (
        <div className="panel">
          <div className="panel-title">Notes</div>
          <p className="panel-text">{pur.notes}</p>
        </div>
      )}

      <ReceiptsPanel
        kind="purchases"
        entityId={pur.id}
        receipts={pur.receipts ?? []}
        onChanged={(u) => setPur(u as Purchase)}
      />

      <dialog ref={dialogRef}>
        <h3>Edit purchase</h3>
        {form && (
          <form onSubmit={submit}>
            <div className="field"><label>Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Price in USD, leave empty if unknown</label>
              <input type="number" step="0.01" min="0" value={form.price ?? ""}
                onChange={(e) => setForm({ ...form, price: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div className="field"><label>Date *</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="field"><label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>Course / Lesson</option><option>Software</option><option>Game</option>
                <option>Membership</option><option>Other</option>
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
