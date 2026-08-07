import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { Subscription, Purchase } from "@/lib/types";

export async function GET() {
  try {
    await requireUser();
    const repo = getRepo();
    const [subscriptions, purchases] = await Promise.all([repo.listSubscriptions(), repo.listPurchases()]);
    return NextResponse.json(
      { exportedAt: new Date().toISOString(), subscriptions, purchases },
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
    const body = (await req.json()) as { subscriptions?: Subscription[]; purchases?: Purchase[] };
    if (!Array.isArray(body.subscriptions) || !Array.isArray(body.purchases)) {
      return NextResponse.json({ error: "invalid backup format" }, { status: 400 });
    }
    await getRepo().replaceAll(body.subscriptions, body.purchases);
    return NextResponse.json({ ok: true, subscriptions: body.subscriptions.length, purchases: body.purchases.length });
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
