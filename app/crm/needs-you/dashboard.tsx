"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STAGE_LABELS, type DealStage } from "@/lib/offers";
import { MOVE_OUT_MRR, WEEKLY_MEETING_TARGET, DAILY_EMAIL_TARGET, DAILY_LINKEDIN_TARGET } from "@/lib/scoreboard";
import { Columns } from "../../ui/charts";
import { useWorkspace } from "../../use-workspace";
import "./dashboard.css";

type Board = {
  today: { calls: number; connects: number; meetings: number };
  week: { calls: number; connects: number; meetings: number; meetingsHeld: number };
  month: { calls: number; connects: number; meetingsBooked: number; meetingsHeld: number; proposalsSent: number; won: number; lost: number };
  rates: { connectRate: number | null; meetingRate: number | null; showRate: number | null; closeRate: number | null };
  allTime: { won: number; lost: number; closeRate: number | null };
  days: { date: string; calls: number; connects: number; meetings: number }[];
  streak: number;
  pipeline: { stage: string; deals: number; setup: number; monthly: number }[];
  recurring: { clients: number; mrr: number };
  targets?: { goalLabel: string; dailyCalls: number };
  sources?: { rows: { channel: string; label: string; deals: number; meetings: number; won: number; wonMonthly: number; meetingRate: number | null; closeRate: number | null }[]; best: { label: string; meetingRate: number | null } | null; unknownShare: number };
  channels?: Record<"today" | "week", { emails: number; replies: number; bounces: number; liRequests: number; liAccepted: number; liMessages: number; texts: number; textReplies: number }>;
  working?: Record<"trades" | "cities", { label: string; dials: number; convos: number; meetings: number }[]>;
  goal: { goal: number; by?: string; collected: number; expected: number; gapAfterExpected: number; daysLeft: number; progressPct: number; withExpectedPct: number; perDeal: { label: string; valueByGoal: number; dealsNeeded: number | null }[] };
};
type Ev = { id: string; title: string; startsAt: string; endsAt: string; allDay: boolean; type: string; status: string; contactId: string | null; dealId: string | null; contactName: string };
type Alert = { level: "urgent" | "soon" | "info"; kind: string; text: string; href: string };

