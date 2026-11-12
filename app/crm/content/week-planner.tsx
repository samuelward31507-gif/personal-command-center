"use client";

// The week's content: 5 Facebook + Instagram posts and 5 reels a day, plus LinkedIn and groups, written by Cinder
// from your real week. Per day: prepare every image and reel in one click, then queue the day so it posts itself
// to Facebook and Instagram at five times through the day. TikTok and LinkedIn: download and post.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PostCard, { cardPng } from "./post-card";
import { renderReel, scenesFor, reelExt, downloadBlob } from "./reel";
import { dayDate, weekStart, type Card } from "@/lib/content-engine";

type Draft = {
  id: string; day: number; n: number; platform: "feed" | "video" | "linkedin" | "group"; pillar: string; pillarName: string; format: string; angle: string;
  hook: string; body: string; caption: string; card: Card; slides: Card[]; shoot: string; status: string; postedAt: string | null; url: string;
  views: number | null; comments: number | null; leads: number | null; issues: string[];
  scheduledAt: string | null; publishStatus: string; publishError: string; media: number;
};
type Data = {
  week: string; drafts: Draft[]; topics: { key: string; name: string; score: number; posts: number; leads: number }[];
  totals: { posts: number; views: number; comments: number; leads: number }; canWrite: boolean; meta: { connected: boolean; instagram: boolean };
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const GROUPS: { id: Draft["platform"]; title: string; note: string }[] = [
  { id: "feed", title: "Facebook + Instagram", note: "Posts itself when queued" },
  { id: "video", title: "Reels", note: "Instagram and Facebook post themselves; download for TikTok" },
  { id: "linkedin", title: "LinkedIn", note: "Copy and post" },
  { id: "group", title: "Facebook groups", note: "Copy and post in 2–3 groups" },
];
const localYmd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nice = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const cardsOf = (d: Draft) => (d.platform === "video" ? scenesFor(d) : d.slides.length ? d.slides : [d.card]);
const fileBase = (d: Draft) => `cinder-${DAYS[d.day].toLowerCase()}-${d.platform === "video" ? "reel" : d.platform}-${d.n + 1}`;

async function upload(draftId: string, idx: number, blob: Blob) {
  const r = await fetch(`/api/content/media?draft=${draftId}&idx=${idx}`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save the file.");
}

/** Render and save a post's image(s) or reel. Returns the files so they can be downloaded too. */
async function prepare(d: Draft, onProgress?: (p: number) => void): Promise<{ name: string; blob: Blob }[]> {
  if (d.platform === "video") {
    const blob = await renderReel(scenesFor(d), onProgress);
    await upload(d.id, 0, blob);
    return [{ name: `${fileBase(d)}.${reelExt(blob)}`, blob }];
  }
  const cards = cardsOf(d), out: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < cards.length; i++) {
    // Instagram only takes JPEG, so the saved copy for posting is JPEG; downloads are JPEG too (smaller, same look).
    const blob = await cardPng(cards[i], { page: cards.length > 1 ? `${i + 1}/${cards.length}` : undefined, jpeg: true });
    if (d.platform === "feed") await upload(d.id, i, blob);
    out.push({ name: `${fileBase(d)}${cards.length > 1 ? "-" + (i + 1) : ""}.jpg`, blob });
    onProgress?.((i + 1) / cards.length);
  }
  return out;
}

type FileOut = { name: string; blob: Blob };
const asFiles = (files: FileOut[]) => files.map(f => new File([f.blob], f.name, { type: f.blob.type || "image/png" }));
/** Phones block a burst of downloads and keep only the last one. There, hand every file to the share sheet at once
 *  ("Save 6 Images" puts them all in Photos). The share sheet needs a fresh tap, so if the files took a while to
 *  make, `ask` is called and the caller shows a "Save to Photos" button. Desktops just download each file. */
async function saveFiles(files: FileOut[], ask: (files: FileOut[]) => void): Promise<void> {
  if (!files.length) return;
  const list = asFiles(files);
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: list })) {
    try { await navigator.share({ files: list }); return; }
    catch (e) { if ((e as Error)?.name === "AbortError") return; ask(files); return; }
  }
  files.forEach((f, i) => setTimeout(() => downloadBlob(f.blob, f.name), i * 350));
}
async function shareNow(files: FileOut[]): Promise<boolean> {
  try { await navigator.share({ files: asFiles(files) }); return true; } catch (e) { return (e as Error)?.name === "AbortError"; }
}

