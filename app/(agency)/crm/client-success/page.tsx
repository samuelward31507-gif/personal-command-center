"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./clients.css";

type Project = { id: string; name: string; clientName: string; contactName: string; status: string; monthlyValue: number; milestoneCount: number; doneMilestones: number; targetDate?: string | null; startDate?: string | null };
type Account = { id: string; client_name: string; service_name: string | null; status: string; renewal_date: string | null; next_review_date: string | null; health_score: number; monthly_value: number | string; goals: string | null; results: string | null; risk_notes: string | null; project_id: string | null; contact_id: string | null };
type Ticket = { id: string; title: string; description: string | null; status: string; priority: string; due_date: string | null; client_name: string | null; contact_name: string | null; resolution_notes: string | null };
type Opt = { id: string; name: string; company?: string };

const STATUSES = ["onboarding", "active", "at_risk", "renewal_due", "paused", "churned"];
const TICKET_STATUSES = ["open", "in_progress", "waiting_on_client", "resolved", "closed"];
const label = (s: string) => { const t = s.replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
const usd = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-US");
const day = (d: string | null) => d ? new Date(String(d).slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const daysUntil = (d: string | null) => d ? Math.round((Date.parse(String(d).slice(0, 10) + "T12:00:00") - Date.now()) / 86400000) : null;
const open = (t: Ticket) => !["resolved", "closed"].includes(t.status);

function Health({ n }: { n: number }) {
  return <span className="cl-health" aria-label={`Health ${n} of 5`} title={`Health ${n} of 5`}>{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? (n <= 2 ? "is-bad" : "is-on") : ""} />)}</span>;
}

