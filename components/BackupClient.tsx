"use client";

import { useRef, useState } from "react";

export default function BackupClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  async function importFile(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.subscriptions) || !Array.isArray(data.purchases)) throw new Error("bad format");
      if (!confirm(`Replace current data with backup (${data.subscriptions.length} subs, ${data.purchases.length} purchases)?`)) return;
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("import failed");
      setMsg("✓ Backup imported — reload the page to see it.");
    } catch {
      setMsg("✗ Invalid backup file.");
    }
  }

  return (
    <div className="toolbar">
      <a className="btn-primary" href="/api/backup" download>⬇ Export backup (JSON)</a>
      <button className="btn-secondary" onClick={() => fileRef.current?.click()}>⬆ Import backup</button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
      />
      {msg && <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>{msg}</span>}
    </div>
  );
}
