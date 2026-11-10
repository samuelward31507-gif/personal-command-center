"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import "./hub.css";
import OpsPanel from "./ops-panel";
import LivePanel from "./live-panel";
import DeliveryPanel from "./delivery-panel";

type Hub = {
  today: string;
  summary: {
    stage: { key: string; label: string };
    attention: { level: "urgent" | "soon" | "info"; text: string; href?: string }[];
    delivery: { done: number; total: number; late: number; next: { title: string; dueAt: string | null } | null };
    money: { paid: number; owed: number; overdue: number };
    goLiveDate: string | null; minTermEnds: string | null; lastReport: string | null;
  };
  client: { id: string; name: string; person: string; email: string; phone: string; location: string; website: string; contactId: string | null; dealId: string | null; projectStatus: string; monthly: number; setup: number; plan: string };
  agreement: { status: string; signedAt: string | null; agreementStatus: string } | null;
  kickoff: { status: string; submittedAt: string | null; highlights: { label: string; value: string }[] } | null;
  milestones: { id: string; title: string; status: string; dueAt: string | null; completedAt: string | null }[];
  money: { id: string; title: string; type: string; amount: number; status: string; dueDate: string | null; paidAt: string | null; invoiceNumber: number | null }[];
  reports: { period: string; status: string }[];
  success: { id: string; status: string; health: number; renewalDate: string | null; nextReview: string | null; goals: string; results: string; risks: string } | null;
  tasks: { id: string; title: string; priority: string; dueAt: string | null }[];
  activity: { channel: string; action: string; outcome: string; notes: string; at: string | null }[];
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmt = (d: string | null) => (d ? new Date(d.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");
const period = (p: string) => new Date(p + "-15T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const STAGES = [["signing", "Signed"], ["kickoff", "Kickoff"], ["building", "Building"], ["live", "Live"]] as const;

export default function ClientHubPage() {
  const { id } = useParams<{ id: string }>();
  const [h, setH] = useState<Hub | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/client-hub?id=" + encodeURIComponent(id), { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Couldn't load this client."); setH(d); })
      .catch(e => setError(e instanceof Error ? e.message : "Couldn't load this client."));
  }, [id]);

  if (error) return <main className="hb-page"><p className="hb-err">{error}</p><Link href="/crm/client-success">← Clients</Link></main>;
  if (!h) return <main className="hb-page"><p className="hb-muted">Loading client…</p></main>;
  const { client: c, summary: s } = h;
  const stageIdx = STAGES.findIndex(([k]) => k === s.stage.key);

  return <main className="hb-page">
    <Link href="/crm/client-success" className="hb-back">‹ Clients</Link>
    <header className="hb-head">
      <div>
        <h1>{c.name}</h1>
        <p className="hb-sub">{[c.plan, c.monthly ? `${usd(c.monthly)}/mo` : "", c.person, c.location].filter(Boolean).join(" · ")}</p>
        <div className="hb-contact">
          {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>}
          {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
          {c.website && <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer">Website</a>}
        </div>
      </div>
      <div className="hb-head-acts">
        {c.dealId && <Link className="hb-btn" href={`/crm/deals/${c.dealId}`}>Deal &amp; agreement</Link>}
        <Link className="hb-btn" href={`/crm/reports?project=${c.id}`}>Monthly report</Link>
      </div>
    </header>

    <ol className={"hb-stages" + (s.stage.key === "ended" ? " ended" : "")}>
      {STAGES.map(([k, label], i) => <li key={k} className={i < stageIdx ? "done" : i === stageIdx ? "now" : ""}><span />{label}</li>)}
      {s.stage.key === "ended" && <li className="now"><span />Ended</li>}
    </ol>

    {s.attention.length > 0 && <section className="hb-attn">
      <h2>Needs you</h2>
      {s.attention.map((a, i) => <div key={i} className={"hb-attn-row " + a.level}><i />{a.href ? <Link href={a.href}>{a.text}</Link> : <span>{a.text}</span>}</div>)}
    </section>}

    <DeliveryPanel projectId={c.id} />
    <LivePanel projectId={c.id} />
    <OpsPanel projectId={c.id} />

    <div className="hb-tiles">
      <div className="hb-tile"><small>Stage</small><strong>{s.stage.label}</strong><span>{s.goLiveDate && s.stage.key === "live" ? `Live since ${fmt(s.goLiveDate)}` : h.kickoff?.submittedAt ? `Kickoff in ${fmt(h.kickoff.submittedAt)}` : ""}</span></div>
      <div className="hb-tile"><small>Delivery</small><strong>{s.delivery.total ? `${s.delivery.done} of ${s.delivery.total}` : "No plan"}</strong><span className={s.delivery.late ? "bad" : ""}>{s.delivery.late ? `${s.delivery.late} late` : s.delivery.next ? `Next: ${s.delivery.next.title}` : ""}</span></div>
      <div className="hb-tile"><small>Collected</small><strong>{usd(s.money.paid)}</strong><span className={s.money.overdue ? "bad" : ""}>{s.money.overdue ? `${usd(s.money.overdue)} overdue` : s.money.owed ? `${usd(s.money.owed)} open` : "Nothing owed"}</span></div>
      <div className="hb-tile"><small>Health</small><strong>{h.success ? `${h.success.health}/5` : "—"}</strong><span>{h.success?.renewalDate ? `Renews ${fmt(h.success.renewalDate)}` : s.minTermEnds ? `Min. term ends ${fmt(s.minTermEnds)}` : ""}</span></div>
    </div>

    <div className="hb-grid">
      <section className="hb-card">
        <div className="hb-card-h"><h2>Delivery</h2><Link href="/crm/projects">Open plan</Link></div>
        {h.milestones.length === 0 ? <p className="hb-muted">No delivery plan yet. It's created when the deal is won.</p> :
          <ul className="hb-steps">{h.milestones.filter(m => m.status !== "cancelled").map(m => {
            const late = m.status !== "done" && m.dueAt && m.dueAt < h.today;
            return <li key={m.id} className={m.status === "done" ? "done" : late ? "late" : ""}><i /><span>{m.title}</span><em>{m.status === "done" ? fmt(m.completedAt) : fmt(m.dueAt)}</em></li>;
          })}</ul>}
      </section>

      <div className="hb-col">
        <section className="hb-card">
          <div className="hb-card-h"><h2>Money</h2><Link href="/crm/finance">Money</Link></div>
          {h.money.length === 0 ? <p className="hb-muted">No money recorded for this client.</p> :
            <ul className="hb-money">{h.money.map(m => {
              const late = m.status !== "paid" && m.dueDate && m.dueDate < h.today;
              return <li key={m.id}><span>{cap(m.title.split(" — ").slice(1).join(" — ") || m.title)}{m.invoiceNumber ? <em> INV-{m.invoiceNumber}</em> : null}</span><b>{usd(m.amount)}</b><small className={m.status === "paid" ? "ok" : late ? "bad" : ""}>{m.status === "paid" ? `Paid ${fmt(m.paidAt)}` : late ? `Overdue since ${fmt(m.dueDate)}` : `Due ${fmt(m.dueDate)}`}</small></li>;
            })}</ul>}
        </section>

        <section className="hb-card">
          <div className="hb-card-h"><h2>Kickoff</h2>{c.dealId && <Link href={`/crm/deals/${c.dealId}`}>Kickoff link</Link>}</div>
          {!h.kickoff ? <p className="hb-muted">No kickoff link sent yet. Create one from the deal page.</p>
            : h.kickoff.status !== "submitted" ? <p className="hb-muted">Sent, not filled in yet. The go-live clock starts when it is.</p>
            : <dl className="hb-dl">{h.kickoff.highlights.map(x => <div key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}</dl>}
        </section>

        <section className="hb-card">
          <div className="hb-card-h"><h2>Reports</h2><Link href={`/crm/reports?project=${c.id}`}>Write one</Link></div>
          {h.reports.length === 0 ? <p className="hb-muted">No monthly reports yet.</p> :
            <ul className="hb-list">{h.reports.map(r => <li key={r.period}><span>{period(r.period)}</span><small className={r.status === "sent" ? "ok" : ""}>{r.status === "sent" ? "Sent" : "Draft"}</small></li>)}</ul>}
        </section>
      </div>
    </div>

    <div className="hb-grid">
      <section className="hb-card">
        <div className="hb-card-h"><h2>Goals and results</h2><Link href="/crm/client-success">Edit</Link></div>
        {!h.success ? <p className="hb-muted">No success record yet. Add one in Clients to track health, goals and the renewal date.</p> :
          <dl className="hb-dl wide">
            {h.success.goals && <div><dt>Goals</dt><dd>{h.success.goals}</dd></div>}
            {h.success.results && <div><dt>Results</dt><dd>{h.success.results}</dd></div>}
            {h.success.risks && <div><dt>Risks</dt><dd>{h.success.risks}</dd></div>}
            {!h.success.goals && !h.success.results && !h.success.risks && <p className="hb-muted">Nothing written down yet.</p>}
          </dl>}
      </section>
      <section className="hb-card">
        <div className="hb-card-h"><h2>Open tasks</h2><Link href="/crm/tasks">Tasks</Link></div>
        {h.tasks.length === 0 ? <p className="hb-muted">No open tasks.</p> :
          <ul className="hb-list">{h.tasks.map(t => <li key={t.id}><span>{t.title}</span><small className={t.dueAt && t.dueAt.slice(0, 10) < h.today ? "bad" : ""}>{t.dueAt ? fmt(t.dueAt) : ""}</small></li>)}</ul>}
        {h.activity.length > 0 && <>
          <h3 className="hb-h3">Recent activity</h3>
          <ul className="hb-list">{h.activity.map((a, i) => <li key={i}><span>{[a.action.replace(/_/g, " "), a.outcome.replace(/_/g, " ")].filter(Boolean).join(" · ")}{a.notes ? ` — ${a.notes}` : ""}</span><small>{fmt(a.at)}</small></li>)}</ul>
        </>}
      </section>
    </div>
  </main>;
}
