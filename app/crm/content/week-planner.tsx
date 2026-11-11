"use client";

// This week's posts, written by Cinder from your real week: one tab per day, every platform's post with its image,
// copy and download buttons, a rewrite with a note, and the numbers once it's up so next week leans on what worked.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PostCard, { downloadCanvas } from "./post-card";
import { dayDate, weekStart, type Card } from "@/lib/content-engine";

type Draft = {
  id: string; day: number; platform: "feed" | "video" | "linkedin" | "group"; pillar: string; pillarName: string; format: string;
  hook: string; body: string; caption: string; card: Card; slides: Card[]; shoot: string; status: string; postedAt: string | null; url: string;
  views: number | null; comments: number | null; leads: number | null; issues: string[];
};
type Data = { week: string; drafts: Draft[]; topics: { key: string; name: string; score: number; posts: number; leads: number }[]; totals: { posts: number; views: number; comments: number; leads: number }; canWrite: boolean };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLAT: Record<string, { name: string; open?: string }> = {
  feed: { name: "Facebook + Instagram", open: "https://business.facebook.com/latest/composer" },
  video: { name: "TikTok + Reels + Shorts", open: "https://www.tiktok.com/upload" },
  linkedin: { name: "LinkedIn", open: "https://www.linkedin.com/feed/?shareActive=true" },
  group: { name: "Facebook group" },
};
const localYmd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nice = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function DraftCard({ d, busy, act }: { d: Draft; busy: boolean; act: (action: string, extra?: Record<string, unknown>) => Promise<boolean> }) {
  const canvases = useRef<Record<number, HTMLCanvasElement>>({});
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hook, setHook] = useState(d.hook), [body, setBody] = useState(d.body);
  const [note, setNote] = useState(""), [noting, setNoting] = useState(false);
  const [url, setUrl] = useState(d.url);
  const [m, setM] = useState({ views: d.views ?? "", comments: d.comments ?? "", leads: d.leads ?? "" });
  useEffect(() => { setHook(d.hook); setBody(d.body); setUrl(d.url); setM({ views: d.views ?? "", comments: d.comments ?? "", leads: d.leads ?? "" }); }, [d]);
  const cards = d.slides.length ? d.slides : [d.card];
  const posted = d.status === "posted";
  const name = (i: number) => `cinder-${DAYS[d.day].toLowerCase()}-${d.platform}${cards.length > 1 ? "-" + (i + 1) : ""}.png`;
  const copy = () => navigator.clipboard?.writeText(d.caption).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });

  return <article className={"cw-post" + (posted ? " is-posted" : "") + (d.status === "skipped" ? " is-skipped" : "")}>
    <header className="cw-post-h">
      <span className="cw-plat">{PLAT[d.platform].name}</span>
      <span className="cw-topic">{d.pillarName}{d.format === "carousel" ? ` · carousel, ${cards.length} slides` : ""}</span>
      {posted && <span className="cw-done">Posted</span>}
      {d.status === "skipped" && <span className="cw-skip">Skipped</span>}
    </header>
    <div className="cw-post-b">
      <div className="cw-media">
        <div className={"cw-strip" + (cards.length > 1 ? " is-multi" : "")}>
          {cards.map((c, i) => <PostCard key={i} card={c} page={cards.length > 1 ? `${i + 1}/${cards.length}` : undefined} label={`Image ${i + 1} for: ${d.hook}`} onCanvas={el => { canvases.current[i] = el; }} />)}
        </div>
        <button type="button" className="u-btn" onClick={() => cards.forEach((_, i) => canvases.current[i] && setTimeout(() => downloadCanvas(canvases.current[i], name(i)), i * 250))}>
          Download {cards.length > 1 ? `${cards.length} images` : "image"}
        </button>
      </div>
      <div className="cw-copy">
        {editing ? <>
          <input className="cw-in" value={hook} onChange={e => setHook(e.target.value)} aria-label="First line" />
          <textarea className="cw-ta" value={body} onChange={e => setBody(e.target.value)} rows={10} aria-label="Post text" />
          <div className="cw-row"><button type="button" className="u-btn u-btn-go" disabled={busy} onClick={async () => { if (await act("edit", { hook, body })) setEditing(false); }}>Save</button><button type="button" className="u-btn u-btn-bare" onClick={() => { setEditing(false); setHook(d.hook); setBody(d.body); }}>Cancel</button></div>
        </> : <>
          <h3 className="cw-hook">{d.hook}</h3>
          <p className="cw-body">{d.body}</p>
          {d.shoot && <div className="cw-shoot"><b>What to film</b><p>{d.shoot}</p></div>}
          {d.issues.length > 0 && <ul className="cw-issues">{d.issues.map(i => <li key={i}>{i}</li>)}</ul>}
        </>}
        {!editing && <div className="cw-row">
          <button type="button" className="u-btn u-btn-go" onClick={copy}>{copied ? "Copied" : d.platform === "video" ? "Copy caption" : "Copy text"}</button>
          {PLAT[d.platform].open && <a className="u-btn" href={PLAT[d.platform].open} target="_blank" rel="noreferrer">Open {d.platform === "feed" ? "Meta" : d.platform === "video" ? "TikTok" : "LinkedIn"}</a>}
          <button type="button" className="u-btn u-btn-bare" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="u-btn u-btn-bare" disabled={busy} onClick={() => setNoting(n => !n)}>Rewrite</button>
          {!posted && d.status !== "skipped" && <button type="button" className="u-btn u-btn-bare" disabled={busy} onClick={() => void act("skip")}>Skip</button>}
        </div>}
        {noting && <div className="cw-row">
          <input className="cw-in" placeholder="Optional: what to change (e.g. about roofers, shorter, use Tuesday's call)" value={note} onChange={e => setNote(e.target.value)} />
          <button type="button" className="u-btn" disabled={busy} onClick={async () => { if (await act("rewrite", { note })) { setNoting(false); setNote(""); } }}>{busy ? "Writing…" : "Rewrite it"}</button>
        </div>}
        <div className="cw-track">
          {!posted ? <>
            <input className="cw-in" placeholder="Link to the post (optional)" value={url} onChange={e => setUrl(e.target.value)} />
            <button type="button" className="u-btn" disabled={busy} onClick={() => void act("posted", { url })}>Mark posted</button>
          </> : <>
            <label>Views <input inputMode="numeric" value={m.views} onChange={e => setM({ ...m, views: e.target.value })} /></label>
            <label>Comments <input inputMode="numeric" value={m.comments} onChange={e => setM({ ...m, comments: e.target.value })} /></label>
            <label>Leads <input inputMode="numeric" value={m.leads} onChange={e => setM({ ...m, leads: e.target.value })} /></label>
            <button type="button" className="u-btn" disabled={busy} onClick={() => void act("metrics", m)}>Save numbers</button>
            {d.url && <a className="u-btn u-btn-bare" href={d.url} target="_blank" rel="noreferrer">View post</a>}
            <button type="button" className="u-btn u-btn-bare" disabled={busy} onClick={() => void act("unpost")}>Undo</button>
          </>}
        </div>
      </div>
    </div>
  </article>;
}

