import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { PurchaseInput } from "@/lib/types";

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await getRepo().listPurchases());
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = (await req.json()) as PurchaseInput;
    if (!body.name?.trim() || !body.date) {
      return NextResponse.json({ error: "name and date are required" }, { status: 400 });
    }
    const pur = await getRepo().createPurchase({
      name: body.name.trim(),
      price: body.price ?? null,
      date: body.date,
      category: body.category ?? "Other",
      notes: body.notes?.trim() ?? "",
    });
    return NextResponse.json(pur, { status: 201 });
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
