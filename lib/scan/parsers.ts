import type { DetectedKind } from "../types";
import type { EmailMessage } from "./source";

/** What a parser extracts from one email (before matching/persistence). */
export interface ParsedEvent {
  vendor: string;
  amount: number | null;
  kind: DetectedKind;
  /** Optional better date than the email date (e.g. a stated renewal date), YYYY-MM-DD. */
  date?: string;
}

export interface Parser {
  name: string;
  match(msg: EmailMessage): boolean;
  parse(msg: EmailMessage): ParsedEvent | null;
}

const text = (msg: EmailMessage) => `${msg.subject}\n${msg.plaintext || msg.snippet}`;

/** "159.99" | "1,234.56" | "59,99" (EU decimal comma) → number */
function parseNum(s: string): number {
  return Number(s.replace(/,(\d{2})$/, ".$1").replace(/,/g, ""));
}

/**
 * First money amount in a string. Handles "$19.00", "US$9.99",
 * "159.99 USD", "59,99 US$/year" (Google Play's EU format).
 */
function findAmount(s: string): number | null {
  const m = s.match(/\$\s?([\d.,]+\d)/) ?? s.match(/([\d.,]+\d)\s?(?:USD|US\$)/i);
  return m ? parseNum(m[1]) : null;
}

/** Prefer an explicitly labeled total/renewal amount over the first $ in the body. */
function findLabeledAmount(s: string): number | null {
  // \b keeps "Subtotal $7.00" from matching as "total"
  const m = s.match(/\b(?:total|amount (?:paid|charged)|renewal price):?\s*(?:US)?\$?\s?([\d.,]+\d)/i);
  return m ? parseNum(m[1]) : findAmount(s);
}

const fromMatches = (msg: EmailMessage, ...domains: string[]) =>
  domains.some((d) => msg.from.toLowerCase().includes(d));

