# 💳 PayPilot

Personal subscription, purchase and (soon) API-usage autopilot. Full product spec: [SPEC.md](./SPEC.md).

**Phase 1** (this code): Next.js app with Google sign-in, MongoDB storage, subscription/purchase CRUD, and a renewals dashboard.
Coming next: Gmail auto-scan → Google Calendar sync → Telegram notifications → API token monitor.

> The old single-file tracker (`index.html`) is kept as a fallback — just open it in a browser.

## Local development (zero setup)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Out of the box `.env.local` sets `DEV_BYPASS_AUTH=true` (no Google sign-in needed) and data
is stored in `data/dev-db.json`, pre-seeded with the subscriptions found in the 2026-07-30 Gmail scan.

## Production setup

### 1. MongoDB Atlas
1. In your Atlas cluster, create a database user and allow network access (Vercel: `0.0.0.0/0` or IP allowlist).
2. Copy the connection string into `MONGODB_URI`.

On first run with an empty database, PayPilot seeds it with the initial data automatically.

### 2. Google OAuth (sign-in)
1. [Google Cloud Console](https://console.cloud.google.com/) → create a project → **APIs & Services → OAuth consent screen** (External, add yourself as test user).
2. **Credentials → Create credentials → OAuth client ID → Web application.**
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://YOUR-DOMAIN.vercel.app/api/auth/callback/google` (prod)
4. Put the client ID/secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

Only the account in `ALLOWED_EMAIL` can sign in — everyone else is rejected.

### 3. Deploy to Vercel

```bash
npx vercel
```

Then set the environment variables in the Vercel project settings (see `.env.example`):

| Variable | Value |
|---|---|
| `AUTH_SECRET` | long random string (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from Google Cloud |
| `ALLOWED_EMAIL` | your Gmail address |
| `MONGODB_URI` | Atlas connection string |
| `DEV_BYPASS_AUTH` | **do not set** in production |

## Project structure

```
app/
  page.tsx                 dashboard (server component)
  subscriptions/page.tsx   subscription list + CRUD
  purchases/page.tsx       purchase log + search
  settings/page.tsx        backup, env status
  signin/page.tsx          Google sign-in
  api/                     REST endpoints (subscriptions, purchases, backup, auth)
components/                Nav, list clients, dialogs, badges
lib/
  db.ts                    repository: MongoDB, or local JSON file when MONGODB_URI is unset
  calc.ts                  money/date/dashboard math
  seed.ts                  initial data from the Gmail scan
auth.ts, middleware.ts     Auth.js v5 (Google) + allowlist + DEV_BYPASS_AUTH
```

## Data safety

- `Settings → Export backup` downloads all data as JSON; `Import backup` restores it (replaces everything).
- The local dev database (`data/`) and env files are gitignored.
