# PayPilot — Personal Subscription & Payments Autopilot

**Author:** Abdulloh (with Claude) · **Date:** 2026-07-31 · **Status:** Draft for review

A full-stack web app that automatically tracks subscriptions and purchases by reading Gmail receipts, pushes renewal dates to Google Calendar, warns about upcoming/failed charges via Telegram, and monitors API credits/usage across pay-as-you-go services (Anthropic, Replicate, Hetzner, Higgsfield, …). Evolves the existing single-file tracker (`index.html`) into a real product.

---

## 1. Problem Statement

Abdulloh has ~15 active subscriptions across many providers (Anthropic, Google Play, Skool, 2Checkout, Proton, Vercel, MongoDB…) and regularly loses track of what renews when and for how much. The cost is real and documented in his inbox: **3 subscriptions currently have failing payments**, a **$159.99 Bitdefender auto-renewal** nearly went unnoticed, and recurring spend is **~$295+/month** with several prices unknown. A static tracker helps only if manually maintained — the maintenance itself is the thing that never happens.

## 2. Goals

1. **Zero surprise charges** — every renewal ≥ $10 produces a warning (Telegram + Calendar) at least 3 days before the charge date.
2. **Self-maintaining data** — ≥ 80% of new receipts/renewals appear in the app without manual entry, within 24h of the email arriving.
3. **Failed payments caught fast** — payment-failure emails are flagged in the app and pushed to Telegram within 24h.
4. **One trustworthy number** — the dashboard shows an accurate monthly recurring total (no "price unknown" gaps after month one).
5. **No silent API burn** — credit balances and month-to-date spend for pay-as-you-go services visible on the dashboard; alert when a balance drops below a threshold or burn rate spikes.
6. **Portfolio value** — a deployed, non-trivial full-stack project (OAuth, external APIs, cron, webhooks, provider adapters) presentable on a résumé/GitHub.

## 3. Non-Goals

- **Bank/card integration (Plaid-style)** — not available for Uzbek banks; email receipts are the data source. Revisit never.
- **Multi-currency (UZS)** — explicitly deferred by owner; USD only in v1. (P2 — design money fields to allow a currency code later.)
- **Multi-user / commercial SaaS** — single user (Google sign-in restricted to one email). Architecture may allow it later, but no team features, billing, or landing pages.
- **Mobile app** — responsive web + Telegram covers mobile needs.
- **Automatic cancellation of subscriptions** — the app informs; the human acts.

## 4. User Stories

Single persona: **the owner** (Abdulloh).

**Core (P0)**
- As the owner, I want to sign in with Google so that only I can access my data and the app can read my Gmail with the same grant.
- As the owner, I want the app to scan my Gmail daily so that new receipts, renewals, and failed payments update my subscription list without me typing anything.
- As the owner, I want a dashboard of monthly total, upcoming renewals, and payment issues so that one glance answers "what's coming and what's broken."
- As the owner, I want to review what the scanner found before it changes my data so that a mis-parsed email can't corrupt my records.
- As the owner, I want full manual CRUD on subscriptions and purchases so that things without email receipts (cash lessons, one-off buys) are tracked too.

**Integrations (P0 in their phases)**
- As the owner, I want every subscription's next renewal as a Google Calendar event with a reminder so that my phone warns me before charges.
- As the owner, I want my **existing Telegram bot** to send me a weekly digest and same-day alerts for failed payments and big (≥$50) upcoming charges so that warnings reach me where I actually look.
- As the owner, I want to create and edit my own notification rules (what triggers them, how many days before, Telegram or Calendar, and the message text) so that alerts match how I actually want to be nagged.

**Usage monitor (P0 in Phase 5)**
- As the owner, I want to connect my API providers (Anthropic, Replicate, Hetzner, Higgsfield) with their API keys so that the app polls balances/usage for me.
- As the owner, I want dashboard cards showing each service's remaining credits or month-to-date spend so that I see API burn next to my subscriptions.
- As the owner, I want a Telegram alert when a balance drops below my threshold or when estimated infra cost changes (e.g. a Hetzner server I forgot is still running) so that I stop leaks early.
- As the owner, I want manual balance entry for providers without a usable API so that every service appears on the dashboard even if it can't be polled.

