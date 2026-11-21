"use client";
// Outbound: the whole prospecting loop on one screen. Find → Score → Reach → Reply → Book across three channels.
// Text and LinkedIn are drafted here and sent by Sam himself (one tap opens Messages / LinkedIn). Email runs from
// the connected inboxes under their daily caps; replies wait here for one tap. Stop means stop on every channel.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "../../use-workspace";
import { copyText } from "@/lib/copy";
import { voicemailText, infoText, callTimeText, smsHref, quietHoursWarning, pickDemoLink } from "@/lib/sms-templates";
import { fillTemplate, mergeFor, hiringRole, dueFollowUps } from "@/lib/email-outreach";
import { DEFAULT_LINKEDIN, HIRING_LINKEDIN, DETAILING_LINKEDIN_MESSAGE, WEEKLY_CONNECT_CAP, CONNECT_NOTE_LIMIT, withRole } from "@/lib/linkedin-outreach";
import "./outbound.css";

type TextItem = { contactId: string; name: string; firstName: string; company: string; phone: string; timeZone: string | null; niche: string; template: "T-VM" | "T-INFO"; reason: string; callAt: string };
type Person = { contactId: string; name: string; company: string; role: string; location: string; niche: string; notes: string; profile: string; gradeA: boolean; acceptedAt?: string; sentAt?: string };
type LogLine = { at: string; channel: string; what: string; quote?: string; count?: number };
type Data = {
  loop: { found: number; gradeA: number; touches: number; replies: number; interested: number; booked: number };
  text: { sentToday: number; repliesToday: number; queue: TextItem[] };
  linkedin: { connectsWeek: number; accepted: number; waiting: number; messagesToday: number; toConnect: Person[]; toMessage: Person[]; toAccept: Person[] };
  log: LogLine[];
};
type Inbox = { email: string; main: boolean; sent: number; cap: number; warming: boolean; resting?: boolean };
type Gmail = { configured: boolean; connected: boolean; sentLast24h: number; cap: number; inboxes?: Inbox[] };
type Mail = { id: string; from: string; addr: string; subject: string; snippet: string; at: string; category: string; summary: string; next: string; contactId: string | null };
type Sent = { contactId: string; step: string; at: string };
type Heard = { contactId: string; kind: "reply" | "bounce"; at: string };

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver" }).replace(" ", " ");
const CATEGORY: Record<string, { label: string; hot?: boolean }> = { interested: { label: "Interested", hot: true }, question: { label: "Question", hot: true }, meeting: { label: "Wants to meet", hot: true }, not_now: { label: "Not now" }, not_interested: { label: "Not interested" }, referral: { label: "Referral", hot: true }, other: { label: "Reply" } };

function Ico({ d }: { d: React.ReactNode }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}
const ICON = {
  text: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  linkedin: <><rect x="2.5" y="2.5" width="19" height="19" rx="4" /><path d="M7.5 10.5v6M7.5 7.5v.01M11.5 16.5v-3.5a2 2 0 0 1 4 0v3.5M11.5 10.5v6" /></>,
  email: <><rect x="2.5" y="4.5" width="19" height="15" rx="2" /><path d="m21.5 7-9.5 6L2.5 7" /></>,
  book: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M4 9.5h16" /></>,
  call: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />,
};

