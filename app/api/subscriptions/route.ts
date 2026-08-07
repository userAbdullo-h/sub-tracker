import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { SubscriptionInput } from "@/lib/types";

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await getRepo().listSubscriptions());
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = (await req.json()) as SubscriptionInput;
    if (!body.name?.trim() || !body.nextDate) {
      return NextResponse.json({ error: "name and nextDate are required" }, { status: 400 });
    }
    const sub = await getRepo().createSubscription({
      name: body.name.trim(),
      price: body.price ?? null,
      cycleMonths: Number(body.cycleMonths) || 1,
      nextDate: body.nextDate,
      status: body.status ?? "active",
      notes: body.notes?.trim() ?? "",
    });
    return NextResponse.json(sub, { status: 201 });
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
