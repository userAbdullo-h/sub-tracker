import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { receiptPath, MIME } from "@/lib/receipts";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireUser();
    const { name } = await params;
    const p = receiptPath(name);
    if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
    const ext = name.split(".").pop()!.toLowerCase();
    return new NextResponse(new Uint8Array(fs.readFileSync(p)), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