export default function WeekPlanner() {
  const [week, setWeek] = useState(() => weekStart(localYmd()));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [day, setDay] = useState(todayIdx);

  const load = useCallback(async (w = week) => {
    try {
      const r = await fetch(`/api/content/engine?week=${w}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't load this week's posts.");
      setData(j); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load this week's posts."); }
  }, [week]);
  useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key); setError("");
    try {
      const r = await fetch("/api/content/engine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save that.");
      if (j.error) setError(j.error);
      await load(); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); return false; }
    finally { setBusy(null); }
  }

  const shift = (n: number) => { const w = dayDate(week, n * 7); setWeek(w); setData(null); };
  const drafts = useMemo(() => data?.drafts ?? [], [data]);
  const ofDay = drafts.filter(d => d.day === day);
  const counts = DAYS.map((_, i) => ({ all: drafts.filter(d => d.day === i && d.status !== "skipped").length, done: drafts.filter(d => d.day === i && d.status === "posted").length }));
  const isThisWeek = week === weekStart(localYmd());
  const postedCount = drafts.filter(d => d.status === "posted").length;
  const live = drafts.filter(d => d.status !== "skipped").length;

  return <section className="cw" aria-label="This week's posts">
    <div className="u-h2-row cw-head">
      <h2 className="u-h2">{isThisWeek ? "This week" : `Week of ${nice(week)}`} <span className="u-quiet">{live ? `${postedCount} of ${live} posted` : ""}</span></h2>
      <div className="cw-nav">
        <button type="button" className="u-btn u-btn-bare" onClick={() => shift(-1)} aria-label="Previous week">‹</button>
        <button type="button" className="u-btn u-btn-bare" onClick={() => { setWeek(weekStart(localYmd())); setDay(todayIdx); }} disabled={isThisWeek}>This week</button>
        <button type="button" className="u-btn u-btn-bare" onClick={() => shift(1)} aria-label="Next week">›</button>
        <button type="button" className="u-btn u-btn-go" disabled={!!busy || data?.canWrite === false} onClick={() => void post({ action: "generate", week }, "gen")}>
          {busy === "gen" ? "Writing the week… about a minute" : drafts.length ? "Fill in missing platforms" : "Write this week"}
        </button>
      </div>
    </div>
    {error && <p className="cw-error" role="alert">{error}</p>}
    {data?.canWrite === false && <p className="u-note">Cinder needs the Anthropic key in Vercel to write posts. Until then, the post library below still works.</p>}

    <div className="cw-days" role="tablist" aria-label="Day">
      {DAYS.map((d, i) => <button key={d} type="button" role="tab" aria-selected={day === i} className={"cw-day" + (day === i ? " is-on" : "") + (isThisWeek && i === todayIdx ? " is-today" : "")} onClick={() => setDay(i)}>
        <b>{d}</b><small>{nice(dayDate(week, i))}</small><em>{counts[i].all ? `${counts[i].done}/${counts[i].all}` : "–"}</em>
      </button>)}
    </div>

    {!data ? <p className="u-note">Loading…</p> : !drafts.length ? <div className="cw-empty">
      <p><b>Nothing written for this week yet.</b> Cinder writes 21 posts from your real week: what you heard on calls, your dial numbers, and the topics that brought leads before. Every Sunday morning it writes the next week on its own.</p>
    </div> : !ofDay.length ? <p className="u-note">Nothing planned for {DAYS[day]}.</p> :
      <div className="cw-list">{ofDay.map(d => <DraftCard key={d.id} d={d} busy={busy === d.id} act={(action, extra) => post({ action, id: d.id, ...extra }, d.id)} />)}</div>}

    {data && data.totals.posts > 0 && <div className="cw-topics">
      <h3 className="u-h2">What&rsquo;s working <span className="u-quiet">last 120 days: {data.totals.posts} posts, {data.totals.views.toLocaleString()} views, {data.totals.leads} leads</span></h3>
      <ol>{data.topics.filter(t => t.posts).map(t => <li key={t.key}><span>{t.name}</span><small>{t.posts} posts · {t.leads} leads</small><i style={{ width: Math.max(4, (t.score / Math.max(1, data.topics[0].score)) * 100) + "%" }} /></li>)}</ol>
      <p className="u-note">Next week gets more of the topics at the top. Log leads on a post when someone mentions it or DMs from it.</p>
    </div>}
  </section>;
}
