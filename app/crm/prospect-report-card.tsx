"use client";

import { useEffect, useMemo, useState } from "react";
import { FINDING_CHOICES, leakMath, SPEEDS, TRADE_DEFAULTS, viewLabel, type LeakInputs, type Speed } from "@/lib/prospect-report";
import "./prospect-report-card.css";

type Report = { id: string; company: string; trade: string; inputs: LeakInputs; findings: string[]; note: string; viewCount: number; lastViewedAt: string | null; createdAt: string; link: string };
type Trade = "fence" | "pool" | "other";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const guessTrade = (company: string): Trade => (/fenc/i.test(company) ? "fence" : /pool|spa\b/i.test(company) ? "pool" : "other");

/** On a contact: make a private one-page report for them, copy its link, and see when they open it. Nothing is sent. */
export default function ProspectReportCard({ contactId, company }: { contactId: string; company: string }) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [editing, setEditing] = useState<Report | "new" | null>(null);
  const [copied, setCopied] = useState("");
  const valid = UUID.test(contactId);

  useEffect(() => {
    let on = true; setReports(null); setEditing(null);
    if (!valid) { setReports([]); return; }
    fetch("/api/prospect-reports?contactId=" + encodeURIComponent(contactId), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : { reports: [] })).then(d => { if (on) setReports(d.reports ?? []); }).catch(() => { if (on) setReports([]); });
    return () => { on = false; };
  }, [contactId, valid]);

  async function copy(link: string) {
    try { await navigator.clipboard.writeText(link); setCopied(link); setTimeout(() => setCopied(""), 1800); } catch { window.prompt("Copy this link", link); }
  }

  if (!valid) return null;
  return <div className="crm-detail-section pr-card">
    <div className="pr-head"><h3>Prospect report</h3>{reports && reports.length > 0 && !editing && <button type="button" className="crm-btn crm-btn-quiet" onClick={() => setEditing("new")}>New report</button>}</div>
    {editing ? <ReportForm contactId={contactId} company={company} report={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={r => { setReports(old => [r, ...(old ?? []).filter(x => x.id !== r.id)]); setEditing(null); void copy(r.link); }} />
      : reports === null ? <p className="crm-notes">Loading…</p>
      : reports.length === 0 ? <div><p className="crm-notes">A private one-page link showing what slow follow-up likely costs them, with numbers they can adjust. Send it in a DM or email instead of a pitch. You&apos;ll see when they open it.</p><button type="button" className="crm-btn" onClick={() => setEditing("new")}>Make a report</button></div>
      : <ul className="pr-list">{reports.map(r => {
          const m = leakMath(r.inputs);
          return <li key={r.id}>
            <div><strong>{usd(m.year)} a year</strong><small className={r.viewCount ? "pr-seen" : ""}>{viewLabel(r.viewCount, r.lastViewedAt)}</small></div>
            <div className="pr-acts">
              <button type="button" className="crm-btn crm-btn-quiet" onClick={() => copy(r.link)}>{copied === r.link ? "Copied" : "Copy link"}</button>
              <a className="crm-btn crm-btn-quiet" href={r.link} target="_blank" rel="noreferrer">View</a>
              <button type="button" className="crm-btn crm-btn-quiet" onClick={() => setEditing(r)}>Edit</button>
            </div>
          </li>;
        })}</ul>}
  </div>;
}

function ReportForm({ contactId, company, report, onCancel, onSaved }: { contactId: string; company: string; report: Report | null; onCancel: () => void; onSaved: (r: Report) => void }) {
  const startTrade = (report?.trade as Trade) ?? guessTrade(company);
  const [name, setName] = useState(report?.company ?? company);
  const [trade, setTrade] = useState<Trade>(startTrade);
  const [inp, setInp] = useState<LeakInputs>(report?.inputs ?? { ...TRADE_DEFAULTS[startTrade], speed: "day", followsUp: false });
  const [picked, setPicked] = useState<string[]>(report?.findings.filter(f => (FINDING_CHOICES as readonly string[]).includes(f)) ?? []);
  const [own, setOwn] = useState(report?.findings.filter(f => !(FINDING_CHOICES as readonly string[]).includes(f)).join("\n") ?? "");
  const [note, setNote] = useState(report?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const m = useMemo(() => leakMath(inp), [inp]);
  const set = <K extends keyof LeakInputs>(k: K, v: LeakInputs[K]) => setInp(p => ({ ...p, [k]: v }));

  function changeTrade(t: Trade) { setTrade(t); if (!report) setInp(p => ({ ...p, ...TRADE_DEFAULTS[t] })); }
  async function save() {
    setBusy(true); setError("");
    const findings = [...picked, ...own.split("\n").map(s => s.trim()).filter(Boolean)];
    try {
      const r = await fetch("/api/prospect-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: report?.id, contactId, company: name, trade, inputs: inp, findings, note }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save the report.");
      onSaved(d.report);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the report."); setBusy(false); }
  }

  return <div className="pr-form">
    <div className="pr-grid">
      <label className="pr-wide">Company<input value={name} onChange={e => setName(e.target.value)} maxLength={160} /></label>
      <label>Trade<select value={trade} onChange={e => changeTrade(e.target.value as Trade)}><option value="fence">Fence</option><option value="pool">Pool</option><option value="other">Other</option></select></label>
      <label>Inquiries a month<input type="number" min={1} value={inp.leads} onChange={e => set("leads", Number(e.target.value))} /></label>
      <label>Average job ($)<input type="number" min={100} step={100} value={inp.jobValue} onChange={e => set("jobValue", Number(e.target.value))} /></label>
      <label>Win rate (%)<input type="number" min={1} max={100} value={inp.closeRate} onChange={e => set("closeRate", Number(e.target.value))} /></label>
      <label>Reply speed<select value={inp.speed} onChange={e => set("speed", e.target.value as Speed)}>{(Object.keys(SPEEDS) as Speed[]).map(k => <option key={k} value={k}>{SPEEDS[k].label}</option>)}</select></label>
      <label>Quotes chased twice?<select value={inp.followsUp ? "yes" : "no"} onChange={e => set("followsUp", e.target.value === "yes")}><option value="no">Not always</option><option value="yes">Yes, every time</option></select></label>
    </div>
    <p className="pr-total">They&apos;ll see <strong>{usd(m.year)}</strong> a year ({usd(m.month)} a month).</p>
    <fieldset className="pr-finds"><legend>What you noticed (pick only what you actually saw)</legend>
      {FINDING_CHOICES.map(f => <label key={f}><input type="checkbox" checked={picked.includes(f)} onChange={e => setPicked(p => e.target.checked ? [...p, f] : p.filter(x => x !== f))} /><span>{f}</span></label>)}
    </fieldset>
    <label className="pr-block">Your own findings, one per line<textarea rows={2} value={own} onChange={e => setOwn(e.target.value)} placeholder="e.g. Your Google listing says you close at 4pm, but the form promises a reply in 24 hours." /></label>
    <label className="pr-block">Personal note at the top (optional)<textarea rows={2} maxLength={800} value={note} onChange={e => setNote(e.target.value)} placeholder="Put this together after looking at your site. Happy to walk through it." /></label>
    {error && <p className="pr-err" role="alert">{error}</p>}
    <div className="pr-acts"><button type="button" className="crm-btn" disabled={busy} onClick={save}>{busy ? "Saving…" : report ? "Save changes" : "Create and copy link"}</button><button type="button" className="crm-btn crm-btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button></div>
  </div>;
}
