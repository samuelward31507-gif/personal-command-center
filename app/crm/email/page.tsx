"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "../../use-workspace";
import { mailtoLink } from "@/lib/deal-workspace";
import { fillTemplate, mergeFor, TEMPLATE_SETS, TRACK_LABEL, trackOf, STEP_GAP_DAYS, type EmailStep, type EmailTemplate, type Track } from "@/lib/email-outreach";
import "./email.css";

type Contact = { id: string; name: string; company: string; email: string; location?: string; status?: string; lastTouchOutcome?: string; nextFollowUp?: string; source?: string; niche?: string };
type Sent = { contactId: string; step: string; at: string };
type Heard = { contactId: string; kind: "reply" | "bounce"; at: string; preview: string; from: string };
const SYNC_KEY = "cinder.gmail.sync.at";

const DAILY = 25;
const STEPS: { key: EmailStep; label: string }[] = [{ key: "intro", label: "First email" }, { key: "follow_up", label: "Follow-up" }, { key: "breakup", label: "Last try" }];
const STOP = new Set(["do_not_contact", "not_interested", "not_a_fit", "meeting_booked", "wrong_contact"]);
const KEY = "cinder.email.templates.v5";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Seconds to wait between bulk sends. A steady trickle looks like a person; a burst looks like a blast. */
const GAP = [15, 30] as const;
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Sets = Record<Track, Record<EmailStep, EmailTemplate>>;
function loadTemplates(): Sets {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const j = JSON.parse(raw); return { trades: { ...TEMPLATE_SETS.trades, ...j.trades }, detailing: { ...TEMPLATE_SETS.detailing, ...j.detailing } }; }
  } catch { /* storage unavailable */ }
  return TEMPLATE_SETS;
}

