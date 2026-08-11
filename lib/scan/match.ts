import type { Subscription } from "../types";
import { inferVendor } from "../vendors";

/**
 * Extra aliases for vendors whose email name differs from the subscription name.
 * Key: lowercased token from the email; value: lowercased token expected in the sub name.
 */
const ALIASES: Array<[RegExp, RegExp]> = [
  [/anthropic/i, /claude|anthropic/i],
  [/manus/i, /manus/i],
  [/google (?:one|ai|play|commerce)/i, /google (?:one|ai)/i],
  [/openai|chatgpt/i, /chatgpt|openai/i],
  [/bitdefender/i, /bitdefender/i],
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Link a detected vendor string to an existing subscription.
 * Tried in order: explicit alias table → shared logo domain (lib/vendors map) →
 * name containment either way.
 */
export function matchSubscription(vendor: string, subs: Subscription[]): Subscription | undefined {
  const candidates = subs.filter((s) => s.status !== "canceled");
  const v = norm(vendor);

  for (const [emailRe, subRe] of ALIASES) {
    if (emailRe.test(vendor)) {
      const hit = candidates.find((s) => subRe.test(s.name));
      if (hit) return hit;
    }
  }

  // Domain match is only trustworthy when unambiguous (two Skool memberships
  // share skool.com — fall through to name matching in that case).
  const domain = inferVendor(vendor).domain;
  if (domain) {
    const hits = candidates.filter((s) => s.logoDomain === domain);
    if (hits.length === 1) return hits[0];
  }

  return candidates.find((s) => {
    const n = norm(s.name);
    return n.includes(v) || v.includes(n);
  });
}
