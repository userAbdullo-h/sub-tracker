"use client";

import { useState } from "react";
import { Warning } from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import { inferVendor } from "@/lib/vendors";
import { fmtMoney, fmtDate } from "@/lib/calc";
import type { DetectedEvent, DetectedKind } from "@/lib/types";

const KIND_BADGE: Record<DetectedKind, { cls: string; label: string }> = {
  charge: { cls: "b-active", label: "charge" },
  failure: { cls: "b-issue", label: "payment failed" },
  renewal_notice: { cls: "b-due", label: "renewal notice" },
  trial: { cls: "b-trial", label: "trial" },
  refund: { cls: "b-price", label: "refund" },
};

interface ScanSummary {
  mode: string;
  fetched: number;
  parsed: number;
  skippedSeen: number;
  autoApplied: number;
  queued: number;
}

export default function ReviewClient({
  initial,
  subNames,
  lastScanAt,
}: {
  initial: DetectedEvent[];
  subNames: Record<string, string>;
  lastScanAt: string | null;
}) {
  const [events, setEvents] = useState(initial);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = events.filter((e) => e.status === "pending");
  const history = events.filter((e) => e.status !== "pending").slice(0, 25);

  async function refresh() {
    const res = await fetch("/api/detected");
    if (res.ok) setEvents(await res.json());
  }

  async function scanNow() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "scan failed");
      setSummary(json as ScanSummary);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function act(ev: DetectedEvent, body: Record<string, unknown>) {
    setBusyId(ev.id);
    setError(null);
    try {
      const res = await fetch(`/api/detected/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "action failed");
      setEvents((cur) => cur.map((e) => (e.id === ev.id ? (json as DetectedEvent) : e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>Review</h2>
        <div className="sub">
          <b>{pending.length}</b> detected {pending.length === 1 ? "event" : "events"} waiting for you
          {/* suppressHydrationWarning: server locale formats this differently than the browser */}
          {lastScanAt && <span suppressHydrationWarning> · last scan {new Date(lastScanAt).toLocaleString()}</span>}
        </div>
      </div>

      <div className="toolbar">
        <button className="btn-primary" onClick={scanNow} disabled={scanning}>
          {scanning ? "Scanning…" : "Scan now"}
        </button>
        {summary && (
          <span className="scan-summary">
            {summary.mode === "fixtures" ? "fixture scan" : "Gmail scan"}: {summary.fetched} emails ·{" "}
            {summary.parsed} parsed · {summary.autoApplied} auto-applied · {summary.queued} queued
          </span>
        )}
      </div>

      {error && (
        <div className="alert">
          <div className="a-icon"><Warning size={16} weight="bold" /></div>
          <div>
            <div className="name">Something went wrong</div>
            <div className="meta">{error}</div>
          </div>
        </div>
      )}

      <div className="note-banner">
        The Gmail scanner never edits your data on its own. Matched <b>charges</b> and{" "}
        <b>payment failures</b> are applied automatically (and logged below); everything else waits
        here for your one-click decision.
      </div>

      {pending.length === 0 && <div className="empty">Inbox zero. Nothing to review.</div>}

      {pending.map((ev) => {
        const matchedName = ev.subscriptionId ? subNames[ev.subscriptionId] : null;
        const kind = KIND_BADGE[ev.kind];
        const busy = busyId === ev.id;
        return (
          <div className="item" key={ev.id}>
            <Logo name={ev.vendor} domain={inferVendor(ev.vendor).domain} category={inferVendor(ev.vendor).category} />
            <div className="grow">
              <div className="name">
                {ev.vendor}
                <span className={`badge ${kind.cls}`}>{kind.label}</span>
                {matchedName && <span className="badge b-price">matches “{matchedName}”</span>}
              </div>
              <div className="meta">
                {fmtDate(ev.date)} · “{ev.emailSubject}”
              </div>
            </div>
            <div className="amount">
              <div className={`price ${ev.amount == null ? "unknown" : ""}`}>{fmtMoney(ev.amount)}</div>
              <div className="cycle">{ev.parser}</div>
            </div>
            <div className="review-actions">
              {matchedName ? (
                <button className="btn-secondary" disabled={busy} onClick={() => act(ev, { action: "approve" })}>
                  {ev.kind === "renewal_notice" ? `Set renewal ${fmtDate(ev.date)}` : "Acknowledge"}
                </button>
              ) : (
                <>
                  <button className="btn-secondary" disabled={busy} onClick={() => act(ev, { action: "approve", as: "subscription" })}>
                    + Subscription
                  </button>
                  <button className="btn-secondary" disabled={busy} onClick={() => act(ev, { action: "approve", as: "purchase" })}>
                    + Purchase
                  </button>
                </>
              )}
              <button className="btn-secondary btn-dismiss" disabled={busy} onClick={() => act(ev, { action: "dismiss" })}>
                Dismiss
              </button>
            </div>
          </div>
        );
      })}

      {history.length > 0 && (
        <section>
          <div className="cat-head" style={{ marginTop: 28 }}>
            <span className="t">Recent activity</span>
            <span className="m">auto-applied &amp; reviewed</span>
          </div>
          {history.map((ev) => {
            const kind = KIND_BADGE[ev.kind];
            return (
              <div className="item history-item" key={ev.id}>
                <Logo name={ev.vendor} domain={inferVendor(ev.vendor).domain} category={inferVendor(ev.vendor).category} />
                <div className="grow">
                  <div className="name">
                    {ev.vendor}
                    <span className={`badge ${kind.cls}`}>{kind.label}</span>
                    <span className={`badge ${ev.status === "dismissed" ? "b-canceled" : "b-active"}`}>
                      {ev.status === "auto" ? "auto-applied" : ev.status}
                    </span>
                  </div>
                  <div className="meta">
                    {fmtDate(ev.date)}
                    {ev.autoNote && <> · {ev.autoNote}</>}
                  </div>
                </div>
                <div className="amount">
                  <div className={`price ${ev.amount == null ? "unknown" : ""}`}>{fmtMoney(ev.amount)}</div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
