import { getRepo } from "../db";
import { FileSource, GoogleGmailSource, type GmailSource } from "./source";

/**
 * Standalone incremental-consent OAuth for the gmail.readonly scope.
 * Kept out of NextAuth: sign-in stays a plain identity grant; Gmail access is a
 * separate one-click "Connect Gmail" flow whose refresh token is stored server-side
 * so the daily cron can scan without a live browser session.
 */

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

function creds() {
  const id = process.env.AUTH_GOOGLE_ID;
  const secret = process.env.AUTH_GOOGLE_SECRET;
  if (!id || id === "unset" || !secret || secret === "unset") return null;
  return { id, secret };
}

export function gmailOauthConfigured(): boolean {
  return creds() !== null;
}

export function buildConsentUrl(redirectUri: string): string {
  const c = creds();
  if (!c) throw new Error("AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET not configured");
  const params = new URLSearchParams({
    client_id: c.id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // force a refresh token even on re-connect
    login_hint: process.env.ALLOWED_EMAIL ?? "",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Google token endpoint ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{ refreshToken: string | null }> {
  const c = creds()!;
  const json = await tokenRequest({
    code,
    client_id: c.id,
    client_secret: c.secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  return { refreshToken: (json.refresh_token as string) ?? null };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const c = creds()!;
  const json = await tokenRequest({
    refresh_token: refreshToken,
    client_id: c.id,
    client_secret: c.secret,
    grant_type: "refresh_token",
  });
  return json.access_token as string;
}

/**
 * Pick the scan source: real Gmail when OAuth is configured and the owner has
 * connected Gmail; otherwise the local fixture file (dev / not-yet-connected).
 */
export async function getScanSource(): Promise<{ source: GmailSource; mode: "gmail" | "fixtures" }> {
  const meta = await getRepo().getScanMeta();
  if (gmailOauthConfigured() && meta.gmailRefreshToken) {
    const accessToken = await refreshAccessToken(meta.gmailRefreshToken);
    return { source: new GoogleGmailSource(accessToken), mode: "gmail" };
  }
  return { source: new FileSource(), mode: "fixtures" };
}