/** Cold email: a merge-filled script per prospect, sent one at a time or in a selected batch. Cinder logs each send and lines up the follow-up. */
export default function EmailPage() {
  const ws = useWorkspace();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  const [heard, setHeard] = useState<Heard[]>([]);
  const [error, setError] = useState("");
  const [step, setStep] = useState<EmailStep>("intro");
  const [picked, setPicked] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<Sets>(TEMPLATE_SETS);
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [gmail, setGmail] = useState<{ configured: boolean; connected: boolean; email: string | null; sentLast24h: number; cap: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [run, setRun] = useState<{ done: number; total: number; failed: string[]; wait: number } | null>(null);
  const stopRef = useRef(false);

  useEffect(() => { setTemplates(loadTemplates()); }, []);
  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([fetch("/api/contacts", { cache: "no-store" }), fetch("/api/email-outreach", { cache: "no-store" })]);
      if (!c.ok) throw new Error(c.status === 401 ? "Sign in to send email." : "Couldn't load contacts.");
      const cj = await c.json(); const sj = s.ok ? await s.json() : { sent: [], heard: [] };
      setContacts(cj.contacts ?? []); setSent(sj.sent ?? []); setHeard(sj.heard ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load contacts."); setContacts([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const loadGmail = useCallback(() => fetch("/api/gmail", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(setGmail).catch(() => setGmail(null)), []);
  useEffect(() => {
    void loadGmail();
    const g = new URLSearchParams(window.location.search).get("gmail");
    const msg: Record<string, string> = { connected: "Gmail connected. Emails now send straight from the CRM.", denied: "You didn't allow Gmail access, so nothing changed.", expired: "That sign-in took too long. Try Connect Gmail again.", "no-refresh": "Google didn't give lasting access. Disconnect Cinder in your Google account settings, then connect again.", "no-scope": "Tick both boxes when Google asks (send email, and view email headers so Cinder can see replies). Connect again.", "not-configured": "Gmail sending isn't set up on the server yet.", error: "Couldn't connect Gmail. Try again." };
    if (g && msg[g]) { setNotice(msg[g]); window.history.replaceState(null, "", "/crm/email"); }
  }, [loadGmail]);

  // Check Gmail for replies and bounces when the page opens (at most every 5 minutes), then refresh the queues.
  useEffect(() => {
    if (!gmail?.connected) return;
    let last = 0; try { last = Number(localStorage.getItem(SYNC_KEY) || 0); } catch { /* storage unavailable */ }
    if (Date.now() - last < 5 * 60000) return;
    try { localStorage.setItem(SYNC_KEY, String(Date.now())); } catch { /* fine */ }
    void fetch("/api/gmail/sync", { method: "POST" }).then(r => r.json().catch(() => ({}))).then((j: { replies?: number; bounces?: number; error?: string }) => {
      if (j.error) { setError(j.error); void loadGmail(); return; }
      if ((j.replies ?? 0) + (j.bounces ?? 0) > 0) { setNotice([j.replies ? `${j.replies} new repl${j.replies === 1 ? "y" : "ies"}` : "", j.bounces ? `${j.bounces} bounced` : ""].filter(Boolean).join(", ") + ". Their sequences stopped."); void load(); }
    }).catch(() => {});
  }, [gmail?.connected, load, loadGmail]);

  // Who's due for each step: never emailed → first email; first email 3+ days ago → follow-up; follow-up 4+ days ago → last try.
  const queues = useMemo(() => {
    const by = new Map<string, Sent[]>();
    const done = new Set(heard.map(h => h.contactId));
    for (const s of sent) by.set(s.contactId, [...(by.get(s.contactId) ?? []), s]);
    const now = Date.now(), days = (iso: string) => (now - Date.parse(iso)) / 86400000;
    const out: Record<EmailStep, Contact[]> = { intro: [], follow_up: [], breakup: [] };
    for (const c of contacts ?? []) {
      if (!c.email || done.has(c.id) || STOP.has(c.lastTouchOutcome ?? "") || (c.status ?? "").toLowerCase() === "customer") continue;
      const mine = by.get(c.id) ?? [];
      const last = (k: string) => mine.find(s => s.step === k);
      if (!mine.length) out.intro.push(c);
      else if (last("intro") && !last("follow_up") && !last("breakup") && days(last("intro")!.at) >= STEP_GAP_DAYS.follow_up) out.follow_up.push(c);
      else if (last("follow_up") && !last("breakup") && days(last("follow_up")!.at) >= STEP_GAP_DAYS.breakup) out.breakup.push(c);
    }
    // Contacts due today (or with no date) first, then by follow-up date.
    const today = localDay();
    for (const k of Object.keys(out) as EmailStep[]) out[k].sort((a, b) => (a.nextFollowUp || today).localeCompare(b.nextFollowUp || today) || (a.company || a.name).localeCompare(b.company || b.name));
    return out;
  }, [contacts, sent, heard]);

  const list = queues[step].filter(c => !skipped.has(c.id) && (!query.trim() || `${c.company} ${c.name} ${c.email} ${c.location}`.toLowerCase().includes(query.trim().toLowerCase())));
  const current = list.find(c => c.id === picked) ?? list[0] ?? null;
  const tpl = templates[trackOf(current?.niche)][step];
  const et: Track = editTrack ?? trackOf(current?.niche);
  const etpl = templates[et][step];
  const merge = current ? mergeFor(current, ws) : null;
  const filled = current && merge ? { subject: fillTemplate(tpl.subject, merge), body: fillTemplate(tpl.body, merge) } : null;
  const today = localDay();
  const sentToday = sent.filter(s => localDay(new Date(s.at)) === today).length;
  const sentWeek = sent.filter(s => Date.now() - Date.parse(s.at) < 7 * 86400000).length;

  function saveTemplates(next: Sets) { setTemplates(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* fine */ } }

  async function markSent(c: Contact, subject: string) {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/email-outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: c.id, step, subject }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't log that email.");
      setSent(s => [{ contactId: c.id, step, at: new Date().toISOString() }, ...s]);
      const idx = list.findIndex(x => x.id === c.id);
      setPicked(list[idx + 1]?.id ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't log that email."); }
    finally { setBusy(false); }
  }
  async function sendNow() {
    if (!current || !filled) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: current.id, step, subject: filled.subject, body: filled.body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { if (r.status === 401) void loadGmail(); throw new Error(j.error || "Couldn't send."); }
      setSent(s => [{ contactId: current.id, step, at: new Date().toISOString() }, ...s]);
      setGmail(g => g && { ...g, sentLast24h: g.sentLast24h + 1 });
      setNotice(`Sent to ${current.company || current.name}.`);
      const idx = list.findIndex(x => x.id === current.id);
      setPicked(list[idx + 1]?.id ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't send."); }
    finally { setBusy(false); }
  }
  const room = gmail?.connected ? Math.max(0, gmail.cap - gmail.sentLast24h) : 0;
  const chosen = list.filter(c => selected.has(c.id));
  const allOn = list.length > 0 && list.slice(0, gmail?.connected ? room : list.length).every(c => selected.has(c.id));
  function toggle(id: string) { setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAll() { setSelected(allOn ? new Set() : new Set(list.slice(0, gmail?.connected ? room : list.length).map(c => c.id))); }

  /** Send the selected emails one at a time from Gmail, with a short random pause between each. */
  async function sendBulk() {
    const runStep = step;
    const batch = chosen.map(c => { const m = mergeFor(c, ws), tplNow = templates[trackOf(c.niche)][runStep]; return { c, subject: fillTemplate(tplNow.subject, m), body: fillTemplate(tplNow.body, m) }; });
    if (!batch.length || !confirm(`Send ${batch.length} email${batch.length === 1 ? "" : "s"} from ${gmail?.email}? They go out one at a time over about ${Math.ceil((batch.length * (GAP[0] + GAP[1])) / 2 / 60)} min. Keep this tab open.`)) return;
    stopRef.current = false; setError(""); setNotice("");
    const failed: string[] = []; let done = 0;
    setRun({ done, total: batch.length, failed, wait: 0 });
    for (let i = 0; i < batch.length; i++) {
      if (stopRef.current) break;
      const { c, subject, body } = batch[i];
      const r = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: c.id, step: runStep, subject, body }) }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok) {
        done++;
        setSent(s => [{ contactId: c.id, step: runStep, at: new Date().toISOString() }, ...s]);
        setGmail(g => g && { ...g, sentLast24h: g.sentLast24h + 1 });
        setSelected(s => { const n = new Set(s); n.delete(c.id); return n; });
      } else {
        failed.push(`${c.company || c.name}: ${j.error || "couldn't send"}`);
        // Stop the whole run on problems that will hit every email: the daily cap, a lost Gmail connection, a missing address.
        if (!r || r.status === 429 || r.status === 401 || r.status >= 500 || /address|Connect Gmail|reconnect/i.test(j.error || "")) stopRef.current = true;
      }
      setRun({ done, total: batch.length, failed: [...failed], wait: 0 });
      if (i < batch.length - 1 && !stopRef.current) {
        for (let w = GAP[0] + Math.floor(Math.random() * (GAP[1] - GAP[0] + 1)); w > 0 && !stopRef.current; w--) { setRun(x => x && { ...x, wait: w }); await sleep(1000); }
      }
    }
    setRun(null);
    void loadGmail();
    setNotice(`Sent ${done} of ${batch.length}.${stopRef.current && done + failed.length < batch.length ? " Stopped early." : ""}`);
    if (failed.length) setError(`Didn't send: ${failed.join("; ")}`);
  }

  function open(kind: "gmail" | "mail") {
    if (!current || !filled) return;
    const url = kind === "gmail"
      ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(current.email)}&su=${encodeURIComponent(filled.subject)}&body=${encodeURIComponent(filled.body)}`
      : mailtoLink(current.email, filled.subject, filled.body);
    window.open(url, kind === "gmail" ? "_blank" : "_self");
    void markSent(current, filled.subject);
  }

  return <div className="u-page em-page" role="region" aria-label="Email">
    <div className="u-head">
      <h1 className="u-title">Email</h1>
      <div className="u-head-actions">
        <div className="u-seg" role="group" aria-label="Which email">{STEPS.map(s => <button key={s.key} type="button" aria-pressed={step === s.key} disabled={!!run} onClick={() => { setStep(s.key); setPicked(null); setSelected(new Set()); }}>{s.label} <span className="u-quiet">{queues[s.key].length}</span></button>)}</div>
        <button className="u-btn" onClick={() => setEditing(e => !e)}>{editing ? "Done editing" : "Edit script"}</button>
      </div>
    </div>
    {error && <p className="u-flash is-bad" role="alert" style={{ marginBottom: 16 }}>{error}</p>}
    {notice && <p className="u-flash" role="status" style={{ marginBottom: 16 }}>{notice}</p>}
    {gmail && !gmail.connected && <div className="em-connect">
      <div><b>Send straight from the CRM</b><span>{gmail.configured ? "Connect your Google Workspace inbox once. Emails go out from your address, replies land in your inbox, follow-ups thread under the first email." : "Sending from the CRM needs a one-time Google setup on the server (Google Cloud sign-in keys). Until then, use Open in Gmail."}</span></div>
      {gmail.configured && <a className="u-btn u-btn-light" href="/api/gmail/connect">Connect Gmail</a>}
    </div>}

    {(() => {
      const recent = heard.filter(h => h.kind === "reply" && Date.now() - Date.parse(h.at) < 14 * 86400000);
      if (!recent.length) return null;
      const byId = new Map<string, Contact>((contacts ?? []).map(c => [c.id, c] as [string, Contact]));
      return <section className="u-sheet em-replies" aria-label="Replies">
        <div className="u-h2-row"><h2 className="u-h2">Replies <span className="u-quiet">{recent.length}</span></h2><span className="u-note">Answer these first. Their follow-ups stopped.</span></div>
        <div className="u-rows">{recent.slice(0, 8).map(h => { const c = byId.get(h.contactId); return <div key={h.contactId + h.at} className="u-row em-reply">
          <div className="u-row-main"><strong>{c ? c.company || c.name : "Contact"}</strong><span>{h.preview || h.from}</span></div>
          <div style={{ display: "flex", gap: 6, flex: "none" }}>
            {c?.email && <a className="u-btn u-btn-light" href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent("from:" + c.email)}`} target="_blank" rel="noreferrer">Answer in Gmail</a>}
            <Link className="u-btn u-btn-bare" href={`/crm?contact=${h.contactId}`}>Contact</Link>
          </div>
        </div>; })}</div>
      </section>;
    })()}

    <div className="u-figs">
      <div className="u-fig"><span className="u-fig-k">Sent today</span><div className="u-fig-v">{sentToday}<small>/ {DAILY}</small></div><div className="u-meter"><i style={{ width: Math.min(100, (sentToday / DAILY) * 100) + "%" }} /></div><div className="u-fig-sub">{sentToday >= DAILY ? "Daily batch done" : <><b>{DAILY - sentToday}</b> left in today&apos;s batch</>}</div></div>
      <div className="u-fig"><span className="u-fig-k">Ready for a first email</span><div className="u-fig-v">{queues.intro.length}</div><div className="u-fig-sub">people with an email you haven&apos;t written yet</div></div>
      <div className="u-fig"><span className="u-fig-k">Follow-ups due</span><div className="u-fig-v">{queues.follow_up.length + queues.breakup.length}</div><div className="u-fig-sub">{STEP_GAP_DAYS.follow_up} days after the first, {STEP_GAP_DAYS.breakup} after the follow-up</div></div>
      <div className="u-fig"><span className="u-fig-k">Sent this week</span><div className="u-fig-v">{sentWeek}</div><div className="u-fig-sub">{(() => { const wk = heard.filter(h => Date.now() - Date.parse(h.at) < 7 * 86400000); const r = wk.filter(h => h.kind === "reply").length, b = wk.length - r; return `${r} repl${r === 1 ? "y" : "ies"}${b ? `, ${b} bounced` : ""}${sentWeek ? ` · ${Math.round((r / sentWeek) * 100)}% reply rate` : ""}`; })()}</div></div>
    </div>

    {editing && <section className="em-edit u-sheet">
      <div className="u-h2-row"><h2 className="u-h2">{STEPS.find(s => s.key === step)?.label} script</h2>
        <div className="u-seg" role="group" aria-label="Which script">{(Object.keys(TRACK_LABEL) as Track[]).map(t => <button key={t} type="button" aria-pressed={et === t} onClick={() => setEditTrack(t)}>{TRACK_LABEL[t]}</button>)}</div>
        <button className="u-btn u-btn-bare" onClick={() => saveTemplates({ ...templates, [et]: { ...templates[et], [step]: TEMPLATE_SETS[et][step] } })}>Reset to default</button></div>
      <p className="u-note" style={{ marginBottom: 12 }}>Fill-ins: <code>{"{first_name}"}</code> <code>{"{company}"}</code> <code>{"{city}"}</code> <code>{"{my_name}"}</code> <code>{"{business}"}</code> <code>{"{booking_link}"}</code> <code>{"{website}"}</code> <code>{"{demo_link}"}</code>. A missing first name becomes &ldquo;there&rdquo;.</p>
      <label className="u-lab">Subject<input className="u-field" value={etpl.subject} onChange={e => saveTemplates({ ...templates, [et]: { ...templates[et], [step]: { ...etpl, subject: e.target.value } } })} /></label>
      <label className="u-lab" style={{ marginTop: 12 }}>Body<textarea className="u-field" rows={11} value={etpl.body} onChange={e => saveTemplates({ ...templates, [et]: { ...templates[et], [step]: { ...etpl, body: e.target.value } } })} /></label>
      <p className="u-note" style={{ marginTop: 8 }}>Saved in this browser as you type.</p>
    </section>}

    {contacts === null ? <p className="u-note" role="status">Loading…</p> : queues[step].length === 0 ? <div className="u-void">
      <h2>{step === "intro" ? "Nobody left to email" : "No follow-ups due"}</h2>
      <p>{step === "intro" ? "Everyone with an email address has had a first email. Import more prospects to keep the batch full." : "Follow-ups show up here automatically a few days after each email you send."}</p>
      {step === "intro" && <Link className="u-btn u-btn-light" href="/crm">Import prospects</Link>}
    </div> : <div className="em-split">
      <div>
        <input className="u-field" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" aria-label="Search the batch" style={{ marginBottom: 12 }} />
        <div className="em-bulk">
          <label className="em-all"><input type="checkbox" checked={allOn} disabled={!!run} onChange={toggleAll} aria-label="Select all" /><span>{chosen.length ? `${chosen.length} selected` : "Select all"}</span></label>
          {chosen.length > 0 && !run && <>
            <button type="button" className="u-btn u-btn-bare" onClick={() => setSelected(new Set())}>Clear</button>
            {gmail?.connected
              ? <button type="button" className="u-btn u-btn-light" disabled={busy || !ws.address || chosen.length > room} onClick={() => void sendBulk()}>Send {chosen.length}</button>
              : <span className="u-note">Connect Gmail to send these in one go.</span>}
          </>}
        </div>
        {chosen.length > 0 && gmail?.connected && !ws.address && !run && <p className="u-note" style={{ marginBottom: 10 }}>Add your mailing address in <Link href="/crm/settings" style={{ textDecoration: "underline" }}>Settings</Link> to send.</p>}
        {chosen.length > room && gmail?.connected && !run && <p className="u-note" style={{ marginBottom: 10 }}>Gmail allows {room} more today. Unselect {chosen.length - room}.</p>}
        {run && <div className="em-run" role="status">
          <div className="em-run-top"><b>Sending {Math.min(run.done + run.failed.length + 1, run.total)} of {run.total}</b><span>{run.wait ? `next in ${run.wait}s` : "sending…"}</span><button type="button" className="u-btn u-btn-bare" onClick={() => { stopRef.current = true; }}>Stop</button></div>
          <div className="u-meter"><i style={{ width: ((run.done + run.failed.length) / run.total) * 100 + "%" }} /></div>
          <span className="u-note">Keep this tab open until it finishes.</span>
        </div>}
        <div className="u-rows em-list">{list.map(c => <div key={c.id} className={"u-row em-item" + (current?.id === c.id ? " is-on" : "") + (selected.has(c.id) ? " is-sel" : "")}>
          <input type="checkbox" className="em-check" checked={selected.has(c.id)} disabled={!!run} onChange={() => toggle(c.id)} aria-label={`Select ${c.company || c.name}`} />
          <button type="button" className="em-pick" onClick={() => setPicked(c.id)}>
            <div className="u-row-main"><strong>{c.company || c.name}</strong><span>{[c.location, trackOf(c.niche) === "detailing" ? "Detailer" : "", c.email].filter(Boolean).join(" · ")}</span></div>
          </button>
        </div>)}</div>
        {skipped.size > 0 && <button className="u-btn u-btn-bare" style={{ marginTop: 8 }} onClick={() => setSkipped(new Set())}>Bring back {skipped.size} skipped</button>}
      </div>

      {current && filled && <div className="em-read">
        <div className="em-to">{gmail?.connected && <><span>From</span><b>{gmail.email}</b></>}<span>To</span><b>{current.email}</b><Link href={`/crm?contact=${current.id}`} className="u-note" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Contact</Link></div>
        <div className="em-paper">
          <div className="em-subj">{filled.subject}</div>
          <pre className="em-body">{filled.body}</pre>
          {gmail?.connected && <pre className="em-foot">{`--\n${ws.businessName}\n${ws.address || "[Add your mailing address in Settings]"}\nNot interested? Reply "unsubscribe" and you won't hear from me again.`}</pre>}
        </div>
        <div className="em-acts">
          {gmail?.connected
            ? <button className="u-btn u-btn-light u-btn-lg" disabled={busy || !!run || !ws.address || gmail.sentLast24h >= gmail.cap} onClick={() => void sendNow()}>{busy ? "Sending…" : "Send"}</button>
            : <button className="u-btn u-btn-light u-btn-lg" disabled={busy} onClick={() => open("gmail")}>Open in Gmail</button>}
          {!gmail?.connected && <button className="u-btn" disabled={busy} onClick={() => open("mail")}>Mail app</button>}
          <button className="u-btn u-btn-bare" disabled={busy} onClick={() => void navigator.clipboard?.writeText(`${filled.subject}\n\n${filled.body}`)}>Copy</button>
          <span style={{ flex: 1 }} />
          <button className="u-btn u-btn-bare" disabled={busy || !!run} onClick={() => void markSent(current, filled.subject)}>Already sent</button>
          <button className="u-btn u-btn-bare" onClick={() => { setSkipped(s => new Set(s).add(current.id)); setPicked(null); }}>Skip</button>
        </div>
        <p className="u-note" style={{ marginTop: 10 }}>{gmail?.connected
          ? (!ws.address ? <>Add your mailing address in <Link href="/crm/settings" style={{ textDecoration: "underline" }}>Settings</Link> to send. The law requires it on cold email.</> : <>Sends from {gmail.email} and moves to the next person. {gmail.sentLast24h} of {gmail.cap} sent in the last 24 hours. <button type="button" className="em-disc" onClick={() => { if (confirm("Disconnect Gmail? Sending goes back to opening each email in Gmail.")) void fetch("/api/gmail", { method: "DELETE" }).then(() => loadGmail()); }}>Disconnect</button></>)
          : "Opening it logs it as sent and moves to the next person. You hit send in your own inbox."}</p>
      </div>}
    </div>}
  </div>;
}
