"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CALL_MODE_GROUPS, CONVERSATIONS, OUTCOME_LABELS, ATTEMPT_LIMIT, type CallOutcome } from "@/lib/call-outcomes";
import { buildDraft, contactFirstName, INFO_EMAIL_STYLES } from "@/lib/call-drafts";
import { localCallInfo } from "@/lib/local-time";
import { cityOf } from "@/lib/call-script";
import { demoText, smsHref, nicheFor } from "@/lib/sms-templates";
import { openerFor } from "@/lib/openers";
import { SCRIPTS, CLOSE, VOICEMAIL, GATEKEEPER, fillLine, type Track } from "@/lib/call-playbook";
import { reportSection } from "@/lib/business-audit";
import { suggestOffer } from "@/lib/offers";
import { offersFrom } from "@/lib/workspace";
import { useWorkspace } from "../../use-workspace";
import type { QueueItem } from "@/lib/my-day";
import SuggestedDeal, { type SuggestedDealData } from "../../suggested-deal";
import TextDraft, { type TextContext } from "../text-draft";
import { CallEmail } from "./call-email";

/** Outcomes that roll straight into the next dial when auto-dial is on. */
const AUTO_NEXT: string[] = ["no_answer", "voicemail", "gatekeeper", "wrong_number", "not_interested", "not_a_fit"];
import "./call.css";

type Contact = { id: string; name: string; company: string; phone: string; email?: string; website?: string; location?: string; notes?: string; status?: string; lastContact?: string; lastTouchAt?: string; lastTouchOutcome?: string; lastNote?: string; attempts?: number; niche?: string };
type Audit = { id: string; content: string; createdAt: string };

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const firstName = contactFirstName;
const KEYS: Partial<Record<CallOutcome, string>> = { no_answer: "1", voicemail: "2", gatekeeper: "3", wrong_number: "4", meeting_booked: "5", interested: "6", callback_requested: "7", not_interested: "8", not_a_fit: "9" };
type Dialog = null | "meeting" | "callback" | "gatekeeper" | "info";
type Draft = { title: string; subject?: string; body: string; contactId: string; channel: "text" | "dm" | "email" | "stay" };
const CHANNEL_LABEL = { text: "Text", dm: "Facebook DM", email: "Email" } as const;
const shortDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

