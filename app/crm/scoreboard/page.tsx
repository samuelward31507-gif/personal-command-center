"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DAILY_CALL_TARGET, REVENUE_GOAL } from "@/lib/scoreboard";
import { STAGE_LABELS, type DealStage } from "@/lib/offers";
import "./scoreboard.css";

type Data = {
  today: { calls: number; connects: number; meetings: number };
  week: { calls: number; connects: number; meetings: number; meetingsHeld: number };
  month: { calls: number; connects: number; meetingsBooked: number; meetingsHeld: number; proposalsSent: number; won: number; lost: number };
  rates: { connectRate: number | null; meetingRate: number | null; showRate: number | null; closeRate: number | null };
  allTime: { won: number; lost: number; closeRate: number | null };
  days: { date: string; calls: number; connects: number; meetings: number }[];
  streak: number;
  pipeline: { stage: string; deals: number; setup: number; monthly: number }[];
  recurring: { clients: number; mrr: number };
  goal: { goal: number; collected: number; expected: number; remaining: number; gapAfterExpected: number; daysLeft: number; progressPct: number; withExpectedPct: number; perDeal: { label: string; valueByGoal: number; dealsNeeded: number | null }[] };
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const rate = (n: number | null) => (n === null ? "—" : n + "%");

export default function ScoreboardPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    fetch(`/api/scoreboard?today=${today}&tz=${now.getTimezoneOffset()}`, { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see your numbers." : j.error || "Could not load the scoreboard."); setD(j); })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load the scoreboard."));
  }, []);

  if (error) return <main className="sb-page"><p className="sb-err">{error}</p></main>;
  if (!d) return <main className="sb-page"><p className="sb-muted">Counting…</p></main>;
  const g = d.goal;
  const max = Math.max(DAILY_CALL_TARGET, ...d.days.map(x => x.calls));
  const todayPct = Math.min(100, Math.round((d.today.calls / DAILY_CALL_TARGET) * 100));
  const openSetup = d.pipeline.reduce((s, p) => s + p.setup, 0), openMonthly = d.pipeline.reduce((s, p) => s + p.monthly, 0);
  const steps = [
    { label: "Calls", n: d.month.calls }, { label: "Connects", n: d.month.connects, r: d.rates.connectRate },
    { label: "Meetings booked", n: d.month.meetingsBooked, r: d.rates.meetingRate }, { label: "Meetings held", n: d.month.meetingsHeld, r: d.rates.showRate },
    { label: "Proposals sent", n: d.month.proposalsSent }, { label: "Won", n: d.month.won, r: d.rates.closeRate },
  ];

  return <main className="sb-page">
    <header className="sb-head">
      <div><div className="sb-eyebrow">Scoreboard</div><h1 className="sb-title">The numbers.</h1>
        <p className="sb-sub">Only what&apos;s logged and recorded. Calls come from Call mode outcomes, money from what you mark paid.</p></div>
      <Link className="sb-cta" href="/crm/call">Start calling →</Link>
    </header>

    <section className="sb-goal">
      <div className="sb-goal-top">
        <div><div className="sb-label">{REVENUE_GOAL.label}</div><div className="sb-goal-num">{money(g.collected)} <span>of {money(g.goal)} collected</span></div></div>
        <div className="sb-goal-days"><strong>{g.daysLeft}</strong><span>days left</span></div>
      </div>
      <div className="sb-bar" aria-label={`${g.progressPct}% collected`}>
        <i className="sb-bar-paid" style={{ width: g.progressPct + "%" }} />
        <i className="sb-bar-expected" style={{ left: g.progressPct + "%", width: Math.max(0, g.withExpectedPct - g.progressPct) + "%" }} />
      </div>
      <div className="sb-goal-legend"><span><i className="sb-dot-paid" />Collected {money(g.collected)}</span><span><i className="sb-dot-exp" />Expected before Dec 31 {money(g.expected)}</span><span>Gap {money(g.gapAfterExpected)}</span></div>
      {g.gapAfterExpected > 0 && <p className="sb-goal-need">To close the gap by Dec 31: {g.perDeal.filter(p => p.dealsNeeded).map((p, i) => <span key={p.label}>{i > 0 && " or "}<strong>{p.dealsNeeded} {p.label.split(" · ")[0]} deal{p.dealsNeeded === 1 ? "" : "s"}</strong> ({money(p.valueByGoal)} each by year-end)</span>)} signed soon.</p>}
    </section>

    <div className="sb-tiles">
      <div className="sb-tile"><div className="sb-label">Calls today</div><div className="sb-num">{d.today.calls}<span>/{DAILY_CALL_TARGET}</span></div><div className="sb-mini-bar"><i style={{ width: todayPct + "%" }} /></div></div>
      <div className="sb-tile"><div className="sb-label">Streak</div><div className="sb-num">{d.streak}<span> day{d.streak === 1 ? "" : "s"}</span></div><small>{d.streak ? "Days in a row with calls" : "Log a call to start one"}</small></div>
      <div className="sb-tile"><div className="sb-label">This week</div><div className="sb-num">{d.week.calls}<span> calls</span></div><small>{d.week.connects} connects · {d.week.meetings} meetings booked</small></div>
      <div className="sb-tile"><div className="sb-label">Recurring</div><div className="sb-num">{money(d.recurring.mrr)}<span>/mo</span></div><small>{d.recurring.clients} active client{d.recurring.clients === 1 ? "" : "s"}</small></div>
    </div>

    <div className="sb-grid">
      <section className="sb-box">
        <div className="sb-boxhead"><h2>Last 14 days</h2><span className="sb-muted">calls · connects</span></div>
        <div className="sb-chart" role="img" aria-label="Calls per day for the last 14 days">
          {d.days.map(x => <div key={x.date} className="sb-col" title={`${x.date}: ${x.calls} calls, ${x.connects} connects, ${x.meetings} meetings`}>
            <div className="sb-colbar"><i className="sb-c-calls" style={{ height: (x.calls / max) * 100 + "%" }} /><i className="sb-c-conn" style={{ height: (x.connects / max) * 100 + "%" }} /></div>
            <span>{new Date(x.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" })}</span>
          </div>)}
          <div className="sb-target" style={{ bottom: `calc(${(DAILY_CALL_TARGET / max) * 100}% * 0.86 + 22px)` }}><span>target {DAILY_CALL_TARGET}</span></div>
        </div>
      </section>

      <section className="sb-box">
        <div className="sb-boxhead"><h2>Funnel · 30 days</h2></div>
        <div className="sb-funnel">{steps.map((s, i) => <div key={s.label} className="sb-step">
          <div className="sb-step-row"><span>{s.label}</span><strong>{s.n}</strong></div>
          <div className="sb-step-bar"><i style={{ width: (steps[0].n ? Math.max(2, (s.n / steps[0].n) * 100) : 0) + "%" }} /></div>
          {i > 0 && s.r !== undefined && <small>{rate(s.r ?? null)} {i === 1 ? "of calls" : i === 2 ? "of connects" : i === 3 ? "show rate" : "close rate"}</small>}
        </div>)}</div>
        <p className="sb-muted">All-time close rate: {rate(d.allTime.closeRate)} ({d.allTime.won} won, {d.allTime.lost} lost)</p>
      </section>
    </div>

    <section className="sb-box">
      <div className="sb-boxhead"><h2>Open pipeline</h2><span className="sb-muted">{money(openSetup)} setup + {money(openMonthly)}/mo</span></div>
      {d.pipeline.length === 0 ? <p className="sb-muted">No open deals. Meetings turn into deals — start with calls.</p> :
        <div className="sb-pipe">{d.pipeline.map(p => <Link key={p.stage} href="/crm/pipeline" className="sb-pipe-row"><span>{STAGE_LABELS[p.stage as DealStage] ?? p.stage}</span><span>{p.deals} deal{p.deals === 1 ? "" : "s"}</span><span>{money(p.setup)} + {money(p.monthly)}/mo</span></Link>)}</div>}
    </section>
  </main>;
}
