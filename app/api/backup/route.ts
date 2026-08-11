import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { Subscription, Purchase, DetectedEvent, ScanMeta } from "@/lib/types";

/**
 * A full backup: records, receipts (nested), and scan history.
 * Scan history matters — `detected` is the message-id ledger that stops a
 * re-scan from applying the same charge twice, so a backup without it is not
 * safe to restore into a fresh database (e.g. when moving to MongoDB Atlas).
 * The Gmail refresh token is deliberately excluded: backups get downloaded,
 * copied between machines and pasted around, so no credential goes in them.
 */
export async function GET() {
  try {
    await requireUser();
    const repo = getRepo();
    const [subscriptions, purchases, detected, meta] = await Promise.all([
      repo.listSubscriptions(),
      repo.listPurchases(),
      repo.listDetected(),
      repo.getScanMeta(),
    ]);
    const { gmailRefreshToken: _omitted, ...scanMeta } = meta;
    void _omitted;
    return NextResponse.json(
      { version: 2, exportedAt: new Date().toISOString(), subscriptions, purchases, detected, scanMeta },
      { headers: { "Content-Disposition": `attachment; filename="paypilot-backup-${new Date().toISOString().slice(0, 10)}.json"` } }
    );
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = (await req.json()) as {
      subscriptions?: Subscription[];
      purchases?: Purchase[];
      detected?: DetectedEvent[];
      scanMeta?: ScanMeta;
    };
    if (!Array.isArray(body.subscriptions) || !Array.isArray(body.purchases)) {
      return NextResponse.json({ error: "invalid backup format" }, { status: 400 });
    }
    // v1 backups carry no scan history; leave whatever this database already has.
    await getRepo().replaceAll(
      body.subscriptions,
      body.purchases,
      Array.isArray(body.detected) ? body.detected : undefined,
      body.scanMeta && typeof body.scanMeta === "object" ? body.scanMeta : undefined
    );
    return NextResponse.json({
      ok: true,
      subscriptions: body.subscriptions.length,
      purchases: body.purchases.length,
      detected: Array.isArray(body.detected) ? body.detected.length : "unchanged",
    });
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
