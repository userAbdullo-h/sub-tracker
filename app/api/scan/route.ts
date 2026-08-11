import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { runScan } from "@/lib/scan/scan";
import { getScanSource } from "@/lib/scan/google-auth";

/** Owner session (Scan now button) or Vercel Cron's Authorization header. */
async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return (await currentUser()) !== null;
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { source, mode } = await getScanSource();
    const result = await runScan(source);
    const { events, ...counts } = result;
    void events;
    return NextResponse.json({ mode, ...counts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "scan failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return handle(req); }
// Vercel Cron invokes with GET
export async function GET(req: NextRequest) { return handle(req); }
