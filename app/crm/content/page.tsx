"use client";

import { useCallback, useEffect, useState } from "react";
import { ALL_POSTS, nextPost, type Channel, type ContentPost } from "@/lib/content-posts";
import "./content.css";

type Posted = { key: string; channel: string; at: string };

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const CHANNELS: { id: Channel; title: string; target: number; unit: string }[] = [
  { id: "page", title: "Facebook page and Instagram", target: 35, unit: "page posts" },
  { id: "video", title: "TikTok and Reels", target: 35, unit: "videos" },
];

/** Content: today's post for the Facebook page and Instagram, today's video, and what you've posted this week. You post by hand; this picks the post and keeps count. */
export default function ContentPage() {
  const [posted, setPosted] = useState<Posted[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/content", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see your posts." : j.error || "Couldn't load your posts.");
      setPosted(j.posted ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your posts."); setPosted(p => p ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function copy(p: ContentPost) {
    const fail = () => setError("Couldn't copy. Select the text and copy it by hand.");
    if (!navigator.clipboard?.writeText) { fail(); return; }
    navigator.clipboard.writeText(p.caption ?? p.body).then(() => {
      setCopied(p.key);
      setTimeout(() => setCopied(c => (c === p.key ? null : c)), 1800);
    }, fail);
  }
  async function markPosted(p: ContentPost) {
    setBusy(p.key); setError("");
    try {
      const r = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: p.key }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save that.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); }
    finally { setBusy(null); }
  }
  async function undo(key: string) {
    setBusy(key); setError("");
    try {
      const r = await fetch(`/api/content?key=${encodeURIComponent(key)}&since=${encodeURIComponent(startOfToday().toISOString())}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't undo that.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't undo that."); }
    finally { setBusy(null); }
  }

  const list = posted ?? [];
  const today = localDay(new Date());
  const weekAgo = Date.now() - 7 * 86400000;
  const lastPosted = (key: string) => list.find(p => p.key === key)?.at ?? null; // newest first

  return <div className="u-page ct-page" role="region" aria-label="Content">
    <div className="u-head">
      <div>
        <h1 className="u-title">Content</h1>
        <p className="u-title-sub">5 page posts and 5 videos a day. Download it, paste the caption, post, mark it posted, and the next one comes up.</p>
      </div>
    </div>
    {error && <p className="u-flash is-bad" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

    {posted === null ? <p className="u-note" role="status">Loading…</p> : <>
      <div className="ct-today">
        {CHANNELS.map(ch => {
          const done = list.filter(p => p.channel === ch.id && localDay(new Date(p.at)) === today);
          const doneLabel = done.length ? ALL_POSTS.find(p => p.key === done[0].key)?.label ?? done[0].key : "";
          const post = nextPost(ch.id, list.filter(p => p.channel === ch.id));
          return <section key={ch.id} className="u-sheet ct-slot" aria-label={ch.title}>
            <div className="ct-slot-head">
              <span className="ct-chan">{ch.title}</span>
              <span className="ct-when">{done.length ? "Next up" : "Today"}</span>
            </div>
            {done.length > 0 && <div className="ct-done" role="status">
              <span className="u-dot is-good" aria-hidden="true" />
              <span>Posted today: <b>{doneLabel}</b>{done.length > 1 ? ` and ${done.length - 1} more` : ""}</span>
              <button type="button" className="ct-link" disabled={busy === done[0].key} onClick={() => void undo(done[0].key)}>Undo</button>
            </div>}
            <h2 className="ct-label">{post.label}</h2>
            {post.file && (
              <div className="ct-video">
                {post.file.endsWith(".mp4")
                  ? <video src={post.file} controls playsInline preload="metadata" />
                  : <img src={post.file} alt="" className="ct-img" />}
                <a className="u-btn" href={post.file} download>{post.file.endsWith(".mp4") ? "Download video" : "Download image"}</a>
              </div>
            )}
            {post.shoot && !post.file && <p className="ct-shoot"><b>Shoot it:</b> {post.shoot}</p>}
            <p className="ct-cap-label">Caption</p>
            <div className="ct-body">{post.caption ?? post.body}</div>
            <div className="ct-acts">
              <button type="button" className="u-btn" onClick={() => copy(post)}>{copied === post.key ? "Copied" : "Copy caption"}</button>
              <button type="button" className={"u-btn" + (done.length ? "" : " u-btn-light")} disabled={busy === post.key} onClick={() => void markPosted(post)}>{busy === post.key ? "Saving…" : "Mark posted"}</button>
            </div>
          </section>;
        })}
      </div>

      <section className="u-block ct-week">
        <div className="u-h2-row"><h2 className="u-h2">This week</h2><span className="u-note">Last 7 days. Target is 35 page posts and 35 videos (5 a day each). Page posts share to Facebook and Instagram; videos go to TikTok.</span></div>
        <div className="u-figs">
          {CHANNELS.map(ch => {
            const n = list.filter(p => p.channel === ch.id && Date.parse(p.at) > weekAgo).length;
            return <div key={ch.id} className="u-fig">
              <span className="u-fig-k">{ch.title}</span>
              <div className="u-fig-v">{n}<small>/ {ch.target}</small></div>
              <div className="u-meter"><i style={{ width: Math.min(100, (n / ch.target) * 100) + "%" }} /></div>
              <div className="u-fig-sub">{n >= ch.target ? "Target hit" : <><b>{ch.target - n}</b> more {ch.unit} to go</>}</div>
            </div>;
          })}
        </div>
      </section>

      <section className="u-block">
        <div className="u-h2-row"><h2 className="u-h2">All posts</h2><span className="u-note">The rotation picks one you haven&apos;t posted, then the one posted longest ago.</span></div>
        {CHANNELS.map(ch => <div key={ch.id} className="ct-group">
          <h3 className="ct-group-h">{ch.title}</h3>
          <div className="u-rows">{ALL_POSTS.filter(p => p.channel === ch.id).map(p => { const at = lastPosted(p.key); return <div key={p.key} className="u-row ct-row">
            <div className="u-row-main"><strong>{p.label}</strong><span>{p.body.split("\n").find(l => l.trim())}</span></div>
            <span className="u-row-end ct-last">{at ? (localDay(new Date(at)) === today ? "Today" : shortDate(at)) : "Never posted"}</span>
            <button type="button" className="u-btn u-btn-bare" onClick={() => copy(p)}>{copied === p.key ? "Copied" : "Copy"}</button>
          </div>; })}</div>
        </div>)}
      </section>
    </>}
  </div>;
}
