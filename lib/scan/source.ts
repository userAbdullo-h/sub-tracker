import fs from "fs";
import path from "path";

/** A minimal email shape the parsers work on — plaintext only, no HTML. */
export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string; // ISO
  snippet: string;
  plaintext: string;
}

export interface GmailSource {
  /** Fetch receipt-ish messages newer than the watermark (epoch seconds), oldest first. */
  search(afterEpochSec: number | null): Promise<EmailMessage[]>;
}

/**
 * The Gmail query the manual scan was built on: purchases category plus
 * receipt/renewal/failure keywords and known billing senders.
 */
export const SCAN_QUERY = [
  "{",
  "category:purchases",
  'subject:(receipt OR invoice OR renewal OR "payment failed" OR "was unsuccessful")',
  '"your subscription"',
  '"renews on"',
  "from:googleplay-noreply@google.com",
  "from:2checkout.com",
  "from:stripe.com",
  "from:skool.com",
  "from:mail.anthropic.com",
  "}",
].join(" ");

/* ---------------- Fixture source (local dev, no OAuth) ---------------- */

/** Reads data/scan-fixtures.json — real emails captured for parser development. */
export class FileSource implements GmailSource {
  private file = path.join(process.cwd(), "data", "scan-fixtures.json");

  async search(afterEpochSec: number | null): Promise<EmailMessage[]> {
    if (!fs.existsSync(this.file)) return [];
    const all = JSON.parse(fs.readFileSync(this.file, "utf-8")) as EmailMessage[];
    return all
      .filter((m) => afterEpochSec == null || new Date(m.date).getTime() / 1000 > afterEpochSec)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

/* ---------------- Real Gmail API source (needs OAuth token) ---------------- */

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function findPlainText(part: GmailPart): string | null {
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8");
  }
  for (const p of part.parts ?? []) {
    const found = findPlainText(p);
    if (found) return found;
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Talks to the Gmail REST API with the signed-in owner's OAuth access token. */
export class GoogleGmailSource implements GmailSource {
  constructor(private accessToken: string) {}

  private async api(pathname: string): Promise<Record<string, unknown>> {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${pathname}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async search(afterEpochSec: number | null): Promise<EmailMessage[]> {
    const q = afterEpochSec ? `${SCAN_QUERY} after:${afterEpochSec}` : SCAN_QUERY;
    const messages: EmailMessage[] = [];
    let pageToken: string | undefined;
    do {
      const page = (await this.api(
        `messages?q=${encodeURIComponent(q)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`
      )) as { messages?: Array<{ id: string }>; nextPageToken?: string };
      for (const { id } of page.messages ?? []) {
        const full = (await this.api(`messages/${id}?format=full`)) as {
          id: string;
          snippet?: string;
          internalDate?: string;
          payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
        };
        const header = (name: string) =>
          full.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
        const plain =
          (full.payload && findPlainText(full.payload)) ??
          (full.payload?.body?.data
            ? stripHtml(Buffer.from(full.payload.body.data, "base64url").toString("utf-8"))
            : "");
        messages.push({
          id: full.id,
          from: header("from"),
          subject: header("subject"),
          date: new Date(Number(full.internalDate)).toISOString(),
          snippet: full.snippet ?? "",
          plaintext: plain ?? "",
        });
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return messages.sort((a, b) => a.date.localeCompare(b.date));
  }
}
