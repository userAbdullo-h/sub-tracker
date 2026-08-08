"use client";

import { useRef, useState } from "react";
import Logo from "@/components/Logo";
import { inferVendor, PURCHASE_ICON } from "@/lib/vendors";
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

  // Group filtered list by category, ordered by total spend then count
  const groups = new Map<string, Purchase[]>();
  for (const p of list) {
    const cat = p.category || "Other";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }
  const orderedGroups = [...groups.entries()]
    .map(([cat, items]) => ({
      cat,
      items,
      spend: items.reduce((a, p) => a + (p.price ?? 0), 0),
    }))
    .sort((a, b) => b.spend - a.spend || b.items.length - a.items.length);

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
      <div className="page-head">
        <h2>Purchases</h2>
        <div className="sub">
          <b>{purs.length}</b> items · logged one-time spend <b>{fmtMoney(total)}</b>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn-primary" onClick={openAdd}>+ Add purchase</button>
        <input
          type="search"
          placeholder="Search purchases… (check here before buying twice!)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {list.length === 0 && <div className="empty">No purchases found.</div>}

      {orderedGroups.map(({ cat, items, spend }) => (
        <section key={cat}>
          <div className="cat-head">
            {PURCHASE_ICON[cat] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={PURCHASE_ICON[cat]} alt="" />
            )}
            <span className="t">{cat}</span>
            <span className="m">
              {items.length} · {spend > 0 ? fmtMoney(spend) : "—"}
            </span>
          </div>
          <div className="card-grid">
            {items.map((p) => (
              <div className="sub-card" key={p.id}>
                <div className="card-top">
                  <Logo name={p.name} domain={inferVendor(p.name).domain} category={p.category} kind="purchase" />
                  <div className="who">
                    <div className="name">{p.name}</div>
                    <div className="cat">{p.category}</div>
                  </div>
                </div>

                <div className="price-line">
                  <span className={`p${p.price == null ? " unknown" : ""}`}>{fmtMoney(p.price)}</span>
                  {p.price == null && (
                    <button className="badge b-price" onClick={() => openEdit(p)}>+ set price</button>
                  )}
                </div>

                <div className="next-line">
                  <span>Bought {fmtDate(p.date)}</span>
                </div>

                {p.notes && <div className="notes" title={p.notes}>{p.notes}</div>}

                <div className="card-foot">
                  <button onClick={() => openEdit(p)}>Edit</button>
                  <button className="del" onClick={() => remove(p)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>
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