export const PARSERS: Parser[] = [
  {
    // "Your receipt for AI Content Accelerator" / "was charged $19.00"
    name: "skool",
    match: (m) => fromMatches(m, "skool.com"),
    parse: (m) => {
      const vendor = m.subject.match(/receipt for (.+)$/i)?.[1]?.trim();
      if (!vendor) return null;
      const amount = findAmount(text(m).match(/was charged[^.]*/i)?.[0] ?? text(m));
      return { vendor: `${vendor} (Skool)`, amount, kind: "charge" };
    },
  },
  {
    // Stripe-run billing failure: "$40.00 payment to Manus AI was unsuccessful [again]"
    // Same template from failed-payments@stripe.com and failed-payments@mail.anthropic.com.
    name: "stripe-failure",
    match: (m) =>
      /^failed-payments/i.test(m.from) || (fromMatches(m, "stripe.com") && /unsuccessful/i.test(m.subject)),
    parse: (m) => {
      const s = m.subject.match(/\$([\d.,]+) payment to (.+?) was unsuccessful/i);
      if (!s) return null;
      return { vendor: s[2].trim(), amount: parseNum(s[1]), kind: "failure" };
    },
  },
  {
    // Stripe receipt template: "Your receipt from Anthropic, PBC #2992-3047-7694"
    // Body: "Amount paid $7.84"
    name: "stripe-receipt",
    match: (m) => /^invoice\+statements@/i.test(m.from) && /receipt from/i.test(m.subject),
    parse: (m) => {
      const vendor = m.subject.match(/receipt from (.+?)(?:\s*#|$)/i)?.[1]?.trim();
      if (!vendor) return null;
      return { vendor, amount: findLabeledAmount(text(m)), kind: "charge" };
    },
  },
  {
    // 2Checkout runs Bitdefender billing: receipts, failures, renewal notices.
    // Amounts as "159.99 USD"; expiry as "2026-08-23".
    name: "2checkout",
    match: (m) => fromMatches(m, "2checkout.com"),
    parse: (m) => {
      const body = text(m);
      const vendor = (
        m.subject.match(/failed payment notice for your (.+?) subscription/i)?.[1] ??
        m.subject.match(/^(.+?) auto-renewal notification/i)?.[1] ??
        body.match(/product name:?\s*([^\r\n]+?)(?:\s{2,}|\r|\n|$)/i)?.[1] ??
        body.match(/subscription for ([^,.\r\n]+)/i)?.[1] ??
        m.subject
      ).trim();
      const amount = findLabeledAmount(body);
      const expiry = body.match(/expir(?:e|ation date)[^\d]*(\d{4}-\d{2}-\d{2})/i)?.[1];
      if (/failed payment/i.test(m.subject)) return { vendor, amount, kind: "failure" };
      if (/auto-renewal notification/i.test(m.subject)) {
        return { vendor, amount, kind: "renewal_notice", date: expiry };
      }
      if (/payment receipt|has been approved/i.test(`${m.subject}\n${body}`)) {
        return { vendor, amount, kind: "charge" };
      }
      return null;
    },
  },
  {
    // Google Play receipts + refunds. Product name lives in the body;
    // amounts can be EU-formatted ("59,99 US$/year").
    name: "googleplay",
    match: (m) => fromMatches(m, "googleplay-noreply@google.com"),
    parse: (m) => {
      const body = text(m);
      if (/refund/i.test(m.subject)) {
        const r = body.match(/refund of \$([\d.,]+) for (.+?)[,.]?\s*(?:Transaction|$)/i);
        return {
          vendor: r?.[2]?.trim() ?? "Google Play",
          amount: r ? parseNum(r[1]) : findAmount(body),
          kind: "refund",
        };
      }
      if (/order receipt/i.test(m.subject)) {
        const vendor =
          body.match(/(?:subscription )?purchase from (.+?) on Google Play/i)?.[1]?.trim() ?? "Google Play";
        return { vendor, amount: findAmount(body), kind: "charge" };
      }
      return null;
    },
  },
  {
    // Proton: "Your current subscription to VPN Plus has renewed ... charged US$9.99"
    name: "proton",
    match: (m) => fromMatches(m, "proton.me", "protonmail.com"),
    parse: (m) => {
      const body = text(m);
      const plan = body.match(/subscription to ([^,.\r\n]+?) has/i)?.[1]?.trim();
      const vendor = plan ? `Proton ${plan}` : "Proton";
      if (/payment has failed/i.test(m.subject)) return { vendor, amount: findAmount(body), kind: "failure" };
      if (/has been renewed/i.test(m.subject)) return { vendor, amount: findAmount(body), kind: "charge" };
      if (/receipt|invoice/i.test(m.subject)) return { vendor, amount: findAmount(body), kind: "charge" };
      return null;
    },
  },
  {
    // "Purchase successful — credit added to your Replicate account"
    name: "replicate",
    match: (m) => fromMatches(m, "replicate.email", "replicate.com"),
    parse: (m) =>
      /purchase successful|payment was successful/i.test(text(m))
        ? { vendor: "Replicate", amount: findAmount(text(m)), kind: "charge" }
        : null,
  },
  {
    // "Action required: Your payment failed to process" (Canva)
    name: "canva-failure",
    match: (m) => fromMatches(m, "canva.com") && /payment failed/i.test(m.subject),
    parse: (m) => ({ vendor: "Canva", amount: findAmount(text(m)), kind: "failure" }),
  },
  {
    // "zenku-workspace has started a free trial of Slack Pro" and similar
    name: "trial",
    match: (m) => /free trial/i.test(m.subject),
    parse: (m) => ({
      vendor: m.subject.match(/free trial of (.+)$/i)?.[1]?.trim() ?? senderName(m.from),
      amount: null,
      kind: "trial",
    }),
  },
  {
    // Last resort: an email that talks money + billing language.
    // Catches ChatGPT ("Total: $22.40"), Scribd, Steam, unknown vendors.
    name: "generic",
    match: (m) =>
      /receipt|invoice|subscription|payment|purchase|renew/i.test(`${m.subject}\n${m.snippet}`),
    parse: (m) => {
      const body = text(m);
      const amount = findLabeledAmount(body);
      const failure = /payment (?:failed|was unsuccessful)|failed payment|could not (?:be )?charge/i.test(body);
      const renewal =
        /renew(?:s|al)?\s(?:on|date|for)|auto-?renew/i.test(body) &&
        !/receipt|charged|paid|subscribed|confirmation/i.test(m.subject);
      if (!amount && !failure && !renewal) return null;
      // "You've successfully subscribed to ChatGPT Plus." names the product
      // better than the sender domain ever could.
      const product = body.match(/subscribed to ([A-Z][\w .+-]{2,30}?)(?:[.,!\r\n]|$)/)?.[1]?.trim();
      return {
        vendor: product ?? senderName(m.from),
        amount,
        kind: failure ? "failure" : renewal ? "renewal_notice" : "charge",
      };
    },
  },
];

/** "noreply@tm.openai.com" → "Openai"; "bitdefender@2checkout.com" → "Bitdefender". */
function senderName(from: string): string {
  const addr = from.match(/<([^>]+)>/)?.[1] ?? from;
  const [local, domain] = addr.toLowerCase().split("@");
  const generic = /^(no-?reply|noreply|support|hello|billing|info|invoice.*|super-support|failed-payments.*)$/;
  const base = generic.test(local)
    ? domain.replace(/^(mail|tm|accounts|e|em|mailer|notify)\./, "").split(".")[0]
    : local;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Run the first matching parser; returns null when no parser understands the email. */
export function parseEmail(msg: EmailMessage): (ParsedEvent & { parser: string }) | null {
  for (const p of PARSERS) {
    if (!p.match(msg)) continue;
    const parsed = p.parse(msg);
    if (parsed) return { ...parsed, parser: p.name };
    // A sender-specific parser that matched but returned null means "recognized,
    // not billing-relevant" (e.g. a Scribd app-download mail) — stop rather than
    // letting the generic parser turn it into review-queue noise.
    if (p.name !== "generic") return null;
  }
  return null;
}
