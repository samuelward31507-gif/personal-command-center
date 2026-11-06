"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CALL_MODE_GROUPS, CONVERSATIONS, OUTCOME_LABELS, ATTEMPT_LIMIT, type CallOutcome } from "@/lib/call-outcomes";
import { buildDraft, contactFirstName } from "@/lib/call-drafts";
import { localCallInfo } from "@/lib/local-time";
import { buildObjections, buildScript, cityOf } from "@/lib/call-script";
import { reportSection } from "@/lib/business-audit";
import { suggestOffer } from "@/lib/offers";
import { offersFrom } from "@/lib/workspace";
import { useWorkspace } from "../../use-workspace";
import type { QueueItem } from "@/lib/my-day";
import SuggestedDeal, { type SuggestedDealData } from "../../suggested-deal";
import TextDraft, { type TextContext } from "../text-draft";
import DiscoveryPanel from "../discovery-panel";
import "./call-mode.css";

type Contact = { id: string; name: string; company: string; phone: string; email?: string; website?: string; location?: string; notes?: string; status?: string; lastContact?: string; lastTouchAt?: string; lastTouchOutcome?: string; lastNote?: string; attempts?: number };
type Audit = { id: string; content: string; createdAt: string };

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const firstName = contactFirstName;
const KEYS: Partial<Record<CallOutcome, string>> = { no_answer: "1", voicemail: "2", gatekeeper: "3", wrong_number: "4", meeting_booked: "5", send_info: "6", callback_requested: "7", interested: "8", not_interested: "9", not_a_fit: "0" };
type Dialog = null | "meeting" | "callback" | "gatekeeper" | "info";
type Draft = { title: string; subject?: string; body: string; contactId: string; channel: "text" | "dm" | "email" | "stay" };
const CHANNEL_LABEL = { text: "Text", dm: "Facebook DM", email: "Email" } as const;
const shortDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

