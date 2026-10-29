import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CalAiSettingsPage() {
  const configured = Boolean(process.env.CAL_AI_WEBHOOK_SECRET && process.env.DATABASE_URL);
  const ownerFallbackConfigured = Boolean(process.env.CINDER_OWNER_ID);
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "28px 22px 60px", color:"#e5e5e5" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <Link href="/crm/settings" style={{ color:"#a1a1a1", textDecoration: "none", fontSize: 13 }}>← Settings</Link>
        <span style={{ fontSize: 11, border:"1px solid #303030", borderRadius: 20, padding: "6px 10px" }}>Integration setup</span>
      </header>
      <section style={{ marginTop: 36, maxWidth: 760 }}>
        <p style={{ fontSize: 10, letterSpacing: 2, color:"#a95335", fontWeight: 700 }}>CINDER / CAL.AI</p>
        <h1 style={{ fontSize: 38, letterSpacing: -1.5, margin: "8px 0" }}>Cal.ai scheduling<span style={{ color:"#a95335" }}>.</span></h1>
        <p style={{ color:"#a1a1a1", lineHeight: 1.65, fontSize: 14 }}>
          Sync Cal.com booking events into Cinder so meetings stay attached to the agency's contacts and daily workflow. Cal.ai phone calls are configured in Cal.com Workflows; Cinder does not start prospecting calls.
        </p>
      </section>
      <section style={{ marginTop: 24, border:"1px solid #303030", borderRadius: 14, padding: 22, background:"#171717" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Connection status</h2>
        <p style={{ fontSize: 13, color:configured ? "#86efac" : "#8b5b20", margin: "0 0 14px" }}>
          {configured ? "Webhook endpoint configured at the environment level." : "Not configured — add the required server-side environment variable before enabling a webhook."}
        </p>
        <p style={{ fontSize: 13, color:"#a1a1a1", lineHeight: 1.6, margin: 0 }}>
          Endpoint: <code>/api/webhooks/cal-ai</code><br />
          Signature verification: HMAC SHA-256 via <code>X-Cal-Signature-256</code><br />
          Owner fallback configured: {ownerFallbackConfigured ? "Yes" : "No (booking must match an existing contact email)"}<br />
          Database migration: <code>db/migrations/0013_cal_ai_booking_sync.sql</code>
        </p>
      </section>
      <section style={{ marginTop: 16, border:"1px solid #303030", borderRadius: 14, padding: 22, background:"#171717" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Setup checklist</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 14, color:"#a1a1a1" }}>
          <li>Apply the migration to the intended Cinder database through the normal release process.</li>
          <li>Set <code>CAL_AI_WEBHOOK_SECRET</code> in the deployment environment and keep it server-side.</li>
          <li>Optionally set <code>CINDER_OWNER_ID</code> if bookings should be recorded even when the invitee email does not match a saved contact. Do not use an arbitrary user ID.</li>
          <li>In Cal.com, create a webhook for booking created, rescheduled, cancelled, and meeting ended events, using the endpoint above and the same secret.</li>
          <li>Configure Cal.ai call workflows in Cal.com for meeting confirmations/reminders and no-show follow-up. Test with a test booking before enabling for real contacts.</li>
        </ol>
        <p style={{ margin: "14px 0 0", fontSize: 13 }}>
          <a href="https://cal.com/ai" target="_blank" rel="noreferrer" style={{ color:"#fca5a5" }}>Cal.ai overview ↗</a>
          {" · "}
          <a href="https://github.com/calcom/help/blob/main/webhooks.mdx" target="_blank" rel="noreferrer" style={{ color:"#fca5a5" }}>Cal.com webhook docs ↗</a>
        </p>
      </section>
    </main>
  );
}
