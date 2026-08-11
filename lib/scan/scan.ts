import { randomUUID } from "crypto";
import { getRepo } from "../db";
import { advanceDate } from "../calc";
import type { DetectedEvent } from "../types";
import type { GmailSource } from "./source";
import { parseEmail } from "./parsers";
import { matchSubscription } from "./match";

export interface ScanResult {
  fetched: number;
  parsed: number;
  skippedSeen: number;
  autoApplied: number;
  queued: number;
  events: DetectedEvent[];
}

/** A first scan with no watermark only looks this far back (backfill is the review queue's job). */
const INITIAL_WINDOW_DAYS = () => Number(process.env.SCAN_INITIAL_DAYS) || 30;
/** Failures older than this are stale news — queued for review instead of auto-flagged. */
const FAILURE_FRESH_DAYS = 14;

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

/**
 * Should this charge auto-advance the matched subscription?
 * Guards against the two ways auto-advance corrupts data:
 *  - stale receipts: the charge is much older than the current due date, so the
 *    due date already accounts for it (advancing again would double-count);
 *  - unrelated charges: amount differs wildly from the subscription price
 *    (e.g. a $7.84 one-time API credit on a $112/mo subscription).
 */
function chargeApplies(sub: { nextDate: string; cycleMonths: number; price: number | null }, eventDate: string, amount: number | null): boolean {
  const cycleDays = sub.cycleMonths * 30.44;
  if (daysBetween(sub.nextDate, eventDate) > cycleDays / 2) return false;
  if (sub.price != null && amount != null && Math.abs(amount - sub.price) > Math.max(1, sub.price * 0.1)) return false;
  return true;
}

/**
 * One scan pass: fetch mail since the watermark, parse, dedupe, match.
 * Safety model per SPEC §Phase 2 — nothing creates/edits records without owner
 * approval, EXCEPT two low-risk reversible auto-actions on *matched* subscriptions:
 * a charge advances the renewal date (same as "mark paid"), and a failure flips
 * the subscription to payment-issue.
 */
export async function runScan(source: GmailSource): Promise<ScanResult> {
  const repo = getRepo();
  const meta = await repo.getScanMeta();
  const after =
    meta.gmailWatermark ??
    Math.floor(Date.now() / 1000) - INITIAL_WINDOW_DAYS() * 86400;
  const messages = await source.search(after);

  const result: ScanResult = { fetched: messages.length, parsed: 0, skippedSeen: 0, autoApplied: 0, queued: 0, events: [] };
  let watermark = meta.gmailWatermark ?? 0;

  for (const msg of messages) {
    watermark = Math.max(watermark, Math.floor(new Date(msg.date).getTime() / 1000));

    if (await repo.hasDetected(msg.id)) {
      result.skippedSeen++;
      continue;
    }
    const parsed = parseEmail(msg);
    if (!parsed) continue;
    result.parsed++;

    const subs = await repo.listSubscriptions();
    // One-off buys (API credit top-ups) are never subscription payments, even
    // when the vendor is one you subscribe to. Leave them unmatched so the
    // review queue offers "+ Purchase" instead of touching the subscription.
    const matched = parsed.oneOff ? undefined : matchSubscription(parsed.vendor, subs);

    const event: DetectedEvent = {
      id: randomUUID(),
      vendor: parsed.vendor,
      amount: parsed.amount,
      date: parsed.date ?? msg.date.slice(0, 10),
      kind: parsed.kind,
      emailDate: msg.date.slice(0, 10),
      sourceMsgId: msg.id,
      emailFrom: msg.from,
      emailSubject: msg.subject,
      parser: parsed.parser,
      status: "pending",
      subscriptionId: matched?.id,
      createdAt: new Date().toISOString(),
    };

    if (matched && parsed.kind === "charge" && chargeApplies(matched, event.date, parsed.amount)) {
      await repo.updateSubscription(matched.id, {
        nextDate: advanceDate(matched.nextDate, matched.cycleMonths),
        lastPaidAt: event.date,
        status: matched.status === "payment-issue" ? "active" : matched.status,
        receipts: [
          ...(matched.receipts ?? []),
          { id: randomUUID(), date: event.date, amount: parsed.amount ?? matched.price, note: `Charge detected in Gmail (${msg.subject})` },
        ],
      });
      event.status = "auto";
      event.autoNote = `Advanced "${matched.name}" to ${advanceDate(matched.nextDate, matched.cycleMonths)} and logged the payment`;
      result.autoApplied++;
    } else if (
      matched &&
      parsed.kind === "failure" &&
      daysBetween(new Date().toISOString().slice(0, 10), event.date) <= FAILURE_FRESH_DAYS
    ) {
      await repo.updateSubscription(matched.id, { status: "payment-issue" });
      event.status = "auto";
      event.autoNote = `Flagged "${matched.name}" as payment-issue`;
      result.autoApplied++;
    } else {
      result.queued++;
    }

    await repo.createDetected(event);
    result.events.push(event);
  }

  await repo.setScanMeta({ lastScanAt: new Date().toISOString(), gmailWatermark: watermark });
  return result;
}
