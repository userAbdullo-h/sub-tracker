import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { buildConsentUrl, gmailOauthConfigured } from "@/lib/scan/google-auth";

/** Kicks off the incremental gmail.readonly consent flow ("Connect Gmail" button). */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    if (!gmailOauthConfigured()) {
      return NextResponse.json(
        { error: "AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET not set — see README OAuth setup" },
        { status: 400 }
      );
    }
    const redirectUri = new URL("/api/gmail/callback", req.nextUrl.origin).toString();
    return NextResponse.redirect(buildConsentUrl(redirectUri));
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
}
