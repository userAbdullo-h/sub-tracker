import Nav from "@/components/Nav";
import BackupClient from "@/components/BackupClient";
import { getRepo, usingFileFallback } from "@/lib/db";
import { devBypass } from "@/lib/session";
import { gmailOauthConfigured } from "@/lib/scan/google-auth";

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

export default async function SettingsPage() {
  const fileDb = usingFileFallback();
  const bypass = devBypass();
  const googleReady = gmailOauthConfigured();
  const meta = await getRepo().getScanMeta();
  const gmailConnected = !!meta.gmailRefreshToken;

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
        <h2>Gmail scan</h2>
        <div className="item" style={{ animation: "none" }}>
          <div className="grow">
            <div className="name">Gmail connection</div>
            <div className="meta">
              {gmailConnected
                ? `Connected${meta.gmailConnectedAt ? " on " + new Date(meta.gmailConnectedAt).toLocaleDateString() : ""}. The daily scan reads receipts with the gmail.readonly scope.`
                : googleReady
                  ? "Grant read-only Gmail access so the scan can find receipts, renewals and failed payments."
                  : "Waiting on Google OAuth credentials (AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET). Until then the Review page can only scan local sample emails."}
            </div>
          </div>
          {gmailConnected ? (
            <span className="badge b-active">connected</span>
          ) : googleReady ? (
            <a className="btn-secondary" href="/api/gmail/connect">Connect Gmail</a>
          ) : (
            <span className="badge b-due">pending</span>
          )}
        </div>
        {meta.lastScanAt && (
          <div className="note-banner">
            Last scan: <b suppressHydrationWarning>{new Date(meta.lastScanAt).toLocaleString()}</b>
          </div>
        )}
      </section>

      <section>
        <h2>Environment status</h2>
        <EnvRow
          label="Database"
          ok={!fileDb}
          okText="MongoDB Atlas connected"
          badText="Using the local file data/dev-db.json, which is for development only. Set MONGODB_URI to use Atlas."
        />
        <EnvRow
          label="Google sign-in"
          ok={googleReady}
          okText="Google OAuth credentials configured"
          badText="AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are not set. Both are required before deploying."
        />
        <EnvRow
          label="Auth mode"
          ok={!bypass}
          okText="Full authentication enforced"
          badText="DEV_BYPASS_AUTH is true, so sign-in is skipped. Local development only."
        />
      </section>

      <section>
        <h2>Coming in later phases</h2>
        <div className="note-banner">
          Google Calendar sync (Phase 3), Telegram notifications with custom rules (Phase 4), and an
          API token &amp; usage monitor for Anthropic, Hetzner, Replicate and Higgsfield (Phase 5). See SPEC.md.
        </div>
      </section>
    </div>
  );
}
