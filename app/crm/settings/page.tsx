"use client";

import { copyText } from "@/lib/copy";
import Link from "next/link";

import { useEffect, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { WorkspaceCard } from "./workspace-card";
import { OfferCard } from "./offer-card";
import "./settings.css";

const authClient = createAuthClient();

/** Public lead form link: share it in your bio, email signature or anywhere prospects find you. */
function LeadFormLink() {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setUrl(window.location.origin + "/start"); }, []);
  return <section style={CARD}>
    <h2 style={{ fontSize: 18, margin: 0 }}>Your lead form</h2>
    <p style={{ color: "#4c525c", fontSize: 13, margin: "6px 0 14px" }}>Anyone who fills this out lands in Contacts as a lead, with a follow-up for today and an urgent task to call them. Nothing is sent to them automatically.</p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <code style={{ flex: "1 1 260px", padding: "9px 12px", borderRadius: 9, border: "1px solid #dcddda", background: "#ffffff", color: "#121417", fontSize: 13 }}>{url || "/start"}</code>
      <button data-variant="primary" onClick={() => { void copyText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }); }}
        style={{ height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid #121417", background: "#121417", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}>{copied ? "Copied" : "Copy link"}</button>
      <Link href="/start" target="_blank" rel="noreferrer" style={{ color: "#2b2f35", fontSize: 13 }}>Open ↗</Link>
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
  return <section style={CARD}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ fontSize: 18, margin: 0 }}>Overnight audits</h2>
        <p style={{ color: "#4c525c", fontSize: 13, margin: "6px 0 0" }}>Every night around 3 AM Cinder audits up to 6 prospects in the day&apos;s call list. Research only; nobody is contacted. Capped at 20 audits a day.</p></div>
      <button data-variant="primary" disabled={busy} onClick={() => void runNow()} style={{ height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid #dcddda", background: "#f1f1ef", color: "#121417", cursor: "pointer" }}>{busy ? "Running…" : "Run now"}</button>
    </div>
    <p style={{ fontSize: 13, margin: "12px 0 0", color: lastCron ? (lastCron.status === "ok" || lastCron.status === "skipped" ? "#2a2d32" : "#a01717") : "#a36415" }}>
      {runs === null ? "Loading…" : lastCron ? `Last overnight run: ${when(lastCron.startedAt)} · ${lastCron.status}${lastCron.summary.reason ? ` (${lastCron.summary.reason})` : ""}${typeof lastCron.summary.audited === "number" ? ` · ${lastCron.summary.audited} audited` : ""}` : "No overnight run recorded yet."}
    </p>
    {note && <p style={{ fontSize: 13, margin: "6px 0 0", color: "#2b2f35" }}>{note}</p>}
    {!!runs?.length && <div style={{ marginTop: 10, display: "grid", gap: 4 }}>{runs.slice(0, 5).map((r, i) => <div key={i} style={{ fontSize: 12.5, color: "#656e7b" }}>{when(r.startedAt)} · {r.trigger} · {r.status}{typeof r.summary.audited === "number" ? ` · ${r.summary.audited}/${r.summary.attempted ?? 0}` : ""}{r.summary.reason ? ` · ${r.summary.reason}` : ""}</div>)}</div>}
  </section>;
}

/** Sunday review: preview this week's email, send it now, and see when it last went out. */
function SundayReview() {
  const [data, setData] = useState<{ review: { subject: string; lines: string[] }; runs: { status: string; at: string }[]; email: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = () => fetch("/api/weekly-review", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(setData).catch(() => setData(null));
  useEffect(() => { void load(); }, []);
  async function sendNow() {
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/weekly-review", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't send it.");
      setNote("Sent. Check your inbox.");
    } catch (e) { setNote(e instanceof Error ? e.message : "Couldn't send it."); }
    finally { setBusy(false); void load(); }
  }
  const btn = { height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid #dcddda", background: "#f1f1ef", color: "#121417", cursor: "pointer" } as const;
  const last = data?.runs?.[0];
  return <section style={CARD}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ fontSize: 18, margin: 0 }}>Sunday review</h2>
        <p style={{ color: "#4c525c", fontSize: 13, margin: "6px 0 0" }}>Every Sunday around 8 AM you get one email: the week&apos;s numbers, what slipped, and your 5 moves for the week.</p></div>
      <div style={{ display: "flex", gap: 8 }}>
        <button data-variant="primary" onClick={() => setOpen(o => !o)} style={btn}>{open ? "Hide preview" : "Preview"}</button>
        <button data-variant="primary" disabled={busy || !data?.email} onClick={() => void sendNow()} style={btn}>{busy ? "Sending…" : "Send now"}</button>
      </div>
    </div>
    <p style={{ fontSize: 13, margin: "12px 0 0", color: "#656e7b" }}>{data === null ? "Loading…" : !data.email ? "Email alerts aren't set up yet." : last ? `Last sent: ${new Date(last.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${last.status}` : "Not sent yet. The first one goes out this Sunday."}</p>
    {note && <p style={{ fontSize: 13, margin: "6px 0 0", color: "#2b2f35" }}>{note}</p>}
    {open && data && <div style={{ marginTop: 14, padding: 16, borderRadius: 10, border: "1px solid #e7e7e4", background: "#f6f6f4", fontSize: 13.5, lineHeight: 1.6, color: "#25282d", whiteSpace: "pre-wrap" }}><b style={{ display: "block", marginBottom: 8, color: "#121417" }}>{data.review.subject}</b>{data.review.lines.join("\n")}</div>}
  </section>;
}