/** Clients: everyone who signed, their onboarding progress, health, renewals and support issues. */
export default function ClientsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [contacts, setContacts] = useState<Opt[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [ticketForm, setTicketForm] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    try {
      const rs = await Promise.all(["/api/client-success", "/api/projects", "/api/contacts"].map(u => fetch(u, { cache: "no-store" })));
      const [cs, pr, ct] = await Promise.all(rs.map(r => r.json().catch(() => ({}))));
      if (!rs[0].ok) throw new Error(cs.error || "Couldn't load your clients.");
      setAccounts(cs.accounts ?? []); setTickets(cs.tickets ?? []);
      setProjects((pr.projects ?? []).filter((p: Project) => p.status !== "cancelled"));
      setContacts((ct.contacts ?? []).map((c: Opt) => ({ id: c.id, name: c.name, company: c.company })));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your clients."); setProjects(p => p ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, method = "POST") {
    setError("");
    const r = await fetch("/api/client-success", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || "That didn't save."); return false; }
    await load(); return true;
  }

  // One row per client: the delivery project, joined with its health record when there is one.
  const rows = useMemo(() => {
    const used = new Set<string>();
    const fromProjects = (projects ?? []).map(p => {
      const acc = accounts.find(a => a.project_id === p.id) ?? accounts.find(a => !a.project_id && a.client_name.trim().toLowerCase() === (p.clientName || p.name).trim().toLowerCase());
      if (acc) used.add(acc.id);
      return { key: p.id, name: p.clientName || p.contactName || p.name, project: p, acc };
    });
    const orphans = accounts.filter(a => !used.has(a.id)).map(a => ({ key: a.id, name: a.client_name, project: undefined as Project | undefined, acc: a as Account | undefined }));
    return [...fromProjects, ...orphans];
  }, [projects, accounts]);

  const live = rows.filter(r => !["churned", "paused"].includes(r.acc?.status ?? "") && r.project?.status !== "completed");
  const mrr = live.reduce((s, r) => s + Number(r.acc?.monthly_value ?? r.project?.monthlyValue ?? 0), 0);
  const atRisk = rows.filter(r => r.acc && (r.acc.status === "at_risk" || r.acc.health_score <= 2));
  const openTickets = tickets.filter(open);
  const nextRenewal = accounts.filter(a => a.renewal_date && (daysUntil(a.renewal_date) ?? -1) >= 0).sort((a, b) => String(a.renewal_date).localeCompare(String(b.renewal_date)))[0];
  const ticketRows = showClosed ? tickets : openTickets;

  return <div className="u-page cl-page" role="region" aria-label="Clients">
    <div className="u-head">
      <h1 className="u-title">Clients</h1>
      <div className="u-head-actions">
        <Link className="u-btn u-btn-bare" href="/crm/reports">Monthly reports</Link>
        <button className="u-btn" onClick={() => setTicketForm(true)}>Log a support issue</button>
        <button className="u-btn u-btn-light" onClick={() => setEditing("new")}>Add health record</button>
      </div>
    </div>
    {error && <p className="u-flash is-bad" role="alert" style={{ marginBottom: 18 }}>{error}</p>}

    <div className="u-figs">
      <div className="u-fig"><span className="u-fig-k">Active clients</span><div className="u-fig-v">{projects ? live.length : "—"}</div><div className="u-fig-sub">{rows.length - live.length ? `${rows.length - live.length} paused, churned or finished` : "Nobody has churned"}</div></div>
      <div className="u-fig"><span className="u-fig-k">Recurring from clients</span><div className="u-fig-v">{usd(mrr)}<small>/mo</small></div><div className="u-fig-sub"><b>{usd(mrr * 12)}</b> a year at this rate</div></div>
      <div className="u-fig"><span className="u-fig-k">At risk</span><div className="u-fig-v">{atRisk.length}</div><div className="u-fig-sub">{atRisk.length ? atRisk.slice(0, 2).map(r => r.name).join(", ") : "Health 3 or better across the board"}</div></div>
      <div className="u-fig"><span className="u-fig-k">Next renewal</span><div className="u-fig-v" style={{ fontSize: 30 }}>{nextRenewal ? `${daysUntil(nextRenewal.renewal_date)} days` : "—"}</div><div className="u-fig-sub">{nextRenewal ? <><b>{nextRenewal.client_name}</b>, {day(nextRenewal.renewal_date)}</> : "No renewal dates set"}</div></div>
    </div>

    {projects === null ? <p className="u-note" role="status">Loading clients…</p> : rows.length === 0 ? <div className="u-void">
      <h2>No clients yet</h2>
      <p>When a deal is marked won, the client shows up here with an onboarding checklist, their own page, and a health record you can track to renewal.</p>
      <Link className="u-btn u-btn-light" href="/crm/pipeline">Open pipeline</Link>
    </div> : <div className="u-tablewrap"><table className="u-table cl-table">
      <thead><tr><th>Client</th><th>Onboarding</th><th>Status</th><th>Health</th><th>Renewal</th><th className="is-num">Monthly</th><th /></tr></thead>
      <tbody>{rows.map(r => {
        const p = r.project, a = r.acc, done = p?.milestoneCount ? p.doneMilestones / p.milestoneCount : 0, rd = daysUntil(a?.renewal_date ?? null);
        return <tr key={r.key}>
          <td><div className="cl-who">{p ? <Link href={`/crm/client-success/${p.id}`}><strong>{r.name}</strong></Link> : <strong>{r.name}</strong>}<span>{a?.service_name || (p ? label(p.status) : "")}</span></div></td>
          <td>{p?.milestoneCount ? <div className="cl-prog"><div className="cl-prog-bar"><i style={{ width: done * 100 + "%" }} /></div><span>{p.doneMilestones} of {p.milestoneCount}</span></div> : <span className="u-quiet">No checklist</span>}</td>
          <td>{a ? <select className="u-field cl-sel" aria-label={`Status for ${r.name}`} value={a.status} onChange={e => void act({ kind: "account", id: a.id, status: e.target.value, healthScore: a.health_score, results: a.results || "", riskNotes: a.risk_notes || "" }, "PATCH")}>{STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}</select> : <span className="u-quiet">No record</span>}</td>
          <td>{a ? <Health n={a.health_score} /> : <span className="u-quiet">—</span>}</td>
          <td>{a?.renewal_date ? <span className={rd != null && rd <= 30 && rd >= 0 ? "cl-soon" : ""}>{day(a.renewal_date)}</span> : <span className="u-quiet">—</span>}</td>
          <td className="is-num is-strong">{usd(Number(a?.monthly_value ?? p?.monthlyValue ?? 0))}</td>
          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            {a ? <button className="u-btn u-btn-bare" onClick={() => setEditing(a)}>Edit</button> : <button className="u-btn u-btn-bare" onClick={() => setEditing({ id: "", client_name: r.name, service_name: "", status: "active", renewal_date: null, next_review_date: null, health_score: 4, monthly_value: p?.monthlyValue ?? 0, goals: "", results: "", risk_notes: "", project_id: p?.id ?? null, contact_id: null })}>Track health</button>}
            {p && <Link className="u-btn" href={`/crm/client-success/${p.id}`}>Open</Link>}
          </td>
        </tr>;
      })}</tbody>
    </table></div>}

    <section style={{ marginTop: 44 }}>
      <div className="u-h2-row">
        <h2 className="u-h2">Support issues</h2>
        <div className="u-seg" role="group" aria-label="Which issues"><button type="button" aria-pressed={!showClosed} onClick={() => setShowClosed(false)}>Open {openTickets.length}</button><button type="button" aria-pressed={showClosed} onClick={() => setShowClosed(true)}>All {tickets.length}</button></div>
      </div>
      {ticketRows.length === 0 ? <p className="u-note">No open issues. When a client reports a problem, log it so nothing slips.</p> : <div className="u-rows">{ticketRows.map(t => {
        const late = t.due_date && open(t) && (daysUntil(t.due_date) ?? 0) < 0;
        return <div key={t.id} className="u-row">
          <span className={"u-dot" + (t.priority === "urgent" || t.priority === "high" ? " is-bad" : "")} title={label(t.priority) + " priority"} />
          <div className="u-row-main"><strong>{t.title}</strong><span>{[t.client_name || t.contact_name, label(t.priority) + " priority", t.description].filter(Boolean).join(" · ")}</span></div>
          <span className={"u-row-end" + (late ? " cl-late" : "")}>{t.due_date ? (late ? "Was due " : "Due ") + day(t.due_date).replace(/, \d{4}$/, "") : "No due date"}</span>
          <select className="u-field cl-sel" aria-label={`Status for ${t.title}`} value={t.status} onChange={e => void act({ kind: "ticket", id: t.id, status: e.target.value, resolutionNotes: t.resolution_notes || "" }, "PATCH")}>{TICKET_STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}</select>
        </div>;
      })}</div>}
    </section>

    {editing && <AccountDialog acc={editing === "new" ? null : editing} projects={projects ?? []} contacts={contacts} onClose={() => setEditing(null)} onSave={async body => { if (await act(body, body.id ? "PATCH" : "POST")) setEditing(null); }} />}
    {ticketForm && <TicketDialog projects={projects ?? []} contacts={contacts} onClose={() => setTicketForm(false)} onSave={async body => { if (await act(body)) setTicketForm(false); }} />}
  </div>;
}

