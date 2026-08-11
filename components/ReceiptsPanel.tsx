"use client";

import { useState } from "react";
import { Paperclip, X } from "@phosphor-icons/react";
import { fmtMoney, fmtDate } from "@/lib/calc";
import type { Receipt } from "@/lib/types";

/** Payment history + receipt attachments for one subscription or purchase. */
export default function ReceiptsPanel({
  kind,
  entityId,
  receipts,
  onChanged,
}: {
  kind: "subscriptions" | "purchases";
  entityId: string;
  receipts: Receipt[];
  onChanged: (updatedEntity: unknown) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sorted = [...receipts].sort((a, b) => b.date.localeCompare(a.date));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("date", date);
      if (amount) form.set("amount", amount);
      form.set("note", note);
      if (file) form.set("file", file);
      const res = await fetch(`/api/${kind}/${entityId}/receipts`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      onChanged(await res.json());
      setAmount(""); setNote(""); setFile(null);
      (document.getElementById("receipt-file") as HTMLInputElement | null)?.form?.reset();
      setDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: Receipt) {
    if (!confirm(`Delete receipt from ${fmtDate(r.date)}?`)) return;
    const res = await fetch(`/api/${kind}/${entityId}/receipts?rid=${r.id}`, { method: "DELETE" });
    if (res.ok) onChanged(await res.json());
  }

  return (
    <div className="panel">
      <div className="panel-title">Payments &amp; receipts</div>
      {sorted.length === 0 && <div className="empty" style={{ padding: 22 }}>No payments recorded yet.</div>}
      {sorted.map((r) => (
        <div className="receipt-row" key={r.id}>
          <div className="r-date">{fmtDate(r.date)}</div>
          <div className="r-amount">{r.amount != null ? fmtMoney(r.amount) : "n/a"}</div>
          <div className="r-note">
            {r.note || "Payment"}
            {r.file && (
              <>
                {" · "}
                <a href={`/api/receipts/${r.file}`} target="_blank" rel="noreferrer">
                  <Paperclip size={13} weight="bold" /> {r.origName ?? "receipt"}
                </a>
              </>
            )}
          </div>
          <button className="r-del" title="Delete receipt" aria-label="Delete receipt" onClick={() => remove(r)}><X size={14} weight="bold" /></button>
        </div>
      ))}

      <form className="receipt-add" onSubmit={add}>
        <div className="panel-title small">Add payment / receipt</div>
        <div className="receipt-fields">
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="number" step="0.01" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input type="text" placeholder="Note (e.g. paid via Visa •2390)" value={note} onChange={(e) => setNote(e.target.value)} />
          <input id="receipt-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.eml,.html"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        {error && <div className="receipt-error">{error}</div>}
        <button className="btn-secondary" type="submit" disabled={busy}>{busy ? "Saving…" : "Add record"}</button>
      </form>
    </div>
  );
}