export default function OutboundPage() {
  const ws = useWorkspace();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [gmail, setGmail] = useState<Gmail | null>(null);
  const [mail, setMail] = useState<Mail[]>([]);
  const [autopilot, setAutopilot] = useState<{ enabled: boolean; perDay: number } | null>(null);
  const [emailLog, setEmailLog] = useState<{ sent: Sent[]; heard: Heard[] }>({ sent: [], heard: [] });
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<{ col: "text" | "li" | "mail"; id: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const j = async (u: string) => { const r = await fetch(u, { cache: "no-store" }).catch(() => null); return r && r.ok ? r.json() : null; };
    const [d, g, m, a, e] = await Promise.all([j("/api/outbound"), j("/api/gmail"), j("/api/gmail/inbox"), j("/api/autopilot"), j("/api/email-outreach")]);
    if (!d) { setError("Couldn't load outbound. Check you're signed in and refresh."); return; }
    setError(""); setData(d); setGmail(g); setMail(Array.isArray(m?.mail) ? m.mail : []); setAutopilot(a); setEmailLog({ sent: e?.sent ?? [], heard: e?.heard ?? [] });
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);

  const texts = useMemo(() => (data?.text.queue ?? []).filter(t => !gone.has("t" + t.contactId)), [data, gone]);
  const liMessage = useMemo(() => (data?.linkedin.toMessage ?? []).filter(p => !gone.has("lm" + p.contactId)), [data, gone]);
  const liConnect = useMemo(() => (data?.linkedin.toConnect ?? []).filter(p => !gone.has("lc" + p.contactId)), [data, gone]);
  const liAccept = useMemo(() => (data?.linkedin.toAccept ?? []).filter(p => !gone.has("la" + p.contactId)), [data, gone]);
  const replies = useMemo(() => mail.filter(x => !gone.has("m" + x.id)), [mail, gone]);
  const hotReplies = replies.filter(r => CATEGORY[r.category]?.hot).length;

  // Drafts
  const textDraft = useCallback((t: TextItem) => {
    const demo = pickDemoLink(t.niche, ws.demoLink);
    return t.template === "T-VM"
      ? voicemailText({ firstName: t.firstName, callTime: callTimeText(new Date(t.callAt), t.timeZone), demoLink: demo, niche: t.niche })
      : infoText({ firstName: t.firstName, demoLink: demo, niche: t.niche, company: t.company });
  }, [ws.demoLink]);
  const liDraft = useCallback((p: Person, step: "connect" | "message") => {
    const m = mergeFor({ name: p.name, company: p.company, location: p.location }, ws);
    const hiring = /Hiring:/.test(p.notes);
    let tpl = hiring ? withRole(HIRING_LINKEDIN[step], hiringRole(p.notes)) : DEFAULT_LINKEDIN[step];
    if (!hiring && step === "message" && /detail/i.test(p.niche)) tpl = DETAILING_LINKEDIN_MESSAGE;
    const out = fillTemplate(tpl, m);
    return step === "connect" ? out.slice(0, CONNECT_NOTE_LIMIT) : out;
  }, [ws]);

  // Keyboard: J/K through the text queue (the column you send by hand most), Enter opens Messages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      if (!texts.length) return;
      const i = sel?.col === "text" ? texts.findIndex(x => x.contactId === sel.id) : -1;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const n = e.key === "j" ? Math.min(texts.length - 1, i + 1) : Math.max(0, i - 1);
        setSel({ col: "text", id: texts[n].contactId });
      } else if (e.key === "Enter" && i >= 0) {
        const item = texts[i]; const body = drafts["t" + item.contactId] ?? textDraft(item);
        window.location.href = smsHref(item.phone, body); setOpened(s => new Set(s).add("t" + item.contactId));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [texts, sel, drafts, textDraft]);

  // Actions
  async function markText(t: TextItem) {
    setBusy("t" + t.contactId);
    const body = drafts["t" + t.contactId] ?? textDraft(t);
    const r = await fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: t.contactId, direction: "outbound", template: t.template, body }) }).catch(() => null);
    setBusy("");
    if (!r?.ok) { const j = await r?.json().catch(() => null); setToast(j?.error ?? "Couldn't log that text."); return; }
    setGone(s => new Set(s).add("t" + t.contactId)); setToast(`Logged: text to ${t.company || t.name}`); void load();
  }
  async function markLinkedIn(p: Person, step: "connect" | "accepted" | "message", key: string) {
    setBusy(key);
    const r = await fetch("/api/linkedin-outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: p.contactId, step }) }).catch(() => null);
    setBusy("");
    if (!r?.ok) { setToast("Couldn't log that."); return; }
    setGone(s => new Set(s).add(key)); setToast(step === "connect" ? `Logged: request to ${p.name || p.company}` : step === "accepted" ? `${p.name || p.company} moved to "send the first message"` : `Logged: message to ${p.name || p.company}`); void load();
  }
  async function draftReply(m: Mail) {
    setBusy("m" + m.id);
    const r = await fetch("/api/gmail/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: m.id }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy("");
    if (!r?.ok || !j?.draft) { setToast(j?.error ?? "Couldn't draft a reply."); return; }
    setDrafts(d => ({ ...d, ["m" + m.id]: j.draft }));
  }
  async function sendReply(m: Mail) {
    const body = (drafts["m" + m.id] ?? "").trim();
    if (!body) return;
    setBusy("m" + m.id);
    const r = await fetch("/api/gmail/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply: m.id, body }) }).catch(() => null);
    setBusy("");
    if (!r?.ok) { const j = await r?.json().catch(() => null); setToast(j?.error ?? "Couldn't send that reply."); return; }
    setGone(s => new Set(s).add("m" + m.id)); setToast(`Reply sent to ${m.from}`); void load();
  }
  async function handled(m: Mail) {
    await fetch("/api/gmail/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: m.id }) }).catch(() => null);
    setGone(s => new Set(s).add("m" + m.id));
  }

  // Email sequence: where everyone who got an email sits, until they reply or bounce.
  const seq = useMemo(() => {
    const heard = new Set(emailLog.heard.map(h => h.contactId));
    const last = new Map<string, string>();
    const rank: Record<string, number> = { intro: 1, follow_up: 2, breakup: 3 };
    for (const s of emailLog.sent) { if (heard.has(s.contactId)) continue; const p = last.get(s.contactId); if (!p || (rank[s.step] ?? 0) > (rank[p] ?? 0)) last.set(s.contactId, s.step); }
    const n: { intro: number; follow_up: number; breakup: number } = { intro: 0, follow_up: 0, breakup: 0 };
    for (const v of last.values()) if (v === "intro" || v === "follow_up" || v === "breakup") n[v]++;
    const due = dueFollowUps(emailLog.sent, emailLog.heard);
    return { ...n, total: last.size, due: due.follow_up + due.breakup };
  }, [emailLog]);
  const emailToday = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return emailLog.sent.filter(s => Date.parse(s.at) >= d.getTime()).length; }, [emailLog]);
  const emailReplies = useMemo(() => emailLog.heard.filter(h => h.kind === "reply").length, [emailLog]);
  const bounces = useMemo(() => emailLog.heard.filter(h => h.kind === "bounce").length, [emailLog]);

  if (error) return <div className="u-page ob-page"><div className="u-head td8-head"><div className="td8-title"><h1 className="u-title">Outbound</h1><p className="td8-sub">{error}</p></div></div></div>;

  const d = data;
  const liReady = liMessage.length + liConnect.length;
  const needs = texts.length + liMessage.length + hotReplies;
  const live = d?.log[0];
  const inboxes = gmail?.inboxes ?? [];
  const textSel = sel?.col === "text" ? sel.id : texts[0]?.contactId;

  return <div className="u-page ob-page" role="region" aria-label="Outbound">
    <div className="u-head td8-head">
      <div className="td8-title">
        <p className="td8-date">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="u-title">Outbound</h1>
        <p className="td8-sub">{!d ? "Loading…" : needs ? <><span className="td8-hot">{needs} {needs === 1 ? "thing" : "things"}</span> {needs === 1 ? "needs" : "need"} you: {[texts.length && `${texts.length} ${texts.length === 1 ? "text" : "texts"}`, liMessage.length && `${liMessage.length} LinkedIn ${liMessage.length === 1 ? "message" : "messages"}`, hotReplies && `${hotReplies} ${hotReplies === 1 ? "reply" : "replies"}`].filter(Boolean).join(", ")}.{autopilot?.enabled ? " Email runs on its own." : ""}</> : <>Nothing needs you right now.{autopilot?.enabled ? " Email runs on its own." : ""}</>}</p>
        {live && <p className="td8-live" aria-live="polite"><i aria-hidden="true" /><span className="g">Live</span><span className="td8-live-t"><b>{live.what}{live.count ? ` +${live.count - 1} more` : ""}</b><em> · {ago(live.at)}</em></span></p>}
      </div>
      <div className="u-head-actions">
        <Link className="u-btn u-btn-bare td-hide-sm" href="/crm/leads">Find leads</Link>
        <Link className="u-btn u-btn-light" href="/crm/call">Start calling <kbd>C</kbd></Link>
      </div>
    </div>

    <ol className="ob-loop" aria-label="Today's loop">
      {[
        ["Find", d?.loop.found, "new today", "/crm"],
        ["Score", d?.loop.gradeA, "grade A", "/crm"],
        ["Reach", d?.loop.touches, d?.loop.touches === 1 ? "touch" : "touches", null],
        ["Reply", d?.loop.replies, d && d.loop.interested ? `${d.loop.interested} interested` : d?.loop.replies === 1 ? "reply" : "replies", null],
        ["Book", d?.loop.booked, d?.loop.booked === 1 ? "meeting" : "meetings", "/crm/calendar"],
      ].map(([k, v, cap, href], i) => {
        const inner = <><span className="k"><i>{i + 1}</i>{k}</span><span className="v">{v ?? "—"}<small>{cap}</small></span></>;
        return <li key={String(k)} className={i === 2 ? "on" : ""}>{href ? <Link href={String(href)}>{inner}</Link> : <div>{inner}</div>}</li>;
      })}
    </ol>

    <div className="ob-cols">
      {/* TEXT */}
      <section className="ob-col" aria-label="Text">
        <header className="ob-ch">
          <div className="ob-ct"><span className="ci"><Ico d={ICON.text} /></span>Text<span className="ob-md">You send</span></div>
          <div className="ob-cs"><div><b>{d?.text.sentToday ?? "—"}</b>Sent today</div><div><b>{d?.text.repliesToday ?? "—"}</b>Replied</div><div><b>{texts.length}</b>Ready</div></div>
        </header>
        <div className="ob-cl">
          <div className="ob-lab"><span>Ready to send</span>{texts.length > 1 && <span className="ob-keys"><kbd>J</kbd><kbd>K</kbd></span>}</div>
          {d && !texts.length && <p className="ob-empty">Nothing to text. Voicemail and info texts show up here after your calls.</p>}
          {texts.map(t => {
            const key = "t" + t.contactId, on = textSel === t.contactId, body = drafts[key] ?? textDraft(t);
            const quiet = quietHoursWarning(new Date(), t.timeZone);
            return <div key={key} className={`ob-r${on ? " sel" : ""}`} onClick={() => !on && setSel({ col: "text", id: t.contactId })}>
              <div className="rt"><b>{t.company || t.name}</b><span>{t.template === "T-VM" ? "Voicemail text" : "Info text"}</span></div>
              <div className="rs">{[t.firstName, t.reason, ago(t.callAt)].filter(Boolean).join(" · ")}</div>
              {on && <>
                <textarea className="ob-msg" value={body} rows={Math.min(8, Math.max(3, Math.ceil(body.length / 52)))} onChange={e => setDrafts(x => ({ ...x, [key]: e.target.value }))} aria-label={`Text to ${t.company || t.name}`} />
                {quiet && <p className="ob-warn">{quiet}</p>}
                <div className="ob-ra">
                  {opened.has(key)
                    ? <button className="ob-b p" disabled={busy === key} onClick={() => void markText(t)}>{busy === key ? "Logging…" : "Mark sent"}</button>
                    : <a className="ob-b p" href={smsHref(t.phone, body)} onClick={() => setOpened(s => new Set(s).add(key))}>Send from phone <kbd>↵</kbd></a>}
                  {opened.has(key) && <a className="ob-b" href={smsHref(t.phone, body)}>Open again</a>}
                  <button className="ob-b q" onClick={() => setGone(s => new Set(s).add(key))}>Skip</button>
                </div>
              </>}
            </div>;
          })}
        </div>
        <footer className="ob-cf">Opens Messages with the text filled in. You hit send, then Mark sent.</footer>
      </section>

      {/* LINKEDIN */}
      <section className="ob-col" aria-label="LinkedIn">
        <header className="ob-ch">
          <div className="ob-ct"><span className="ci"><Ico d={ICON.linkedin} /></span>LinkedIn<span className="ob-md">You send</span></div>
          <div className="ob-cs"><div><b>{d?.linkedin.connectsWeek ?? "—"}</b>Requests this week</div><div><b>{d?.linkedin.accepted ?? "—"}</b>Accepted</div><div><b>{d?.linkedin.waiting ?? "—"}</b>Waiting</div></div>
          <div className="ob-cap" aria-hidden="true"><i style={{ width: Math.min(100, ((d?.linkedin.connectsWeek ?? 0) / WEEKLY_CONNECT_CAP) * 100) + "%" }} /></div>
          <div className="ob-capt"><span>{d?.linkedin.connectsWeek ?? 0} of {WEEKLY_CONNECT_CAP} this week</span><span>{liReady} ready</span></div>
        </header>
        <div className="ob-cl">
          {d && !liReady && !liAccept.length && <p className="ob-empty">No LinkedIn profiles on your prospects yet. Add them on the <Link href="/crm/linkedin">LinkedIn page</Link> and they show up here.</p>}
          {liMessage.length > 0 && <div className="ob-lab"><span>Accepted. Send the first message</span></div>}
          {liMessage.slice(0, 6).map(p => <LiRow key={"lm" + p.contactId} p={p} k={"lm" + p.contactId} step="message" sel={sel} setSel={setSel} draft={drafts["lm" + p.contactId] ?? liDraft(p, "message")} setDraft={v => setDrafts(x => ({ ...x, ["lm" + p.contactId]: v }))} busy={busy} onDone={() => void markLinkedIn(p, "message", "lm" + p.contactId)} onCopy={async t => setToast((await copyText(t)) ? "Copied. Paste it on LinkedIn." : "Couldn't copy.")} />)}
          {liConnect.length > 0 && <div className="ob-lab"><span>Connect</span><span>{liConnect.length}{liConnect.length >= 25 ? "+" : ""}</span></div>}
          {liConnect.slice(0, 6).map(p => <LiRow key={"lc" + p.contactId} p={p} k={"lc" + p.contactId} step="connect" sel={sel} setSel={setSel} draft={drafts["lc" + p.contactId] ?? liDraft(p, "connect")} setDraft={v => setDrafts(x => ({ ...x, ["lc" + p.contactId]: v.slice(0, CONNECT_NOTE_LIMIT) }))} busy={busy} onDone={() => void markLinkedIn(p, "connect", "lc" + p.contactId)} onCopy={async t => setToast((await copyText(t)) ? "Copied. Paste it in the note." : "Couldn't copy.")} />)}
          {liAccept.length > 0 && <div className="ob-lab"><span>Waiting to accept</span><span>{d?.linkedin.waiting}</span></div>}
          {liAccept.slice(0, 4).map(p => <div key={"la" + p.contactId} className="ob-r">
            <div className="rt"><b>{p.name || p.company}</b><span>Sent {p.sentAt ? ago(p.sentAt) : ""}</span></div>
            <div className="rs">{[p.role, p.company].filter(Boolean).join(", ")}</div>
            <div className="ob-ra"><button className="ob-b" disabled={busy === "la" + p.contactId} onClick={() => void markLinkedIn(p, "accepted", "la" + p.contactId)}>They accepted</button></div>
          </div>)}
        </div>
        <footer className="ob-cf">Hands-on by design: LinkedIn bans automated sending. Free accounts get a few notes a month, so most requests go without one.</footer>
      </section>

      {/* EMAIL */}
      <section className="ob-col" aria-label="Email">
        <header className="ob-ch">
          <div className="ob-ct"><span className="ci"><Ico d={ICON.email} /></span>Email<span className={`ob-md${autopilot?.enabled ? " auto" : ""}`}>{autopilot?.enabled ? "Automatic" : "You send"}</span></div>
          <div className="ob-cs"><div><b>{gmail ? emailToday : "—"}</b>Sent today</div><div><b>{emailReplies}</b>Replied</div><div><b>{bounces}</b>Bounced</div></div>
          <div className="ob-cap" aria-hidden="true"><i style={{ width: Math.min(100, ((gmail?.sentLast24h ?? 0) / Math.max(1, gmail?.cap ?? 1)) * 100) + "%" }} /></div>
          <div className="ob-capt"><span>{gmail?.connected ? `${gmail.sentLast24h} of ${gmail.cap} in 24h · ${inboxes.length} ${inboxes.length === 1 ? "inbox" : "inboxes"}` : "No inbox connected"}</span><span>{inboxes.some(i => i.warming) ? "Warming" : gmail?.connected ? "Ready" : ""}</span></div>
        </header>
        <div className="ob-cl">
          {gmail && !gmail.connected && <p className="ob-empty">Connect a sending inbox on the <Link href="/crm/email">Email page</Link>. Use a separate domain, never your main inbox.</p>}
          {replies.length > 0 && <div className="ob-lab"><span>Waiting on you</span><span>{replies.length}</span></div>}
          {replies.slice(0, 5).map(m => {
            const key = "m" + m.id, on = sel?.col === "mail" && sel.id === m.id, cat = CATEGORY[m.category] ?? CATEGORY.other, draft = drafts[key];
            return <div key={key} className={`ob-r${on ? " sel" : ""}`} onClick={() => !on && setSel({ col: "mail", id: m.id })}>
              <div className="rt"><b>{m.from}</b><span className={`ob-tag${cat.hot ? " hot" : ""}`}>{cat.label}</span></div>
              <div className="rs">{m.summary || m.subject}</div>
              {on && <>
                <div className="ob-quote">{m.snippet}</div>
                {draft !== undefined
                  ? <textarea className="ob-msg" value={draft} rows={Math.min(10, Math.max(4, Math.ceil(draft.length / 52)))} onChange={e => setDrafts(x => ({ ...x, [key]: e.target.value }))} aria-label={`Reply to ${m.from}`} />
                  : m.next ? <p className="ob-next">{m.next}</p> : null}
                <div className="ob-ra">
                  {draft !== undefined
                    ? <button className="ob-b p" disabled={busy === key || !draft.trim()} onClick={() => void sendReply(m)}>{busy === key ? "Sending…" : "Send reply"}</button>
                    : <button className="ob-b p" disabled={busy === key} onClick={() => void draftReply(m)}>{busy === key ? "Drafting…" : "Draft reply"}</button>}
                  <button className="ob-b q" onClick={() => void handled(m)}>Done</button>
                </div>
              </>}
            </div>;
          })}
          {gmail?.connected && <>
            <div className="ob-lab"><span>In the sequence</span><span>{seq.total} {seq.total === 1 ? "person" : "people"}</span></div>
            <div className="ob-seq" aria-hidden="true">{(["intro", "follow_up", "breakup"] as const).map((k, i) => <i key={k} style={{ flexGrow: Math.max(seq[k], seq.total ? 0 : 1), background: ["#1c1d1f", "#8a919c", "#d3d8df"][i] }} />)}</div>
            <div className="ob-seqk"><span>First · {seq.intro}</span><span>Follow-up · {seq.follow_up}</span><span>Last · {seq.breakup}</span></div>
            {seq.due > 0 && <p className="ob-due">{seq.due} follow-up{seq.due === 1 ? "" : "s"} due. {autopilot?.enabled ? "Autopilot sends them on its next run." : <Link href="/crm/email">Send them on the Email page</Link>}</p>}
          </>}
        </div>
        <footer className="ob-cf">Capped per inbox. Anyone who says stop is removed from every channel. <Link href="/crm/email">Email settings</Link></footer>
      </section>
    </div>

    <section className="ob-log" aria-label="Today's log">
      <div className="ob-sh"><h2>Today’s log <span>· what ran while you were calling</span></h2></div>
      {d && !d.log.length && <p className="ob-empty">Nothing yet today.</p>}
      {d?.log.map((l, i) => <div key={i} className="ob-lg">
        <time>{clock(l.at)}</time>
        <span className="w"><b>{l.count && l.count > 1 ? l.what.replace(/ to .*/, ` to ${l.count} people`) : l.what}</b>{l.quote && <> · “{l.quote}”</>}</span>
        <span className="ch"><Ico d={ICON[l.channel as keyof typeof ICON] ?? ICON.call} />{({ text: "Text", linkedin: "LinkedIn", email: "Email", book: "Book", call: "Call" } as Record<string, string>)[l.channel] ?? ""}</span>
      </div>)}
    </section>
    {toast && <div className="ob-toast" role="status">{toast}</div>}
  </div>;
}

function LiRow({ p, k, step, sel, setSel, draft, setDraft, busy, onDone, onCopy }: {
  p: Person; k: string; step: "connect" | "message"; sel: { col: string; id: string } | null; setSel: (v: { col: "li"; id: string }) => void;
  draft: string; setDraft: (v: string) => void; busy: string; onDone: () => void; onCopy: (t: string) => void;
}) {
  const on = sel?.col === "li" && sel.id === k;
  return <div className={`ob-r${on ? " sel" : ""}`} onClick={() => !on && setSel({ col: "li", id: k })}>
    <div className="rt"><b>{p.name || p.company}</b><span>{step === "connect" ? (p.gradeA ? "Grade A" : "Connect") : "Message"}</span></div>
    <div className="rs">{[p.role, p.company, p.location.split(",")[0]].filter(Boolean).join(" · ")}</div>
    {on && <>
      <textarea className="ob-msg" value={draft} rows={step === "connect" ? 4 : 8} onChange={e => setDraft(e.target.value)} aria-label={step === "connect" ? "Connection note" : "First message"} />
      {step === "connect" && <p className="ob-hint">{draft.length}/{CONNECT_NOTE_LIMIT} · the note is optional</p>}
      <div className="ob-ra">
        <a className="ob-b p" href={p.profile} target="_blank" rel="noopener noreferrer">Open profile</a>
        <button className="ob-b" onClick={() => onCopy(draft)}>Copy {step === "connect" ? "note" : "message"}</button>
        <button className="ob-b" disabled={busy === k} onClick={onDone}>{busy === k ? "Logging…" : step === "connect" ? "Request sent" : "Message sent"}</button>
      </div>
    </>}
  </div>;
}
