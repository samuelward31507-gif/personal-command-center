"use client";

import { copyText } from "@/lib/copy";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "../../use-workspace";
import { fillTemplate, hiringRole, mergeFor, trackOf } from "@/lib/email-outreach";
import { DEFAULT_LINKEDIN, DETAILING_LINKEDIN_MESSAGE, CONNECT_NOTE_LIMIT, WEEKLY_CONNECT_CAP, HIRING_LINKEDIN, withRole, jobPostLink, profileLink, type LinkedInStep } from "@/lib/linkedin-outreach";
import "../email/email.css";

type Contact = { id: string; name: string; company: string; linkedin?: string; location?: string; status?: string; lastTouchOutcome?: string; niche?: string; notes?: string };
type Log = { contactId: string; step: string; at: string };
type Tab = "hiring" | "connect" | "follow";

const TABS: { key: Tab; label: string }[] = [{ key: "hiring", label: "Hiring posts" }, { key: "connect", label: "Connect" }, { key: "follow", label: "Message" }];
const STOP = new Set(["do_not_contact", "not_interested", "not_a_fit", "meeting_booked", "wrong_contact"]);
const KEY = "cinder.linkedin.templates.v5";
const isHiring = (c: Contact) => (c.notes ?? "").includes("Hiring:");
const url = (v: string) => (v.startsWith("http") ? v : "https://www.linkedin.com/in/" + v.replace(/^@/, "").replace(/^linkedin\.com\/in\//, ""));

/** LinkedIn: a queue of owners to connect with, then message once they accept. You do each step on LinkedIn; Cinder keeps the list and the script. */
export default function LinkedInPage() {
  const ws = useWorkspace();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [tab, setTab] = useState<Tab>("hiring");
  const [profile, setProfile] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [useNote, setUseNote] = useState(false);
  const [tpl, setTpl] = useState({ ...DEFAULT_LINKEDIN, detailing: DETAILING_LINKEDIN_MESSAGE });
  const [copied, setCopied] = useState(false);

  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) setTpl({ ...DEFAULT_LINKEDIN, detailing: DETAILING_LINKEDIN_MESSAGE, ...JSON.parse(raw) }); } catch { /* storage unavailable */ } }, []);
  const load = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([fetch("/api/contacts", { cache: "no-store" }), fetch("/api/linkedin-outreach", { cache: "no-store" })]);
      if (!c.ok) throw new Error(c.status === 401 ? "Sign in to use LinkedIn." : "Couldn't load contacts.");
      setContacts((await c.json()).contacts ?? []); setLog(l.ok ? (await l.json()).log ?? [] : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load contacts."); setContacts([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const queues = useMemo(() => {
    const by = new Map<string, Set<string>>();
    for (const x of log) by.set(x.contactId, (by.get(x.contactId) ?? new Set()).add(x.step));
    const out: Record<Tab, Contact[]> = { hiring: [], connect: [], follow: [] };
    for (const c of contacts ?? []) {
      if (STOP.has(c.lastTouchOutcome ?? "") || (c.status ?? "").toLowerCase() === "customer") continue;
      const s = by.get(c.id) ?? new Set();
      // A company hiring for the phones, found from a LinkedIn job post: open the post (you're signed in, Grok isn't)
      // and save the profile of whoever posted it or the owner. Then it joins Connect with the hiring note.
      if (!c.linkedin) { if (isHiring(c) && /linkedin\.com/i.test(jobPostLink(c.notes ?? "")) && !s.has("skipped")) out.hiring.push(c); continue; }
      if (s.has("message")) continue;
      // Request sent: they wait in Message until you send the first message (once they've accepted).
      if (s.has("connect")) out.follow.push(c);
      else out.connect.push(c);
    }
    return out;
  }, [contacts, log]);
  const sentWeek = log.filter(x => x.step === "connect" && Date.now() - Date.parse(x.at) < 7 * 86400000).length;
  const list = queues[tab];
  const current = list.find(c => c.id === picked) ?? list[0] ?? null;
  const merge = current ? mergeFor(current, ws) : null;
  const role = current && isHiring(current) ? hiringRole(current.notes ?? "") : "";
  const text = current && merge && tab !== "hiring" ? (tab === "follow"
    ? fillTemplate(role ? withRole(HIRING_LINKEDIN.message, role) : trackOf(current.niche) === "detailing" ? tpl.detailing : tpl.message, merge)
    : useNote || role ? fillTemplate(role ? withRole(HIRING_LINKEDIN.connect, role) : tpl.connect, merge) : "") : "";

  function saveTpl(next: typeof tpl) { setTpl(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* fine */ } }
  async function saveProfile(c: Contact) {
    const link = profileLink(profile);
    if (!link) { setError("Paste a profile link that looks like linkedin.com/in/their-name."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/linkedin-outreach", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: c.id, profile: link }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't save the profile.");
      const i = list.findIndex(x => x.id === c.id); setPicked(list[i + 1]?.id ?? null); setProfile("");
      setContacts(cs => (cs ?? []).map(x => (x.id === c.id ? { ...x, linkedin: link } : x)));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the profile."); }
    finally { setBusy(false); }
  }
  async function mark(c: Contact, step: "connect" | "accepted" | "message" | "skipped") {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/linkedin-outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: c.id, step }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't log that.");
      setLog(l => [{ contactId: c.id, step, at: new Date().toISOString() }, ...l]);
      const i = list.findIndex(x => x.id === c.id); setPicked(list[i + 1]?.id ?? null); setCopied(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't log that."); }
    finally { setBusy(false); }
  }
  // Hiring posts, one tap: save the profile you pasted, copy the connection note, open their profile, log the request.
  function saveAndConnect(c: Contact) {
    const link = profileLink(profile);
    if (!link) { setError("Paste a profile link that looks like linkedin.com/in/their-name."); return; }
    const m = mergeFor(c, ws);
    void copyText(fillTemplate(withRole(HIRING_LINKEDIN.connect, hiringRole(c.notes ?? "")), m));
    window.open(link, "_blank", "noopener");
    setCopied(true);
    void (async () => { await saveProfile(c); await mark(c, "connect"); })();
  }
  async function sentMessage(c: Contact) {
    const by = new Set(log.filter(x => x.contactId === c.id).map(x => x.step));
    if (!by.has("accepted")) await fetch("/api/linkedin-outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: c.id, step: "accepted" }) }).catch(() => null);
    await mark(c, "message");
  }
  function openProfile() {
    if (!current?.linkedin) return;
    if (text) { void copyText(text); setCopied(true); }
    window.open(url(current.linkedin), "_blank", "noopener");
  }

  const editKey: LinkedInStep | "detailing" = tab === "follow" ? (trackOf(current?.niche) === "detailing" ? "detailing" : "message") : "connect";
  return <div className="u-page em-page" role="region" aria-label="LinkedIn">
    <div className="u-head">
      <h1 className="u-title">LinkedIn</h1>
      <div className="u-head-actions">
        <div className="u-seg" role="group" aria-label="Which step">{TABS.map(t => <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPicked(null); setCopied(false); setProfile(""); }}>{t.label} <span className="u-quiet">{queues[t.key].length}</span></button>)}</div>
        <button className="u-btn" onClick={() => setEditing(e => !e)}>{editing ? "Done editing" : "Edit script"}</button>
      </div>
    </div>
    {error && <p className="u-flash is-bad" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

    <div className="u-figs">
      <div className="u-fig"><span className="u-fig-k">Requests this week</span><div className="u-fig-v">{sentWeek}<small>/ {WEEKLY_CONNECT_CAP}</small></div><div className="u-meter"><i style={{ width: Math.min(100, (sentWeek / WEEKLY_CONNECT_CAP) * 100) + "%" }} /></div><div className="u-fig-sub">LinkedIn restricts accounts that go much past this</div></div>
      <div className="u-fig"><span className="u-fig-k">Ready to connect</span><div className="u-fig-v">{queues.connect.length}</div><div className="u-fig-sub">owners with a LinkedIn profile</div></div>
      <div className="u-fig"><span className="u-fig-k">Hiring posts</span><div className="u-fig-v">{queues.hiring.length}</div><div className="u-fig-sub">find who posted the job</div></div>
      <div className="u-fig"><span className="u-fig-k">Requests out</span><div className="u-fig-v">{queues.follow.length}</div><div className="u-fig-sub">message them once they accept</div></div>
    </div>

    {editing && <section className="em-edit u-sheet">
      <div className="u-h2-row"><h2 className="u-h2">{editKey === "message" ? "First message (contractors)" : editKey === "detailing" ? "First message (detailers)" : "Connection note"}</h2><button className="u-btn u-btn-bare" onClick={() => saveTpl({ ...tpl, [editKey]: editKey === "detailing" ? DETAILING_LINKEDIN_MESSAGE : DEFAULT_LINKEDIN[editKey] })}>Reset to default</button></div>
      <p className="u-note" style={{ marginBottom: 12 }}>Fill-ins: <code>{"{first_name}"}</code> <code>{"{company}"}</code> <code>{"{city}"}</code> <code>{"{my_name}"}</code> <code>{"{booking_link}"}</code> <code>{"{demo_link}"}</code>.{editKey === "connect" && ` Notes are capped at ${CONNECT_NOTE_LIMIT} characters.`}</p>
      <textarea className="u-field" rows={editKey === "connect" ? 4 : 11} value={tpl[editKey]} onChange={e => saveTpl({ ...tpl, [editKey]: e.target.value })} />
    </section>}

    {contacts === null ? <p className="u-note" role="status">Loading…</p> : list.length === 0 ? <div className="u-void">
      <h2>{tab === "hiring" ? "No hiring posts to open" : tab === "connect" ? "Nobody to connect with" : "No one to message yet"}</h2>
      <p>{tab === "hiring" ? "Companies the nightly hiring finder found on LinkedIn show up here until you save who posted the job." : tab === "connect" ? "Contacts with a LinkedIn profile show up here. The Sunday lead run adds owners' profiles when it finds them, or add one on any contact." : "Everyone you send a request to lands here. When they accept on LinkedIn, send them the message."}</p>
      {tab === "connect" && <Link className="u-btn u-btn-light" href="/crm">Open contacts</Link>}
    </div> : <div className="em-split">
      <div className="u-rows em-list">{list.map(c => <div key={c.id} className={"u-row em-item" + (current?.id === c.id ? " is-on" : "")}>
        <button type="button" className="em-pick" onClick={() => { setPicked(c.id); setCopied(false); setProfile(""); }}>
          <div className="u-row-main"><strong>{c.name && c.name !== c.company ? `${c.name}, ${c.company}` : c.company || c.name}</strong><span>{[isHiring(c) ? `Hiring: ${hiringRole(c.notes ?? "")}` : "", c.location, c.niche].filter(Boolean).join(" · ")}</span></div>
        </button>
      </div>)}</div>

      {current && tab === "hiring" && <div className="em-read">
        <div className="em-to"><span>Hiring</span><b>{hiringRole(current.notes ?? "")}</b><Link href={`/crm?contact=${current.id}`} className="u-note" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Contact</Link></div>
        <p className="u-note" style={{ margin: "0 0 12px" }}>Open the post, find who posted it (&ldquo;Meet the hiring team&rdquo;), and paste their profile link. Connect copies your note and opens their profile: tap Connect, then Add a note, then paste.</p>
        <input className="u-field" value={profile} onChange={e => setProfile(e.target.value)} placeholder="https://www.linkedin.com/in/…" aria-label="Their LinkedIn profile link" onKeyDown={e => { if (e.key === "Enter") saveAndConnect(current); }} />
        <div className="em-acts" style={{ marginTop: 12 }}>
          <button className="u-btn u-btn-light u-btn-lg" onClick={() => window.open(jobPostLink(current.notes ?? ""), "_blank", "noopener")}>Open the job post</button>
          <span style={{ flex: 1 }} />
          <button className="u-btn u-btn-bare" disabled={busy} onClick={() => void mark(current, "skipped")}>No one listed</button>
          <button className="u-btn" disabled={busy || !profile.trim()} onClick={() => saveAndConnect(current)}>Connect</button>
        </div>
      </div>}
      {current && tab !== "hiring" && <div className="em-read">
        <div className="em-to"><span>To</span><b>{current.name || current.company}</b><Link href={`/crm?contact=${current.id}`} className="u-note" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Contact</Link></div>
        {tab === "connect" && !role && <label className="u-note" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}><input type="checkbox" checked={useNote} onChange={e => setUseNote(e.target.checked)} /> Add a note (free accounts get only a few a month)</label>}
        {text ? <div className="em-paper"><pre className="em-body">{text}</pre>{tab === "connect" && <p className="u-note" style={{ marginTop: 12, color: text.length > CONNECT_NOTE_LIMIT ? "#b73629" : "#717b8b" }}>{text.length} / {CONNECT_NOTE_LIMIT} characters</p>}</div>
          : <p className="u-note">Send the request without a note. The pitch goes in your first message once they accept.</p>}
        <div className="em-acts">
          <button className="u-btn u-btn-light u-btn-lg" disabled={busy} onClick={openProfile}>{text ? "Copy and open profile" : "Open profile"}</button>
          <span style={{ flex: 1 }} />
          {tab === "connect" && <button className="u-btn" disabled={busy} onClick={() => void mark(current, "connect")}>Request sent</button>}
          {tab === "follow" && <button className="u-btn" disabled={busy} onClick={() => void sentMessage(current)}>Message sent</button>}
        </div>
        {copied && <p className="u-note" style={{ marginTop: 10 }}>Copied. Paste it on LinkedIn.</p>}
      </div>}
    </div>}
  </div>;
}