function AccountDialog({ acc, projects, contacts, onClose, onSave }: { acc: Account | null; projects: Project[]; contacts: Opt[]; onClose: () => void; onSave: (b: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({
    name: acc?.client_name ?? "", service: acc?.service_name ?? "", monthly: String(acc?.monthly_value ?? ""), status: acc?.status ?? "active", health: String(acc?.health_score ?? 4),
    renewal: acc?.renewal_date ? String(acc.renewal_date).slice(0, 10) : "", review: acc?.next_review_date ? String(acc.next_review_date).slice(0, 10) : "",
    goals: acc?.goals ?? "", results: acc?.results ?? "", risks: acc?.risk_notes ?? "", projectId: acc?.project_id ?? "", contactId: acc?.contact_id ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const isEdit = !!acc?.id;
  return <div className="u-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="u-dialog cl-form" style={{ width: "min(620px, 100%)", maxHeight: "calc(100vh - 36px)", overflowY: "auto" }} role="dialog" aria-modal="true" aria-label="Client health"
      onSubmit={async e => { e.preventDefault(); setBusy(true); await onSave({ kind: "account", ...(isEdit ? { id: acc!.id } : { clientName: f.name, contactId: f.contactId || null, projectId: f.projectId || null }), serviceName: f.service, monthlyValue: Number(f.monthly || 0), status: f.status, healthScore: Number(f.health), renewalDate: f.renewal || null, nextReviewDate: f.review || null, goals: f.goals, results: f.results, riskNotes: f.risks }); setBusy(false); }}>
      <h3>{isEdit ? acc!.client_name : acc?.client_name ? `Track ${acc.client_name}` : "Add health record"}</h3>
      <div className="cl-grid">
        {!isEdit && <label className="u-lab cl-full">Client name<input className="u-field" required value={f.name} onChange={set("name")} placeholder="Ridgeline Fence Co." /></label>}
        <label className="u-lab">What they bought<input className="u-field" value={f.service} onChange={set("service")} placeholder="Book & Close" /></label>
        <label className="u-lab">Monthly<input className="u-field" type="number" min="0" step="0.01" value={f.monthly} onChange={set("monthly")} /></label>
        <label className="u-lab">Status<select className="u-field" value={f.status} onChange={set("status")}>{STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label className="u-lab">Health<select className="u-field" value={f.health} onChange={set("health")}>{["5", "4", "3", "2", "1"].map(s => <option key={s} value={s}>{s} of 5{s === "5" ? ", thrilled" : s === "1" ? ", about to leave" : ""}</option>)}</select></label>
        <label className="u-lab">Renewal<input className="u-field" type="date" value={f.renewal} onChange={set("renewal")} /></label>
        <label className="u-lab">Next check-in<input className="u-field" type="date" value={f.review} onChange={set("review")} /></label>
        {!isEdit && <label className="u-lab">Client page<select className="u-field" value={f.projectId} onChange={set("projectId")}><option value="">None</option>{projects.map(p => <option key={p.id} value={p.id}>{p.clientName || p.name}</option>)}</select></label>}
        {!isEdit && <label className="u-lab">Contact<select className="u-field" value={f.contactId} onChange={set("contactId")}><option value="">None</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}</select></label>}
        <label className="u-lab cl-full">What they want out of it<textarea className="u-field" rows={2} value={f.goals} onChange={set("goals")} placeholder="10 booked estimates a month from missed calls" /></label>
        <label className="u-lab cl-full">Results so far<textarea className="u-field" rows={2} value={f.results} onChange={set("results")} placeholder="23 missed calls texted back, 6 booked in October" /></label>
        <label className="u-lab cl-full">Risks<textarea className="u-field" rows={2} value={f.risks} onChange={set("risks")} placeholder="Owner hasn't opened the last report" /></label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}><button type="button" className="u-btn" onClick={onClose}>Cancel</button><button type="submit" className="u-btn u-btn-light" disabled={busy || (!isEdit && !f.name.trim())}>{busy ? "Saving…" : "Save"}</button></div>
    </form>
  </div>;
}

function TicketDialog({ projects, contacts, onClose, onSave }: { projects: Project[]; contacts: Opt[]; onClose: () => void; onSave: (b: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({ title: "", detail: "", priority: "normal", due: "", projectId: "", contactId: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return <div className="u-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="u-dialog cl-form" style={{ width: "min(560px, 100%)" }} role="dialog" aria-modal="true" aria-label="Log a support issue"
      onSubmit={async e => { e.preventDefault(); setBusy(true); await onSave({ kind: "ticket", title: f.title, description: f.detail, priority: f.priority, dueDate: f.due || null, projectId: f.projectId || null, contactId: f.contactId || null }); setBusy(false); }}>
      <h3>Log a support issue</h3>
      <div className="cl-grid">
        <label className="u-lab cl-full">What&apos;s wrong<input className="u-field" required autoFocus value={f.title} onChange={set("title")} placeholder="Missed-call texts stopped sending" /></label>
        <label className="u-lab">Client<select className="u-field" value={f.projectId} onChange={set("projectId")}><option value="">None</option>{projects.map(p => <option key={p.id} value={p.id}>{p.clientName || p.name}</option>)}</select></label>
        <label className="u-lab">Contact<select className="u-field" value={f.contactId} onChange={set("contactId")}><option value="">None</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}</select></label>
        <label className="u-lab">Priority<select className="u-field" value={f.priority} onChange={set("priority")}>{["low", "normal", "high", "urgent"].map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label className="u-lab">Fix by<input className="u-field" type="date" value={f.due} onChange={set("due")} /></label>
        <label className="u-lab cl-full">Details<textarea className="u-field" rows={3} value={f.detail} onChange={set("detail")} placeholder="What they said, when it started" /></label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}><button type="button" className="u-btn" onClick={onClose}>Cancel</button><button type="submit" className="u-btn u-btn-light" disabled={busy || !f.title.trim()}>{busy ? "Saving…" : "Log issue"}</button></div>
    </form>
  </div>;
}
