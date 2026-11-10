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
  const top = Math.max(1, d?.steps[0]?.n ?? 1);
  return <div className="u-page fn-page" role="region" aria-label="Funnel">
    <div className="u-head">
      <h1 className="u-title">Funnel</h1>
      <div className="u-head-actions"><div className="u-seg" role="group" aria-label="Range">{[7, 30, 90].map(n => <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)}>{n} days</button>)}</div></div>
    </div>
    {err && <p className="u-flash is-bad" role="alert">{err}</p>}
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
