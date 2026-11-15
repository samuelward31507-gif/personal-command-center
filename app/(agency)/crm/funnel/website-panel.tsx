"use client";

// Website: who came to cinderrevenue.com, what they did, and which prospects opened their personal demo link.
import { useEffect, useState } from "react";

type Stats = { visitors: number; sessions: number; views: number; bounceRate: number | null; medianSeconds: number | null; bookClicks: number; bookClickRate: number | null; demoPlays: number; calcUses: number;
  pages: { path: string; views: number }[]; sources: { source: string; sessions: number }[]; byDay: { day: string; visitors: number }[] };
type Watched = { company: string; name: string; at: string; plays: number; seconds: number | null };

const secs = (s: number | null) => (s === null ? "–" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);
const pageName = (p: string) => ({ "/": "Home", "/watch": "Demo film", "/demo": "Demo", "/try": "Try it", "/privacy": "Privacy", "/terms": "Terms" } as Record<string, string>)[p] ?? p;

export default function WebsitePanel({ days }: { days: number }) {
  const [d, setD] = useState<{ stats: Stats; watched: Watched[] } | null>(null);
  useEffect(() => { fetch(`/api/website?days=${days}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(setD).catch(() => setD(null)); }, [days]);
  if (!d) return null;
  const s = d.stats, max = Math.max(1, ...s.byDay.map(x => x.visitors));
  return <section className="fn-web" aria-label="Website">
    <h2 className="u-h2">Website <span className="u-quiet">cinderrevenue.com, last {days} days</span></h2>
    {s.visitors === 0 ? <p className="u-note">No visits recorded yet. Tracking starts when the website update is published.</p> : <>
      <div className="fn-facts">
        <div><span>Visitors</span><b>{s.visitors.toLocaleString()}</b></div>
        <div><span>Sessions</span><b>{s.sessions.toLocaleString()}</b></div>
        <div><span>Bounce rate</span><b>{s.bounceRate ?? "–"}{s.bounceRate !== null ? "%" : ""}</b></div>
        <div><span>Median time on site</span><b>{secs(s.medianSeconds)}</b></div>
        <div><span>Booking clicks</span><b>{s.bookClicks}</b><span>{s.bookClickRate !== null ? `${s.bookClickRate}% of visitors` : ""}</span></div>
        <div><span>Demo plays</span><b>{s.demoPlays}</b></div>
        <div><span>Calculator used</span><b>{s.calcUses}</b></div>
      </div>
      {s.byDay.length > 1 && <div className="fn-days" role="img" aria-label={`Visitors per day, highest ${max}`}>{s.byDay.map(x => <div key={x.day} title={`${x.day}: ${x.visitors}`}><i style={{ height: `${(x.visitors / max) * 100}%` }} /></div>)}</div>}
      <div className="fn-two">
        <div><h3>Top pages</h3><ul>{s.pages.map(p => <li key={p.path}><span>{pageName(p.path)}</span><b>{p.views}</b></li>)}</ul></div>
        <div><h3>Where visits came from</h3><ul>{s.sources.map(p => <li key={p.source}><span>{p.source}</span><b>{p.sessions}</b></li>)}</ul></div>
      </div>
    </>}
    <h3 className="fn-h3">Prospects who opened their demo link</h3>
    {d.watched.length === 0 ? <p className="u-note">When someone opens the personal demo link from a text or email, they show up here, and you get a "call now" alert while they're watching.</p>
      : <ul className="fn-watch">{d.watched.map(w => <li key={w.company + w.at}><b>{w.company}</b>{w.name && <span> · {w.name}</span>}<span className="u-quiet">{new Date(w.at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}{w.plays ? `, watched the film${w.plays > 1 ? ` ${w.plays}×` : ""}` : ", opened it"}{w.seconds ? `, ${secs(w.seconds)} on the page` : ""}</span></li>)}</ul>}
  </section>;
}
