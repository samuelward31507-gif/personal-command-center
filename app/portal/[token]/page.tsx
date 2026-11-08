"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BrandLogo } from "../../cinder-brand";
import "./portal.css";

type Figures = { inquiries?: number; firstReply?: string; estimates?: number; jobsWon?: number; jobsValue?: number; highlight?: string; nextMonth?: string };
type Doc = {
  client: string; from: { name: string; owner: string; email: string };
  stage: { key: string; label: string }; clock: { state: string; label: string; deadline: string | null };
  milestones: { title: string; done: boolean; dueAt: string | null }[];
  waiting: { text: string; href?: string }[];
  invoices: { number: string; title: string; amount: number; status: string; dueDate: string | null; paidAt: string | null; link: string | null }[];
  reports: { period: string; figures: Figures }[];
};
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const fmt = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");
const STAGES = [["signing", "Signed"], ["kickoff", "Kickoff"], ["building", "Building"], ["live", "Live"]] as const;

/** Client portal: where their build is, what's waiting on them, their reports and invoices. */
export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/portal?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "This link isn't valid."); setDoc(d); })
      .catch(e => setError(e instanceof Error ? e.message : "This link isn't valid."));
  }, [token]);

  if (!doc) return <div className="pt-page"><div className="pt-main"><p className="pt-muted">{error || "Loading…"}</p></div></div>;
  const idx = STAGES.findIndex(([k]) => k === doc.stage.key);
  const done = doc.milestones.filter(m => m.done).length;
  return <div className="pt-page">
    <header className="pt-top"><BrandLogo mono className="pt-logo" title={doc.from.name} /><span>{doc.client}</span></header>
    <div className="pt-main">
      <h1>{doc.stage.key === "live" ? "Your system is live." : "Your build"}</h1>
      <ol className="pt-stages">{STAGES.map(([k, l], i) => <li key={k} className={i < idx ? "done" : i === idx ? "now" : ""}><span />{l}</li>)}</ol>
      {doc.stage.key !== "live" && doc.clock.state !== "not_started" && <p className="pt-clock">{doc.clock.label}{doc.clock.deadline ? ` · guaranteed live by ${fmt(doc.clock.deadline)}` : ""}</p>}

      {doc.waiting.length > 0 && <section className="pt-sec pt-wait"><h2>Waiting on you</h2>
        <ul>{doc.waiting.map((w, i) => <li key={i}>{w.href ? <a href={w.href}>{w.text} →</a> : w.text}</li>)}</ul></section>}

      {doc.milestones.length > 0 && <section className="pt-sec"><h2>Build plan <small>{done} of {doc.milestones.length} done</small></h2>
        <ol className="pt-plan">{doc.milestones.map((m, i) => <li key={i} className={m.done ? "done" : ""}><i aria-hidden="true" /><span>{m.title}</span><small>{m.done ? "Done" : m.dueAt ? fmt(m.dueAt) : ""}</small></li>)}</ol></section>}

      {doc.reports.length > 0 && <section className="pt-sec"><h2>Monthly results</h2>
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

      <p className="pt-foot">Questions? {doc.from.email ? <a href={`mailto:${doc.from.email}`}>Email {doc.from.owner}</a> : `Reply to ${doc.from.owner}'s last email`}.</p>
    </div>
  </div>;
}
