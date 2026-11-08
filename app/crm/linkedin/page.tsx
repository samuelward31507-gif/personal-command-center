"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "../../use-workspace";
import { fillTemplate, mergeFor } from "@/lib/email-outreach";
import { DEFAULT_LINKEDIN, CONNECT_NOTE_LIMIT, WEEKLY_CONNECT_CAP, type LinkedInStep } from "@/lib/linkedin-outreach";
import "../email/email.css";

type Contact = { id: string; name: string; company: string; linkedin?: string; location?: string; status?: string; lastTouchOutcome?: string; niche?: string };
type Log = { contactId: string; step: string; at: string };
type Tab = "connect" | "waiting" | "message";

const TABS: { key: Tab; label: string }[] = [{ key: "connect", label: "Connect" }, { key: "waiting", label: "Waiting" }, { key: "message", label: "Message" }];
const STOP = new Set(["do_not_contact", "not_interested", "not_a_fit", "meeting_booked", "wrong_contact"]);
const KEY = "cinder.linkedin.templates.v1";
const url = (v: string) => (v.startsWith("http") ? v : "https://www.linkedin.com/in/" + v.replace(/^@/, "").replace(/^linkedin\.com\/in\//, ""));

/** LinkedIn: a queue of owners to connect with, then message once they accept. You do each step on LinkedIn; Cinder keeps the list and the script. */
export default function LinkedInPage() {
  const ws = useWorkspace();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [tab, setTab] = useState<Tab>("connect");
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [useNote, setUseNote] = useState(false);
  const [tpl, setTpl] = useState(DEFAULT_LINKEDIN);
  const [copied, setCopied] = useState(false);

  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) setTpl({ ...DEFAULT_LINKEDIN, ...JSON.parse(raw) }); } catch { /* storage unavailable */ } }, []);
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
    const out: Record<Tab, Contact[]> = { connect: [], waiting: [], message: [] };
    for (const c of contacts ?? []) {
      if (!c.linkedin || STOP.has(c.lastTouchOutcome ?? "") || (c.status ?? "").toLowerCase() === "customer") continue;
      const s = by.get(c.id) ?? new Set();
      if (s.has("message")) continue;
      if (s.has("accepted")) out.message.push(c);
      else if (s.has("connect")) out.waiting.push(c);
      else out.connect.push(c);
    }
    return out;
  }, [contacts, log]);
  const sentWeek = log.filter(x => x.step === "connect" && Date.now() - Date.parse(x.at) < 7 * 86400000).length;
  const list = queues[tab];
  const current = list.find(c => c.id === picked) ?? list[0] ?? null;
  const merge = current ? mergeFor(current, ws) : null;
  const text = current && merge ? (tab === "message" ? fillTemplate(tpl.message, merge) : useNote ? fillTemplate(tpl.connect, merge) : "") : "";

  function saveTpl(next: typeof tpl) { setTpl(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* fine */ } }
  async function mark(c: Contact, step: "connect" | "accepted" | "message") {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/linkedin-outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: c.id, step }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't log that.");
      setLog(l => [{ contactId: c.id, step, at: new Date().toISOString() }, ...l]);
      const i = list.findIndex(x => x.id === c.id); setPicked(list[i + 1]?.id ?? null); setCopied(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't log that."); }
    finally { setBusy(false); }
  }
  function openProfile() {
    if (!current?.linkedin) return;
    if (text) { void navigator.clipboard?.writeText(text); setCopied(true); }
    window.open(url(current.linkedin), "_blank", "noopener");
  }

  const editKey: LinkedInStep = tab === "message" ? "message" : "connect";
  return <div className="u-page em-page" role="region" aria-label="LinkedIn">
    <div className="u-head">
      <h1 className="u-title">LinkedIn</h1>
      <div className="u-head-actions">
        <div className="u-seg" role="group" aria-label="Which step">{TABS.map(t => <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPicked(null); setCopied(false); }}>{t.label} <span className="u-quiet">{queues[t.key].length}</span></button>)}</div>
        <button className="u-btn" onClick={() => setEditing(e => !e)}>{editing ? "Done editing" : "Edit script"}</button>
      </div>
    </div>
    {error && <p className="u-flash is-bad" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

    <div className="u-figs">
      <div className="u-fig"><span className="u-fig-k">Requests this week</span><div className="u-fig-v">{sentWeek}<small>/ {WEEKLY_CONNECT_CAP}</small></div><div className="u-meter"><i style={{ width: Math.min(100, (sentWeek / WEEKLY_CONNECT_CAP) * 100) + "%" }} /></div><div className="u-fig-sub">LinkedIn restricts accounts that go much past this</div></div>
      <div className="u-fig"><span className="u-fig-k">Ready to connect</span><div className="u-fig-v">{queues.connect.length}</div><div className="u-fig-sub">owners with a LinkedIn profile</div></div>
      <div className="u-fig"><span className="u-fig-k">Waiting to accept</span><div className="u-fig-v">{queues.waiting.length}</div><div className="u-fig-sub">mark them accepted when they do</div></div>
      <div className="u-fig"><span className="u-fig-k">Ready to message</span><div className="u-fig-v">{queues.message.length}</div><div className="u-fig-sub">accepted, pitch not sent yet</div></div>
    </div>

    {editing && <section className="em-edit u-sheet">
      <div className="u-h2-row"><h2 className="u-h2">{editKey === "message" ? "First message" : "Connection note"}</h2><button className="u-btn u-btn-bare" onClick={() => saveTpl({ ...tpl, [editKey]: DEFAULT_LINKEDIN[editKey] })}>Reset to default</button></div>
      <p className="u-note" style={{ marginBottom: 12 }}>Fill-ins: <code>{"{first_name}"}</code> <code>{"{company}"}</code> <code>{"{city}"}</code> <code>{"{my_name}"}</code> <code>{"{booking_link}"}</code>.{editKey === "connect" && ` Notes are capped at ${CONNECT_NOTE_LIMIT} characters.`}</p>
      <textarea className="u-field" rows={editKey === "message" ? 11 : 4} value={tpl[editKey]} onChange={e => saveTpl({ ...tpl, [editKey]: e.target.value })} />
    </section>}

    {contacts === null ? <p className="u-note" role="status">Loading…</p> : list.length === 0 ? <div className="u-void">
      <h2>{tab === "connect" ? "Nobody to connect with" : tab === "waiting" ? "No pending requests" : "No one to message yet"}</h2>
      <p>{tab === "connect" ? "Contacts with a LinkedIn profile show up here. The Sunday lead run adds owners' profiles when it finds them, or add one on any contact." : tab === "waiting" ? "Requests you send land here until you mark them accepted." : "When someone accepts, mark them accepted and they move here with your first message ready."}</p>
      {tab === "connect" && <Link className="u-btn u-btn-light" href="/crm">Open contacts</Link>}
    </div> : <div className="em-split">
      <div className="u-rows em-list">{list.map(c => <div key={c.id} className={"u-row em-item" + (current?.id === c.id ? " is-on" : "")}>
        <button type="button" className="em-pick" onClick={() => { setPicked(c.id); setCopied(false); }}>
          <div className="u-row-main"><strong>{c.name && c.name !== c.company ? `${c.name}, ${c.company}` : c.company || c.name}</strong><span>{[c.location, c.niche].filter(Boolean).join(" · ")}</span></div>
        </button>
      </div>)}</div>

      {current && <div className="em-read">
        <div className="em-to"><span>To</span><b>{current.name || current.company}</b><Link href={`/crm?contact=${current.id}`} className="u-note" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Contact</Link></div>
        {tab === "connect" && <label className="u-note" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}><input type="checkbox" checked={useNote} onChange={e => setUseNote(e.target.checked)} /> Add a note (free accounts get only a few a month)</label>}
        {text ? <div className="em-paper"><pre className="em-body">{text}</pre>{tab === "connect" && <p className="u-note" style={{ marginTop: 12, color: text.length > CONNECT_NOTE_LIMIT ? "#c0392b" : "#8a8178" }}>{text.length} / {CONNECT_NOTE_LIMIT} characters</p>}</div>
          : tab === "waiting" ? <p className="u-note">Request sent. Check LinkedIn, then mark accepted when they connect.</p>
          : <p className="u-note">Send the request without a note. The pitch goes in your first message once they accept.</p>}
        <div className="em-acts">
          <button className="u-btn u-btn-light u-btn-lg" disabled={busy} onClick={openProfile}>{text ? "Copy and open profile" : "Open profile"}</button>
          <span style={{ flex: 1 }} />
          {tab === "connect" && <button className="u-btn" disabled={busy} onClick={() => void mark(current, "connect")}>Request sent</button>}
          {tab === "waiting" && <button className="u-btn" disabled={busy} onClick={() => void mark(current, "accepted")}>Accepted</button>}
          {tab === "message" && <button className="u-btn" disabled={busy} onClick={() => void mark(current, "message")}>Message sent</button>}
        </div>
        {copied && <p className="u-note" style={{ marginTop: 10 }}>Copied. Paste it on LinkedIn.</p>}
      </div>}
    </div>}
  </div>;
}