const usd = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-US");
const pct = (n: number | null) => (n == null ? "—" : n + "%");
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Dashboard: where you stand against your targets, what's next today, and how the funnel converts. Read-only. */
export default function Dashboard() {
  const ws = useWorkspace();
  const [b, setB] = useState<Board | null>(null);
  const [err, setErr] = useState("");
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [, tick] = useState(0);

  useEffect(() => {
    const now = new Date();
    fetch(`/api/scoreboard?today=${localDay(now)}&tz=${now.getTimezoneOffset()}`, { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see your numbers." : j.error || "Couldn't load your numbers."); setB(j); })
      .catch(e => setErr(e instanceof Error ? e.message : "Couldn't load your numbers."));
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 2);
    fetch(`/api/calendar-events?fromAt=${encodeURIComponent(start.toISOString())}&toAt=${encodeURIComponent(end.toISOString())}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : { events: [] })).then(d => setEvents((d.events ?? []).filter((e: Ev) => e.status !== "cancelled")))
      .catch(() => setEvents([]));
    fetch("/api/ops-alerts", { cache: "no-store" }).then(r => (r.ok ? r.json() : { alerts: [] })).then(d => setAlerts(d.alerts ?? [])).catch(() => {});
    const t = setInterval(() => tick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 5 ? "Late night" : now.getHours() < 12 ? "Morning" : now.getHours() < 18 ? "Afternoon" : "Evening";
  const target = b?.targets?.dailyCalls ?? ws.dailyCallTarget ?? 100;
  const upcoming = (events ?? []).filter(e => new Date(e.endsAt).getTime() > Date.now()).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
  const when = (e: Ev) => {
    const s = new Date(e.startsAt), isToday = localDay(s) === localDay();
    const t = e.allDay ? "All day" : s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return { t, day: isToday ? "" : "Tomorrow" };
  };
  const until = (iso: string) => {
    const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
    if (mins <= 0) return "Now";
    if (mins > 24 * 60) return "";
    const h = Math.floor(mins / 60), m = mins % 60;
    return "In " + (h ? `${h}h ` : "") + (m || !h ? `${m}m` : "");
  };

  if (err) return <div className="u-page db-page" role="region" aria-label="Dashboard"><div className="u-void"><h2>{err}</h2></div></div>;

  const g = b?.goal;
  const steps = b ? [
    { k: "Dials", n: b.month.calls, r: null as number | null, of: "" },
    { k: "Conversations", n: b.month.connects, r: b.rates.connectRate, of: "of dials" },
    { k: "Meetings booked", n: b.month.meetingsBooked, r: b.rates.meetingRate, of: "of conversations" },
    { k: "Meetings held", n: b.month.meetingsHeld, r: b.rates.showRate, of: "showed up" },
    { k: "Proposals", n: b.month.proposalsSent, r: null, of: "" },
    { k: "Won", n: b.month.won, r: b.rates.closeRate, of: "close rate" },
  ] : [];
  const openMrr = b?.pipeline.reduce((s, p) => s + p.monthly, 0) ?? 0;
  const byLabel = g?.by ? new Date(g.by + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";

  return <div className="u-page db-page" role="region" aria-label="Dashboard">
    <div className="u-head">
      <div>
        <p className="u-note" style={{ marginBottom: 8 }}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="u-title">{greeting}, {ws.ownerFirstName}</h1>
      </div>
      <div className="u-head-actions"><Link className="u-btn u-btn-light u-btn-lg" href="/crm/call">Start calling</Link></div>
    </div>

    <div className="u-figs">
      <Link href="/crm/call" className="u-fig"><span className="u-fig-k">Dials today</span><div className="u-fig-v">{b ? b.today.calls : "—"}<small>/ {target}</small></div><div className="u-meter"><i style={{ width: Math.min(100, ((b?.today.calls ?? 0) / target) * 100) + "%" }} /></div><div className="u-fig-sub">{b ? (b.today.calls >= target ? "Target hit" : <><b>{target - b.today.calls}</b> to go{b.streak ? `, ${b.streak}-day streak` : ""}</>) : ""}</div></Link>
      <Link href="/crm/calendar" className="u-fig"><span className="u-fig-k">Meetings this week</span><div className="u-fig-v">{b ? b.week.meetings : "—"}<small>/ {WEEKLY_MEETING_TARGET}</small></div><div className="u-meter"><i style={{ width: Math.min(100, ((b?.week.meetings ?? 0) / WEEKLY_MEETING_TARGET) * 100) + "%" }} /></div><div className="u-fig-sub">{b ? <><b>{b.week.connects}</b> conversations from {b.week.calls} dials</> : ""}</div></Link>
      <Link href="/crm/finance" className="u-fig"><span className="u-fig-k">Monthly recurring</span><div className="u-fig-v">{b ? usd(b.recurring.mrr) : "—"}<small>/mo</small></div><div className="u-meter"><i style={{ width: Math.min(100, ((b?.recurring.mrr ?? 0) / MOVE_OUT_MRR) * 100) + "%" }} /></div><div className="u-fig-sub">{b ? <><b>{usd(Math.max(0, MOVE_OUT_MRR - b.recurring.mrr))}</b> to {usd(MOVE_OUT_MRR)}, {b.recurring.clients} client{b.recurring.clients === 1 ? "" : "s"}</> : ""}</div></Link>
      <Link href="/crm/finance" className="u-fig"><span className="u-fig-k">{b?.targets?.goalLabel ?? "Revenue goal"}</span><div className="u-fig-v">{g ? usd(g.collected) : "—"}</div><div className="u-meter"><i style={{ width: (g?.progressPct ?? 0) + "%" }} /></div><div className="u-fig-sub">{g ? <><b>{g.daysLeft}</b> days left, {usd(g.goal)} goal</> : ""}</div></Link>
    </div>

    {b && (() => {
      const t = b.channels?.today, w = b.channels?.week;
      const cells: { k: string; href: string; n: number; of?: number; wk: string; hot?: boolean }[] = [
        { k: "Dials", href: "/crm/call", n: b.today.calls, of: target, wk: `${b.week.calls} this week` },
        { k: "Conversations", href: "/crm/call", n: b.today.connects, wk: `${b.week.connects} this week` },
        { k: "Meetings", href: "/crm/calendar", n: b.today.meetings, wk: `${b.week.meetings} this week` },
        { k: "Emails", href: "/crm/email", n: t?.emails ?? 0, of: DAILY_EMAIL_TARGET, wk: `${w?.emails ?? 0} this week${w?.bounces ? `, ${w.bounces} bounced` : ""}` },
        { k: "Replies", href: "/crm/email", n: (t?.replies ?? 0) + (t?.textReplies ?? 0), wk: ((t?.replies ?? 0) + (t?.textReplies ?? 0)) > 0 ? "Answer them first" : `${(w?.replies ?? 0) + (w?.textReplies ?? 0)} this week`, hot: ((t?.replies ?? 0) + (t?.textReplies ?? 0)) > 0 },
        { k: "LinkedIn", href: "/crm/linkedin", n: t?.liRequests ?? 0, of: DAILY_LINKEDIN_TARGET, wk: `${w?.liRequests ?? 0} sent, ${w?.liAccepted ?? 0} accepted` },
        { k: "Texts", href: "/crm/call", n: t?.texts ?? 0, wk: `${w?.texts ?? 0} this week` },
      ];
      return <section className="u-block">
        <div className="u-h2-row"><h2 className="u-h2">Outreach today</h2><span className="u-note">Counts itself as you work. LinkedIn counts what you mark on the LinkedIn page.</span></div>
        <div className="db-out">{cells.map(c => <Link key={c.k} href={c.href} className={"db-out-c" + (c.hot ? " is-hot" : "")}>
          <span className="u-fig-k">{c.k}</span>
          <b className="db-step-n">{c.n}{c.of ? <small> / {c.of}</small> : null}</b>
          {c.of ? <div className="u-meter"><i style={{ width: Math.min(100, (c.n / c.of) * 100) + "%" }} /></div> : <div className="db-out-gap" />}
          <span className="db-step-r">{c.wk}</span>
        </Link>)}</div>
      </section>;
    })()}

    <div className="u-split u-split-2 u-block">
      <section>
        <div className="u-h2-row"><h2 className="u-h2">Dials, last 14 days</h2><span className="u-note">Dashed line is your {target}/day target. Dots are meetings booked.</span></div>
        {b ? <Columns labels={b.days.map(d => new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }))} values={b.days.map(d => d.calls)} target={target} marks={b.days.map(d => d.meetings > 0)} height={250} /> : <div style={{ height: 250 }} />}
      </section>
      <section>
        <div className="u-h2-row"><h2 className="u-h2">Next up</h2><Link className="u-note" href="/crm/calendar" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Calendar</Link></div>
        {events === null ? <p className="u-note">Loading…</p> : upcoming.length === 0
          ? <div className="u-rows"><div className="u-row"><div className="u-row-main"><strong>Nothing booked today or tomorrow</strong><span>Meetings come from dials. Book one in Call mode.</span></div></div></div>
          : <div className="u-rows">{upcoming.slice(0, 4).map((e, i) => <Link key={e.id} className="u-row db-ev" href={e.dealId ? `/crm/deals/${e.dealId}` : e.contactId ? `/crm?contact=${e.contactId}` : "/crm/calendar"}>
            <div className="db-ev-t"><b className="u-num">{when(e).t}</b><span>{[when(e).day, i === 0 ? until(e.startsAt) : ""].filter(Boolean).join(", ")}</span></div>
            <div className="u-row-main"><strong>{e.title}</strong>{e.contactName && <span>{e.contactName}</span>}</div>
          </Link>)}</div>}
        {alerts.length > 0 && <div style={{ marginTop: 28 }}>
          <div className="u-h2-row"><h2 className="u-h2">Needs attention</h2></div>
          <div className="u-rows">{alerts.slice(0, 5).map((a, i) => <Link key={i} className="u-row" href={a.href} style={{ minHeight: 46 }}><span className={"u-dot" + (a.level === "urgent" ? " is-bad" : "")} /><div className="u-row-main"><span style={{ color: "var(--u-soft)", fontSize: 13.5, whiteSpace: "normal" }}>{a.text}</span></div></Link>)}</div>
        </div>}
      </section>
    </div>

    <section className="u-block">
      <div className="u-h2-row"><h2 className="u-h2">Funnel, last 30 days</h2><span className="u-note">All-time close rate {pct(b?.allTime.closeRate ?? null)}</span></div>
      <div className="db-funnel">{steps.map((st, i) => <div key={st.k} className="db-step">
        <span className="u-fig-k">{st.k}</span>
        <b className="db-step-n">{b ? st.n.toLocaleString("en-US") : "—"}</b>
        <span className="db-step-r">{i === 0 ? "" : st.r != null ? `${st.r}% ${st.of}` : ""}</span>
      </div>)}</div>
    </section>

    {b?.working && b.working.trades.length > 0 && <section className="u-block">
      <div className="u-h2-row"><h2 className="u-h2">What&apos;s working</h2><span className="u-note">Last 30 days. Meetings per 100 dials is the number to compare.</span></div>
      <div className="u-split u-split-even">{(["trades", "cities"] as const).map(k => <div key={k} className="u-tablewrap">
        <table className="u-table">
          <thead><tr><th>{k === "trades" ? "Trade" : "City"}</th><th className="u-num">Dials</th><th className="u-num">Talked</th><th className="u-num">Meetings</th><th className="u-num" title="Meetings per 100 dials">Per 100</th></tr></thead>
          <tbody>{b.working![k].map(r => <tr key={r.label}><td>{r.label}</td><td className="u-num">{r.dials}</td><td className="u-num">{r.convos}</td><td className="u-num">{r.meetings}</td><td className="u-num">{r.dials >= 20 ? (r.meetings / r.dials * 100).toFixed(1) : <span className="u-quiet" title="Needs 20+ dials to mean anything">—</span>}</td></tr>)}</tbody>
        </table>
      </div>)}</div>
    </section>}

    <div className="u-split u-split-even u-block">
      <section>
        <div className="u-h2-row"><h2 className="u-h2">Open pipeline</h2><Link className="u-note" href="/crm/pipeline" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{usd(openMrr)}/mo if it all closes</Link></div>
        {!b ? null : b.pipeline.length === 0 ? <p className="u-note">No open deals yet. Booked meetings become deals.</p> : <div className="u-rows">{b.pipeline.map(p => <Link key={p.stage} href="/crm/pipeline" className="u-row" style={{ minHeight: 46 }}>
          <div className="u-row-main"><span style={{ color: "var(--u-soft)", fontSize: 13.5 }}>{STAGE_LABELS[p.stage as DealStage] ?? p.stage}</span></div>
          <span className="u-row-end">{p.deals} deal{p.deals === 1 ? "" : "s"}</span>
          <span className="u-row-end u-num" style={{ minWidth: 90, color: "var(--u-text)" }}>{usd(p.monthly)}/mo</span>
        </Link>)}</div>}
      </section>
      <section className="db-goal">{!g ? null : g.gapAfterExpected <= 0 ? <><div className="u-h2-row"><h2 className="u-h2">Goal</h2></div><p className="db-goal-need">Collected plus expected covers {g ? usd(g.goal) : ""}. Keep billing on time.</p></> : <>
      <div className="u-h2-row"><h2 className="u-h2">What closes the gap to {usd(g.goal)} by {byLabel}</h2></div>
      <div className="db-goalbar" aria-label={`${g.progressPct}% collected`}><i className="is-paid" style={{ width: g.progressPct + "%" }} /><i className="is-exp" style={{ left: g.progressPct + "%", width: Math.max(0, g.withExpectedPct - g.progressPct) + "%" }} /></div>
      <div className="u-legend" style={{ marginTop: 12 }}><span><i style={{ background: "#d9d3cb" }} />Collected {usd(g.collected)}</span><span><i className="is-2" />Expected {usd(g.expected)}</span><span>Gap {usd(g.gapAfterExpected)}</span></div>
      <p className="db-goal-need">{g.perDeal.filter(p => p.dealsNeeded).map((p, i) => <span key={p.label}>{i > 0 && " or "}<b>{p.dealsNeeded} {p.label.split(" · ")[0]} deal{p.dealsNeeded === 1 ? "" : "s"}</b></span>)} signed soon.</p>
    </>}</section>
    </div>

    {b?.sources && b.sources.rows.length > 0 && <section className="u-block">
      <div className="u-h2-row"><h2 className="u-h2">Where deals come from</h2><span className="u-note">Last 180 days</span></div>
      <div className="u-tablewrap"><table className="u-table"><thead><tr><th>Channel</th><th className="is-num">Deals</th><th className="is-num">Meetings</th><th className="is-num">Won</th><th className="is-num">Won monthly</th><th className="is-num">Close rate</th></tr></thead><tbody>
        {b.sources.rows.map(r => <tr key={r.channel}><td className="is-strong">{r.label}</td><td className="is-num">{r.deals}</td><td className="is-num">{r.meetings}</td><td className="is-num">{r.won}</td><td className="is-num">{usd(r.wonMonthly)}</td><td className="is-num">{pct(r.closeRate)}</td></tr>)}
      </tbody></table></div>
      {b.sources.best && <p className="u-note" style={{ marginTop: 12 }}>{b.sources.best.label} books the most meetings per deal ({b.sources.best.meetingRate}%). Spend more time there.</p>}
    </section>}
  </div>;
}