function Status({ d }: { d: Draft }) {
  if (d.status === "posted") return <span className="cw-pill is-ok">Posted{d.postedAt ? " " + clock(d.postedAt) : ""}</span>;
  if (d.status === "skipped") return <span className="cw-pill">Skipped</span>;
  if (d.publishStatus === "queued" && d.scheduledAt) return <span className="cw-pill is-q">Queued · {clock(d.scheduledAt)}</span>;
  if (d.publishStatus === "publishing") return <span className="cw-pill is-q">Posting…</span>;
  if (d.publishStatus === "failed") return <span className="cw-pill is-bad" title={d.publishError}>Didn&rsquo;t post</span>;
  if (d.media && (d.platform === "feed" || d.platform === "video")) return <span className="cw-pill">Ready</span>;
  return null;
}

function DraftCard({ d, busy, act, meta }: { d: Draft; busy: boolean; act: (action: string, extra?: Record<string, unknown>) => Promise<boolean>; meta: Data["meta"] }) {
  const canvases = useRef<Record<number, HTMLCanvasElement>>({});
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hook, setHook] = useState(d.hook), [body, setBody] = useState(d.body);
  const [note, setNote] = useState(""), [noting, setNoting] = useState(false);
  const [url, setUrl] = useState(d.url);
  const [m, setM] = useState({ views: d.views ?? "", comments: d.comments ?? "", leads: d.leads ?? "" });
  const [reel, setReel] = useState<{ src: string; blob: Blob } | null>(null);
  const [work, setWork] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { setHook(d.hook); setBody(d.body); setUrl(d.url); setM({ views: d.views ?? "", comments: d.comments ?? "", leads: d.leads ?? "" }); }, [d]);
  useEffect(() => () => { if (reel) URL.revokeObjectURL(reel.src); }, [reel]);
  const cards = cardsOf(d);
  const posted = d.status === "posted";
  const isReel = d.platform === "video";
  const copy = () => navigator.clipboard?.writeText(d.caption).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });
  const [pending, setPending] = useState<FileOut[] | null>(null);
  // Phones only open the share sheet straight from a tap, with nothing awaited first, so the slide images are
  // drawn ahead of time and the tap hands them over immediately.
  const [ready, setReady] = useState<File[] | null>(null);
  const cardKey = JSON.stringify(cards);
  useEffect(() => {
    if (isReel) return;
    let live = true;
    const t = setTimeout(() => {
      Promise.all(cards.map((c, i) => cardPng(c, { page: cards.length > 1 ? `${i + 1}/${cards.length}` : undefined })))
        .then(blobs => { if (live) setReady(asFiles(blobs.map((blob, i) => ({ blob, name: `${fileBase(d)}${cards.length > 1 ? "-" + (i + 1) : ""}.png` })))); })
        .catch(() => {});
    }, 400);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, isReel]);
  const downloadSlides = () => {
    if (ready && navigator.canShare?.({ files: ready })) {
      navigator.share({ files: ready }).catch((e: Error) => { if (e?.name !== "AbortError") files().then(f => setPending(f)); });
      return;
    }
    void files().then(f => saveFiles(f, setPending));
  };
  const files = async (): Promise<FileOut[]> => {
    const name = (i: number) => `${fileBase(d)}${cards.length > 1 ? "-" + (i + 1) : ""}.png`;
    const blobs = await Promise.all(cards.map((_, i) => new Promise<Blob | null>(res => canvases.current[i] ? canvases.current[i].toBlob(res, "image/png") : res(null))));
    return blobs.flatMap((b, i) => (b ? [{ name: name(i), blob: b }] : []));
  };

  async function makeReel(save: boolean) {
    setErr(""); setWork(0);
    try {
      const [f] = await prepare(d, p => setWork(p));
      setReel(r => { if (r) URL.revokeObjectURL(r.src); return { src: URL.createObjectURL(f.blob), blob: f.blob }; });
      if (save) downloadBlob(f.blob, f.name);
      await act("refresh");
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't make the reel."); }
    finally { setWork(null); }
  }

  return <article className={"cw-post" + (posted ? " is-posted" : "") + (d.status === "skipped" ? " is-skipped" : "") + (isReel ? " is-reel" : "")}>
    <div className="cw-media">
      {isReel && reel ? <video src={reel.src} className="cw-canvas is-tall" controls playsInline loop muted autoPlay /> :
        <div className={"cw-strip" + (cards.length > 1 && !isReel ? " is-multi" : "")}>
          {(isReel ? cards.slice(0, 1) : cards).map((c, i) => <PostCard key={i} card={c} tall={isReel} page={!isReel && cards.length > 1 ? `${i + 1}/${cards.length}` : undefined} label={`Image ${i + 1} for: ${d.hook}`} onCanvas={el => { canvases.current[i] = el; }} />)}
        </div>}
      {work !== null && <div className="cw-bar" role="progressbar" aria-valuenow={Math.round(work * 100)}><i style={{ width: work * 100 + "%" }} /></div>}
    </div>
    <div className="cw-copy">
      <header className="cw-post-h">
        <span className="cw-topic">{d.pillarName}{d.format === "carousel" ? ` · ${cards.length} slides` : isReel ? ` · ${cards.length} scenes` : ""}</span>
        <Status d={d} />
      </header>
      {editing ? <>
        <input className="cw-in" value={hook} onChange={e => setHook(e.target.value)} aria-label="First line" />
        <textarea className="cw-ta" value={body} onChange={e => setBody(e.target.value)} rows={8} aria-label="Post text" />
        <div className="cw-row"><button type="button" className="u-btn u-btn-go" disabled={busy} onClick={async () => { if (await act("edit", { hook, body })) setEditing(false); }}>Save</button><button type="button" className="u-btn u-btn-bare" onClick={() => { setEditing(false); setHook(d.hook); setBody(d.body); }}>Cancel</button></div>
      </> : <>
        <h3 className="cw-hook">{d.hook}</h3>
        <p className={"cw-body" + (open ? " is-open" : "")}>{d.body}</p>
        {d.body.length > 220 && <button type="button" className="cw-more" onClick={() => setOpen(o => !o)}>{open ? "Less" : "More"}</button>}
        {isReel && <ol className="cw-scenes">{cards.map((c, i) => <li key={i}>{c.type === "hook" ? c.text : c.type === "stat" ? `${c.figure} ${c.line}` : c.type === "list" ? c.title : c.title}</li>)}</ol>}
        {d.issues.length > 0 && <ul className="cw-issues">{d.issues.map(i => <li key={i}>{i}</li>)}</ul>}
        {d.publishStatus === "failed" && d.publishError && <p className="cw-err">{d.publishError}</p>}
        {err && <p className="cw-err">{err}</p>}
      </>}
      {!editing && <div className="cw-row">
        <button type="button" className="u-btn u-btn-go" onClick={copy}>{copied ? "Copied" : "Copy caption"}</button>
        {isReel ? <button type="button" className="u-btn" disabled={work !== null} onClick={() => void makeReel(true)}>{work !== null ? `Recording ${Math.round(work * 100)}%` : reel ? "Download reel" : "Make reel"}</button>
          : pending ? <button type="button" className="u-btn u-btn-go" onClick={async () => { if (await shareNow(pending)) setPending(null); }}>Save {pending.length} to Photos</button>
          : <button type="button" className="u-btn" onClick={downloadSlides}>{ready && typeof navigator !== "undefined" && navigator.canShare?.({ files: ready }) ? `Save ${cards.length > 1 ? cards.length + " " : ""}to Photos` : `Download${cards.length > 1 ? ` ${cards.length}` : ""}`}</button>}
        {meta.connected && (d.platform === "feed" || isReel) && !posted && d.media > 0 && <button type="button" className="u-btn" disabled={busy} onClick={() => void act("publish_now")}>Post now</button>}
        <button type="button" className="u-btn u-btn-bare" onClick={() => setEditing(true)}>Edit</button>
        <button type="button" className="u-btn u-btn-bare" disabled={busy} onClick={() => setNoting(n => !n)}>Rewrite</button>
        {!posted && d.status !== "skipped" && <button type="button" className="u-btn u-btn-bare" disabled={busy} onClick={() => void act("skip")}>Skip</button>}
      </div>}
      {noting && <div className="cw-row">
        <input className="cw-in" placeholder="Optional: what to change (shorter, about roofers, use Tuesday's call)" value={note} onChange={e => setNote(e.target.value)} />
        <button type="button" className="u-btn" disabled={busy} onClick={async () => { if (await act("rewrite", { note })) { setNoting(false); setNote(""); } }}>{busy ? "Writing…" : "Rewrite it"}</button>
      </div>}
      <div className="cw-track">
        {!posted ? <>
          <input className="cw-in" placeholder="Posted it yourself? Paste the link (optional)" value={url} onChange={e => setUrl(e.target.value)} />
          <button type="button" className="u-btn u-btn-bare" disabled={busy} onClick={() => void act("posted", { url })}>Mark posted</button>
        </> : <>
          <label>Views <input inputMode="numeric" value={m.views} onChange={e => setM({ ...m, views: e.target.value })} /></label>
          <label>Comments <input inputMode="numeric" value={m.comments} onChange={e => setM({ ...m, comments: e.target.value })} /></label>
          <label>Leads <input inputMode="numeric" value={m.leads} onChange={e => setM({ ...m, leads: e.target.value })} /></label>
          <button type="button" className="u-btn" disabled={busy} onClick={() => void act("metrics", m)}>Save</button>
          {d.url && <a className="u-btn u-btn-bare" href={d.url} target="_blank" rel="noreferrer">View</a>}
          <button type="button" className="u-btn u-btn-bare" disabled={busy} onClick={() => void act("unpost")}>Undo</button>
        </>}
      </div>
    </div>
  </article>;
}

