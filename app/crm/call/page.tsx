"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CALL_OUTCOMES, OUTCOME_LABELS, type CallOutcome } from "@/lib/call-outcomes";
import { buildObjections, buildScript, cityOf } from "@/lib/call-script";
import { reportSection } from "@/lib/business-audit";
import { OFFERS, suggestOffer } from "@/lib/offers";
import type { QueueItem } from "@/lib/my-day";
import SuggestedDeal, { type SuggestedDealData } from "../../suggested-deal";
import "./call-mode.css";

type Contact = { id: string; name: string; company: string; phone: string; email?: string; website?: string; location?: string; notes?: string; status?: string; lastContact?: string };
type Audit = { id: string; content: string; createdAt: string };

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const firstName = (name: string, company: string) => { const f = name.trim().split(/\s+/)[0] ?? ""; return f && f.toLowerCase() !== company.trim().split(/\s+/)[0]?.toLowerCase() ? f : ""; };
const KEYS: Partial<Record<CallOutcome, string>> = { no_answer: "1", voicemail: "2", connected: "3", callback_requested: "4", interested: "5", meeting_booked: "6", not_a_fit: "7", wrong_contact: "8" };

/** Call mode: one prospect at a time with the brief, script, objections and one-tap outcomes. Calls are placed by the founder. */
export default function CallModePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<Audit | null | undefined>(undefined);
  const [tab, setTab] = useState<"brief" | "script" | "objections">("brief");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string; deal?: SuggestedDealData | null } | null>(null);
  const [logged, setLogged] = useState<{ name: string; outcome: string }[]>([]);
  const [dialog, setDialog] = useState<null | "meeting" | "callback">(null);
  const [when, setWhen] = useState({ date: "", time: "10:00", minutes: "30" });
  const [openObj, setOpenObj] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const now = new Date();
      const tomorrow = new Date(now); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const q = new URLSearchParams({ today: localKey(now), dayEnd: tomorrow.toISOString(), windowEnd: dayAfter.toISOString() });
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

  const item = queue[index];
  const contact = item?.contact ? { ...item.contact, ...(contacts[item.contact.id] ?? {}) } as Contact : null;

  useEffect(() => {
    setAudit(undefined); setNotes(""); setTab("brief"); setOpenObj(null);
    if (!contact?.id) return;
    let live = true;
    fetch(`/api/research-artifacts?type=audit_prep&contactId=${contact.id}`, { cache: "no-store" })
      .then(r => r.json()).then(d => { if (live) setAudit((d.artifacts ?? []).filter((a: { status: string }) => a.status !== "archived")[0] ?? null); })
      .catch(() => live && setAudit(null));
    return () => { live = false; };
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const offer = useMemo(() => suggestOffer(contact?.company ?? "", audit ? reportSection(audit.content, "Verdict") : null), [contact?.company, audit]);
  const scriptInput = contact ? { firstName: firstName(contact.name, contact.company), company: contact.company || contact.name, location: contact.location ?? "", notes: contact.notes ?? "", setupFee: OFFERS.tier1.setupFee, monthlyFee: OFFERS.tier1.monthlyFee } : null;
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

  async function log(outcome: CallOutcome, extra: { followUpDate?: string } = {}) {
    if (!contact || busy) return;
    if (outcome === "do_not_contact" && !confirm(`Mark ${contact.company || contact.name} do not contact? This stops all outreach and suppresses the number and email.`)) return;
    setBusy(true); setFlash(null);
    try {
      const r = await fetch("/api/contacts/outcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: contact.id, outcome, notes, ...extra }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Could not log that outcome.");
      const who = contact.company || contact.name;
      setLogged(l => [{ name: who, outcome: OUTCOME_LABELS[outcome] }, ...l]);
      setFlash({ ok: true, text: `${who}: ${data.label}${data.nextFollowUp ? ` · follow-up ${data.nextFollowUp}` : ""}`, deal: data.suggestedDeal || null });
      setQueue(q => q.filter((_, i) => i !== index));
      setIndex(i => Math.min(i, Math.max(0, queue.length - 2)));
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not log that outcome." }); }
    finally { setBusy(false); }
  }

  function openDialog(kind: "meeting" | "callback") {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || (e.target as HTMLElement)?.closest?.("textarea, input, select")) return;
      if (e.key === "c" || e.key === "C") { e.preventDefault(); dial(); }
      else if (e.key === "ArrowRight" || e.key === "n") setIndex(i => Math.min(i + 1, Math.max(0, queue.length - 1)));
      else if (e.key === "ArrowLeft" || e.key === "p") setIndex(i => Math.max(0, i - 1));
      else {
        const o = (Object.entries(KEYS) as [CallOutcome, string][]).find(([, k]) => k === e.key)?.[0];
        if (o === "meeting_booked") openDialog("meeting"); else if (o === "callback_requested") openDialog("callback"); else if (o) void log(o);
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
        <h1 className="cm-title">{queue.length ? `${queue.length} to call` : "List cleared"}</h1>
        <p className="cm-sub">{logged.length ? `${logged.length} logged this session · ` : ""}Follow-ups first, then today&apos;s fresh prospects. You dial; Cinder keeps score.</p>
      </div>
      <div className="cm-head-actions">
        <Link className="cm-link" href="/crm/needs-you">Needs you</Link>
        <button data-variant="primary" className="cm-btn" onClick={() => void load()}>Refresh</button>
      </div>
    </header>

    {flash && <div className={"cm-flash" + (flash.ok ? "" : " is-bad")} role="status">{flash.text}</div>}
    {flash?.deal && <div className="cm-deal-wrap"><SuggestedDeal key={flash.text} deal={flash.deal} /></div>}

    {!item ? <div className="cm-empty cm-done">
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
            <div className="cm-mini">{index + 1} of {queue.length} · {item.group === "prospects" ? "New prospect" : "Follow-up"}</div>
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

        <div className="cm-why">{item.why}</div>

        <div className="cm-tabs">
          {(["brief", "script", "objections"] as const).map(t => <button data-variant="primary" key={t} aria-current={tab === t ? "true" : undefined} className={"cm-tabbtn" + (tab === t ? " is-on" : "")} onClick={() => setTab(t)}>
            {t === "brief" ? "Brief" : t === "script" ? "Script" : "Objections"}</button>)}
        </div>

        <div className="cm-body">
          {tab === "brief" && (audit === undefined ? <p className="cm-muted">Loading audit…</p> : brief ? <div className="cm-brief">
            {brief.verdict && <div className="cm-verdict">{clean(brief.verdict)}</div>}
            {brief.plan && <Block title="Call plan" text={brief.plan} />}
            {brief.opps && <Block title="Top opportunities" text={brief.opps} />}
            {brief.flags && <Block title="Red flags" text={brief.flags} />}
            <p className="cm-muted">Suggested offer: {offer.label} · ${offer.setupFee.toLocaleString()} + ${offer.monthlyFee.toLocaleString()}/mo</p>
          </div> : <div className="cm-noaudit">
            <p>No audit yet. Use the script, or research them first so you know their gaps before you dial.</p>
            <Link className="cm-btn-link" href={`/crm/audit?contact=${contact?.id}`}>Run an audit on {contact?.company || contact?.name}</Link>
            {contact?.notes && <Block title="Notes on file" text={contact.notes} />}
          </div>)}
          {tab === "script" && <ol className="cm-script">{script.map(s => <li key={s.key}><div className="cm-step">{s.label}</div><p className="cm-say">&ldquo;{s.say}&rdquo;</p><small className="cm-tip">{s.tip}</small></li>)}</ol>}
          {tab === "objections" && <div className="cm-objs">{objections.map(o => <div key={o.key} className={"cm-obj" + (openObj === o.key ? " is-open" : "")}>
            <button data-variant="primary" className="cm-obj-head" onClick={() => setOpenObj(openObj === o.key ? null : o.key)} aria-expanded={openObj === o.key}><span>&ldquo;{o.heard}&rdquo;</span><span aria-hidden="true">{openObj === o.key ? "−" : "+"}</span></button>
            {openObj === o.key && <div className="cm-obj-body"><p className="cm-say">&ldquo;{o.say}&rdquo;</p><small className="cm-tip">{o.then}</small></div>}
          </div>)}</div>}
        </div>

        <div className="cm-dock">
        <label className="cm-notes"><span className="cm-mini">Call notes (saved with the outcome)</span>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Who you spoke to, what they said, their lead flow, best time to call back…" />
        </label>

        <div className="cm-outcomes">
          {CALL_OUTCOMES.map(o => <button data-variant="primary" key={o} disabled={busy}
            className={"cm-out" + (o === "meeting_booked" || o === "interested" ? " is-good" : o === "do_not_contact" ? " is-bad" : "")}
            onClick={() => o === "meeting_booked" ? openDialog("meeting") : o === "callback_requested" ? openDialog("callback") : void log(o)}>
            {OUTCOME_LABELS[o]}{KEYS[o] && <kbd>{KEYS[o]}</kbd>}
          </button>)}
        </div>
        <div className="cm-nav">
          <button data-variant="primary" className="cm-btn" disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))}>← Previous</button>
          <button data-variant="primary" className="cm-btn" disabled={index >= queue.length - 1} onClick={() => setIndex(i => i + 1)}>Skip →</button>
        </div>
        </div>
      </section>
    </div>}

    {dialog && <div className="cm-scrim" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(null); }}>
      <div className="cm-dialog" role="dialog" aria-modal="true" aria-labelledby="cm-dialog-title">
        <h3 id="cm-dialog-title">{dialog === "meeting" ? `Book a meeting with ${contact?.company || contact?.name}` : `When should you call ${contact?.company || contact?.name} back?`}</h3>
        <div className="cm-when">
          <label>Date<input type="date" value={when.date} onChange={e => setWhen({ ...when, date: e.target.value })} /></label>
          {dialog === "meeting" && <>
            <label>Time<input type="time" value={when.time} onChange={e => setWhen({ ...when, time: e.target.value })} /></label>
            <label>Length<select value={when.minutes} onChange={e => setWhen({ ...when, minutes: e.target.value })}><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label>
          </>}
        </div>
        <p className="cm-muted">{dialog === "meeting" ? "Adds it to your Cinder calendar, logs Meeting booked, and moves any open deal to Meeting booked. Send the invite yourself." : "Logs Callback requested and puts them back in your queue on that day."}</p>
        <div className="cm-row cm-right">
          <button data-variant="primary" className="cm-btn" onClick={() => setDialog(null)}>Cancel</button>
          <button data-variant="primary" className="cm-btn cm-primary" disabled={busy || !when.date} onClick={() => dialog === "meeting" ? void bookMeeting() : (setDialog(null), void log("callback_requested", { followUpDate: when.date }))}>
            {busy ? "Saving…" : dialog === "meeting" ? "Book meeting" : "Set callback"}</button>
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
