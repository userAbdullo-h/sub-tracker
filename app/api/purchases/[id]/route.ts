import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { PurchaseInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const patch = (await req.json()) as Partial<PurchaseInput>;
    const updated = await getRepo().updatePurchase(id, patch);
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
    const ok = await getRepo().deletePurchase(id);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