**Edge cases**
- As the owner, I want the scanner to recognize the same subscription across different email formats (e.g. Anthropic receipt vs. Anthropic failed-payment) so that I don't get duplicates.
- As the owner, I want to dismiss/ignore a detected item (e.g. a one-off trial) so that noise doesn't accumulate.
- As the owner, I want the app to keep working (read-only) if Gmail/Calendar tokens expire, and clearly prompt me to re-connect.

## 5. Requirements

### Phase 1 — Core app (P0)
Web app with auth, database, and the current tracker's features rebuilt properly.

- **Stack:** Next.js (App Router, TypeScript) on Vercel · MongoDB Atlas (existing cluster) · NextAuth/Auth.js with Google provider.
- Sign-in restricted by env allowlist (`ALLOWED_EMAIL=abdullokhan3@gmail.com`). Unknown Google accounts see "not authorized."
- Subscriptions & Purchases CRUD, statuses (active / trial / payment-issue / canceled), notes, cycles (n-months), "mark paid" advancing next date.
- Dashboard: monthly recurring total, due-in-30-days, payment issues, upcoming list. Parity with current `index.html`, plus a spend-history chart.
- Seed script imports the current localStorage/seed data into MongoDB.
- ✅ *Acceptance:* deployed on Vercel; owner signs in from phone and laptop and sees the same data; another Google account is rejected.

### Phase 2 — Gmail auto-scan (P0)
- OAuth scope `gmail.readonly` requested at sign-in (incremental consent OK).
- Vercel Cron hits `/api/scan` daily; it searches Gmail (same query patterns used in the manual scan: receipts, renewals, failed payments, Google Play, 2Checkout, Stripe senders) for messages newer than the last scan watermark.
- Parser layer: per-sender parsers (Google Play, Skool, Anthropic/Stripe, 2Checkout, Proton, generic amount+date fallback) producing normalized `DetectedEvent { vendor, amount?, date, kind: charge|renewal_notice|failure|trial, sourceMsgId }`.
- Matching engine links events to existing subscriptions (by vendor alias table); unmatched events land in an **Inbox/Review queue** — nothing auto-creates or auto-edits records without one-click owner approval, except: a `charge` matching an existing subscription auto-advances its next-renewal date and logs to payment history (low-risk, reversible).
- Failure events set subscription status to `payment-issue` automatically and record the failure.
- Idempotent: re-scanning the same message ID never duplicates events.
- ✅ *Acceptance:* a new Skool receipt email appears as a payment in the app within 24h with no manual input; a Stripe failure email flips the subscription to payment-issue.

### Phase 3 — Google Calendar (P0)
- Scope `calendar.events`; a dedicated "💳 PayPilot" calendar is created on first sync.
- Each active subscription gets an event on its next-renewal date (all-day) with a popup reminder 3 days + 1 day before; amount and vendor in the title ("Bitdefender — $159.99 renews").
- Events update/move when renewal dates change (store `calendarEventId` per subscription); canceled subscriptions remove their events.
- ✅ *Acceptance:* changing a renewal date in the app moves the Calendar event within one sync; phone shows a reminder 3 days before a test renewal.

