import Nav from "@/components/Nav";
import BackupClient from "@/components/BackupClient";
import { usingFileFallback } from "@/lib/db";
import { devBypass } from "@/lib/session";

export const dynamic = "force-dynamic";

function EnvRow({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="item" style={{ animation: "none" }}>
      <div className="grow">
        <div className="name">{label}</div>
        <div className="meta">{ok ? okText : badText}</div>
      </div>
      <span className={`badge ${ok ? "b-active" : "b-due"}`}>{ok ? "configured" : "pending"}</span>
    </div>
  );
}

export default function SettingsPage() {
  const fileDb = usingFileFallback();
  const bypass = devBypass();
  const googleReady = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return (
    <div className="wrap">
      <Nav />

      <section>
        <h2>Backup</h2>
        <div className="note-banner">
          Export your data as JSON regularly, and before any migration. Import replaces all current data.
        </div>
        <BackupClient />
      </section>

      <section>
        <h2>Environment status</h2>
        <EnvRow
          label="Database"
          ok={!fileDb}
          okText="MongoDB Atlas connected"
          badText="Using local file (data/dev-db.json) — dev only. Set MONGODB_URI to use Atlas."
        />
        <EnvRow
          label="Google sign-in"
          ok={googleReady}
          okText="Google OAuth credentials configured"
          badText="AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET not set — required before deploying."
        />
        <EnvRow
          label="Auth mode"
          ok={!bypass}
          okText="Full authentication enforced"
          badText="DEV_BYPASS_AUTH=true — sign-in is skipped. Local development only!"
        />
      </section>

      <section>
        <h2>Coming in later phases</h2>
        <div className="note-banner">
          Phase 2: Gmail auto-scan · Phase 3: Google Calendar sync · Phase 4: Telegram notifications with custom rules ·
          Phase 5: API token &amp; usage monitor (Anthropic, Hetzner, Replicate, Higgsfield). See SPEC.md.
        </div>
      </section>
    </div>
  );
}
