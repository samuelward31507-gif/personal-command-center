"use client";

import { copyText } from "@/lib/copy";
import { useEffect, useMemo, useState } from "react";
import { REPORT_FIELDS, renderReport, cleanFigures, lastMonth, periodLabel, type ReportFigures } from "@/lib/client-report";
import { useWorkspace } from "../../use-workspace";
import { mailtoLink } from "@/lib/deal-workspace";
import "./report.css";

type Client = { id: string; name: string; status: string; email: string; firstName: string };
type Report = { id: string; projectId: string; period: string; figures: ReportFigures; content: string; status: string; updatedAt: string | null };

/** Monthly client reports: enter the month's numbers from the live system, get an email-ready report. */
export default function ReportsPage() {
  const wsp = useWorkspace();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [period, setPeriod] = useState(() => lastMonth(new Date()));
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/client-reports", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see reports." : d.error || "Could not load reports.");
      setClients(d.clients); setReports(d.reports);
      const want = new URLSearchParams(window.location.search).get("project");
      setProjectId(p => p || (want && d.clients.some((c: { id: string }) => c.id === want) ? want : "") || d.clients[0]?.id || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load reports."); }
  }
  useEffect(() => { void load(); }, []);

  const client = clients?.find(c => c.id === projectId);
  const saved = reports.find(r => r.projectId === projectId && r.period === period);
  // Load the saved figures when switching client or month; prefill last month's estimates from the previous report.
  useEffect(() => {
    if (saved) { setForm(Object.fromEntries(Object.entries(saved.figures).map(([k, v]) => [k, String(v)]))); return; }
    const prev = reports.filter(r => r.projectId === projectId && r.period < period).sort((a, b) => b.period.localeCompare(a.period))[0];
    setForm(prev?.figures.estimates !== undefined ? { estimatesPrev: String(prev.figures.estimates) } : {});
  }, [projectId, period, saved?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cleaned = useMemo(() => cleanFigures(form), [form]);
  const preview = client ? renderReport(client.name, period, "ok" in cleaned ? cleaned.ok : {}, wsp.ownerFirstName, wsp.businessName) : null;

  async function save() {
    setBusy(true); setFlash(null);
    try {
      const r = await fetch("/api/client-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, period, figures: form }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not save the report.");
      setFlash({ ok: true, text: "Saved. Copy it or open it in your email to send." });
      await load();
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not save the report." }); }
    finally { setBusy(false); }
  }
  async function markSent() {
    if (!saved) return;
    const r = await fetch("/api/client-reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: saved.id, status: "sent" }) });
    if (r.ok) { setFlash({ ok: true, text: "Marked sent." }); await load(); }
  }
  function copyReport() {
    if (!preview) return;
    void copyText(`${preview.subject}\n\n${preview.body}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); });
  }

  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1 - i); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });
  const history = reports.filter(r => r.projectId === projectId);

  const last = months[0];
  const due = (clients ?? []).filter(c => !["completed", "cancelled"].includes(c.status) && !reports.some(r => r.projectId === c.id && r.period === last && r.status === "sent"));
  const sentCount = (clients ?? []).length - due.length;

  return <div className="u-page rx-page" role="region" aria-label="Client reports">
    <div className="u-head">
      <h1 className="u-title">Client reports</h1>
      {clients && !!clients.length && <div className="u-head-actions">
        <select className="u-field rx-sel" aria-label="Client" value={projectId} onChange={e => setProjectId(e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="u-field rx-sel" aria-label="Month" value={period} onChange={e => setPeriod(e.target.value)}>{months.map(m => <option key={m} value={m}>{periodLabel(m)}</option>)}</select>
      </div>}
    </div>
    {error && <p className="u-flash is-bad" role="alert" style={{ marginBottom: 16 }}>{error}</p>}
    {!clients && !error && <p className="u-note" role="status">Loading…</p>}
    {clients && !clients.length && <div className="u-void"><h2>No clients to report on yet</h2><p>Every client gets a one-page results report each month: missed calls caught, jobs booked, revenue it brought in. Once a deal is won, their report lives here.</p><a className="u-btn u-btn-light" href="/crm/pipeline">Open pipeline</a></div>}

    {clients && !!clients.length && <>
      <div className="rx-due">
        <div><span className="u-fig-k">{periodLabel(last)} reports</span><b className="u-num">{sentCount}<small> of {clients.length} sent</small></b></div>
        <div className="rx-due-list">{due.length === 0 ? <span className="u-note">Every client has their {periodLabel(last)} report.</span> : due.map(c => <button key={c.id} type="button" className={"rx-chip" + (c.id === projectId && period === last ? " is-on" : "")} onClick={() => { setProjectId(c.id); setPeriod(last); }}>{c.name}<span>{reports.some(r => r.projectId === c.id && r.period === last) ? "Draft" : "Not started"}</span></button>)}</div>
      </div>

      <div className="rx-grid">
        <section>
          <div className="u-h2-row"><h2 className="u-h2">{client?.name}, {periodLabel(period)}</h2>{saved && <span className={"u-mark" + (saved.status === "sent" ? " is-good" : "")}>{saved.status === "sent" ? "Sent" : "Draft"}</span>}</div>
          <p className="u-note" style={{ marginBottom: 18, lineHeight: 1.55 }}>Enter the numbers from their live system. Only what you type goes in the report, nothing is estimated.</p>
          <div className="rx-fields">
            {REPORT_FIELDS.map(f => <label key={f.key} className={"u-lab" + (f.kind === "long" ? " rx-wide" : "")}>{f.label}
              {f.kind === "long"
                ? <textarea className="u-field" rows={3} value={form[f.key] ?? ""} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
                : <input className="u-field" inputMode={f.kind === "text" ? "text" : "numeric"} placeholder={f.help ?? ""} value={form[f.key] ?? ""} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />}
            </label>)}
          </div>
          {"error" in cleaned && <p className="u-flash is-bad" style={{ marginTop: 14 }}>{cleaned.error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}><button className="u-btn u-btn-light" disabled={busy || "error" in cleaned || !projectId} onClick={() => void save()}>{busy ? "Saving…" : saved ? "Update report" : "Save report"}</button></div>
          {flash && <p className={"u-flash" + (flash.ok ? "" : " is-bad")} style={{ marginTop: 12 }}>{flash.text}</p>}
          {!!history.length && <div style={{ marginTop: 36 }}><div className="u-h2-row"><h2 className="u-h2">Past reports</h2></div><div className="u-rows">{history.map(h => <button key={h.id} type="button" className="u-row" style={{ minHeight: 44 }} onClick={() => setPeriod(h.period)}><div className="u-row-main"><strong style={{ fontWeight: 500 }}>{periodLabel(h.period)}</strong></div><span className={"u-mark" + (h.status === "sent" ? " is-good" : "")}>{h.status === "sent" ? "Sent" : "Draft"}</span></button>)}</div></div>}
        </section>

        <section className="rx-preview">
          <div className="u-h2-row"><h2 className="u-h2">What {client?.firstName || "they"} will get</h2></div>
          {preview && <div className="rx-paper">
            <div className="rx-paper-from">{wsp.businessName || "Cinder"}</div>
            <div className="rx-paper-subj">{preview.subject}</div>
            <pre className="rx-paper-body">{preview.body}</pre>
          </div>}
          {preview && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <a className="u-btn u-btn-light" href={mailtoLink(client?.email ?? "", preview.subject, preview.body)}>Open in my email</a>
            <button className="u-btn" onClick={copyReport}>{copied ? "Copied" : "Copy"}</button>
            {saved && saved.status !== "sent" && <button className="u-btn u-btn-bare" onClick={() => void markSent()}>Mark sent</button>}
          </div>}
          <p className="u-note" style={{ marginTop: 12 }}>{client?.email ? `Opens addressed to ${client.email}.` : "No email on this client's contact yet."} Nothing is sent for you.</p>
        </section>
      </div>
    </>}
  </div>;
}
