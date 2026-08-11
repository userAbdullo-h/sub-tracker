import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { exchangeCode } from "@/lib/scan/google-auth";

/** Google redirects here after consent; stores the refresh token for cron scans. */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(new URL("/settings?gmail=denied", req.nextUrl.origin));
    }
    const redirectUri = new URL("/api/gmail/callback", req.nextUrl.origin).toString();
    const { refreshToken } = await exchangeCode(code, redirectUri);
    if (!refreshToken) {
      return NextResponse.redirect(new URL("/settings?gmail=no-refresh-token", req.nextUrl.origin));
    }
    const repo = getRepo();
    const meta = await repo.getScanMeta();
    await repo.setScanMeta({ ...meta, gmailRefreshToken: refreshToken, gmailConnectedAt: new Date().toISOString() });
    return NextResponse.redirect(new URL("/settings?gmail=connected", req.nextUrl.origin));
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