### Phase 4 — Telegram notifications (P0)
- **Reuses the owner's existing bot** — no new BotFather bot. The owner provides the bot's credentials (token, or the bot's own API endpoint if it has a backend); PayPilot sends through it. Owner's chat ID stored; all other chat IDs ignored.
- Weekly digest (Mon 09:00 Tashkent): renewals in next 14 days with amounts + current payment issues.
- Immediate alerts (on daily scan): new payment failure; upcoming charge ≥ $50 within 3 days.
- Bot commands: `/upcoming`, `/total`, `/issues` answering from the DB (only if the existing bot can delegate commands to PayPilot — e.g. webhook forwarding; otherwise commands are P1 and PayPilot is send-only).
- **Custom notification rules (P0)** — a Notifications settings page where the owner creates/edits rules instead of hardcoded behavior:
  - Rule = `{ trigger, condition, timing, channel, template, enabled }`
    - *Triggers:* upcoming renewal · payment failure detected · low provider balance · weekly digest · Hetzner cost change
    - *Conditions:* amount ≥ X, specific subscriptions/providers only, or all
    - *Timing:* N days before (renewals), immediate (failures/balances), cron expression (digests)
    - *Channel:* Telegram message and/or Calendar event/reminder
    - *Template:* editable message text with variables (`{name}`, `{amount}`, `{date}`, `{days_left}`, `{balance}`), with a live preview and "send test" button
  - The defaults above ship as pre-created rules the owner can edit or disable — nothing is hardcoded.
  - Per-rule delivery log (sent when, to which channel, success/failure).
- ✅ *Acceptance:* digest arrives Monday via the existing bot; a detected failure produces a Telegram message the same day; owner edits a rule's template and days-before, and the next notification reflects it; "send test" delivers instantly.

### Phase 5 — Token & Usage Monitor (P0)
Credit/usage tracking for pay-as-you-go services, alongside subscriptions.

- **Provider adapter interface**: each provider is a module declaring capabilities `{ balance?, usageMTD?, costEstimate? }` and implementing `poll(credentials) → Metrics`. Daily cron (same `/api/scan` family) polls all connected providers and appends to a time-series collection.
- **Credential storage**: API keys entered by the owner in the app UI, encrypted at rest (AES-256-GCM with a `CREDENTIALS_KEY` env secret), never sent to the client after saving, never logged. Server-side polling only.
- **Launch adapters**:
  - **Anthropic** — Admin API usage/cost reports (`/v1/organizations/usage_report`, `cost_report`) with an admin key. Shows MTD token usage + cost.
  - **Hetzner Cloud** — list servers/volumes/IPs + `/v1/pricing` → live estimated monthly cost; diff against yesterday to catch new/forgotten resources.
  - **Replicate** — account + predictions API (no documented billing endpoint): show prediction counts; spend via manual entry and/or Gmail receipt scan (Stripe emails).
  - **Higgsfield** — investigate credits API during implementation; fallback to manual balance card.
  - **Manual provider** — generic card: owner sets balance and optional expected burn/month; app decays the estimate and nags to refresh monthly.
- **Dashboard**: "API & Infra" section with one card per provider (balance or MTD spend, sparkline of last 30 days, staleness indicator when a poll fails).
- **Alerts (Telegram)**: balance below owner-set threshold; poll failing 3+ days (token expired?); Hetzner estimated cost changed > $5/mo.
- Failed polls degrade gracefully: card shows last known value + "stale since {date}".
- ✅ *Acceptance:* Anthropic MTD cost and Hetzner estimated monthly cost appear on the dashboard within one poll cycle of connecting keys; dropping a balance below threshold in a test produces a Telegram alert; API keys are not readable via any API response or page source after entry.

### Nice-to-Have (P1)
- Spend analytics page (monthly totals over time, by category/vendor; uses payment-history collection).
- Manual "Scan now" button + scan-log page (what ran, what was found, parse errors).
- Price-change detection ("Claude charged $112 but subscription says $90 — update?").
- Export/import JSON (parity with current backup tab).

### Future (P2) — design for, don't build
- Multi-currency (store `{amount, currency}` not bare number).
- Multi-user (userId on every document from day one — costs nothing now, enables later).
- Web push notifications as Telegram alternative.

## 6. Data Model (MongoDB, sketch)

```
subscriptions: { _id, userId, name, vendorAliases[], price?, cycleMonths, nextDate,
                 status, notes, calendarEventId?, createdAt, updatedAt }
purchases:     { _id, userId, name, price?, date, category, notes, sourceMsgId? }
payments:      { _id, userId, subscriptionId, amount, date, kind: charge|refund|failure, sourceMsgId }
detected:      { _id, userId, vendor, amount?, date, kind, sourceMsgId, status: pending|approved|dismissed, raw }
providers:     { _id, userId, type: anthropic|hetzner|replicate|higgsfield|manual, label,
                 encryptedCredentials?, alertThreshold?, manualBalance?, updatedAt }
notifyRules:   { _id, userId, trigger, condition{minAmount?, subscriptionIds?, providerIds?},
                 timing{daysBefore?|cron?}, channels[telegram|calendar], template, enabled }
notifyLog:     { _id, userId, ruleId, sentAt, channel, ok, error? }
usageSamples:  { _id, userId, providerId, at, balance?, spendMTD?, costEstimateMo?, raw }   // time series
meta:          { userId, lastScanAt, telegramChatId, gmailWatermark }
```

## 7. Success Metrics

- **Leading (first month):** ≥ 80% of new receipt emails auto-captured; 0 duplicate subscriptions created by scanner; scan cron success rate ≥ 95%.
- **Lagging (quarter):** 0 surprise charges (every charge was pre-announced); no subscription in `payment-issue` state longer than 7 days; "price unknown" count = 0.

## 8. Open Questions

- **(Owner, blocking for Phase 2)** Google Cloud project: Gmail scope `gmail.readonly` on a personal OAuth app in "testing" mode works for your own account without verification (100-user cap, 7-day refresh-token expiry unless app is set to "production"). Accept re-consent friction, or push app to production unverified for personal use? → Decide during Phase 2 setup.
- **(Owner, non-blocking)** Should purchases (one-time) also become Calendar entries, or Calendar is subscriptions-only? Default: subscriptions-only.
- **(Engineering, non-blocking)** Parser strategy for unknown senders: regex-only fallback vs. optional Claude API call to extract `{vendor, amount, date}` from email text. Start regex-only; LLM extraction is a fun P1.
- **(Owner, blocking for Phase 5 Anthropic adapter)** Admin API keys require a Console organization admin role — confirm your Anthropic account has Console/API access (as opposed to only a Claude subscription). If not, the Anthropic card falls back to Gmail-receipt-based tracking.
- **(Engineering, non-blocking)** Higgsfield: does their public API expose a credits/balance endpoint? *Finding 2026-08-08: their MCP server exposes `balance` (credits + plan) and `transactions` (spend/grant history) — the data exists programmatically. Remaining question is whether the same is reachable with an API key (for PayPilot's server-side polling) vs. only a user session. Fallback is the manual provider card.*
- **(Owner, non-blocking)** Hetzner: Cloud only, or also Robot (dedicated servers)? Robot has a separate API and auth. Default: Cloud only in v1.
- **(Owner, blocking for Phase 4)** Existing Telegram bot details: is it a plain bot token we can send through directly, or does it have its own backend/API that PayPilot should call? And is the bot free to receive new commands (`/upcoming` etc.), or is it busy with another purpose so PayPilot should be send-only?

## 9. Timeline & Phasing

No hard deadlines — hobby pace, each phase independently shippable:

| Phase | Scope | Rough effort |
|-------|-------|--------------|
| 1 | Next.js app + auth + DB + CRUD + dashboard, deployed | 1–2 sessions |
| 2 | Gmail scan pipeline + review queue | 2–3 sessions |
| 3 | Calendar sync | 1 session |
| 4 | Telegram (existing bot) + custom notification rules engine | 1–2 sessions |
| 5 | Token & usage monitor (adapters: Anthropic, Hetzner, Replicate, Higgsfield, manual) | 2 sessions |

Dependency notes: Phases 2–5 each need one-time credential setup by the owner (Google Cloud OAuth app; existing Telegram bot token/API; provider API keys). The existing `index.html` stays untouched as a fallback until Phase 1 reaches parity.
