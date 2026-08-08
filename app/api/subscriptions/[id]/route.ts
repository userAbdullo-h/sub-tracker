import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { advanceDate } from "@/lib/calc";
import type { SubscriptionInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const body = (await req.json()) as Partial<SubscriptionInput> & { action?: "markPaid" };
    const repo = getRepo();

    if (body.action === "markPaid") {
      const subs = await repo.listSubscriptions();
      const sub = subs.find((s) => s.id === id);
      if (!sub) return NextResponse.json({ error: "not found" }, { status: 404 });
      const today = new Date().toISOString().slice(0, 10);
      const updated = await repo.updateSubscription(id, {
        nextDate: advanceDate(sub.nextDate, sub.cycleMonths),
        lastPaidAt: today,
        status: sub.status === "payment-issue" ? "active" : sub.status,
        receipts: [
          ...(sub.receipts ?? []),
          { id: randomUUID(), date: today, amount: sub.price, note: "Marked as paid" },
        ],
      });
      return NextResponse.json(updated);
    }

    const { action: _ignored, ...patch } = body;
    const updated = await repo.updateSubscription(id, patch);
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const ok = await getRepo().deleteSubscription(id);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
