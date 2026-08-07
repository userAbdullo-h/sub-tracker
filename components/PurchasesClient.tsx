"use client";

import { useRef, useState } from "react";
import { Avatar, PriceBadge } from "@/components/bits";
import { fmtMoney, fmtDate } from "@/lib/calc";
import type { Purchase, PurchaseInput } from "@/lib/types";

const emptyForm: PurchaseInput = {
  name: "",
  price: null,
  date: new Date().toISOString().slice(0, 10),
  category: "Course / Lesson",
  notes: "",
};

export default function PurchasesClient({ initial }: { initial: Purchase[] }) {
  const [purs, setPurs] = useState(initial);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<PurchaseInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const list = purs
    .filter((p) => `${p.name} ${p.notes} ${p.category}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = purs.reduce((a, p) => a + (p.price ?? 0), 0);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    dialogRef.current?.showModal();
  }

  function openEdit(p: Purchase) {
    setEditingId(p.id);
    setForm({ name: p.name, price: p.price, date: p.date, category: p.category, notes: p.notes });
    dialogRef.current?.showModal();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/purchases/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const updated = (await res.json()) as Purchase;
        setPurs((cur) => cur.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const res = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const created = (await res.json()) as Purchase;
        setPurs((cur) => [...cur, created]);
      }
      dialogRef.current?.close();
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Purchase) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await fetch(`/api/purchases/${p.id}`, { method: "DELETE" });
    setPurs((cur) => cur.filter((x) => x.id !== p.id));
  }

  return (
    <>
      <div className="toolbar">
        <button className="btn-primary" onClick={openAdd}>+ Add purchase</button>
        <input
          type="search"
          placeholder="Search purchases… (check here before buying twice!)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="note-banner">
        Total logged one-time spend: <b>{fmtMoney(total)}</b> ({purs.length} items)
      </div>

      {list.length === 0 && <div className="empty">No purchases found.</div>}
      {list.map((p) => (
        <div className="item" key={p.id}>
          <Avatar name={p.name} />
          <div className="grow">
            <div className="name">
              {p.name} <PriceBadge price={p.price} />
            </div>
            <div className="meta">
              {fmtDate(p.date)} · {p.category}
              {p.notes ? ` · ${p.notes}` : ""}
            </div>
          </div>
          <div className="amount">
            <div className={`price${p.price == null ? " unknown" : ""}`}>{fmtMoney(p.price)}</div>
          </div>
          <div className="actions">
            <button onClick={() => openEdit(p)}>Edit</button>
            <button className="del" onClick={() => remove(p)}>✕</button>
          </div>
        </div>
      ))}

      <dialog ref={dialogRef}>
        <h3>{editingId ? "Edit purchase" : "Add purchase"}</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label>What did you buy? *</label>
            <input required value={form.name} placeholder="e.g. Python course on Udemy"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Price (USD) — leave empty if unknown</label>
            <input type="number" step="0.01" min="0"
              value={form.price ?? ""}
              onChange={(e) => setForm({ ...form, price: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Date *</label>
            <input type="date" required value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option>Course / Lesson</option>
              <option>Software</option>
              <option>Game</option>
              <option>Membership</option>
              <option>Other</option>
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