export default function SettingsPage() {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [databaseStatus, setDatabaseStatus] = useState("Checking…");
  const [hermesStatus, setHermesStatus] = useState("Checking…");
  const [calStatus, setCalStatus] = useState("Checking…");
  const [tab, setTab] = useState<Tab>("business");
  // The tab lives in the URL hash so links like /crm/settings#automations open the right one.
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (TABS.some(t => t.key === h)) setTab(h as Tab); };
    read(); window.addEventListener("hashchange", read); return () => window.removeEventListener("hashchange", read);
  }, []);
  const pick = (t: Tab) => { setTab(t); history.replaceState(null, "", "#" + t); };

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
        setCalStatus(data.calAi === true ? "Connected" : "Setup required");
      })
      .catch(() => { if (active) setHermesStatus("Unavailable"); });
    return () => { active = false; };
  }, []);

  const integrations = [
    { name: "Database", detail: "Contacts, deals, tasks, clients and money", status: databaseStatus },
    { name: "Hermes", detail: "Lets your AI chief of staff read Cinder. It can't take actions.", status: hermesStatus },
    { name: "Cal.ai scheduling", detail: "Bookings flow into Cinder automatically", status: calStatus },
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
    <main className="set-page" style={{ maxWidth: 1040, margin: "0 auto", color: "var(--u-text)" }}>

      <section style={{ marginTop: 20, maxWidth: 720 }}>
        <h1 className="set-title">Settings</h1>
        <p style={{ color:"#4c525c", lineHeight: 1.65, fontSize: 14 }}>Your business details, prices and goal, plus the jobs Cinder runs for you.</p>
      </section>

      {error && <p role="alert" style={{ marginTop: 20, padding: 12, borderRadius: 8, background:"#f6ecec", color:"#a31414", fontSize: 13 }}>{error}</p>}

      <nav className="set-tabs" aria-label="Settings sections">
        {TABS.map(t => <button key={t.key} type="button" aria-pressed={tab === t.key} aria-selected={tab === t.key} onClick={() => pick(t.key)}>{t.label}</button>)}
      </nav>

      {tab === "business" && <><WorkspaceCard /><OfferCard /></>}

      {tab === "automations" && <><LeadFormLink /><OvernightAudits /><SundayReview /></>}

      {tab === "account" && <>
      <section style={CARD}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Connections</h2>
        <p style={{ color:"#4c525c", fontSize: 13, margin: "6px 0 18px" }}>What&apos;s connected right now.</p>
        <div style={{ display: "grid", gap: 0 }}>
          {integrations.map((item) => (
            <article key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 0", borderTop: "1px solid #e7e7e4" }}>
              <div>
                <h3 style={{ fontSize: 14, margin: 0 }}>{item.name}</h3>
                <p style={{ color:"#575f6b", fontSize: 12.5, lineHeight: 1.5, margin: "5px 0 0" }}>{item.detail}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {item.name === "Cal.ai scheduling" && <Link href="/crm/settings/cal-ai" style={{ fontSize: 12.5, color:"#121417", textDecoration: "none", fontWeight: 600 }}>Set up</Link>}
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color:item.status === "Connected" || item.status === "Configured" ? "#181a1e" : "#4c525c", background:item.status === "Connected" || item.status === "Configured" ? "#f1f1ef" : "#f1f1ef", borderRadius: 20, padding: "5px 10px" }}>{item.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...CARD, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>Sign out</h2>
          <p style={{ color:"#4c525c", fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>Sign out of Cinder on this browser.</p>
        </div>
        <button type="button" onClick={() => void signOut()} disabled={signingOut} style={{ border:"1px solid #dcddda", borderRadius: 9, padding: "9px 14px", background:"transparent", color:"#121417", fontWeight: 600, fontSize: 13, cursor: signingOut ? "wait" : "pointer" }}>{signingOut ? "Signing out…" : "Sign out"}</button>
      </section>
      </>}
    </main>
  );
}

const CARD: React.CSSProperties = { marginTop: 18, border: "1px solid #e7e7e4", borderRadius: 16, background: "#ffffff", padding: 22 };
type Tab = "business" | "automations" | "account";
const TABS: { key: Tab; label: string }[] = [{ key: "business", label: "Business" }, { key: "automations", label: "Automations" }, { key: "account", label: "Account" }];
