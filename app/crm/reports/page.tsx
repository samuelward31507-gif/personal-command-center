"use client";

import { useEffect, useMemo, useState } from "react";
import { REPORT_FIELDS, renderReport, cleanFigures, lastMonth, periodLabel, type ReportFigures } from "@/lib/client-report";
import { mailtoLink } from "@/lib/deal-workspace";
import "./reports.css";

type Client = { id: string; name: string; status: string; email: string; firstName: string };
type Report = { id: string; projectId: string; period: string; figures: ReportFigures; content: string; status: string; updatedAt: string | null };

/** Monthly client reports: enter the month's numbers from the live system, get an email-ready report. */
export default function ReportsPage() {
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
      setProjectId(p => p || d.clients[0]?.id || "");
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
  const preview = client ? renderReport(client.name, period, "ok" in cleaned ? cleaned.ok : {}) : null;

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
    void navigator.clipboard?.writeText(`${preview.subject}\n\n${preview.body}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); });
  }

  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1 - i); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });
  const history = reports.filter(r => r.projectId === projectId);

  return <main className="rp-page">
    <div className="rp-eyebrow">Clients</div>
    <h1>Monthly reports</h1>
    <p className="rp-sub">The one-page results report every client gets each month. Enter the numbers from their live system; Cinder writes the report. Nothing is estimated.</p>
    {error && <p className="rp-err" role="alert">{error}</p>}
    {clients && !clients.length && <div className="rp-empty"><b>No clients yet.</b><p>Reports appear here once a deal is signed and its delivery project exists.</p></div>}
    {clients && !!clients.length && <div className="rp-grid">
      <section className="rp-card">
        <div className="rp-row">
          <label>Client<select value={projectId} onChange={e => setProjectId(e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Month<select value={period} onChange={e => setPeriod(e.target.value)}>{months.map(m => <option key={m} value={m}>{periodLabel(m)}</option>)}</select></label>
        </div>
        <div className="rp-fields">
          {REPORT_FIELDS.map(f => <label key={f.key} className={f.kind === "long" ? "rp-wide" : ""}>{f.label}
            {f.kind === "long"
              ? <textarea rows={3} value={form[f.key] ?? ""} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
              : <input inputMode={f.kind === "text" ? "text" : "numeric"} placeholder={f.help ?? ""} value={form[f.key] ?? ""} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />}
          </label>)}
        </div>
        {"error" in cleaned && <p className="rp-err">{cleaned.error}</p>}
        <div className="rp-actions"><button data-variant="primary" className="rp-btn rp-primary" disabled={busy || "error" in cleaned || !projectId} onClick={() => void save()}>{busy ? "Saving…" : saved ? "Update report" : "Save report"}</button>
          {saved && <span className={"rp-pill " + (saved.status === "sent" ? "rp-sent" : "")}>{saved.status === "sent" ? "Sent" : "Draft"}</span>}</div>
        {flash && <p className={flash.ok ? "rp-ok" : "rp-err"}>{flash.text}</p>}
      </section>
      <section className="rp-card rp-preview">
        <div className="rp-k">Preview</div>
        {preview && <><div className="rp-subject">{preview.subject}</div><pre>{preview.body}</pre>
          <div className="rp-actions">
            <button data-variant="primary" className="rp-btn" onClick={copyReport}>{copied ? "Copied" : "Copy"}</button>
            <a className="rp-btn" href={mailtoLink(client?.email ?? "", preview.subject, preview.body)}>Open in my email</a>
            {saved && saved.status !== "sent" && <button data-variant="primary" className="rp-btn" onClick={() => void markSent()}>Mark sent</button>}
          </div>
          <p className="rp-fine">{client?.email ? `Goes to ${client.email} when you open it in your email.` : "No email on this client's contact. Add one to send straight from here."} Cinder never sends it for you.</p></>}
        {!!history.length && <div className="rp-history"><div className="rp-k">Past reports</div>{history.map(h => <button key={h.id} className="rp-hist" onClick={() => setPeriod(h.period)}>{periodLabel(h.period)} <span>{h.status === "sent" ? "Sent" : "Draft"}</span></button>)}</div>}
      </section>
    </div>}
  </main>;
}