/** Call mode: one prospect at a time with the brief, script, objections and one-tap outcomes. Calls are placed by the founder. */
export default function CallModePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<Audit | null | undefined>(undefined);
  const [tab, setTab] = useState<"brief" | "script" | "objections" | "discovery">("brief");
  const [founding, setFounding] = useState<{ script: string; left: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string; deal?: SuggestedDealData | null } | null>(null);
  const [logged, setLogged] = useState<{ name: string; outcome: string }[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [gk, setGk] = useState({ name: "", best: "" });
  const [info, setInfo] = useState<{ channel: "text" | "dm" | "email"; pain: string }>({ channel: "text", pain: "" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [textCtx, setTextCtx] = useState<{ ctx: TextContext; contactId: string; who: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ dials: number; conversations: number; meetings: number } | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [when, setWhen] = useState({ date: "", time: "10:00", minutes: "30" });
  const [openObj, setOpenObj] = useState<string | null>(null);
  const [auditing, setAuditing] = useState<{ done: number; total: number; current: string } | null>(null);
  // Callbacks: find anyone by name, company or phone and log the result without leaving Call mode.
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const now = new Date();
      const tomorrow = new Date(now); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const q = new URLSearchParams({ today: localKey(now), dayEnd: tomorrow.toISOString(), windowEnd: dayAfter.toISOString(), prospects: "300" });
      const [dayRes, cRes] = await Promise.all([fetch("/api/my-day?" + q, { cache: "no-store" }), fetch("/api/contacts", { cache: "no-store" })]);
      if (dayRes.status === 401) throw new Error("Sign in to start calling.");
      const day = await dayRes.json().catch(() => ({}));
      const c = await cRes.json().catch(() => ({}));
      if (!dayRes.ok) throw new Error(day.error || "Could not build the call list.");
      const items: QueueItem[] = (day.items ?? []).filter((i: QueueItem) => i.callable && i.contact && ["revenue", "prospects", "deals"].includes(i.group));
      setQueue(items);
      setContacts(Object.fromEntries((c.contacts ?? []).map((x: Contact) => [x.id, x])));
      setIndex(0);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not build the call list."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch("/api/offer", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => d && setFounding({ script: d.script, left: d.left })).catch(() => {});
  }, []);
  useEffect(() => {
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    fetch("/api/call-stats?since=" + encodeURIComponent(midnight.toISOString()), { cache: "no-store" })
      .then(r => r.ok ? r.json() : null).then(d => d && setStats({ dials: d.dials, conversations: d.conversations, meetings: d.meetings })).catch(() => {});
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const item = queue[index];
  const contact = picked && contacts[picked] ? contacts[picked] : item?.contact ? { ...item.contact, ...(contacts[item.contact.id] ?? {}) } as Contact : null;
  const matches = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (t.length < 2) return [];
    const digits = t.replace(/\D/g, "");
    return (Object.values(contacts) as Contact[]).filter(c => {
      if (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)) return true;
      return /[a-z]/.test(t) && `${c.company ?? ""} ${c.name ?? ""}`.toLowerCase().includes(t);
    }).slice(0, 8);
  }, [search, contacts]);
  function pick(id: string) { setPicked(id); setSearch(""); setFlash(null); }

  useEffect(() => {
    setAudit(undefined); setNotes(""); setTab("brief"); setOpenObj(null);
    if (!contact?.id) return;
    let live = true;
    fetch(`/api/research-artifacts?type=audit_prep&contactId=${contact.id}`, { cache: "no-store" })
      .then(r => r.json()).then(d => { if (live) setAudit((d.artifacts ?? []).filter((a: { status: string }) => a.status !== "archived")[0] ?? null); })
      .catch(() => live && setAudit(null));
    return () => { live = false; };
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const wsp = useWorkspace();
  const offers = useMemo(() => offersFrom(wsp), [wsp]);
  const offer = useMemo(() => suggestOffer(contact?.company ?? "", audit ? reportSection(audit.content, "Verdict") : null, offers), [contact?.company, audit, offers]);
  const scriptInput = contact ? { firstName: firstName(contact.name, contact.company), company: contact.company || contact.name, location: contact.location ?? "", notes: contact.notes ?? "", setupFee: offers.tier1.setupFee, monthlyFee: offers.tier1.monthlyFee, me: wsp.ownerFirstName, brand: wsp.shortName, priceLine: founding?.script, spotsLeft: founding?.left } : null;
  const script = scriptInput ? buildScript(scriptInput) : [];
  const objections = scriptInput ? buildObjections(scriptInput) : [];
  const brief = audit ? {
    verdict: reportSection(audit.content, "Verdict"),
    plan: reportSection(audit.content, "Call plan"),
    flags: reportSection(audit.content, "Red flags"),
    opps: reportSection(audit.content, "Top opportunities"),
  } : null;

  function dial() {
    if (!contact?.phone) return;
    void fetch("/api/call-logs", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id, channel: "call", action: "outbound_call", outcome: "initiated", notes: "Call launched from Call mode." }) }).catch(() => {});
    window.location.href = "tel:" + contact.phone.replace(/[^+\d]/g, "");
  }

  async function log(outcome: CallOutcome, extra: { followUpDate?: string } = {}, extraNote = "") {
    if (!contact || busy) return;
    if (outcome === "do_not_contact" && !confirm(`Mark ${contact.company || contact.name} do not contact? This stops all outreach and suppresses the number and email.`)) return;
    setBusy(true); setFlash(null);
    try {
      const r = await fetch("/api/contacts/outcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: contact.id, outcome, notes: [extraNote, notes.trim()].filter(Boolean).join("\n"), ...extra }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Could not log that outcome.");
      setStats(st => st && { dials: st.dials + 1, conversations: st.conversations + (CONVERSATIONS.includes(outcome) ? 1 : 0), meetings: st.meetings + (outcome === "meeting_booked" ? 1 : 0) });
      setCopied(false);
      const draftInput = { firstName: firstName(contact.name, contact.company), company: contact.company || contact.name, pain: info.pain, me: wsp.ownerFirstName || "Samuel", bookingLink: wsp.bookingLink || "https://cal.com/samuel-ward-saqpvb/15min" };
      const t: TextContext | undefined = data.text;
      setTextCtx(t && (t.template || t.notice || t.tasks?.length || t.closed) ? { ctx: t, contactId: contact.id, who: contact.company || contact.name } : null);
      if (outcome === "not_a_fit") {
        setDraft({ title: `Optional stay-in-touch text for ${contact.company || contact.name}`, ...buildDraft("stay_in_touch", draftInput), contactId: contact.id, channel: "stay" });
      } else setDraft(null);
      const who = contact.company || contact.name;
      setLogged(l => [{ name: who, outcome: OUTCOME_LABELS[outcome] }, ...l]);
      const parkedNote = data.parked ? ` · ${ATTEMPT_LIMIT} tries with no answer, so they're parked for 30 days` : data.attempts ? ` · try ${data.attempts} of ${ATTEMPT_LIMIT}` : "";
      setFlash({ ok: true, text: `${who}: ${data.label}${data.nextFollowUp ? ` · back on ${data.nextFollowUp}` : ""}${parkedNote}`, deal: data.suggestedDeal || null });
      if (picked) {
        // A callback: drop them from today's list too so they never come back up by mistake.
        const id = picked;
        setQueue(q => { const next = q.filter(x => x.contact?.id !== id); setIndex(i => Math.min(i, Math.max(0, next.length - 1))); return next; });
        setPicked(null);
      } else {
        setQueue(q => q.filter((_, i) => i !== index));
        setIndex(i => Math.min(i, Math.max(0, queue.length - 2)));
      }
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not log that outcome." }); }
    finally { setBusy(false); }
  }

  /** Research every unaudited prospect in the list, two at a time, so each call opens with a brief. */
  async function auditRest() {
    // With a full calling day in the queue, audit only the next few people, not all of them.
    const todo = queue.slice(index).filter(q => q.contact && !/Audit:/.test(q.why)).slice(0, 10);
    if (!todo.length || auditing) return;
    if (!confirm(`Run audits on ${todo.length} prospect${todo.length === 1 ? "" : "s"}? About a minute each, two at a time. Uses Anthropic API credit.`)) return;
    let done = 0;
    setAuditing({ done, total: todo.length, current: "" });
    const one = async (q: QueueItem) => {
      const c = { ...q.contact!, ...(contacts[q.contact!.id] ?? {}) } as Contact;
      setAuditing(a => a && { ...a, current: c.company || c.name });
      try {
        const r = await fetch("/api/business-audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          companyName: c.company || c.name, website: c.website ?? "", location: c.location ?? "", contactId: c.id,
          context: c.notes ? `CRM notes: ${c.notes.slice(0, 1500)}` : "" }) });
        if (r.ok) setQueue(qs => qs.map(x => x.id === q.id ? { ...x, why: x.why.replace(/No audit yet — run one first/, "Audit: ready") } : x));
      } catch { /* keep going */ }
      done++; setAuditing(a => a && { ...a, done });
    };
    for (let i = 0; i < todo.length; i += 2) await Promise.all(todo.slice(i, i + 2).map(one));
    setAuditing(null);
    setFlash({ ok: true, text: `Audits finished for ${done} prospect${done === 1 ? "" : "s"}.` });
    if (contact?.id) {
      setAudit(undefined);
      fetch(`/api/research-artifacts?type=audit_prep&contactId=${contact.id}`, { cache: "no-store" }).then(r => r.json()).then(d => setAudit((d.artifacts ?? [])[0] ?? null)).catch(() => setAudit(null));
    }
  }

  function openDialog(kind: Exclude<Dialog, null>) {
    if (kind === "gatekeeper") { setGk({ name: "", best: "" }); setDialog(kind); return; }
    if (kind === "info") { void log("send_info"); return; } // drafts the info text right away
    const d = new Date(); d.setDate(d.getDate() + (kind === "callback" ? 1 : 2));
    if (d.getDay() === 6) d.setDate(d.getDate() + 2); if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    setWhen(w => ({ ...w, date: localKey(d) })); setDialog(kind);
  }

  async function bookMeeting() {
    if (!contact || !when.date || !when.time) return;
    setBusy(true);
    try {
      const start = new Date(`${when.date}T${when.time}:00`);
      const end = new Date(start.getTime() + Number(when.minutes) * 60000);
      const who = contact.company || contact.name;
      const r = await fetch("/api/calendar-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: `Discovery call — ${who}`, description: [`Booked from Call mode.`, contact.phone && `Phone: ${contact.phone}`, notes && `Notes: ${notes}`].filter(Boolean).join("\n"),
        startsAt: start.toISOString(), endsAt: end.toISOString(), type: "meeting", contactId: contact.id }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Could not add the meeting to your calendar."); }
      setDialog(null); setBusy(false);
      await log("meeting_booked", { followUpDate: when.date });
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not book the meeting." }); setBusy(false); }
  }

  function pickOutcome(o: CallOutcome) {
    if (o === "meeting_booked") openDialog("meeting");
    else if (o === "callback_requested") openDialog("callback");
    else if (o === "gatekeeper") openDialog("gatekeeper");
    else if (o === "send_info") openDialog("info");
    else void log(o);
  }

  async function copyDraft() {
    if (!draft) return;
    try { await navigator.clipboard.writeText(draft.subject ? `${draft.subject}\n\n${draft.body}` : draft.body); setCopied(true); } catch { setCopied(false); }
  }
  async function markSent() {
    if (!draft) return;
    const via = draft.channel === "dm" ? "Facebook DM" : draft.channel === "email" ? "email" : "text";
    const isText = draft.channel === "text" || draft.channel === "stay";
    const r = await fetch("/api/call-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      contactId: draft.contactId, channel: isText ? "text" : "note", action: isText ? "outbound_text" : "note", outcome: "other",
      notes: `Sent by ${via} from my phone (Cinder draft):\n${draft.body}`.slice(0, 5000) }) }).catch(() => null);
    setFlash(r?.ok ? { ok: true, text: `Marked as sent by ${via}.` } : { ok: false, text: "Couldn't mark it as sent. Try again." });
    if (r?.ok) setDraft(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || (e.target as HTMLElement)?.closest?.("textarea, input, select")) return;
      if (e.key === "c" || e.key === "C") { e.preventDefault(); dial(); }
      else if (e.key === "ArrowRight" || e.key === "n") setIndex(i => Math.min(i + 1, Math.max(0, queue.length - 1)));
      else if (e.key === "ArrowLeft" || e.key === "p") setIndex(i => Math.max(0, i - 1));
      else {
        const o = (Object.entries(KEYS) as [CallOutcome, string][]).find(([, k]) => k === e.key)?.[0];
        if (o) pickOutcome(o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading) return <main className="cm-page"><div className="cm-empty"><div className="cm-spinner" />Building your call list…</div></main>;
  if (error) return <main className="cm-page"><div className="cm-empty"><p>{error}</p><button data-variant="primary" className="cm-btn" onClick={() => void load()}>Try again</button></div></main>;

  return <main className="cm-page">
    <header className="cm-head">
      <div>
        <div className="cm-eyebrow">Call mode</div>
        <h1 className="cm-title">{queue.length ? `${queue.length} to call` : "Nothing to call right now"}</h1>
        <p className="cm-sub">Follow-ups first, then people you haven&apos;t called. You dial; Cinder keeps score.</p>
        {stats && <div className="cm-stats" aria-label="Today's numbers"><span><b>{stats.dials}</b> dials</span><span><b>{stats.conversations}</b> conversations</span><span><b>{stats.meetings}</b> meetings</span></div>}
      </div>
      <div className="cm-head-actions">
        <Link className="cm-link" href="/crm/needs-you">Today</Link>
        {queue.some(q => q.contact && !/Audit:/.test(q.why)) && <button data-variant="primary" className="cm-btn" disabled={!!auditing} onClick={() => void auditRest()}>
          {auditing ? `Auditing ${auditing.done}/${auditing.total}${auditing.current ? ` · ${auditing.current}` : ""}…` : `Audit the next ${Math.min(10, queue.slice(index).filter(q => q.contact && !/Audit:/.test(q.why)).length)}`}</button>}
        <button data-variant="primary" className="cm-btn" onClick={() => void load()}>Refresh</button>
      </div>
    </header>

    {flash && <div className={"cm-flash" + (flash.ok ? "" : " is-bad")} role="status">{flash.text}</div>}
    {flash?.deal && <div className="cm-deal-wrap"><SuggestedDeal key={flash.text} deal={flash.deal} /></div>}
    {draft && <div className="cm-draft">
      <div className="cm-draft-head"><b>{draft.title}</b><span>Nothing is sent from Cinder. Copy it and send it from your phone.</span></div>
      {draft.subject && <div className="cm-draft-subject">Subject: {draft.subject}</div>}
      <textarea rows={draft.channel === "email" ? 7 : 4} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} aria-label="Message draft" />
      <div className="cm-row">
        <button type="button" data-variant="primary" className="cm-btn cm-primary" onClick={() => void copyDraft()}>{copied ? "Copied ✓" : "Copy"}</button>
        <button type="button" data-variant="primary" className="cm-btn" onClick={() => void markSent()}>Mark as sent</button>
        <button type="button" data-variant="primary" className="cm-btn" onClick={() => setDraft(null)}>Dismiss</button>
      </div>
    </div>}

    {textCtx && <TextDraft key={textCtx.contactId + textCtx.ctx.callAt} ctx={textCtx.ctx} contactId={textCtx.contactId} who={textCtx.who} primaryClass="cm-btn cm-primary" quietClass="cm-btn" />}

    <div className="cm-find">
      <input type="search" inputMode="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Someone calling back? Search name, company or phone number" aria-label="Find a contact by name, company or phone number" />
      {search.trim().length >= 2 && <div className="cm-find-results" role="listbox">
        {matches.length ? matches.map(c => <button type="button" data-variant="primary" key={c.id} className="cm-find-row" onClick={() => pick(c.id)}>
          <span>{c.company || c.name}</span><small>{[c.company ? c.name : "", c.phone].filter(Boolean).join(" · ")}</small>
        </button>) : <div className="cm-find-none">No contact matches “{search.trim()}”.</div>}
      </div>}
    </div>
    {picked && contact && <div className="cm-flash" role="status">Logging a callback from {contact.company || contact.name}. Tap the result below. <button type="button" data-variant="primary" className="cm-btn" onClick={() => setPicked(null)}>Back to my list</button></div>}

    {!item && !picked ? <div className="cm-empty cm-done">
      <h2>Nothing left in today&apos;s list.</h2>
      <p>{logged.length ? `You logged ${logged.length} call${logged.length === 1 ? "" : "s"}. ` : ""}Add prospects or run audits to fill tomorrow.</p>
      <div className="cm-row"><Link className="cm-btn-link" href="/crm">Contacts</Link><Link className="cm-btn-link" href="/crm/audit">Run an audit</Link></div>
    </div> : <div className="cm-grid">
      <aside className="cm-queue" aria-label="Call list">
        {queue.map((q, i) => <button data-variant="primary" key={q.id} className={"cm-q" + (i === index ? " is-on" : "")} onClick={() => setIndex(i)}>
          <span className="cm-q-name">{q.contact?.company || q.contact?.name}</span>
          <span className="cm-q-why">{q.group === "prospects" ? "New prospect" : q.status === "overdue" ? "Overdue follow-up" : "Follow-up"}{/Audit:/.test(q.why) ? " · audited" : ""}</span>
        </button>)}
        {logged.length > 0 && <div className="cm-logged"><div className="cm-mini">Logged</div>{logged.slice(0, 8).map((l, i) => <div key={i} className="cm-logged-row"><span>{l.name}</span><small>{l.outcome}</small></div>)}</div>}
      </aside>

      <section className="cm-main">
        <div className="cm-who">
          <div className="cm-who-main">
            <div className="cm-mini">{picked ? "Callback" : `${index + 1} of ${queue.length} · ${item?.group === "prospects" ? "New prospect" : "Follow-up"}`}</div>
            <h2 className="cm-company">{contact?.company || contact?.name}</h2>
            <div className="cm-meta">
              {contact?.name && contact.name !== contact.company && <span>{contact.name}</span>}
              {contact?.location && cityOf(contact.location) && <span>{contact.location}</span>}
              {contact?.website && <a href={/^https?:/.test(contact.website) ? contact.website : "https://" + contact.website} target="_blank" rel="noreferrer">Website ↗</a>}
              <Link href={`/crm?contact=${contact?.id}`}>Open record</Link>
            </div>
          </div>
          <div className="cm-dial">
            <div className="cm-phone">{contact?.phone}</div>
            <button data-variant="primary" className="cm-call" onClick={dial}>Call <kbd>C</kbd></button>
          </div>
        </div>

        {(() => {
          const lt = contact ? localCallInfo(contact.location ?? "", clock, contact.phone ?? "") : null;
          const last = contact?.lastTouchOutcome ? `Last: ${OUTCOME_LABELS[contact.lastTouchOutcome as CallOutcome] ?? contact.lastTouchOutcome}${contact.lastTouchAt ? ` · ${shortDate(contact.lastTouchAt)}` : ""}` : "Never called";
          const tries = contact?.attempts ? ` · ${contact.attempts} of ${ATTEMPT_LIMIT} tries with no answer` : "";
          return <div className="cm-history">
            {lt && <span className={"cm-local is-" + lt.window} title={lt.window === "good" ? "Good time: owners are usually off the job" : lt.window === "late" ? "Too early or too late to call" : "During the work day"}><i aria-hidden="true" />{lt.time} their time</span>}
            <span>{last}{tries}</span>
            {contact?.lastNote && <p className="cm-lastnote">{contact.lastNote}</p>}
          </div>;
        })()}
        {!picked && item && <div className="cm-why">{item.why}</div>}

        <div className="cm-tabs">
          {(["brief", "script", "objections", "discovery"] as const).map(t => <button data-variant="primary" key={t} aria-current={tab === t ? "true" : undefined} className={"cm-tabbtn" + (tab === t ? " is-on" : "")} onClick={() => setTab(t)}>
            {t === "brief" ? "Brief" : t === "script" ? "Script" : t === "objections" ? "Objections" : "Discovery"}</button>)}
        </div>

        <div className="cm-body">
          {tab === "brief" && (audit === undefined ? <p className="cm-muted">Loading audit…</p> : brief ? <div className="cm-brief">
            <span className="ai-badge" title="Written by AI from public web research. Check anything important before you rely on it.">AI research · verify</span>
            {brief.verdict && <div className="cm-verdict">{clean(brief.verdict)}</div>}
            {brief.plan && <Block title="Call plan" text={brief.plan} />}
            {brief.opps && <Block title="Top opportunities" text={brief.opps} />}
            {brief.flags && <Block title="Red flags" text={brief.flags} />}
            {audit && <Link className="cm-link" href={`/crm/audits/${audit.id}`}>Full audit report →</Link>}
            <p className="cm-muted">Suggested offer: {offer.label} · ${offer.setupFee.toLocaleString()} + ${offer.monthlyFee.toLocaleString()}/mo</p>
          </div> : <div className="cm-noaudit">
            <p>No audit yet. Use the script, or research them first so you know their gaps before you dial.</p>
            <Link className="cm-btn-link" href={`/crm/audit?contact=${contact?.id}`}>Run an audit on {contact?.company || contact?.name}</Link>
            {contact?.notes && <Block title="Notes on file" text={contact.notes} />}
          </div>)}
          {tab === "script" && <ol className="cm-script">{script.map(s => <li key={s.key}><div className="cm-step">{s.label}</div><p className="cm-say">&ldquo;{s.say}&rdquo;</p><small className="cm-tip">{s.tip}</small></li>)}</ol>}
          {tab === "discovery" && contact?.id && <DiscoveryPanel key={contact.id} contactId={contact.id} compact />}
          {tab === "objections" && founding && <div className="fo-chip" style={{ marginBottom: 10 }}><p>&ldquo;{founding.script}&rdquo;</p><small>Spots left: {founding.left}</small></div>}
          {tab === "objections" && <div className="cm-objs">{objections.map(o => <div key={o.key} className={"cm-obj" + (openObj === o.key ? " is-open" : "")}>
            <button data-variant="primary" className="cm-obj-head" onClick={() => setOpenObj(openObj === o.key ? null : o.key)} aria-expanded={openObj === o.key}><span>&ldquo;{o.heard}&rdquo;</span><span aria-hidden="true">{openObj === o.key ? "−" : "+"}</span></button>
            {openObj === o.key && <div className="cm-obj-body"><p className="cm-say">&ldquo;{o.say}&rdquo;</p><small className="cm-tip">{o.then}</small></div>}
          </div>)}</div>}
        </div>

        <div className="cm-dock">
        <label className="cm-notes"><span className="cm-mini">Call notes (saved with the outcome)</span>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Who you spoke to, what they said, their lead flow, best time to call back…" />
        </label>

        {CALL_MODE_GROUPS.map(g => <div key={g.label} className="cm-outgroup">
          <div className="cm-mini">{g.label}</div>
          <div className="cm-outcomes">
            {g.outcomes.map(o => <button data-variant="primary" key={o} disabled={busy}
              className={"cm-out" + (o === "meeting_booked" || o === "send_info" || o === "interested" ? " is-good" : o === "do_not_contact" ? " is-bad" : "")}
              onClick={() => pickOutcome(o)}>
              {OUTCOME_LABELS[o]}{KEYS[o] && <kbd>{KEYS[o]}</kbd>}
            </button>)}
          </div>
        </div>)}
        <div className="cm-nav">
          <button data-variant="primary" className="cm-btn" disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))}>← Previous</button>
          <button data-variant="primary" className="cm-btn" disabled={index >= queue.length - 1} onClick={() => setIndex(i => i + 1)}>Skip →</button>
        </div>
        </div>
      </section>
    </div>}

    {dialog && <div className="cm-scrim" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(null); }}>
      <div className="cm-dialog" role="dialog" aria-modal="true" aria-labelledby="cm-dialog-title">
        <h3 id="cm-dialog-title">{dialog === "meeting" ? `Book a meeting with ${contact?.company || contact?.name}` : dialog === "gatekeeper" ? "Who picked up?" : dialog === "info" ? `Send ${contact?.company || contact?.name} info` : `When should you call ${contact?.company || contact?.name} back?`}</h3>
        {dialog === "gatekeeper" ? <div className="cm-when">
          <label>Their name (optional)<input value={gk.name} onChange={e => setGk({ ...gk, name: e.target.value })} placeholder="e.g. Lisa at the front desk" autoFocus /></label>
          <label>Best time to reach the owner (optional)<input value={gk.best} onChange={e => setGk({ ...gk, best: e.target.value })} placeholder="e.g. before 8am" /></label>
        </div> : dialog === "info" ? <div className="cm-when">
          <label>Send it by<select value={info.channel} onChange={e => setInfo({ ...info, channel: e.target.value as "text" | "dm" | "email" })}><option value="text">Text</option><option value="dm">Facebook DM</option><option value="email">Email</option></select></label>
          <label>Their problem, starting with “you” (optional)<input value={info.pain} onChange={e => setInfo({ ...info, pain: e.target.value })} placeholder="e.g. you miss calls when the crew's out" autoFocus /></label>
        </div> : <div className="cm-when">
          <label>Date<input type="date" value={when.date} onChange={e => setWhen({ ...when, date: e.target.value })} /></label>
          {dialog === "meeting" && <>
            <label>Time<input type="time" value={when.time} onChange={e => setWhen({ ...when, time: e.target.value })} /></label>
            <label>Length<select value={when.minutes} onChange={e => setWhen({ ...when, minutes: e.target.value })}><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label>
          </>}
        </div>}
        <p className="cm-muted">{dialog === "meeting" ? "Adds it to your Cinder calendar, logs Meeting booked, and moves any open deal to Meeting booked. Send the invite yourself." : dialog === "gatekeeper" ? "Saves who you talked to and brings them back tomorrow. You'll see the name and best time on the next call." : dialog === "info" ? "Logs Send info and writes a message for you to copy and send from your phone. Nothing is sent from Cinder. They come back tomorrow for a follow-up call." : "Logs Callback requested and puts them back in your queue on that day."}</p>
        <div className="cm-row cm-right">
          <button data-variant="primary" className="cm-btn" onClick={() => setDialog(null)}>Cancel</button>
          <button data-variant="primary" className="cm-btn cm-primary" disabled={busy || ((dialog === "meeting" || dialog === "callback") && !when.date)} onClick={() => {
            if (dialog === "meeting") void bookMeeting();
            else if (dialog === "gatekeeper") { setDialog(null); void log("gatekeeper", {}, ["Gatekeeper answered", gk.name && `Name: ${gk.name.trim()}`, gk.best && `Best time to reach the owner: ${gk.best.trim()}`].filter(Boolean).join(". ") + "."); }
            else if (dialog === "info") { setDialog(null); void log("send_info", {}, `Asked for info by ${CHANNEL_LABEL[info.channel].toLowerCase()}.${info.pain.trim() ? ` Their problem: ${info.pain.trim()}` : ""}`); }
            else { setDialog(null); void log("callback_requested", { followUpDate: when.date }); }
          }}>
            {busy ? "Saving…" : dialog === "meeting" ? "Book meeting" : dialog === "gatekeeper" ? "Save" : dialog === "info" ? "Log and write the message" : "Set callback"}</button>
        </div>
      </div>
    </div>}
  </main>;
}

function clean(text: string) { return text.replace(/\*\*/g, "").replace(/^[-*•]\s+/gm, ""); }

function Block({ title, text }: { title: string; text: string }) {
  const lines = text.split("\n").map(l => l.replace(/\*\*/g, "").trim()).filter(Boolean);
  return <div className="cm-block"><div className="cm-mini">{title}</div><ul>{lines.map((l, i) => <li key={i}>{l.replace(/^[-*•]\s+|^\d+[.)]\s+/, "")}</li>)}</ul></div>;
}
