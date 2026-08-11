import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    await requireUser();
    const events = await getRepo().listDetected();
    // Newest first; pending on top is the client's job
    events.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json(events);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
