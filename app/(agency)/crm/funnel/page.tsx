"use client";

// Funnel: dials to clients, with the rate between each step and the one step to fix next.
import { useEffect, useState } from "react";
import "./funnel.css";
import WebsitePanel from "./website-panel";

type Step = { key: string; label: string; n: number; rate: number | null; rateLabel: string };
type Data = { days: number; counts: { noShow: number; cash: number; held: number }; unmarked: number; steps: Step[]; leak: string };

export default function FunnelPage() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setErr("");
    fetch(`/api/funnel?days=${days}`, { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject(new Error("Couldn't load the funnel."))).then(setD).catch(e => setErr(e.message));
  }, [days]);
  const top = Math.max(1, d?.steps?.[0]?.n ?? 1);
  // The brief's four rates and the channel table, from the same scoreboard Today uses.
  type Board = { month: { meetingsBooked: number; meetingsHeld: number; proposalsSent: number; won: number }; rates: { showRate: number | null };
    sources?: { rows: { channel: string; label: string; deals: number; meetings: number; won: number; wonMonthly: number; meetingRate: number | null; closeRate: number | null }[] } };
  const [b, setB] = useState<Board | null>(null);
  useEffect(() => { const n = new Date(); fetch(`/api/scoreboard?today=${n.toLocaleDateString("en-CA")}&tz=${n.getTimezoneOffset()}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(setB).catch(() => {}); }, []);
  const pc = (a: number, z: number) => (z ? Math.round((a / z) * 100) : null);
  return <div className="u-page fn-page" role="region" aria-label="Funnel">
    <div className="u-head">
      <h1 className="u-title">Numbers<span className="u-dim">Meetings and closes by channel. Close rate = won ÷ proposals sent. Meeting to won = won ÷ meetings held.</span></h1>
      <div className="u-head-actions"><div className="u-seg" role="group" aria-label="Range">{[7, 30, 90].map(n => <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)}>{n} days</button>)}</div></div>
    </div>
    {err && <p className="u-flash is-bad" role="alert">{err}</p>}
    {b && <div className="u-figs">
      <div className="u-fig"><span className="u-fig-k">Meetings booked</span><div className="u-fig-v">{b.month.meetingsBooked}</div><div className="u-fig-sub">this month</div></div>
      <div className="u-fig"><span className="u-fig-k">Show rate</span><div className="u-fig-v">{b.rates.showRate == null ? "–" : `${b.rates.showRate}%`}</div><div className="u-fig-sub">{b.month.meetingsHeld} held</div></div>
      <div className="u-fig"><span className="u-fig-k">Close rate</span><div className="u-fig-v">{pc(b.month.won, b.month.proposalsSent) == null ? "–" : `${pc(b.month.won, b.month.proposalsSent)}%`}</div><div className="u-fig-sub">won ÷ proposals sent, {b.month.won} of {b.month.proposalsSent}</div></div>
      <div className="u-fig"><span className="u-fig-k">Meeting to won</span><div className="u-fig-v">{pc(b.month.won, b.month.meetingsHeld) == null ? "–" : `${pc(b.month.won, b.month.meetingsHeld)}%`}</div><div className="u-fig-sub">won ÷ meetings held, {b.month.won} of {b.month.meetingsHeld}</div></div>
    </div>}
    {b?.sources && b.sources.rows.length > 0 && <section className="u-block">
      <div className="u-h2-row"><h2 className="u-h2">By channel</h2><span className="u-note">Meetings per deal started is the number to compare</span></div>
      <div className="u-tablewrap"><table className="u-table"><thead><tr><th>Channel</th><th className="is-num">Deals</th><th className="is-num">Meetings</th><th className="is-num">Meeting rate</th><th className="is-num">Won</th><th className="is-num">Close rate</th><th className="is-num">Won /mo</th></tr></thead>
        <tbody>{b.sources.rows.map(r => <tr key={r.channel}><td className="is-strong">{r.label}</td><td className="is-num">{r.deals}</td><td className="is-num">{r.meetings}</td><td className="is-num">{r.meetingRate == null ? "–" : `${r.meetingRate}%`}</td><td className="is-num">{r.won}</td><td className="is-num">{r.closeRate == null ? "–" : `${r.closeRate}%`}</td><td className="is-num">{r.wonMonthly ? "$" + Math.round(r.wonMonthly).toLocaleString("en-US") : "–"}</td></tr>)}</tbody>
        <tfoot><tr><td className="is-strong">All</td><td className="is-num">{b.sources.rows.reduce((a, r) => a + r.deals, 0)}</td><td className="is-num">{b.sources.rows.reduce((a, r) => a + r.meetings, 0)}</td><td /><td className="is-num">{b.sources.rows.reduce((a, r) => a + r.won, 0)}</td><td /><td className="is-num">${Math.round(b.sources.rows.reduce((a, r) => a + r.wonMonthly, 0)).toLocaleString("en-US")}</td></tr></tfoot></table></div>
    </section>}
    {d && <>
      <p className="fn-leak">{d.leak}</p>
      <ol className="fn-steps">{d.steps.map(s => <li key={s.key}>
        <div className="fn-label"><b>{s.label}</b>{s.rate !== null && <span>{s.rate}% {s.rateLabel}</span>}</div>
        <div className="fn-bar" aria-hidden="true"><i style={{ width: `${Math.max(s.n ? 1.5 : 0, (s.n / top) * 100)}%` }} /></div>
        <div className="fn-n">{s.n.toLocaleString()}</div>
      </li>)}</ol>
      <div className="fn-facts">
        <div><span>No-shows</span><b>{d.counts.noShow}</b></div>
        <div><span>Cash collected</span><b>${d.counts.cash.toLocaleString()}</b></div>
        <div><span>Meetings not marked yet</span><b>{d.unmarked}</b></div>
      </div>
      {d.unmarked > 0 && <p className="u-note">Mark each past meeting as Showed or No-show from the card that pops up after it, so the show rate is real.</p>}
    </>}
    <WebsitePanel days={days} />
  </div>;
}
