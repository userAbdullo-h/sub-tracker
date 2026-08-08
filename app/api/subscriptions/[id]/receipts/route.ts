import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { buildReceipt, deleteReceiptFile } from "@/lib/receipts";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const repo = getRepo();
    const sub = (await repo.listSubscriptions()).find((s) => s.id === id);
    if (!sub) return NextResponse.json({ error: "not found" }, { status: 404 });
    const receipt = await buildReceipt(await req.formData());
    const updated = await repo.updateSubscription(id, { receipts: [...(sub.receipts ?? []), receipt] });
    return NextResponse.json(updated, { status: 201 });
  } catch (r) {
    if (r instanceof Response) return r;
    return NextResponse.json({ error: r instanceof Error ? r.message : "upload failed" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const rid = req.nextUrl.searchParams.get("rid");
    const repo = getRepo();
    const sub = (await repo.listSubscriptions()).find((s) => s.id === id);
    if (!sub) return NextResponse.json({ error: "not found" }, { status: 404 });
    const receipt = (sub.receipts ?? []).find((r) => r.id === rid);
    if (!receipt) return NextResponse.json({ error: "receipt not found" }, { status: 404 });
    if (receipt.file) deleteReceiptFile(receipt.file);
    const updated = await repo.updateSubscription(id, {
      receipts: (sub.receipts ?? []).filter((r) => r.id !== rid),
    });
    return NextResponse.json(updated);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
