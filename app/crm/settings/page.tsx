"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";

const authClient = createAuthClient();

/** Public lead form link: share it in your bio, email signature or anywhere prospects find you. */
function LeadFormLink() {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setUrl(window.location.origin + "/start"); }, []);
  return <section style={{ marginTop: 26, border: "1px solid #2a221c", borderRadius: 14, background: "#151210", padding: 20 }}>
    <h2 style={{ fontSize: 18, margin: 0 }}>Your lead form</h2>
    <p style={{ color: "#a1a1a1", fontSize: 13, margin: "6px 0 14px" }}>Anyone who fills this out lands in Contacts as a lead, with a follow-up for today and an urgent task to call them. Nothing is sent to them automatically.</p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <code style={{ flex: "1 1 260px", padding: "9px 12px", borderRadius: 9, border: "1px solid #2a2a2a", background: "#0c0c0c", color: "#ededed", fontSize: 13 }}>{url || "/start"}</code>
      <button data-variant="primary" onClick={() => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }); }}
        style={{ height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid #ededed", background: "#ededed", color: "#0b0b0b", fontWeight: 600, cursor: "pointer" }}>{copied ? "Copied" : "Copy link"}</button>
      <Link href="/start" target="_blank" rel="noreferrer" style={{ color: "#cfcfcf", fontSize: 13 }}>Open ↗</Link>
    </div>
  </section>;
}


type AuditRun = { trigger: string; status: string; startedAt: string; summary: { audited?: number; attempted?: number; reason?: string } };
/** Overnight audits: when the job last ran, what it did, and a button to run it now. */
function OvernightAudits() {
  const [runs, setRuns] = useState<AuditRun[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = () => fetch("/api/pre-audit", { cache: "no-store" }).then(r => r.ok ? r.json() : { runs: [] }).then(d => setRuns(d.runs ?? [])).catch(() => setRuns([]));
  useEffect(() => { void load(); }, []);
  async function runNow() {
    setBusy(true); setNote("Auditing today's call list… (up to 2 minutes)");
    try {
      const r = await fetch("/api/pre-audit", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "The run failed.");
      setNote(d.status === "skipped" ? `Nothing to do: ${d.reason}.` : `Done: ${d.audited} of ${d.attempted} audited.`);
    } catch (e) { setNote(e instanceof Error ? e.message : "The run failed."); }
    finally { setBusy(false); void load(); }
  }
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const lastCron = runs?.find(r => r.trigger === "cron");
  return <section style={{ marginTop: 18, border: "1px solid #303030", borderRadius: 14, background: "#171717", padding: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ fontSize: 18, margin: 0 }}>Overnight audits</h2>
        <p style={{ color: "#a1a1a1", fontSize: 13, margin: "6px 0 0" }}>Every night around 3 AM Cinder audits up to 6 prospects in the day&apos;s call list. Research only; nobody is contacted. Capped at 20 audits a day.</p></div>
      <button data-variant="primary" disabled={busy} onClick={() => void runNow()} style={{ height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid #2a2a2a", background: "#171717", color: "#e5e5e5", cursor: "pointer" }}>{busy ? "Running…" : "Run now"}</button>
    </div>
    <p style={{ fontSize: 13, margin: "12px 0 0", color: lastCron ? (lastCron.status === "ok" || lastCron.status === "skipped" ? "#9ee6b5" : "#f2a5a5") : "#f0c38a" }}>
      {runs === null ? "Loading…" : lastCron ? `Last overnight run: ${when(lastCron.startedAt)} · ${lastCron.status}${lastCron.summary.reason ? ` (${lastCron.summary.reason})` : ""}${typeof lastCron.summary.audited === "number" ? ` · ${lastCron.summary.audited} audited` : ""}` : "No overnight run recorded yet."}
    </p>
    {note && <p style={{ fontSize: 13, margin: "6px 0 0", color: "#cfcfcf" }}>{note}</p>}
    {!!runs?.length && <div style={{ marginTop: 10, display: "grid", gap: 4 }}>{runs.slice(0, 5).map((r, i) => <div key={i} style={{ fontSize: 12.5, color: "#8f8f8f" }}>{when(r.startedAt)} · {r.trigger} · {r.status}{typeof r.summary.audited === "number" ? ` · ${r.summary.audited}/${r.summary.attempted ?? 0}` : ""}{r.summary.reason ? ` · ${r.summary.reason}` : ""}</div>)}</div>}
  </section>;
}

export default function SettingsPage() {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [databaseStatus, setDatabaseStatus] = useState("Checking…");
  const [hermesStatus, setHermesStatus] = useState("Checking…");

  useEffect(() => {
    let active = true;
    fetch("/api/contacts", { cache: "no-store" })
      .then((response) => {
        if (!active) return;
        setDatabaseStatus(response.ok ? "Connected" : response.status === 401 ? "Sign in required" : "Unavailable");
      })
      .catch(() => { if (active) setDatabaseStatus("Unavailable"); });
    fetch("/api/hermes/status", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) { setHermesStatus("Sign in required"); return; }
        if (!response.ok) { setHermesStatus("Unavailable"); return; }
        const data = await response.json();
        setHermesStatus(data.configured === true ? "Configured" : "Not configured");
      })
      .catch(() => { if (active) setHermesStatus("Unavailable"); });
    return () => { active = false; };
  }, []);

  const integrations = [
    { name: "Workspace database", detail: "Contacts, deals, tasks, projects, finance, and business memory", status: databaseStatus },
    { name: "Hermes read-only bridge", detail: "Read-only workspace context for Hermes; no external actions are executed", status: hermesStatus },
    { name: "Cal.ai scheduling", detail: "Booking sync and AI scheduling-call setup; not enabled until configured and tested", status: "Setup required" },
    { name: "External CRM integrations", detail: "Third-party CRM and messaging connections", status: "Not connected" },
  ];

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result?.error) throw new Error(result.error.message || "Unable to sign out.");
      window.location.assign("/sign-in");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 22px 60px", color:"#e5e5e5" }}>

      <section style={{ marginTop: 36, maxWidth: 720 }}>
        <p style={{ fontSize: 10, letterSpacing: 2, color:"#a95335", fontWeight: 700 }}>Workspace</p>
        <h1 style={{ fontSize: 38, letterSpacing: -1.5, margin: "8px 0" }}>Settings</h1>
        <p style={{ color:"#a1a1a1", lineHeight: 1.65, fontSize: 14 }}>Review the workspace foundation and connected capabilities. External integrations are shown honestly as disconnected until they are configured and verified.</p>
      </section>

      {error && <p role="alert" style={{ marginTop: 20, padding: 12, borderRadius: 8, background:"#2a1414", color:"#fca5a5", fontSize: 13 }}>{error}</p>}

      <LeadFormLink />
      <OvernightAudits />

      <section style={{ marginTop: 26, border:"1px solid #303030", borderRadius: 14, background:"#171717", padding: 20 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Workspace connections</h2>
        <p style={{ color:"#a1a1a1", fontSize: 13, margin: "6px 0 18px" }}>Current connection state, not a promise that future integrations are already active.</p>
        <div style={{ display: "grid", gap: 0 }}>
          {integrations.map((item, index) => (
            <article key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 0", borderTop:index === 0 ? "1px solid #303030" : "1px solid #303030" }}>
              <div>
                <h3 style={{ fontSize: 14, margin: 0 }}>{item.name}</h3>
                <p style={{ color:"#a1a1a1", fontSize: 12, lineHeight: 1.5, margin: "5px 0 0" }}>{item.detail}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {item.name === "Cal.ai scheduling" && <Link href="/crm/settings/cal-ai" style={{ fontSize: 12, color:"#fca5a5", textDecoration: "none", fontWeight: 700 }}>Configure →</Link>}
                <span style={{ flexShrink: 0, fontSize: 10, letterSpacing: .3, fontWeight: 700, color:item.status === "Connected" || item.status === "Configured" ? "#86efac" : "#a1a1a1", background:item.status === "Connected" || item.status === "Configured" ? "#10241a" : "#171717", borderRadius: 20, padding: "6px 9px" }}>{item.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18, border:"1px solid #303030", borderRadius: 14, background:"#171717", padding: 20 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Your workspace data</h2>
        <p style={{ color:"#a1a1a1", fontSize: 13, lineHeight: 1.65, margin: "8px 0 16px" }}>Your signed-in workspace contains your CRM records, sales pipeline, tasks, client delivery, financial entries, AI workforce records, and business memory. The Hermes bridge is not active, so saved business memory is not automatically injected into an AI agent.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/crm" style={linkStyle}>Contacts</a>
          <a href="/crm/pipeline" style={linkStyle}>Sales pipeline</a>
          <a href="/crm/tasks" style={linkStyle}>Tasks</a>
          <a href="/crm/projects" style={linkStyle}>Projects</a>
          <a href="/crm/strategy" style={linkStyle}>Strategy & memory</a>
        </div>
      </section>

      <section style={{ marginTop: 18, border:"1px solid #303030", borderRadius: 14, background:"#171717", padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>Account session</h2>
          <p style={{ color:"#a1a1a1", fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>Sign out of this Cinder workspace on this browser.</p>
        </div>
        <button type="button" onClick={() => void signOut()} disabled={signingOut} style={{ border:"1px solid #303030", borderRadius: 8, padding: "10px 14px", background:"#171717", color:"#e5e5e5", fontWeight: 650, cursor: signingOut ? "wait" : "pointer" }}>{signingOut ? "Signing out…" : "Sign out"}</button>
      </section>
    </main>
  );
}

const linkStyle: React.CSSProperties = { color:"#e5e5e5", fontSize: 12, textDecoration: "none", border:"1px solid #303030", borderRadius: 7, padding: "8px 10px", background:"#171717" };
