# PayPilot — Project Handoff / Context Log

> **Purpose:** this file lets a fresh Claude Code session (on any machine) continue the project with full context.
> Point Claude at this file and say "continue from HANDOFF.md".
> Keep it updated at the end of each working session.

## The story so far (updated 2026-08-07)

1. **Origin.** Owner (Abdulloh, abdullokhan3@gmail.com) kept losing track of subscriptions — surprise renewals,
   forgotten purchases, failed card payments (Visa •2390). Claude scanned his Gmail (read-only) and found ~16
   subscriptions, including 3 with failing payments and a $159.99 Bitdefender auto-renewal due ~Aug 8–23, 2026.
2. **v0: single-file tracker.** `index.html` — self-contained localStorage app, seeded with the Gmail findings.
   Kept as a working fallback; not part of the Next.js build.
3. **Pivot to a real product.** Owner wanted a bigger portfolio project with external integrations.
   Full PRD written → `SPEC.md` (project name **PayPilot**, 5 phases). Key decisions:
   - Stack: Next.js + TypeScript on Vercel, MongoDB Atlas (owner already pays for both), Auth.js (Google), Vercel Cron.
   - Gmail auto-scan with a human review queue (scanner never silently edits data; only auto-advance on matched charges).
   - Google Calendar sync (dedicated "PayPilot" calendar, reminders 3d + 1d before).
   - Telegram: **reuse owner's existing bot** (NOT BotFather-new). Open question: plain token vs. bot's own backend API; send-only vs. commands.
   - Custom notification rules engine (trigger/condition/timing/channel/template) — P0, nothing hardcoded.
   - Phase 5: token/usage monitor via provider adapters — Anthropic (Admin API), Hetzner Cloud (cost estimate from resources),
     Replicate (no billing API — manual/Gmail fallback), Higgsfield (API TBD), generic manual cards. Keys encrypted at rest.
   - Non-goals: bank integration (impossible in UZ), multi-currency UZS (deferred P2), multi-user SaaS, mobile app, auto-cancel.
4. **Phase 1 BUILT & VERIFIED (2026-08-07).** Full Next.js app in this repo — see structure in `README.md`.
   All flows tested in browser: dashboard stats, CRUD, mark-paid advancing dates, backup export/import, zero console/server errors.

## Current state

- **Works now, zero setup:** `npm install && npm run dev` → http://localhost:3000.
  `.env.local` has `DEV_BYPASS_AUTH=true` (no Google needed locally); data in `data/dev-db.json` (gitignored!).
- **Phase 1 done.** Phases 2–5 not started.
- **Legacy:** `index.html` (v0 tracker) still works standalone.

## Not in git (transfer manually if needed)

- `.env.local` — recreate from `.env.example` (dev values are trivial; see README)
- `data/dev-db.json` — the actual live data while in file-mode; export a JSON backup from Settings, or copy the file
- Claude auto-memory is machine-local — this file replaces it cross-machine

## Owner's blocking TODOs (before/during next phases)

- [ ] Google Cloud project: OAuth consent screen + Web client → `AUTH_GOOGLE_ID/SECRET` (needed for real sign-in AND Phase 2 Gmail scope)
- [ ] MongoDB Atlas: connection string → `MONGODB_URI`
- [ ] Vercel: deploy + env vars (see README table)
- [ ] Phase 4 decision: existing Telegram bot — token or backend API? send-only or can take commands?
- [ ] Phase 5 check: does Anthropic account have Console/Admin API access?

## Next work item

**Phase 2 — Gmail auto-scan** (see SPEC.md §Phase 2): OAuth `gmail.readonly` incremental consent, `/api/scan` + Vercel Cron,
per-sender parsers (Google Play, Skool, Anthropic/Stripe, 2Checkout, Proton, generic), vendor-alias matching engine,
review queue (`detected` collection), auto-advance matched charges, auto-flag failures. Gmail search queries that worked
for the manual scan are documented in the git history of this session's work — or re-derive: category:purchases,
subject:(receipt OR invoice), "your subscription" OR "renews on", sender-specific (googleplay-noreply, 2checkout, stripe).

## Session log

- **2026-07-30:** Gmail scan → built v0 `index.html`, then visual redesign (Inter/JetBrains Mono, avatars, glassy dark UI).
- **2026-07-31:** Pivot decision → SPEC.md drafted → +Phase 5 (token monitor) → +existing-bot reuse + custom notification rules.
- **2026-08-07:** Phase 1 scaffolded, built, browser-verified. README + this handoff written. Pushed to github.com/userAbdullo-h/sub-tracker.
- **2026-08-08:** Premium UI redesign — card grids for subscriptions/purchases (.card-grid/.sub-card), refined design tokens (solid surfaces, single accent, tabular numbers), page headers, clickable "+ set price" badge opens the edit dialog. Verified desktop + mobile. Also confirmed Higgsfield MCP exposes balance/transactions (noted in SPEC.md Phase 5). Owner deleted Manus Pro from their data.
- **2026-08-08 (later):** "Aurora" UI overhaul (design system v3) per owner request for a big, lighter, 3D look: light theme is now DEFAULT with dark as toggle (ThemeToggle in nav, pp-theme in localStorage, pre-hydration init script in layout.tsx); animated aurora gradient blobs behind every page; glass (backdrop-blur) nav/stat cards; 3D tilt hover on sub-cards; shine-sweep primary buttons; dashboard hero section with Higgsfield-generated 3D artwork (public/hero.png — glass credit cards + coins, generated via nano_banana_pro, prompt in git history) with theme-aware overlay. Gotcha fixed: generic `section h2` styles must stay scoped with :not(.hero). Verified both themes, desktop + mobile.
- **2026-08-08 (later still):** Categories + logos. Subscriptions now have `category` + `logoDomain` (auto-inferred via lib/vendors.ts regex map, normalized on read in lib/db.ts — migrates old records on the fly). Subscriptions page groups cards by category (ordered by monthly spend) with 3D pastel-glass category icons (public/icons/*.png, Higgsfield nano_banana_pro, resized to 256px). Service logos = real favicons via Google s2 endpoint in components/Logo.tsx with 3-level fallback (favicon → category icon → letter tile). Purchases + dashboard rows use Logo too. Category select added to the subscription dialog. Note: two icon generations failed on first attempt (gear+wrench, coin with dollar sign) — simplified prompts succeeded.
- **2026-08-08 (evening):** Purchases page got the same category-group treatment (PURCHASE_ICON headers, spend-ordered). Web-researched and added the owner's 5 dev courses as purchases (in their live data, not seed): AIforUI $199, CSS for JS Devs (Comeau, price null — tiered), Three.js Journey (Bruno Simon) $95, Epic React (Dodds) $119, Animations on the Web (Kowalski) $199 — all with domains in the vendor map for real favicons, notes carry list-price caveats, purchase dates unknown (set to 2026-08-08). Owner should correct prices/dates to actuals. Next: Phase 2 (Gmail scan) — waiting on owner's Google OAuth credentials.
