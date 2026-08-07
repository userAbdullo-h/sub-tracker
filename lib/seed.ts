import type { SubscriptionInput, PurchaseInput } from "./types";

// Initial data from the Gmail scan of 2026-07-30 (see SPEC.md and the legacy index.html tracker)
export const seedSubscriptions: SubscriptionInput[] = [
  { name: "Claude (Anthropic)", price: 112.0, cycleMonths: 1, nextDate: "2026-08-25", status: "active", notes: "Billing cycle was reset to Jul 25, 2026 after a late payment. Card failed several times in May–Jul — keep balance on card ending 2390." },
  { name: "AI Content Accelerator (Skool)", price: 19.0, cycleMonths: 1, nextDate: "2026-08-29", status: "active", notes: "Last charged Jul 29, 2026 on Visa •2390." },
  { name: "Chase AI+ (Skool)", price: 98.0, cycleMonths: 1, nextDate: "2026-07-24", status: "payment-issue", notes: "Jul 24, 2026 charge FAILED. Update the card or cancel the membership — otherwise access may lapse." },
  { name: "Manus Pro", price: 40.0, cycleMonths: 1, nextDate: "2026-07-20", status: "payment-issue", notes: "$40 charge failing since Jul 20, 2026 (multiple retries via Stripe). Fix card or cancel." },
  { name: "Google AI Pro 5TB (Google One)", price: null, cycleMonths: 1, nextDate: "2026-08-29", status: "active", notes: "Activated Jul 29, 2026 (previous AI Plus 400GB plan refunded $44.24). Check exact price in Play Store → Subscriptions." },
  { name: "Proton VPN Plus", price: 9.99, cycleMonths: 1, nextDate: "2026-08-06", status: "active", notes: "Renews around the 6th each month. First charge attempts often fail — top up card before the 6th." },
  { name: "Bitdefender Ultimate Security", price: 159.99, cycleMonths: 12, nextDate: "2026-08-23", status: "active", notes: "AUTO-RENEWS $159.99 via 2Checkout — will be charged up to 15 days BEFORE Aug 23, 2026 (so from ~Aug 8). Cancel in Bitdefender Central → My Subscriptions if you don't want it." },
  { name: "IObit PRO bundle (6 apps)", price: null, cycleMonths: 14, nextDate: "2027-08-12", status: "active", notes: "Driver Booster, Advanced SystemCare, Smart Defrag, Software Updater, Uninstaller, Malware Fighter — 14-month subs bought Jun 12, 2026 via 2Checkout." },
  { name: "Duolingo Family Plan", price: null, cycleMonths: 12, nextDate: "2027-06-19", status: "active", notes: "Via Google Play, renews Jun 19, 2027. Check price in Play Store → Subscriptions." },
  { name: "Chess.com (Google Play)", price: 22.99, cycleMonths: 12, nextDate: "2026-11-25", status: "canceled", notes: "Canceled — access ends Nov 25, 2026, no further charges." },
  { name: "WordPress.com (userabdullo.link)", price: null, cycleMonths: 12, nextDate: "2027-04-06", status: "active", notes: "Renewed Apr 6, 2026 on Visa •2390 (Receipt #116035486)." },
  { name: "1Password (Annual, 1 user)", price: 35.91, cycleMonths: 12, nextDate: "2027-01-14", status: "active", notes: "Charged Jan 14, 2026 → next Jan 14, 2027." },
  { name: "Vercel", price: null, cycleMonths: 1, nextDate: "2026-08-28", status: "active", notes: "Receipts arrive ~28th monthly. Pro plan is typically $20/mo — confirm in receipt email." },
  { name: "MongoDB Atlas", price: null, cycleMonths: 1, nextDate: "2026-08-02", status: "active", notes: "Usage-based billing, invoiced ~2nd of month (Abdullo's Org)." },
  { name: "Scribd", price: null, cycleMonths: 1, nextDate: "2026-08-30", status: "active", notes: "Subscription confirmed Jun 30, 2026. Confirm price (~$11.99/mo) and whether still active." },
  { name: "Canva Pro", price: null, cycleMonths: 1, nextDate: "2026-06-10", status: "payment-issue", notes: "Trial started May 11, 2026; charges failing since Jun 10 (insufficient funds). Probably lapsed — confirm and delete if canceled." },
];

export const seedPurchases: PurchaseInput[] = [
  { name: "Steam purchase (games/items)", price: null, date: "2026-05-15", category: "Game", notes: "Items added to Steam library — check Steam purchase history for amount." },
  { name: "IObit software order (2 orders)", price: null, date: "2025-09-01", category: "Software", notes: "Orders #260468041 and #260605597 on iobit.com via 2Checkout." },
  { name: "Galaxy Theme — Retro Monochrome Working Desk", price: null, date: "2025-10-11", category: "Software", notes: "Samsung Galaxy Themes, order 2025101112G69103481." },
  { name: "Google Play purchase (POMELO TECH)", price: null, date: "2025-10-06", category: "Other", notes: "Order GPA.3301-4562-6547-51089." },
];
