"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_GROUP_SCRIPTS, daysUntilDue, nextScript, type GroupScript } from "@/lib/group-posts";
import "./groups.css";

type Group = { id: string; name: string; url: string; rules: string; everyDays: number; lastPosted: string | null; posts30: number; leads: number; meetings: number };
type Post = { groupId: string; script: string; at: string };
const KEY = "cinder.group.scripts.v2";
const ago = (iso: string | null) => { if (!iso) return "Never"; const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000); return d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`; };

/** Facebook groups: post by hand (Meta blocks apps from posting to groups), but in 30 seconds, and see which groups bring leads. */
export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [scripts, setScripts] = useState<GroupScript[]>(DEFAULT_GROUP_SCRIPTS);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingScripts, setEditingScripts] = useState(false);
  const [adding, setAdding] = useState<{ id?: string; name: string; url: string; rules: string; everyDays: number } | null>(null);
  const [posting, setPosting] = useState<{ g: Group; script: GroupScript; body: string; copied: boolean } | null>(null);
  const [lead, setLead] = useState<{ g: Group; name: string; company: string; phone: string; email: string; note: string } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (Array.isArray(s) && s.length) setScripts(s); } } catch { /* storage unavailable */ } }, []);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/groups", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see your groups." : j.error || "Couldn't load groups.");
      setGroups(j.groups ?? []); setPosts(j.posts ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load groups."); setGroups([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(() => [...(groups ?? [])].sort((a, b) => daysUntilDue(a.lastPosted, a.everyDays) - daysUntilDue(b.lastPosted, b.everyDays)), [groups]);
  const due = sorted.filter(g => daysUntilDue(g.lastPosted, g.everyDays) <= 0).length;
  const week = posts.filter(p => Date.now() - Date.parse(p.at) < 7 * 86400000).length;
  const leads = (groups ?? []).reduce((n, g) => n + g.leads, 0), meetings = (groups ?? []).reduce((n, g) => n + g.meetings, 0);

  async function call(body: object) {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save that.");
      await load(); return j;
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); return null; }
    finally { setBusy(false); }
  }
  function startPost(g: Group) { const s = nextScript(scripts, posts.filter(p => p.groupId === g.id)); setPosting({ g, script: s, body: s.body, copied: false }); }
  function copyOpen() {
    if (!posting) return;
    void navigator.clipboard?.writeText(posting.body);
    if (posting.g.url) window.open(posting.g.url, "_blank", "noopener");
    setPosting({ ...posting, copied: true });
  }
  function saveScripts(next: GroupScript[]) { setScripts(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* fine */ } }

  return <div className="u-page gr-page" role="region" aria-label="Groups">
    <div className="u-head">
      <h1 className="u-title">Groups</h1>
      <div className="u-head-actions">
        <button className="u-btn" onClick={() => setEditingScripts(e => !e)}>{editingScripts ? "Done editing" : "Edit posts"}</button>
        <button className="u-btn u-btn-light" onClick={() => setAdding({ name: "", url: "", rules: "", everyDays: 7 })}>Add group</button>
      </div>
    </div>
    {error && <p className="u-flash is-bad" role="alert" style={{ marginBottom: 16 }}>{error}</p>}
    {notice && <p className="u-flash" role="status" style={{ marginBottom: 16 }}>{notice}</p>}

    <div className="u-figs">
      <div className="u-fig"><span className="u-fig-k">Due to post</span><div className="u-fig-v">{due}</div><div className="u-fig-sub">groups ready for a new post</div></div>
      <div className="u-fig"><span className="u-fig-k">Posted this week</span><div className="u-fig-v">{week}</div><div className="u-fig-sub">across all groups</div></div>
      <div className="u-fig"><span className="u-fig-k">Leads from groups</span><div className="u-fig-v">{leads}</div><div className="u-fig-sub">added with Lead from post</div></div>
      <div className="u-fig"><span className="u-fig-k">Meetings from groups</span><div className="u-fig-v">{meetings}</div><div className="u-fig-sub">booked with those leads</div></div>
    </div>

    {editingScripts && <section className="u-sheet gr-scripts">
      <div className="u-h2-row"><h2 className="u-h2">Post scripts</h2><button className="u-btn u-btn-bare" onClick={() => saveScripts(DEFAULT_GROUP_SCRIPTS)}>Reset to default</button></div>
      <p className="u-note" style={{ marginBottom: 14 }}>Each group gets the script it hasn&apos;t seen yet, then the one used longest ago, so nobody sees the same post twice in a row.</p>
      {scripts.map((s, i) => <label key={s.key} className="u-lab">{s.label}
        <textarea className="u-field" rows={7} value={s.body} onChange={e => saveScripts(scripts.map((x, k) => (k === i ? { ...x, body: e.target.value } : x)))} />
      </label>)}
    </section>}

    {groups === null ? <p className="u-note" role="status">Loading…</p> : groups.length === 0 ? <div className="u-void">
      <h2>Add the groups you post in</h2>
      <p>Facebook doesn&apos;t let any app post to groups, so you post by hand. This page picks the post, copies it, opens the group, and tracks which groups bring leads.</p>
      <button className="u-btn u-btn-light" onClick={() => setAdding({ name: "", url: "", rules: "", everyDays: 7 })}>Add group</button>
    </div> : <div className="u-tablewrap"><table className="u-table gr-table">
      <thead><tr><th>Group</th><th>Last post</th><th className="u-num">Posts (30d)</th><th className="u-num">Leads</th><th className="u-num">Meetings</th><th aria-label="Actions" /></tr></thead>
      <tbody>{sorted.map(g => { const d = daysUntilDue(g.lastPosted, g.everyDays); return <tr key={g.id}>
        <td><div className="gr-name">{g.url ? <a href={g.url} target="_blank" rel="noreferrer">{g.name}</a> : g.name}<button type="button" className="gr-edit" onClick={() => setAdding({ id: g.id, name: g.name, url: g.url, rules: g.rules, everyDays: g.everyDays })}>Edit</button></div>{g.rules && <span className="gr-rules">{g.rules}</span>}</td>
        <td><span className={d <= 0 ? "gr-due" : ""}>{d <= 0 ? "Due now" : `In ${d} day${d === 1 ? "" : "s"}`}</span><span className="gr-sub">{ago(g.lastPosted)}</span></td>
        <td className="u-num">{g.posts30}</td><td className="u-num">{g.leads}</td><td className="u-num">{g.meetings}</td>
        <td><div className="gr-acts"><button className={"u-btn " + (d <= 0 ? "u-btn-light" : "")} onClick={() => startPost(g)}>Post</button><button className="u-btn u-btn-bare" onClick={() => setLead({ g, name: "", company: "", phone: "", email: "", note: "" })}>Lead from post</button></div></td>
      </tr>; })}</tbody>
    </table></div>}

    {posting && <div className="u-scrim" role="dialog" aria-modal="true" aria-label="Post to group" onMouseDown={e => { if (e.target === e.currentTarget) setPosting(null); }}>
      <div className="u-dialog gr-dialog">
        <h3>Post in {posting.g.name}</h3>
        <div className="u-seg" role="group" aria-label="Which post" style={{ marginBottom: 12 }}>{scripts.map(s => <button key={s.key} type="button" aria-pressed={posting.script.key === s.key} onClick={() => setPosting({ ...posting, script: s, body: s.body, copied: false })}>{s.label}</button>)}</div>
        {posting.g.rules && <p className="u-note" style={{ marginBottom: 10 }}>Group rules: {posting.g.rules}</p>}
        <textarea className="u-field" rows={11} value={posting.body} onChange={e => setPosting({ ...posting, body: e.target.value })} />
        <p className="u-note" style={{ marginTop: 10 }}>{posting.copied ? "Copied. Paste it in the group, post it, then mark it posted." : posting.g.url ? "Copies the post and opens the group." : "Add the group's link (Edit) to open it from here."}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="u-btn" onClick={() => setPosting(null)}>Cancel</button>
          <button className="u-btn" onClick={copyOpen}>{posting.g.url ? "Copy and open group" : "Copy"}</button>
          <button className="u-btn u-btn-light" disabled={busy} onClick={async () => { if (await call({ action: "posted", id: posting.g.id, script: posting.script.key })) { setNotice(`Logged your post in ${posting.g.name}.`); setPosting(null); } }}>Mark posted</button>
        </div>
      </div>
    </div>}

    {lead && <div className="u-scrim" role="dialog" aria-modal="true" aria-label="Lead from post" onMouseDown={e => { if (e.target === e.currentTarget) setLead(null); }}>
      <div className="u-dialog">
        <h3>Lead from {lead.g.name}</h3>
        <p className="u-note" style={{ marginBottom: 14 }}>Someone commented or messaged you. Add them so they land in your contacts and Call mode, tagged with this group.</p>
        <label className="u-lab">Name<input className="u-field" value={lead.name} onChange={e => setLead({ ...lead, name: e.target.value })} placeholder="Mike Torres" /></label>
        <label className="u-lab">Company<input className="u-field" value={lead.company} onChange={e => setLead({ ...lead, company: e.target.value })} placeholder="Torres Fence Co" /></label>
        <label className="u-lab">Phone<input className="u-field" value={lead.phone} onChange={e => setLead({ ...lead, phone: e.target.value })} inputMode="tel" /></label>
        <label className="u-lab">Email<input className="u-field" value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })} inputMode="email" /></label>
        <label className="u-lab">What they said<input className="u-field" value={lead.note} onChange={e => setLead({ ...lead, note: e.target.value })} placeholder={`Commented "show me"`} /></label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button className="u-btn" onClick={() => setLead(null)}>Cancel</button>
          <button className="u-btn u-btn-light" disabled={busy || !(lead.name.trim() || lead.company.trim())} onClick={async () => { const j = await call({ action: "lead", id: lead.g.id, name: lead.name, company: lead.company, phone: lead.phone, email: lead.email, note: lead.note }); if (j) { setNotice(`Added ${lead.name || lead.company}.`); setLead(null); } }}>Add lead</button>
        </div>
        <p className="u-note" style={{ marginTop: 12 }}><Link href="/crm" style={{ textDecoration: "underline" }}>Contacts</Link> shows everyone from groups under their source.</p>
      </div>
    </div>}

    {adding && <div className="u-scrim" role="dialog" aria-modal="true" aria-label={adding.id ? "Edit group" : "Add group"} onMouseDown={e => { if (e.target === e.currentTarget) setAdding(null); }}>
      <div className="u-dialog">
        <h3>{adding.id ? "Edit group" : "Add a group"}</h3>
        <label className="u-lab">Name<input className="u-field" value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} placeholder="Fence Contractors of Texas" /></label>
        <label className="u-lab">Link<input className="u-field" value={adding.url} onChange={e => setAdding({ ...adding, url: e.target.value })} placeholder="https://www.facebook.com/groups/…" /></label>
        <label className="u-lab">Rules to remember<input className="u-field" value={adding.rules} onChange={e => setAdding({ ...adding, rules: e.target.value })} placeholder="Promo posts on Fridays only" /></label>
        <label className="u-lab">Post every (days)<input className="u-field" type="number" min={1} max={60} value={adding.everyDays} onChange={e => setAdding({ ...adding, everyDays: Number(e.target.value) || 7 })} /></label>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 18 }}>
          {adding.id ? <button className="u-btn u-btn-bare" onClick={async () => { if (confirm(`Remove ${adding.name}? Its posts and leads stay in your history.`) && await call({ action: "remove", id: adding.id })) setAdding(null); }}>Remove</button> : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="u-btn" onClick={() => setAdding(null)}>Cancel</button>
            <button className="u-btn u-btn-light" disabled={busy || !adding.name.trim()} onClick={async () => { if (await call(adding.id ? { action: "edit", ...adding } : { action: "add", ...adding })) setAdding(null); }}>{adding.id ? "Save" : "Add group"}</button>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}
