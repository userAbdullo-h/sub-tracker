// Vendor recognition: maps service names to real domains (for favicons) and categories.

export const CATEGORIES = [
  "AI Tools",
  "Entertainment",
  "Learning",
  "Security & Privacy",
  "Dev & Infra",
  "Design & Creative",
  "Utilities",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_ICONS: Record<string, string> = {
  "AI Tools": "/icons/ai.png",
  Entertainment: "/icons/entertainment.png",
  Learning: "/icons/learning.png",
  "Security & Privacy": "/icons/security.png",
  "Dev & Infra": "/icons/dev.png",
  "Design & Creative": "/icons/design.png",
  Utilities: "/icons/utilities.png",
  Other: "/icons/other.png",
};

// Purchase categories reuse the same icon set
export const PURCHASE_ICON: Record<string, string> = {
  "Course / Lesson": CATEGORY_ICONS["Learning"],
  Software: CATEGORY_ICONS["Utilities"],
  Game: CATEGORY_ICONS["Entertainment"],
  Membership: CATEGORY_ICONS["Other"],
  Other: CATEGORY_ICONS["Other"],
};

const VENDORS: Array<[RegExp, { domain: string; category: Category }]> = [
  [/claude|anthropic/i, { domain: "anthropic.com", category: "AI Tools" }],
  [/manus/i, { domain: "manus.im", category: "AI Tools" }],
  [/higgsfield/i, { domain: "higgsfield.ai", category: "AI Tools" }],
  [/replicate/i, { domain: "replicate.com", category: "AI Tools" }],
  [/google ai|gemini/i, { domain: "gemini.google.com", category: "AI Tools" }],
  [/skool/i, { domain: "skool.com", category: "Learning" }],
  [/duolingo/i, { domain: "duolingo.com", category: "Learning" }],
  [/scribd/i, { domain: "scribd.com", category: "Learning" }],
  [/udemy/i, { domain: "udemy.com", category: "Learning" }],
  [/coursera/i, { domain: "coursera.org", category: "Learning" }],
  [/proton/i, { domain: "proton.me", category: "Security & Privacy" }],
  [/bitdefender/i, { domain: "bitdefender.com", category: "Security & Privacy" }],
  [/1password/i, { domain: "1password.com", category: "Security & Privacy" }],
  [/nordvpn/i, { domain: "nordvpn.com", category: "Security & Privacy" }],
  [/vercel/i, { domain: "vercel.com", category: "Dev & Infra" }],
  [/mongodb|atlas/i, { domain: "mongodb.com", category: "Dev & Infra" }],
  [/hetzner/i, { domain: "hetzner.com", category: "Dev & Infra" }],
  [/github/i, { domain: "github.com", category: "Dev & Infra" }],
  [/wordpress/i, { domain: "wordpress.com", category: "Dev & Infra" }],
  [/canva/i, { domain: "canva.com", category: "Design & Creative" }],
  [/adobe/i, { domain: "adobe.com", category: "Design & Creative" }],
  [/figma/i, { domain: "figma.com", category: "Design & Creative" }],
  [/netflix/i, { domain: "netflix.com", category: "Entertainment" }],
  [/spotify/i, { domain: "spotify.com", category: "Entertainment" }],
  [/youtube/i, { domain: "youtube.com", category: "Entertainment" }],
  [/chess\.?com|chess/i, { domain: "chess.com", category: "Entertainment" }],
  [/steam/i, { domain: "steampowered.com", category: "Entertainment" }],
  [/iobit|driver booster|systemcare|smart defrag|malware fighter/i, { domain: "iobit.com", category: "Utilities" }],
  [/microsoft|onedrive|office/i, { domain: "microsoft.com", category: "Utilities" }],
  [/telegram/i, { domain: "telegram.org", category: "Utilities" }],
  [/google one|google play/i, { domain: "one.google.com", category: "Utilities" }],
];

export function inferVendor(name: string): { domain?: string; category: Category } {
  for (const [re, info] of VENDORS) {
    if (re.test(name)) return info;
  }
  return { category: "Other" };
}

/** Fill in category/logoDomain when missing (migrates pre-category records on the fly). */
export function normalizeSub<T extends { name: string; category?: string; logoDomain?: string }>(sub: T): T {
  const inferred = inferVendor(sub.name);
  return {
    ...sub,
    category: sub.category && (CATEGORIES as readonly string[]).includes(sub.category) ? sub.category : inferred.category,
    logoDomain: sub.logoDomain ?? inferred.domain,
  };
}
