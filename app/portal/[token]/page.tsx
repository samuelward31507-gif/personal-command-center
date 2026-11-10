"use client";

// The owner's Cinder app: what the system did for them (leads answered, reply speed, estimates booked, quotes chased),
// every conversation to read along, then their build status and invoices. /portal/demo shows an example company.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BrandLogo } from "../../cinder-brand";
import "./portal.css";

type Figures = { inquiries?: number; firstReply?: string; estimates?: number; jobsWon?: number; jobsValue?: number; highlight?: string; nextMonth?: string };
type Conv = { id: string; name: string; source: string; status: string; at: string | null; last: string };
type Live = { leads: number; answered: number; booked: number; replySec: number | null; chasing: number; chasingValue: number; won: number; wonValue: number; revived: number; reviews: number; weeks: { week: string; leads: number; booked: number }[]; conversations: Conv[] };
type Doc = {
  demo?: boolean; client: string; from: { name: string; owner: string; email: string };
  stage: { key: string; label: string }; clock: { state: string; label: string; deadline: string | null };
  milestones: { title: string; done: boolean; dueAt: string | null }[];
  waiting: { text: string; href?: string }[];
  invoices: { number: string; title: string; amount: number; status: string; dueDate: string | null; paidAt: string | null; link: string | null }[];
  reports: { period: string; figures: Figures }[];
  live?: Live;
};
type Text = { direction: string; author: string; body: string; at: string | null };
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const fmt = (d: string | null) => (d ? new Date(d.length > 10 ? d : d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const ago = (d: string | null) => { if (!d) return ""; const m = Math.round((Date.now() - Date.parse(d)) / 60000); return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : fmt(d); };
const secs = (n: number | null) => (n == null ? "–" : n < 60 ? `${n} sec` : `${Math.round(n / 60)} min`);
const STAGES = [["signing", "Signed"], ["kickoff", "Kickoff"], ["building", "Building"], ["live", "Live"]] as const;
const STATUS: Record<string, string> = { auto: "Handled for you", paused: "Needs you", booked: "Booked", closed: "Done", opted_out: "Opted out" };
const SOURCE: Record<string, string> = { missed_call: "Missed call", "web chat": "Website chat", text: "Text", quote: "Quote follow-up", review: "Review request", rehash: "Revived lead" };

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [texts, setTexts] = useState<Text[]>([]);
  useEffect(() => {
    fetch("/api/portal?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "This link isn't valid."); setDoc(d); })
      .catch(e => setError(e instanceof Error ? e.message : "This link isn't valid."));
  }, [token]);
  useEffect(() => {
    if (!open) return;
    fetch(`/api/portal?token=${encodeURIComponent(token)}&thread=${open}`, { cache: "no-store" }).then(r => r.json()).then(d => setTexts(d.texts ?? [])).catch(() => setTexts([]));
  }, [open, token]);

  if (!doc) return <div className="pt-page"><div className="pt-main"><p className="pt-muted">{error || "Loading…"}</p></div></div>;
  const L = doc.live;
  const idx = STAGES.findIndex(([k]) => k === doc.stage.key);
  const done = doc.milestones.filter(m => m.done).length;
  const maxW = Math.max(1, ...(L?.weeks.map(w => w.leads) ?? [1]));
  const needs = L?.conversations.filter(c => c.status === "paused") ?? [];
  const hasLive = !!L && (L.leads > 0 || L.conversations.length > 0);

  return <div className="pt-page">
    <header className="pt-top"><BrandLogo mono className="pt-logo" title={doc.from.name} /><span>{doc.client}{doc.demo ? " · Example" : ""}</span></header>
    <div className="pt-main">
      {hasLive && L ? <>
        <p className="pt-k">Last 30 days</p>
        <h1>Cinder answered {L.answered} lead{L.answered === 1 ? "" : "s"} and booked {L.booked} estimate{L.booked === 1 ? "" : "s"} for you.</h1>
        {needs.length > 0 && <div className="pt-needs"><b>{needs.length} conversation{needs.length === 1 ? " needs" : "s need"} you</b>{needs.map(n => <button key={n.id} type="button" onClick={() => setOpen(n.id)}>{n.name}: &ldquo;{n.last.slice(0, 60)}&rdquo;</button>)}</div>}

        <div className="pt-kpis">
          <div><span>Leads answered</span><b>{L.answered}<small> of {L.leads}</small></b></div>
          <div><span>Typical first reply</span><b>{secs(L.replySec)}</b></div>
          <div><span>Estimates booked</span><b>{L.booked}</b></div>
          <div><span>Quotes being chased</span><b>{L.chasing}</b><em>{L.chasingValue ? usd(L.chasingValue) + " in open quotes" : ""}</em></div>
        </div>

        {L.weeks.length > 1 && <section className="pt-card pt-trend" aria-label="Leads and bookings by week">
          <div className="pt-card-h"><h2>Every week</h2><span><i className="k-l" /> Leads <i className="k-b" /> Booked</span></div>
          <div className="pt-bars">{L.weeks.map(w => <div key={w.week} className="pt-bar" title={`${w.leads} leads, ${w.booked} booked`}>
            <i className="l" style={{ height: (w.leads / maxW) * 100 + "%" }} /><i className="b" style={{ height: (w.booked / maxW) * 100 + "%" }} /></div>)}</div>
        </section>}

        <div className="pt-mini">
          <div><b>{L.won}</b><span>quotes won after follow-up{L.wonValue ? `, ${usd(L.wonValue)}` : ""}</span></div>
          <div><b>{L.revived}</b><span>old leads who replied</span></div>
          <div><b>{L.reviews}</b><span>review requests sent</span></div>
        </div>

        <section className="pt-card">
          <div className="pt-card-h"><h2>Conversations</h2><span>Read along any time. Reply from your phone and Cinder steps back.</span></div>
          <div className="pt-convs">
            <ul>{L.conversations.map(c => <li key={c.id}><button type="button" aria-pressed={open === c.id} onClick={() => setOpen(c.id)}>
              <span className="pt-av">{c.name.replace(/[^A-Za-z ]/g, "").split(" ").map(x => x[0]).join("").slice(0, 2) || "#"}</span>
              <span className="pt-cv"><b>{c.name}</b><small>{SOURCE[c.source] ?? c.source} · {ago(c.at)}</small><em>{c.last}</em></span>
              <span className={"pt-st is-" + c.status}>{STATUS[c.status] ?? c.status}</span></button></li>)}</ul>
            <div className="pt-thread">{!open ? <p className="pt-muted">Pick a conversation to read it.</p> :
              <ol>{texts.map((t, i) => t.author === "system" ? <li key={i} className="sys">{t.body} · {ago(t.at)}</li> :
                <li key={i} className={t.direction === "in" ? "in" : "out"}><p>{t.body}</p><small>{t.direction === "in" ? "Customer" : t.author === "owner" ? "You" : "Cinder"} · {ago(t.at)}</small></li>)}</ol>}</div>
          </div>
        </section>
      </> : <h1>{doc.stage.key === "live" ? "Your system is live." : "Your build"}</h1>}

      {doc.stage.key !== "live" && <>
        <ol className="pt-stages">{STAGES.map(([k, l], i) => <li key={k} className={i < idx ? "done" : i === idx ? "now" : ""}><span />{l}</li>)}</ol>
        {doc.clock.state !== "not_started" && <p className="pt-clock">{doc.clock.label}{doc.clock.deadline ? ` · guaranteed live by ${fmt(doc.clock.deadline)}` : ""}</p>}
      </>}

      {doc.waiting.length > 0 && <section className="pt-sec pt-wait"><h2>Waiting on you</h2>
        <ul>{doc.waiting.map((w, i) => <li key={i}>{w.href ? <a href={w.href}>{w.text}</a> : w.text}</li>)}</ul></section>}

      {doc.milestones.length > 0 && doc.stage.key !== "live" && <section className="pt-sec"><h2>Build plan <small>{done} of {doc.milestones.length} done</small></h2>
        <ol className="pt-plan">{doc.milestones.map((m, i) => <li key={i} className={m.done ? "done" : ""}><i aria-hidden="true" /><span>{m.title}</span><small>{m.done ? "Done" : m.dueAt ? fmt(m.dueAt) : ""}</small></li>)}</ol></section>}

      {doc.reports.length > 0 && <section className="pt-sec"><h2>Monthly reports</h2>
        {doc.reports.map(r => <div key={r.period} className="pt-report"><h3>{r.period}</h3>
          <div className="pt-figs">
            {r.figures.inquiries !== undefined && <div><b>{r.figures.inquiries}</b><span>inquiries answered{r.figures.firstReply ? `, ${r.figures.firstReply} first reply` : ""}</span></div>}
            {r.figures.estimates !== undefined && <div><b>{r.figures.estimates}</b><span>estimates booked</span></div>}
            {r.figures.jobsValue !== undefined && <div><b>{usd(r.figures.jobsValue)}</b><span>won from follow-up</span></div>}
          </div>
          {r.figures.highlight && <p>{r.figures.highlight}</p>}
          {r.figures.nextMonth && <p className="pt-next">Next: {r.figures.nextMonth}</p>}
        </div>)}</section>}

      {doc.invoices.length > 0 && <section className="pt-sec"><h2>Invoices</h2>
        <ul className="pt-inv">{doc.invoices.map(v => <li key={v.number}><span>{v.number} · {v.title}</span><b>{usd(v.amount)}</b>
          <small className={v.status === "paid" ? "ok" : v.status === "overdue" ? "bad" : ""}>{v.status === "paid" ? `Paid ${fmt(v.paidAt)}` : v.dueDate ? `Due ${fmt(v.dueDate)}` : "Open"}</small>
          {v.link && <a href={v.link}>View</a>}</li>)}</ul></section>}

      <p className="pt-foot">{doc.demo ? "This is an example account with made-up numbers. " : ""}Questions? {doc.from.email ? <a href={`mailto:${doc.from.email}`}>Email {doc.from.owner}</a> : `Reply to ${doc.from.owner}'s last email`}.</p>
    </div>
  </div>;
}