/** Call mode: one prospect at a time, the research brief, and one-tap outcomes. Calls are placed by the founder from his own phone. */
export default function CallModePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<Audit | null | undefined>(undefined);
  const [founding, setFounding] = useState<{ script: string; left: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string; deal?: SuggestedDealData | null } | null>(null);
  const [logged, setLogged] = useState<{ name: string; outcome: string }[]>([]);
  // Auto-dial: after a quick outcome (no answer, voicemail, gatekeeper…), the next call opens on its own after a short countdown.
  const [autoDial, setAutoDial] = useState(() => { try { return localStorage.getItem("cinder.autodial") !== "off"; } catch { return true; } });
  const [countdown, setCountdown] = useState<number | null>(null);
  // Browsers block a call that starts without a click or key press, so auto-dial lines up the next call and one key places it.
  const [ready, setReady] = useState(false);
  // Info email straight from Call mode: type the address the receptionist gave, pick More work or Time back, send.
  const [mail, setMail] = useState<{ to: string; style: "info_email" | "info_email_time"; busy: boolean; msg: { ok: boolean; text: string } | null }>({ to: "", style: "info_email", busy: false, msg: null });
  const readyLink = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => { if (ready) readyLink.current?.focus(); }, [ready]);
  // "New only" hides follow-ups so the list is just people you have never called.
  const [newOnly, setNewOnly] = useState(() => { try { return localStorage.getItem("cinder.newonly") !== "off"; } catch { return true; } });
  const pendingDial = useRef(false);
  const [session, setSession] = useState<{ start: number; dials: number } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [gk, setGk] = useState({ name: "", owner: "", direct: "", best: "" });
  const [info, setInfo] = useState<{ channel: "text" | "dm" | "email"; pain: string; style: "info_email" | "info_email_time" }>({ channel: "text", pain: "", style: "info_email" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [textCtx, setTextCtx] = useState<{ ctx: TextContext; contactId: string; who: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [mailAfter, setMailAfter] = useState<{ id: string; name: string; company: string; email: string; location?: string; niche?: string } | null>(null);
  const [gmail, setGmail] = useState<{ connected: boolean; email: string | null } | null>(null);
  useEffect(() => { fetch("/api/gmail", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(setGmail).catch(() => setGmail(null)); }, []);
  const [stats, setStats] = useState<{ dials: number; conversations: number; meetings: number } | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [when, setWhen] = useState({ date: "", time: "10:00", minutes: "30" });
  const [auditing, setAuditing] = useState<{ done: number; total: number; current: string } | null>(null);
  // Callbacks: find anyone by name, company or phone and log the result without leaving Call mode.
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  // Playbook panel: an objection id, or "close", "voicemail", "gatekeeper". null shows the script.
  const [say, setSay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const now = new Date();
      const tomorrow = new Date(now); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const q = new URLSearchParams({ today: localKey(now), dayEnd: tomorrow.toISOString(), windowEnd: dayAfter.toISOString(), prospects: "1500" });
      const [dayRes, cRes] = await Promise.all([fetch("/api/my-day?" + q, { cache: "no-store" }), fetch("/api/contacts", { cache: "no-store" })]);
      if (dayRes.status === 401) throw new Error("Sign in to start calling.");
      const day = await dayRes.json().catch(() => ({}));
      const c = await cRes.json().catch(() => ({}));
      if (!dayRes.ok) throw new Error(day.error || "Could not build the call list.");
      const items: QueueItem[] = (day.items ?? []).filter((i: QueueItem) => i.callable && i.contact && ["revenue", "prospects", "deals"].includes(i.group));
      const byId: Record<string, Contact> = Object.fromEntries((c.contacts ?? []).map((x: Contact) => [x.id, x]));
      // New prospects: whoever is at a good time to call right now goes first (owners off the job: early morning,
      // late afternoon), then the work day, then anyone where it's too early or too late. Callbacks keep their place.
      const rank = { good: 0, ok: 1, late: 2 } as const;
      const winOf = (i: QueueItem) => { const x = byId[i.contact!.id]; const w = localCallInfo(x?.location ?? "", now, x?.phone ?? i.contact!.phone ?? "")?.window; return w ? rank[w] : 1; };
      const slots = items.map((it, n) => (it.group === "prospects" ? n : -1)).filter(n => n >= 0);
      const ordered = slots.map(n => items[n]).map((it, k) => ({ it, k, w: winOf(it) })).sort((x, y) => x.w - y.w || x.k - y.k).map(x => x.it);
      slots.forEach((n, k) => { items[n] = ordered[k]; });
      // A contact can show up as both a follow-up and a deal next step: call them once.
      const seen = new Set<string>();
      setQueue(items.filter(i => { const id = i.contact!.id; if (seen.has(id)) return false; seen.add(id); return !newOnly || i.group === "prospects"; }));
      setContacts(byId);
      setIndex(0);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not build the call list."); }
    finally { setLoading(false); }
  }, [newOnly]);
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
  const track: Track = contact && openerFor(contact.niche, contact.company, contact.notes).trade === "detailing" ? "detailing" : "trades";
  const play = SCRIPTS[track];
  const playFirst = contact ? firstName(contact.name ?? "", contact.company ?? "") : "";
  useEffect(() => { setSay(null); }, [contact?.id]);
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
  // Opened from the Dashboard's follow-up list: /crm/call?contact=<id> jumps straight to that person.
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("contact"); if (id) { setPicked(id); window.history.replaceState(null, "", "/crm/call"); } }, []);
  // A ?contact= id that isn't in your contacts would otherwise log outcomes on the list's current person as a "callback".
  useEffect(() => { if (!loading && picked && !contacts[picked]) setPicked(null); }, [loading, picked, contacts]);

  useEffect(() => {
    setAudit(undefined); setNotes("");
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
  const brief = audit ? {
    verdict: reportSection(audit.content, "Verdict"),
    plan: reportSection(audit.content, "Call plan"),
    flags: reportSection(audit.content, "Red flags"),
    opps: reportSection(audit.content, "Top opportunities"),
  } : null;

  async function sendInfoMail() {
    if (!contact || mail.busy) return;
    const to = mail.to.trim();
    const d = buildDraft(mail.style, { firstName: firstName(contact.name, contact.company), company: contact.company || contact.name, pain: info.pain, me: wsp.ownerFirstName || "Samuel", bookingLink: wsp.bookingLink || "https://cal.com/samuel-ward-saqpvb/15min" });
    setMail(m => ({ ...m, busy: true, msg: null }));
    try {
      const r = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: contact.id, step: "info", subject: d.subject, body: d.body, email: to }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send it.");
      setContacts(cs => ({ ...cs, [contact.id]: { ...(cs[contact.id] ?? contact), email: to.toLowerCase() } as Contact }));
      setMail(m => ({ ...m, busy: false, msg: { ok: true, text: `Sent "${d.subject}" to ${to} from ${j.from || "your Gmail"}.` } }));
    } catch (e) { setMail(m => ({ ...m, busy: false, msg: { ok: false, text: e instanceof Error ? e.message : "Couldn't send it." } })); }
  }

  /** Logs that a call went out. The call itself is started by a real tel: link (or location change for the C key). */
  function noteLaunch() {
    if (!contact) return;
    setReady(false); setCountdown(null); pendingDial.current = false;
    setSession(s => s ?? { start: Date.now(), dials: 0 });
    void fetch("/api/call-logs", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id, channel: "call", action: "outbound_call", outcome: "initiated", notes: "Call launched from Call mode." }) }).catch(() => {});
  }
  function dial(number?: string) {
    setReady(false);
    const to = number || contact?.phone;
    if (!contact || !to) return;
    noteLaunch();
    window.location.href = "tel:" + to.replace(/[^+\d]/g, "");
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
      setMailAfter(outcome === "voicemail" && contact.email ? { id: contact.id, name: contact.name, company: contact.company, email: contact.email, location: contact.location, niche: contact.niche } : null);
      const draftInput = { firstName: firstName(contact.name, contact.company), company: contact.company || contact.name, pain: info.pain, me: wsp.ownerFirstName || "Samuel", bookingLink: wsp.bookingLink || "https://cal.com/samuel-ward-saqpvb/15min" };
      const t: TextContext | undefined = data.text;
      setTextCtx(t && (t.template || t.notice || t.tasks?.length || t.closed) ? { ctx: t, contactId: contact.id, who: contact.company || contact.name } : null);
      if (outcome === "not_a_fit") {
        setDraft({ title: `Optional stay-in-touch text for ${contact.company || contact.name}`, ...buildDraft("stay_in_touch", draftInput), contactId: contact.id, channel: "stay" });
      } else if (outcome === "send_info" && info.channel === "email") {
        setDraft({ title: `Info email for ${contact.company || contact.name}${contact.email ? ` (${contact.email})` : ""}`, ...buildDraft(info.style, draftInput), contactId: contact.id, channel: "email" });
      } else setDraft(null);
      const who = contact.company || contact.name;
      setLogged(l => [{ name: who, outcome: OUTCOME_LABELS[outcome] }, ...l]);
      setSession(s => s ? { ...s, dials: s.dials + 1 } : { start: Date.now(), dials: 1 });
      // Quick outcomes roll straight into the next dial; real conversations pause so you can text, book or take notes.
      if (autoDial && !picked && AUTO_NEXT.includes(outcome)) pendingDial.current = true;
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
    if (kind === "gatekeeper") { setGk({ name: "", owner: firstName(contact?.name ?? "", contact?.company ?? "") || "", direct: "", best: "" }); setDialog(kind); return; }
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

  // Start the countdown once the next contact is on screen; dial when it hits zero.
  // A pending auto-dial only applies to the very next contact; never carry it over (e.g. to a later
  // callback pick or a refreshed list) when that contact has no phone or the list ran out.
  useEffect(() => {
    const go = pendingDial.current;
    pendingDial.current = false;
    setMail({ to: contact?.email ?? "", style: "info_email", busy: false, msg: null });
    const isReady = !!(go && contact?.phone && !picked);
    setReady(isReady);
    // Take focus out of the notes box (or the outcome button) so Enter places the call instead of typing a new line.
    if (isReady && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [contact?.id, contact?.phone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { setCountdown(null); dial(); return; }
    const t = setTimeout(() => setCountdown(c => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);
  function toggleAuto() { setAutoDial(a => { const n = !a; try { localStorage.setItem("cinder.autodial", n ? "on" : "off"); } catch { /* fine */ } if (!n) { setCountdown(null); setReady(false); } return n; }); }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack Cmd/Ctrl+C (copy), Cmd+1..9 (switch tab) or key-repeat.
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const typing = !!(e.target as HTMLElement)?.closest?.("textarea, input, select, [contenteditable]");
      if (countdown !== null && (e.key === "Escape" || (e.key === " " && !typing))) { e.preventDefault(); setCountdown(null); return; }
      if (ready && e.key === "Escape") { e.preventDefault(); setReady(false); return; }
      if (dialog || typing) return;
      const ob = contact ? play.objections.find(o => o.key === e.key) : undefined;
      if (e.key === "Escape" && say) { e.preventDefault(); setSay(null); }
      else if (ob) { e.preventDefault(); setSay(s => (s === ob.id ? null : ob.id)); }
      else if (e.key === "d" || e.key === "D") { const link = document.querySelector<HTMLAnchorElement>(".dl-demo-text"); if (link) { e.preventDefault(); link.click(); } }
      else if (e.key === "c" || e.key === "C") { e.preventDefault(); const link = document.querySelector<HTMLAnchorElement>(".dl-call-link"); if (link) link.click(); else dial(); }
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

  const target = wsp.dailyCallTarget || 100;
  const who = contact?.company || contact?.name || "";
  const lt = contact ? localCallInfo(contact.location ?? "", clock, contact.phone ?? "") : null;
  const last = contact?.lastTouchOutcome ? `${OUTCOME_LABELS[contact.lastTouchOutcome as CallOutcome] ?? contact.lastTouchOutcome}${contact.lastTouchAt ? `, ${shortDate(contact.lastTouchAt)}` : ""}` : "Never called";
  const unaudited = queue.slice(index).filter(q => q.contact && !/Audit:/.test(q.why)).length;

  if (loading) return <div className="u-page dl-call" role="region" aria-label="Call mode"><p className="u-note" role="status">Building your call list…</p></div>;
  if (error) return <div className="u-page dl-call" role="region" aria-label="Call mode"><div className="u-void"><h2>{error}</h2><button className="u-btn u-btn-light" onClick={() => void load()}>Try again</button></div></div>;

  return <div className="u-page dl-call" role="region" aria-label="Call mode">
    <div className="dl-top">
      <div className="dl-score" aria-label="Today's numbers">
        <div><span className="u-fig-k">Dials today</span><b className="u-num">{stats?.dials ?? 0}<small> / {target}</small></b><div className="u-meter"><i style={{ width: Math.min(100, ((stats?.dials ?? 0) / target) * 100) + "%" }} /></div></div>
        <div><span className="u-fig-k">Conversations</span><b className="u-num">{stats?.conversations ?? 0}</b></div>
        <div><span className="u-fig-k">Meetings</span><b className="u-num" >{stats?.meetings ?? 0}</b></div>
        <div><span className="u-fig-k">Left in list</span><b className="u-num">{queue.length}</b></div>
        {session && (() => { const mins = Math.max(1, Math.round((clock.getTime() - session.start) / 60000)); return <div><span className="u-fig-k">This session</span><b className="u-num">{session.dials}<small> in {mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}</small></b><span className="dl-pace">{mins >= 10 ? `${Math.round(session.dials / (mins / 60))}/hr pace` : "pace after 10 min"}</span></div>; })()}
      </div>
      <div className="u-head-actions">
        {unaudited > 0 && <button className="u-btn" disabled={!!auditing} onClick={() => void auditRest()}>
          {auditing ? `Researching ${auditing.done}/${auditing.total}${auditing.current ? `, ${auditing.current}` : ""}` : `Research the next ${Math.min(10, unaudited)}`}</button>}
        <button className="u-btn u-btn-bare" aria-pressed={autoDial} title="After no answer, voicemail, gatekeeper, wrong number or a quick no, the next call opens by itself" onClick={toggleAuto}>Auto-dial {autoDial ? "on" : "off"}</button>
        <button className="u-btn u-btn-bare" aria-pressed={newOnly} title="Show only people you have never called" onClick={() => setNewOnly(v => { const n = !v; try { localStorage.setItem("cinder.newonly", n ? "on" : "off"); } catch { /* fine */ } return n; })}>{newOnly ? "New only" : "Everyone"}</button>
        <button className="u-btn u-btn-bare" onClick={() => void load()}>Refresh list</button>
      </div>
    </div>

    {ready && countdown === null && contact && <div className="dl-auto" role="status">
      <span>Next call: <b>{contact.company || contact.name}</b>. Press <kbd>Enter</kbd> to call.</span>
      {/* A real link: Safari only lets a page start a call from a link or button the user activates. Enter on the focused link counts. */}
      <a ref={readyLink} className="u-btn u-btn-light" href={"tel:" + (contact.phone || "").replace(/[^+\d]/g, "")} onClick={() => noteLaunch()}>Call now</a>
      <button type="button" className="u-btn u-btn-bare" onClick={() => setReady(false)}>Not now (Esc)</button>
    </div>}

    {countdown !== null && contact && <div className="dl-auto" role="status">
      <span>Calling <b>{contact.company || contact.name}</b> in {countdown}…</span>
      <button type="button" className="u-btn u-btn-light" onClick={() => dial()}>Call now</button>
      <button type="button" className="u-btn u-btn-bare" onClick={() => setCountdown(null)}>Stop (Esc)</button>
    </div>}

    {(flash || draft || textCtx) && <div className="dl-after">
      {flash && <p className={"u-flash" + (flash.ok ? "" : " is-bad")} role="status">{flash.text}</p>}
      {flash?.deal && <SuggestedDeal key={flash.text} deal={flash.deal} />}
      {draft && <div className="u-sheet u-sheet-pad">
        <div className="u-h2-row"><h2 className="u-h2">{draft.title}</h2><span className="u-note">Copy it and send it from your phone.</span></div>
        {draft.subject && <p className="u-note" style={{ marginBottom: 8 }}>Subject: {draft.subject}</p>}
        <textarea className="u-field" rows={draft.channel === "email" ? 7 : 4} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} aria-label="Message draft" />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" className="u-btn u-btn-light" onClick={() => void copyDraft()}>{copied ? "Copied" : "Copy"}</button>
          <button type="button" className="u-btn" onClick={() => void markSent()}>Mark as sent</button>
          <button type="button" className="u-btn u-btn-bare" onClick={() => setDraft(null)}>Dismiss</button>
        </div>
      </div>}
      {mailAfter && <CallEmail key={mailAfter.id} who={mailAfter} ws={wsp} gmail={gmail} onClose={() => setMailAfter(null)} />}
      {textCtx && <TextDraft key={textCtx.contactId + textCtx.ctx.callAt} ctx={textCtx.ctx} contactId={textCtx.contactId} who={textCtx.who} primaryClass="u-btn u-btn-light" quietClass="u-btn" />}
    </div>}

    <div className="dl-grid">
      <aside className="dl-rail" aria-label="Call list">
        <div className="dl-find">
          <input className="u-field" type="search" inputMode="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Calling back? Name, company or number" aria-label="Find a contact by name, company or phone number" />
          {search.trim().length >= 2 && <div className="dl-find-list" role="listbox">
            {matches.length ? matches.map(c => <button type="button" key={c.id} className="u-row" onClick={() => pick(c.id)}>
              <div className="u-row-main"><strong>{c.company || c.name}</strong><span>{[c.company ? c.name : "", c.phone].filter(Boolean).join(" · ")}</span></div>
            </button>) : <p className="u-note" style={{ padding: 12 }}>No contact matches “{search.trim()}”.</p>}
          </div>}
        </div>
        <div className="dl-list">
          {queue.map((q, i) => <button type="button" key={q.id} className={"dl-q" + (i === index && !picked ? " is-on" : "")} onClick={() => { setPicked(null); setIndex(i); }}>
            <span className="dl-q-n u-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="dl-q-main"><b>{q.contact?.company || q.contact?.name}</b><small>{q.group === "prospects" ? "New" : q.status === "overdue" ? "Overdue follow-up" : "Follow-up"}{/Audit:/.test(q.why) ? " · researched" : ""}</small></span>
          </button>)}
          {queue.length === 0 && <p className="u-note" style={{ padding: "8px 4px" }}>The list is empty.</p>}
        </div>
        {logged.length > 0 && <div className="dl-logged"><span className="u-fig-k">Logged this session</span>{logged.slice(0, 8).map((l, i) => <div key={i}><span>{l.name}</span><small>{l.outcome}</small></div>)}</div>}
      </aside>

      {!contact ? <section className="dl-main"><div className="u-void">
        <h2>That&apos;s the whole list</h2>
        <p>{logged.length ? `${logged.length} call${logged.length === 1 ? "" : "s"} logged. ` : ""}Import more prospects or research the ones you have so tomorrow starts full.</p>
        <div style={{ display: "flex", gap: 8 }}><Link className="u-btn u-btn-light" href="/crm">Open contacts</Link><Link className="u-btn" href="/crm/audit">Research a business</Link></div>
      </div></section> : <section className="dl-main">
        <div className="dl-who">
          <div className="dl-who-l">
            <p className="dl-pos">{picked ? "Callback" : `${index + 1} of ${queue.length} · ${item?.group === "prospects" ? "New prospect" : item?.status === "overdue" ? "Overdue follow-up" : "Follow-up"}`}{picked && <button type="button" className="u-btn u-btn-bare" style={{ height: 24, marginLeft: 8 }} onClick={() => setPicked(null)}>Back to my list</button>}</p>
            <h1 className="dl-name">{who}</h1>
            <div className="dl-meta">
              {contact.name && contact.name !== contact.company && <span>{contact.name}</span>}
              {contact.location && cityOf(contact.location) && <span>{contact.location}</span>}
              {lt && <span className={"dl-local is-" + lt.window} title={lt.window === "good" ? "Good time: owners are usually off the job" : lt.window === "late" ? "Too early or too late to call" : "During the work day"}><i aria-hidden="true" />{lt.time} their time</span>}
              {contact.website && <a href={/^https?:/.test(contact.website) ? contact.website : "https://" + contact.website} target="_blank" rel="noreferrer">Website</a>}
              <Link href={`/crm?contact=${contact.id}`}>Open record</Link>
            </div>
          </div>
          <div className="dl-dial">
            <span className="dl-phone u-num">{contact.phone}</span>
            <a className="u-btn u-btn-go u-btn-lg dl-call-link" href={"tel:" + (contact.phone || "").replace(/[^+\d]/g, "")} onClick={() => noteLaunch()}>Call <kbd>C</kbd></a>
            {contact.phone && <a className="u-btn u-btn-light dl-demo-text" href={smsHref(contact.phone, demoText({ firstName: playFirst, company: contact.company, niche: track === "detailing" ? "detailing" : nicheFor(contact.company, contact.notes, contact.niche), settingsLink: wsp.demoLink }).body)} title="Opens Messages with the demo clip filled in" onClick={e => { const body = decodeURIComponent((e.currentTarget.getAttribute("href") ?? "").split("body=")[1] ?? ""); void fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: contact.id, direction: "outbound", body }) }).catch(() => {}); }}>Text the demo <kbd>D</kbd></a>}
          </div>
        </div>

        <div className="dl-history">
          <span><b>Last touch</b>{last}</span>
          {!!contact.attempts && <span><b>No-answer tries</b>{contact.attempts} of {ATTEMPT_LIMIT}</span>}
          {!picked && item && <span><b>Why now</b>{item.why}</span>}
        </div>
        {(() => {
          const note = contact.lastNote ?? "";
          if (contact.lastTouchOutcome === "gatekeeper" || /Gatekeeper answered/i.test(note)) {
            const grab = (k: string) => note.match(new RegExp(k + ":\\s*([^.\\n]+)", "i"))?.[1]?.trim() ?? "";
            const who = grab("Gatekeeper answered"), ask = grab("Ask for") || grab("Name"), direct = grab("Direct line"), best = grab("Best time") || grab("Best time to reach the owner");
            return <div className="dl-gk">
              <div><b>Gatekeeper last time{who ? `: ${who}` : ""}.</b> {ask ? <>Ask for <b>{ask}</b>{best ? <>, best {best.replace(/^(at|around)\s+/i, "")}</> : ""}.</> : best ? <>Best time: {best}.</> : "Ask for the owner by name."}</div>
              {direct && <button type="button" className="u-btn u-btn-light" onClick={() => dial(direct)}>Call direct line {direct}</button>}
            </div>;
          }
          return note ? <p className="dl-lastnote">{note}</p> : null;
        })()}

        {(() => {
          const f = (line: string) => fillLine(line, track, playFirst);
          const ob = play.objections.find(o => o.id === say);
          const extra = [["voicemail", "Voicemail"], ["gatekeeper", "Gatekeeper"]] as const;
          return <div className="dl-open dl-play" aria-label="What to say">
            {say === null ? <>
              <div><span>Open</span><p>{f(play.open)}</p></div>
              <div><span>Pain</span>{f(play.pitch).split(" ... (let them talk, then) ").map((part, i) => <p key={i}>{i > 0 && <em style={{ display: "block", opacity: 0.6, fontSize: "0.85em" }}>Let them talk.</em>}{part}</p>)}</div>
              <div><span>Ask</span><p>{f(CLOSE)} <button type="button" className="dl-more" onClick={() => setSay("close")}>Guarantee</button></p></div>
              <div><span>After they book</span><p className="dl-dig">{play.dig.map((q, i) => <span key={i}><i>{i + 1}</i>{f(q)} </span>)}</p></div>
            </> : <div className="dl-say" role="status">
              <span>{ob ? "Say" : say === "close" ? "Close" : say === "voicemail" ? "Voicemail" : "Gatekeeper"}</span>
              <div>
              {ob && <p className="dl-say-h">If they say “{ob.label}”</p>}
              {ob ? <>
                <p>{f(ob.say)}</p>
                {ob.then && !/^then the close\.?$/i.test(ob.then.trim()) && <p className="dl-then">{f(ob.then)}</p>}
                {ob.then && /the close/i.test(ob.then) && <p className="dl-then"><b>Then close:</b> {f(CLOSE)}</p>}
              </> : say === "close" ? <>
                <p className="dl-then"><b>Guarantee:</b> {f(play.guarantee)}</p>
                <p>{f(CLOSE)}</p>
              </> : say === "voicemail" ? <p>{f(VOICEMAIL[track])}</p> : say === "gatekeeper" ? <p>{f(GATEKEEPER)}</p> : null}
              <button type="button" className="dl-say-x" onClick={() => setSay(null)}>Back to script <kbd>Esc</kbd></button>
              </div>
            </div>}
            <div className="dl-ifs" role="group" aria-label="If they say">
              <div>
                <span className="dl-ifs-k">If they say</span>
                {play.objections.map(o => <button type="button" key={o.id} className="dl-if" aria-pressed={say === o.id} onClick={() => setSay(s => (s === o.id ? null : o.id))}>{o.label}<kbd>{o.key}</kbd></button>)}
                <i className="dl-if-sep" aria-hidden="true" />
                {extra.map(([id, label]) => <button type="button" key={id} className="dl-if" aria-pressed={say === id} onClick={() => setSay(s => (s === id ? null : id))}>{label}</button>)}
              </div>
            </div>
          </div>;
        })()}

        <div className="dl-brief">
          {audit === undefined ? <p className="u-note">Loading research…</p> : brief ? <>
            {brief.verdict && <p className="dl-verdict">{clean(brief.verdict)}</p>}
            <div className="dl-cols">
              {brief.plan && <Block title="How to run the call" text={brief.plan} />}
              {brief.opps && <Block title="Where they're losing jobs" text={brief.opps} />}
              {brief.flags && <Block title="Watch out for" text={brief.flags} />}
            </div>
            <div className="dl-brief-foot">
              <span>Pitch <b>{offer.label}</b>, ${offer.setupFee.toLocaleString()} setup + ${offer.monthlyFee.toLocaleString()}/mo{founding && founding.left > 0 ? ` · ${founding.left} founding spot${founding.left === 1 ? "" : "s"} left` : ""}</span>
              <span title="Written by AI from public web research. Check anything important before you rely on it.">AI research, verify before quoting</span>
              <Link href={`/crm/audits/${audit!.id}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Full report</Link>
            </div>
          </> : <div className="dl-noaudit">
            <p>No research on {who} yet. Know their gaps before you dial.</p>
            <Link className="u-btn" href={`/crm/audit?contact=${contact.id}`}>Research {who}</Link>
            {contact.notes && <Block title="Notes on file" text={contact.notes} />}
          </div>}
        </div>

        <div className="dl-dock">
          <textarea className="u-field" rows={1} value={notes} onChange={e => setNotes(e.target.value)} aria-label="Call notes, saved with the outcome" placeholder="Notes, saved with the outcome: who you spoke to, what they said, best time to call back" />
          <div className="dl-outs">
            {CALL_MODE_GROUPS.filter(g => g.label !== "Remove").map((g, gi) => <div key={g.label} role="group" aria-label={g.label}>
              {gi > 0 && <span className="dl-sep" aria-hidden="true" />}
              {g.outcomes.map(o => <button type="button" key={o} disabled={busy} title={g.label}
                className={"dl-out" + (o === "meeting_booked" ? " is-win" : "")}
                onClick={() => pickOutcome(o)}>{OUTCOME_LABELS[o]}{KEYS[o] && <kbd>{KEYS[o]}</kbd>}</button>)}
            </div>)}
          </div>
          <form className="dl-mail" onSubmit={e => { e.preventDefault(); void sendInfoMail(); }}>
            <label className="u-note" htmlFor="dl-mail-to">Got their email? Send the info email from your Gmail:</label>
            <div className="dl-mail-row">
              <input id="dl-mail-to" className="u-field" type="email" placeholder="owner@theircompany.com" value={mail.to} onChange={e => setMail({ ...mail, to: e.target.value, msg: null })} />
              <select className="u-field" aria-label="Which email" value={mail.style} onChange={e => setMail({ ...mail, style: e.target.value as "info_email" | "info_email_time", msg: null })}>
                {INFO_EMAIL_STYLES.map(o => <option key={o.kind} value={o.kind}>{o.label}</option>)}
              </select>
              <button type="submit" className="u-btn u-btn-light" disabled={mail.busy || !mail.to.trim()}>{mail.busy ? "Sending…" : "Send email"}</button>
            </div>
            {mail.msg && <p className={"u-flash" + (mail.msg.ok ? "" : " is-bad")} role="status">{mail.msg.text}</p>}
          </form>
          <div className="dl-nav">
            <span className="u-note">Keys: <kbd>C</kbd> call, <kbd>1</kbd>–<kbd>0</kbd> outcome, <kbd>←</kbd> <kbd>→</kbd> move</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="u-btn u-btn-bare" disabled={busy} onClick={() => void log("do_not_contact")}>Do not contact</button>
              <button type="button" className="u-btn u-btn-bare" disabled={index === 0 || !!picked} onClick={() => setIndex(i => Math.max(0, i - 1))}>Previous</button>
              <button type="button" className="u-btn" disabled={index >= queue.length - 1 || !!picked} onClick={() => setIndex(i => i + 1)}>Skip</button>
            </div>
          </div>
        </div>
      </section>}
    </div>

    {dialog && <div className="u-scrim" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(null); }}>
      <div className="u-dialog" role="dialog" aria-modal="true" aria-labelledby="dl-dialog-title">
        <h3 id="dl-dialog-title">{dialog === "meeting" ? `Book a meeting with ${who}` : dialog === "gatekeeper" ? "Who picked up?" : dialog === "info" ? `Send ${who} info` : `When should you call ${who} back?`}</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {dialog === "gatekeeper" ? <>
            <label className="u-lab">Who picked up<input className="u-field" value={gk.name} onChange={e => setGk({ ...gk, name: e.target.value })} placeholder="Lisa at the front desk" autoFocus /></label>
            <label className="u-lab">Who to ask for next time<input className="u-field" value={gk.owner} onChange={e => setGk({ ...gk, owner: e.target.value })} placeholder="Mark, the owner" /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="u-lab">Their cell or direct line<input className="u-field" type="tel" value={gk.direct} onChange={e => setGk({ ...gk, direct: e.target.value })} placeholder="If they gave it" /></label>
              <label className="u-lab">Best time to catch them<input className="u-field" value={gk.best} onChange={e => setGk({ ...gk, best: e.target.value })} placeholder="Before 8am" /></label>
            </div>
          </> : dialog === "info" ? <>
            <label className="u-lab">Send it by<select className="u-field" value={info.channel} onChange={e => setInfo({ ...info, channel: e.target.value as "text" | "dm" | "email" })}><option value="text">Text</option><option value="dm">Facebook DM</option><option value="email">Email</option></select></label>
            {info.channel === "email" && <label className="u-lab">Which email<select className="u-field" value={info.style} onChange={e => setInfo({ ...info, style: e.target.value as "info_email" | "info_email_time" })}>{INFO_EMAIL_STYLES.map(o => <option key={o.kind} value={o.kind}>{o.label}{o.kind === "info_email_time" ? " (for owners who are slammed)" : " (for owners with room)"}</option>)}</select></label>}
            <label className="u-lab">Their problem, starting with “you” (optional)<input className="u-field" value={info.pain} onChange={e => setInfo({ ...info, pain: e.target.value })} placeholder="you miss calls when the crew's out" autoFocus /></label>
          </> : <div style={{ display: "grid", gridTemplateColumns: dialog === "meeting" ? "1.3fr 1fr 1fr" : "1fr", gap: 10 }}>
            <label className="u-lab">Date<input className="u-field" type="date" value={when.date} onChange={e => setWhen({ ...when, date: e.target.value })} /></label>
            {dialog === "meeting" && <>
              <label className="u-lab">Time<input className="u-field" type="time" value={when.time} onChange={e => setWhen({ ...when, time: e.target.value })} /></label>
              <label className="u-lab">Length<select className="u-field" value={when.minutes} onChange={e => setWhen({ ...when, minutes: e.target.value })}><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label>
            </>}
          </div>}
        </div>
        <p className="u-note" style={{ marginTop: 14, lineHeight: 1.55 }}>{dialog === "meeting" ? "Adds it to your calendar, logs Meeting booked and moves any open deal forward. Send the invite yourself." : dialog === "gatekeeper" ? "Next time they come up, Call mode tells you who to ask for and when, and lets you dial the direct line instead of the front desk." : dialog === "info" ? "Logs Send info and writes a message for you to send from your phone. They come back tomorrow for a follow-up." : "Logs Callback requested and puts them back in your list that day."}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" className="u-btn" onClick={() => setDialog(null)}>Cancel</button>
          <button type="button" className="u-btn u-btn-light" disabled={busy || ((dialog === "meeting" || dialog === "callback") && !when.date)} onClick={() => {
            if (dialog === "meeting") void bookMeeting();
            else if (dialog === "gatekeeper") { setDialog(null); void log("gatekeeper", {}, [gk.name.trim() ? `Gatekeeper answered: ${gk.name.trim()}` : "Gatekeeper answered", gk.owner.trim() && `Ask for: ${gk.owner.trim()}`, gk.direct.trim() && `Direct line: ${gk.direct.trim()}`, gk.best.trim() && `Best time: ${gk.best.trim()}`].filter(Boolean).join(". ") + "."); }
            else if (dialog === "info") { setDialog(null); void log("send_info", {}, `Asked for info by ${CHANNEL_LABEL[info.channel].toLowerCase()}.${info.pain.trim() ? ` Their problem: ${info.pain.trim()}` : ""}`); }
            else { setDialog(null); void log("callback_requested", { followUpDate: when.date }); }
          }}>{busy ? "Saving…" : dialog === "meeting" ? "Book meeting" : dialog === "gatekeeper" ? "Save" : dialog === "info" ? "Log and write the message" : "Set callback"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

function clean(text: string) { return text.replace(/\*\*/g, "").replace(/^[-*•]\s+/gm, ""); }

function Block({ title, text }: { title: string; text: string }) {
  const lines = text.split("\n").map(l => l.replace(/\*\*/g, "").trim()).filter(Boolean);
  return <div className="dl-col"><h2 className="u-h2">{title}</h2><ul>{lines.map((l, i) => <li key={i}>{l.replace(/^[-*•]\s+|^\d+[.)]\s+/, "")}</li>)}</ul></div>;
}