export default function WeekPlanner() {
  const [week, setWeek] = useState(() => weekStart(localYmd()));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [prep, setPrep] = useState<{ done: number; total: number; label: string } | null>(null);
  const [dayFiles, setDayFiles] = useState<FileOut[] | null>(null);
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
    if (body.action === "refresh") { await load(); return true; }
    setBusy(key); setError("");
    try {
      const r = await fetch("/api/content/engine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save that.");
      if (j.error) setError(j.error);
      await load(); return j;
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); return false; }
    finally { setBusy(null); }
  }

  /** Writes the week in rounds until every slot has a post (each round fills what the last one didn't). */
  async function writeWeek() {
    setBusy("gen"); setError(""); setNote("");
    try {
      for (let round = 0; round < 4; round++) {
        const r = await fetch("/api/content/engine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", week }) });
        const j = await r.json().catch(() => ({}));
        await load();
        if (!r.ok) throw new Error(j.error || "Couldn't write the week.");
        if (!j.missing || !j.written) { if (j.missing) setNote(`${j.missing} posts still missing. Press it again to fill them.`); break; }
        setNote(`Written ${j.written} more. Filling the rest…`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't write the week."); }
    finally { setBusy(null); }
  }

  /** Render and save every image and reel for the day; optionally download them all and queue the day. */
  async function prepareDay(opts: { download: boolean; queue: boolean }) {
    const list = (data?.drafts ?? []).filter(d => d.day === day && d.status === "draft" && (opts.download ? true : d.platform === "feed" || d.platform === "video"));
    if (!list.length) return;
    setError(""); setPrep({ done: 0, total: list.length, label: "" });
    const files: { name: string; blob: Blob }[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        setPrep({ done: i, total: list.length, label: d.platform === "video" ? `Recording reel ${d.n + 1}` : `Drawing ${d.platform === "feed" ? "post" : d.platform} ${d.n + 1}` });
        if (d.platform === "linkedin" || d.platform === "group") { if (opts.download) files.push(...await prepare(d)); continue; }
        if (d.media && !opts.download) continue; // already prepared
        files.push(...await prepare(d));
      }
      if (opts.download) await saveFiles(files, setDayFiles);
      await load();
      if (opts.queue) {
        const ids = list.filter(d => d.platform === "feed" || d.platform === "video").map(d => d.id);
        const j = await post({ action: "schedule", ids }, "queue");
        if (j && typeof j === "object" && "queued" in j) setNote(`${(j as { queued: number }).queued} posts queued for ${DAYS[day]}. They go out at 7:30, 10:30, 1:30, 4:30 and 7:30.`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't prepare the day."); }
    finally { setPrep(null); }
  }

  const shift = (n: number) => { setWeek(dayDate(week, n * 7)); setData(null); };
  const drafts = useMemo(() => data?.drafts ?? [], [data]);
  const ofDay = drafts.filter(d => d.day === day);
  const counts = DAYS.map((_, i) => { const l = drafts.filter(d => d.day === i && d.status !== "skipped"); return { all: l.length, done: l.filter(d => d.status === "posted").length, queued: l.filter(d => d.publishStatus === "queued").length }; });
  const isThisWeek = week === weekStart(localYmd());
  const live = drafts.filter(d => d.status !== "skipped").length;
  const postedCount = drafts.filter(d => d.status === "posted").length;
  const dayQueued = ofDay.filter(d => d.publishStatus === "queued");

  return <section className="cw" aria-label="This week's posts">
    <div className="cw-head">
      <div>
        <h2 className="cw-title">{isThisWeek ? "This week" : `Week of ${nice(week)}`}</h2>
        <p className="cw-sub">{live ? `${live} posts · ${postedCount} posted` : "5 posts and 5 reels a day, written from your week"}</p>
      </div>
      <div className="cw-nav">
        <button type="button" className="u-btn u-btn-bare" onClick={() => shift(-1)} aria-label="Previous week">‹</button>
        <button type="button" className="u-btn u-btn-bare" onClick={() => { setWeek(weekStart(localYmd())); setDay(todayIdx); }} disabled={isThisWeek}>Today</button>
        <button type="button" className="u-btn u-btn-bare" onClick={() => shift(1)} aria-label="Next week">›</button>
        <button type="button" className="u-btn u-btn-go" disabled={!!busy || data?.canWrite === false} onClick={() => void writeWeek()}>
          {busy === "gen" ? "Writing… about 2 minutes" : live ? "Fill in missing posts" : "Write this week"}
        </button>
      </div>
    </div>

    {data && <div className={"cw-connect" + (data.meta.connected ? " is-on" : "")}>
      <span className="cw-dot" aria-hidden="true" />
      {data.meta.connected
        ? <span>Facebook{data.meta.instagram ? " and Instagram" : ""} connected. Queued posts go out on their own, five times a day.{!data.meta.instagram ? " Add META_IG_USER_ID to post to Instagram too." : ""}</span>
        : <span>Facebook and Instagram aren&rsquo;t connected, so posts don&rsquo;t go out on their own yet. Add <code>META_PAGE_ID</code>, <code>META_PAGE_TOKEN</code> and <code>META_IG_USER_ID</code> in Vercel. Until then, download and post.</span>}
    </div>}
    {error && <p className="cw-error" role="alert">{error}</p>}
    {note && <p className="cw-note" role="status">{note}</p>}
    {data?.canWrite === false && <p className="u-note">Cinder needs the Anthropic key in Vercel to write posts.</p>}

    <div className="cw-days" role="tablist" aria-label="Day">
      {DAYS.map((d, i) => <button key={d} type="button" role="tab" aria-selected={day === i} className={"cw-day" + (day === i ? " is-on" : "") + (isThisWeek && i === todayIdx ? " is-today" : "")} onClick={() => setDay(i)}>
        <span className="cw-day-top"><b>{d}</b>{isThisWeek && i === todayIdx && <i>Today</i>}</span>
        <small>{nice(dayDate(week, i))}</small>
        <span className="cw-meter"><i style={{ width: counts[i].all ? (counts[i].done / counts[i].all) * 100 + "%" : 0 }} /><i className="q" style={{ width: counts[i].all ? (counts[i].queued / counts[i].all) * 100 + "%" : 0 }} /></span>
        <em>{counts[i].all ? `${counts[i].done} of ${counts[i].all} posted` : "Nothing yet"}</em>
      </button>)}
    </div>

    {ofDay.length > 0 && <div className="cw-daybar">
      <div className="cw-daybar-l">
        <b>{DAYS[day]}, {nice(dayDate(week, day))}</b>
        <span>{prep ? `${prep.label} · ${prep.done + 1} of ${prep.total}` : dayQueued.length ? `${dayQueued.length} queued` : "Prepare the images and reels, then queue them."}</span>
        {prep && <span className="cw-bar"><i style={{ width: (prep.done / prep.total) * 100 + "%" }} /></span>}
      </div>
      <div className="cw-row">
        {dayFiles ? <button type="button" className="u-btn u-btn-go" onClick={async () => { if (await shareNow(dayFiles)) setDayFiles(null); }}>Save {dayFiles.length} files to Photos</button>
          : <button type="button" className="u-btn" disabled={!!prep} onClick={() => void prepareDay({ download: true, queue: false })}>Download all</button>}
        {data?.meta.connected && <button type="button" className="u-btn u-btn-go" disabled={!!prep || !!busy} onClick={() => void prepareDay({ download: false, queue: true })}>{prep ? "Preparing…" : "Prepare and queue the day"}</button>}
        {dayQueued.length > 0 && <button type="button" className="u-btn u-btn-bare" disabled={!!busy} onClick={() => void post({ action: "unschedule", ids: dayQueued.map(d => d.id) }, "unq")}>Unqueue</button>}
      </div>
    </div>}
    {prep && <p className="u-note">Keep this tab open and in front while reels record. Each one records in real time, about 15 seconds.</p>}

    {!data ? <p className="u-note">Loading…</p> : !drafts.length ? <div className="cw-empty">
      <b>Nothing written for this week yet.</b>
      <p>Cinder writes 77 posts from your real week: 5 Facebook + Instagram posts and 5 reels a day, LinkedIn on weekdays and two group posts. They come from what owners said on your calls, your numbers, and the topics that brought leads before. It writes next week every Sunday on its own.</p>
    </div> : !ofDay.length ? <p className="u-note">Nothing planned for {DAYS[day]}.</p> :
      GROUPS.map(g => { const list = ofDay.filter(d => d.platform === g.id); return list.length ? <div key={g.id} className="cw-group">
        <div className="cw-group-h"><h3>{g.title} <span>{list.length}</span></h3><small>{g.note}</small></div>
        <div className="cw-list">{list.map(d => <DraftCard key={d.id} d={d} meta={data.meta} busy={busy === d.id} act={(action, extra) => post({ action, id: d.id, ...extra }, d.id) as Promise<boolean>} />)}</div>
      </div> : null; })}

    {data && data.totals.posts > 0 && <div className="cw-topics">
      <h3 className="cw-group-h">What&rsquo;s working <small>Last 120 days: {data.totals.posts} posts, {data.totals.views.toLocaleString()} views, {data.totals.leads} leads</small></h3>
      <ol>{data.topics.filter(t => t.posts).map(t => <li key={t.key}><span>{t.name}</span><small>{t.posts} posts · {t.leads} leads</small><i style={{ width: Math.max(4, (t.score / Math.max(1, data.topics[0].score)) * 100) + "%" }} /></li>)}</ol>
      <p className="u-note">Next week gets more of the topics at the top. Log leads on a post when someone mentions it or DMs from it.</p>
    </div>}
  </section>;
}
