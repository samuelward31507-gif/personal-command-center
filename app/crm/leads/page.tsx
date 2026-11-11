"use client";

// Lead finder: pick trades and cities once; every night Cinder pulls the best local businesses from Google Maps
// into Contacts whenever the call list runs low, then audits them and finds their emails before you call.
import { useCallback, useEffect, useState } from "react";
import { TRADES } from "@/lib/lead-finder";
import "./leads.css";

type Search = { id: string; trade: string; city: string; pages: number; found: number; added: number; status: string; last_run_at: string | null };
type Data = { searches: Search[]; waiting: number; fromMaps: number; floor: number; configured: boolean };
const PICKS = ["fence company", "deck builder", "concrete contractor", "roofing contractor", "landscaping company", "auto detailing", "pressure washing", "garage door company"];
const ago = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Not yet");

export default function LeadFinder() {
  const [d, setD] = useState<Data | null>(null);
  const [trades, setTrades] = useState<string[]>(["fence company"]);
  const [cities, setCities] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => fetch("/api/leads", { cache: "no-store" }).then(r => r.json()).then(j => { if (!j.error) setD(j); else setNote({ ok: false, text: j.error }); }).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>, key: string, ok: (j: Record<string, unknown>) => string) {
    setBusy(key); setNote(null);
    try {
      const r = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "That didn't work.");
      setNote({ ok: true, text: ok(j) }); await load();
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "That didn't work." }); }
    finally { setBusy(""); }
  }
  const cityList = cities.split(/\n|;/).map(c => c.trim()).filter(Boolean);
  const queued = d?.searches.filter(s => s.status === "queued").length ?? 0;
  const pct = d ? Math.min(100, (d.waiting / Math.max(1, d.floor)) * 100) : 0;

  return <div className="u-page lf-page" role="region" aria-label="Lead finder">
    <div className="u-head">
      <div>
        <h1 className="u-title">Lead finder</h1>
        <p className="u-title-sub">Pick trades and cities once. Every night, when fewer than {d?.floor ?? 150} fresh leads are waiting, Cinder pulls the best local businesses from Google Maps, audits them and finds their emails.</p>
      </div>
    </div>

    {d && !d.configured && <div className="lf-setup">
      <b>One key to turn this on</b>
      <p>In Google Cloud (the same project as Gmail), enable <em>Places API (New)</em>, create an API key restricted to it, and add it in Vercel as <code>GOOGLE_PLACES_KEY</code>. Google&rsquo;s free monthly allowance covers about 1,000 searches, roughly 20,000 businesses.</p>
    </div>}
    {note && <p className={"u-flash " + (note.ok ? "is-good" : "is-bad")} role="status">{note.text}</p>}

    <div className="u-figs">
      <div className="u-fig"><span className="u-fig-k">Fresh leads waiting</span><div className="u-fig-v">{d?.waiting ?? "–"}<small>/ {d?.floor ?? 150}</small></div><div className="u-meter"><i style={{ width: pct + "%" }} /></div><div className="u-fig-sub">{d && d.waiting >= d.floor ? "Full. Nothing to pull tonight." : "Tops up tonight"}</div></div>
      <div className="u-fig"><span className="u-fig-k">From Google Maps</span><div className="u-fig-v">{d?.fromMaps ?? "–"}</div><div className="u-fig-sub">waiting to be called</div></div>
      <div className="u-fig"><span className="u-fig-k">Searches queued</span><div className="u-fig-v">{queued}</div><div className="u-fig-sub">{d?.searches.length ?? 0} saved in all</div></div>
    </div>

    <section className="u-sheet u-sheet-pad lf-add">
      <h2 className="u-h2">Add searches</h2>
      <div className="lf-grid">
        <div>
          <p className="lf-label">Trades</p>
          <div className="lf-chips">{[...new Set([...PICKS, ...trades])].map(t => <button key={t} type="button" aria-pressed={trades.includes(t)} className={"lf-chip" + (trades.includes(t) ? " is-on" : "")} onClick={() => setTrades(x => x.includes(t) ? x.filter(y => y !== t) : [...x, t])}>{t}</button>)}</div>
          <select className="lf-more" value="" onChange={e => e.target.value && setTrades(x => x.includes(e.target.value) ? x : [...x, e.target.value])} aria-label="More trades">
            <option value="">More trades…</option>{TRADES.filter(t => !PICKS.includes(t)).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <p className="lf-label">Cities, one per line</p>
          <textarea className="lf-cities" rows={6} value={cities} onChange={e => setCities(e.target.value)} placeholder={"Aurora, CO\nLakewood, CO\nFort Collins, CO\nPlano, TX"} />
        </div>
      </div>
      <div className="lf-row">
        <span className="u-note">{trades.length && cityList.length ? `${trades.length * cityList.length} searches, up to ${trades.length * cityList.length * 60} businesses` : "Pick trades and add cities."}</span>
        <button type="button" className="u-btn u-btn-go" disabled={!trades.length || !cityList.length || busy === "add"} onClick={() => void post({ action: "add", trades, cities: cityList }, "add", j => { setCities(""); return `${j.added} searches saved. They run tonight when the list is low, or press Run now.`; })}>Save searches</button>
      </div>
    </section>

    <section className="u-block">
      <div className="u-h2-row"><h2 className="u-h2">Saved searches</h2><span className="u-note">Each run pulls 3 pages (up to 60 businesses) and only adds open, local businesses with a phone, ranked by reviews and website.</span></div>
      {!d ? <p className="u-note">Loading…</p> : !d.searches.length ? <p className="lf-empty">No searches yet. Add a trade and a few cities above.</p> :
        <table className="lf-table"><thead><tr><th>Search</th><th>Pages</th><th>Found</th><th>Added</th><th>Last run</th><th>Status</th><th /></tr></thead>
          <tbody>{d.searches.map(s => <tr key={s.id}>
            <td><b>{s.trade}</b><small>{s.city}</small></td><td>{s.pages}</td><td>{s.found}</td><td>{s.added}</td><td>{ago(s.last_run_at)}</td>
            <td><span className={"u-mark" + (s.status === "done" ? " is-good" : "")}>{s.status === "done" ? "Finished" : s.status === "paused" ? "Paused" : "Queued"}</span></td>
            <td className="lf-acts">{s.status !== "done" && <>
              <button type="button" className="u-btn" disabled={!!busy || !d.configured} onClick={() => void post({ action: "run", id: s.id }, s.id, j => `${j.added} new leads added to Contacts${j.done ? ". That search is finished." : "."}`)}>{busy === s.id ? "Searching…" : "Run now"}</button>
              <button type="button" className="u-btn u-btn-bare" disabled={!!busy} onClick={() => void post({ action: s.status === "paused" ? "resume" : "pause", id: s.id }, "p" + s.id, () => s.status === "paused" ? "Resumed." : "Paused.")}>{s.status === "paused" ? "Resume" : "Pause"}</button>
            </>}</td>
          </tr>)}</tbody></table>}
    </section>
  </div>;
}
