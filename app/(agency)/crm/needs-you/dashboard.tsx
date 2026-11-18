"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { STAGE_LABELS, type DealStage } from "@/lib/offers";
import { MOVE_OUT_MRR, WEEKLY_MEETING_TARGET, DAILY_EMAIL_TARGET, DAILY_LINKEDIN_TARGET } from "@/lib/scoreboard";
import { Logo } from "../../ui/logo";
import { DraftCard } from "../../ui/parts";
import type { QueueItem } from "@/lib/my-day";
import { dueFollowUps } from "@/lib/email-outreach";
import { INBOX_URL, CHANNEL_LABEL } from "@/lib/inbox-links";
import { timeZoneFor, timeZoneForPhone } from "@/lib/local-time";
import { confirmText, meetingNudge, meetingWhen, reminderText, resolveTimeZone, smsHref, infoText, infoFollowUpText, pickDemoLink, nicheFor, loomText, loomPoints, referralText, hiringText } from "@/lib/sms-templates";
import { useWorkspace } from "../../use-workspace";
import "./dashboard.css";

type Board = {
  today: { calls: number; connects: number; meetings: number };
  week: { calls: number; connects: number; meetings: number; meetingsHeld: number };
  month: { calls: number; connects: number; meetingsBooked: number; meetingsHeld: number; proposalsSent: number; won: number; lost: number };
  rates: { connectRate: number | null; meetingRate: number | null; showRate: number | null; closeRate: number | null };
  allTime: { won: number; lost: number; closeRate: number | null };
  days: { date: string; calls: number; connects: number; meetings: number }[];
  streak: number;
  pipeline: { stage: string; deals: number; setup: number; monthly: number }[];
  recurring: { clients: number; mrr: number };
  targets?: { goalLabel: string; dailyCalls: number };
  sources?: { rows: { channel: string; label: string; deals: number; meetings: number; won: number; wonMonthly: number; meetingRate: number | null; closeRate: number | null }[]; best: { label: string; meetingRate: number | null } | null; unknownShare: number };
  channels?: Record<"today" | "week", { emails: number; replies: number; bounces: number; liRequests: number; liAccepted: number; liMessages: number; texts: number; textReplies: number }>;
  working?: Record<"trades" | "cities", { label: string; dials: number; convos: number; meetings: number }[]>;
  goal: { goal: number; by?: string; collected: number; expected: number; gapAfterExpected: number; daysLeft: number; progressPct: number; withExpectedPct: number; perDeal: { label: string; valueByGoal: number; dealsNeeded: number | null }[] };
};
type Ev = { id: string; title: string; startsAt: string; endsAt: string; allDay: boolean; type: string; status: string; contactId: string | null; dealId: string | null; contactName: string; contactFirst?: string; contactCompany?: string; contactPhone?: string; contactTimeZone?: string; contactLocation?: string };
type Referral = { dealId: string; title: string; id: string; firstName: string; company: string; phone: string; wonAt: string | null };
type Warm = { id: string; firstName: string; company: string; phone: string; website?: string; niche: string; location?: string; callNote?: string; outcome: string; at: string | null; infoSentAt: string | null; repliedAt: string | null; tasks: { id: string; title: string; due: string | null; day: number }[] };
type Todo = { key: string; title: string; why: string; overdue: boolean; href: string; action: string; onClick?: () => void; alt?: { label: string; onClick: () => void }; name?: string; website?: string; body?: string; contactId?: string };
type Alert = { level: "urgent" | "soon" | "info"; kind: string; text: string; href: string };

const usd = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-US");
const pct = (n: number | null) => (n == null ? "—" : n + "%");
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Dashboard: where you stand against your targets, what's next today, and how the funnel converts. Read-only. */
export default function Dashboard() {
  const ws = useWorkspace();
  const [b, setB] = useState<Board | null>(null);
  const [err, setErr] = useState("");
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [todo, setTodo] = useState<Todo[] | null>(null);
  const [allTodo, setAllTodo] = useState(false);
  const [warm, setWarm] = useState<Warm[] | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [hiring, setHiring] = useState<{ id: string; firstName: string; company: string; phone: string; niche: string; website: string; role: string; hasEmail: boolean; emailed: boolean }[]>([]);
  const [loom, setLoom] = useState<{ w: Warm; taskId?: string; key: string; url: string } | null>(null);
  const [doneKeys, setDoneKeys] = useState<Record<string, true>>({});
  const [dms, setDms] = useState<{ id: string; channel: "instagram" | "facebook"; from: string; body: string; at: string }[]>([]);
  const [content, setContent] = useState<{ key: string; channel: string; at: string }[] | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [ask, setAsk] = useState("");
  const [dbrief, setDbrief] = useState<{ text: string; calls: { contactId: string; reason: string }[]; generatedAt: string } | null | undefined>(undefined);
  const [grok, setGrok] = useState<{ briefs: { id: string; contactId: string | null; type: string; who: string; at: string }[]; drafts: number; runs: { agent: string; task: string; status: string; summary: string; at: string | null }[] } | null>(null);
  useEffect(() => { fetch("/api/agent-activity", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => setGrok(d && Array.isArray(d.briefs) ? d : null)).catch(() => {}); }, []);
  const [radar, setRadar] = useState<{ id: string; contactId: string; reason: string; body: string; company: string; firstName: string; phone: string; website: string; channel?: string; subject?: string; author?: string; email?: string }[]>([]);
  const [writing, setWriting] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const now = new Date();
    fetch(`/api/scoreboard?today=${localDay(now)}&tz=${now.getTimezoneOffset()}`, { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see your numbers." : j.error || "Couldn't load your numbers."); setB(j); })
      .catch(e => setErr(e instanceof Error ? e.message : "Couldn't load your numbers."));
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 2);
    // The route requires from/to (YYYY-MM-DD) as well as fromAt/toAt, or it 400s and no meetings show.
    fetch(`/api/calendar-events?from=${localDay(start)}&to=${localDay(end)}&fromAt=${encodeURIComponent(start.toISOString())}&toAt=${encodeURIComponent(end.toISOString())}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : { events: [] })).then(d => setEvents((d.events ?? []).filter((e: Ev) => e.status !== "cancelled")))
      .catch(() => setEvents([]));
    fetch("/api/inbox", { cache: "no-store" }).then(r => (r.ok ? r.json() : { messages: [] })).then(d => setDms(d.messages ?? [])).catch(() => {});
    // Content log: only used to nudge today's page post. No row if it fails (e.g. table not migrated yet).
    fetch("/api/content", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => setContent(Array.isArray(d?.posted) ? d.posted : null)).catch(() => {});
    fetch("/api/follow-ups", { cache: "no-store" }).then(r => (r.ok ? r.json() : { leads: [] })).then(d => { setWarm(d.leads ?? []); setReferrals(d.referrals ?? []); setHiring(d.hiring ?? []); }).catch(() => setWarm([]));
    // Your manual follow-ups: email, LinkedIn and texts only. Calls (callbacks, redials) live in Call mode.
    Promise.all([
      fetch("/api/email-outreach", { cache: "no-store" }).then(r => (r.ok ? r.json() : { sent: [], heard: [] })).catch(() => ({ sent: [], heard: [] })),
      fetch("/api/linkedin-outreach", { cache: "no-store" }).then(r => (r.ok ? r.json() : { log: [] })).catch(() => ({ log: [] })),
      fetch("/api/gmail/inbox", { cache: "no-store" }).then(r => (r.ok ? r.json() : { mail: [] })).catch(() => ({ mail: [] })),
    ]).then(([e, l, ib]) => {
      const replies = (e.heard ?? []).filter((h: { kind: string; at: string }) => h.kind === "reply" && Date.now() - Date.parse(h.at) < 3 * 86400000).length;
      const due = dueFollowUps(e.sent ?? [], e.heard ?? []);
      const steps = new Map<string, { s: Set<string>; at: number }>();
      for (const x of (l.log ?? []) as { contactId: string; step: string; at: string }[]) {
        const m = steps.get(x.contactId) ?? { s: new Set<string>(), at: 0 };
        m.s.add(x.step); if (x.step === "connect") m.at = Math.max(m.at, Date.parse(x.at)); steps.set(x.contactId, m);
      }
      const liMsg = [...steps.values()].filter(m => m.s.has("accepted") && !m.s.has("message")).length;
      const liCheck = [...steps.values()].filter(m => m.s.has("connect") && !m.s.has("accepted") && !m.s.has("message") && Date.now() - m.at > 3 * 86400000).length;
      const n = due.follow_up + due.breakup;
      const mail = (ib.mail ?? []) as { category: string; from: string; summary: string }[];
      const hot = mail.filter(m => m.category === "interested" || m.category === "meeting").length;
      setTodo([
        mail.length ? { key: "inbox", title: `${mail.length} email${mail.length === 1 ? "" : "s"} in your inbox need${mail.length === 1 ? "s" : ""} you`, why: `${mail[0].from}${mail[0].summary ? `: ${mail[0].summary}` : ""}`, overdue: hot > 0, href: "/crm/email", action: "Open" } : null,
        replies ? { key: "email-replies", title: `Answer ${replies} email repl${replies === 1 ? "y" : "ies"}`, why: "They wrote back. Their follow-ups stopped.", overdue: true, href: "/crm/email", action: "Open" } : null,
        n ? { key: "email-due", title: `Send ${n} email follow-up${n === 1 ? "" : "s"}`, why: due.breakup ? `${due.breakup} of them ${due.breakup === 1 ? "is a last try" : "are last tries"}` : "3 days since the first email", overdue: false, href: "/crm/email", action: "Open" } : null,
        liMsg ? { key: "li-msg", title: `Message ${liMsg} new LinkedIn connection${liMsg === 1 ? "" : "s"}`, why: "They accepted. Your first message is ready to copy.", overdue: false, href: "/crm/linkedin", action: "Open" } : null,
        liCheck ? { key: "li-check", title: `Check ${liCheck} LinkedIn request${liCheck === 1 ? "" : "s"} for accepts`, why: "Sent 3+ days ago. Mark the ones who accepted.", overdue: false, href: "/crm/linkedin", action: "Open" } : null,
      ].filter(Boolean) as Todo[]);
    });
    {
      const d0 = new Date(), dayEnd = new Date(d0); dayEnd.setHours(23, 59, 59, 999);
      const windowEnd = new Date(dayEnd); windowEnd.setDate(windowEnd.getDate() + 1);
      fetch(`/api/my-day?today=${localDay(d0)}&dayEnd=${encodeURIComponent(dayEnd.toISOString())}&windowEnd=${encodeURIComponent(windowEnd.toISOString())}`, { cache: "no-store" })
        .then(r => (r.ok ? r.json() : { items: [] })).then(d => setQueue(((d.items ?? []) as QueueItem[]).filter(i => i.callable && i.contact).sort((a, b) => a.rank - b.rank))).catch(() => setQueue([]));
    }
    fetch("/api/daily-brief", { cache: "no-store" }).then(r => (r.ok ? r.json() : { brief: null })).then(d => setDbrief(d.brief ?? null)).catch(() => setDbrief(null));
    fetch("/api/follow-up-drafts", { cache: "no-store" }).then(r => (r.ok ? r.json() : { drafts: [] })).then(d => setRadar(d.drafts ?? [])).catch(() => {});
    fetch("/api/ops-alerts", { cache: "no-store" }).then(r => (r.ok ? r.json() : { alerts: [] })).then(d => setAlerts(d.alerts ?? [])).catch(() => {});
    const t = setInterval(() => tick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // C starts calling; Enter sends the first ready text, like the hints on the buttons say.
  const firstDraft = useRef<(() => void) | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input, textarea, select, button, a, [contenteditable='true'], [role='dialog']")) return;
      if (e.key.toLowerCase() === "c") window.location.href = "/crm/call";
      else if (e.key === "Enter" && firstDraft.current) { e.preventDefault(); firstDraft.current(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 5 ? "Late night" : now.getHours() < 12 ? "Morning" : now.getHours() < 18 ? "Afternoon" : "Evening";
  const target = b?.targets?.dailyCalls ?? ws.dailyCallTarget ?? 100;
  const [nudged, setNudged] = useState<Record<string, true>>(() => { try { return JSON.parse(localStorage.getItem("cinder.nudged.v1") || "{}"); } catch { return {}; } });
  function nudge(e: Ev, kind: "confirm" | "remind") {
    if (!e.contactPhone || !e.contactId) return;
    const tz = resolveTimeZone({ timeZone: e.contactTimeZone, location: e.contactLocation, phone: e.contactPhone }, timeZoneFor, timeZoneForPhone);
    const at = meetingWhen(new Date(e.startsAt), new Date(), tz);
    const body = kind === "confirm" ? confirmText({ firstName: e.contactFirst && e.contactFirst !== e.contactCompany ? e.contactFirst : "", when: at, business: ws.businessName }) : reminderText({ firstName: e.contactFirst && e.contactFirst !== e.contactCompany ? e.contactFirst : "", when: at });
    window.location.href = smsHref(e.contactPhone, body);
    void fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: e.contactId, direction: "outbound", body }) }).catch(() => {});
    const next = { ...nudged, [e.id + ":" + kind]: true as const }; setNudged(next);
    try { localStorage.setItem("cinder.nudged.v1", JSON.stringify(next)); } catch { /* fine */ }
  }
  const upcoming = (events ?? []).filter(e => new Date(e.endsAt).getTime() > Date.now()).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
  // Meeting texts (confirm the day before, remind in the last 3 hours) join the follow-up list.
  const meetingTexts: Todo[] = upcoming.flatMap(e => {
    const k = e.contactPhone ? meetingNudge(new Date(e.startsAt), new Date(), null) : null;
    if (!k || nudged[e.id + ":" + k]) return [];
    const who = e.contactName || e.title;
    return [{ key: "text:" + e.id + k, title: k === "confirm" ? `Text ${who} to confirm` : `Text ${who} a reminder`, why: k === "confirm" ? `Confirm ${e.title}` : `Remind before ${e.title}`, overdue: k === "remind", href: "/crm/calendar", action: "Text", name: e.contactCompany || who, onClick: () => nudge(e, k) }];
  });
  // Warm leads: the info text they asked for, then the day 1/2/3/7 follow-up texts. One text per lead per day.
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const short = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "");
  let upcomingTexts = 0;
  const warmTexts: Todo[] = (warm ?? []).flatMap(w => {
    if (w.repliedAt) return [];
    const who = w.company || w.firstName || "this lead";
    const first = w.firstName && w.firstName !== w.company ? w.firstName : "";
    const niche = nicheFor(w.niche, w.company);
    const log = (body: string, taskId?: string, key?: string) => {
      window.location.href = smsHref(w.phone, body);
      void fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: w.id, direction: "outbound", body }) }).catch(() => {});
      if (taskId) void fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, status: "done" }) }).catch(() => {});
      if (key) setDoneKeys(k => ({ ...k, [key]: true }));
    };
    if (!w.infoSentAt) {
      const key = "info:" + w.id;
      if (doneKeys[key]) return [];
      const body = infoText({ firstName: first, demoLink: pickDemoLink(niche, ws.demoLink), niche, company: w.company });
      return [{ key, title: `Send info to ${who}`, why: `Asked for info ${short(w.at)}`, overdue: true, href: `/crm?contact=${w.id}`, action: "Text", name: who, website: w.website, body, contactId: w.id,
        onClick: () => log(body, undefined, key), alt: { label: "Loom", onClick: () => setLoom({ w, key, url: "" }) } }];
    }
    const next = w.tasks[0];
    if (!next || !next.due) return [];
    const textedRecently = Date.now() - Date.parse(w.infoSentAt) < 20 * 3600000;
    if (Date.parse(next.due) > endToday.getTime() || textedRecently) { upcomingTexts++; return []; }
    const key = "fu:" + next.id;
    if (doneKeys[key]) return [];
    const body = infoFollowUpText({ firstName: first, company: w.company, day: next.day, niche });
    return [{ key, title: `Follow up with ${who}`, why: `${next.day === 7 ? "Last" : `Day ${next.day}`} follow-up, info sent ${short(w.infoSentAt)}`, overdue: Date.parse(next.due) < startToday.getTime(), href: `/crm?contact=${w.id}`, action: "Text", name: who, website: w.website, body, contactId: w.id,
      onClick: () => log(body, next.id, key), alt: { label: "Loom", onClick: () => setLoom({ w, taskId: next.id, key, url: "" }) } }];
  });
  // Unread Instagram / Facebook DMs: one row per channel, newest message as the preview.
  const dmRows: Todo[] = (["instagram", "facebook"] as const).flatMap(ch => {
    const m = dms.filter(d => d.channel === ch);
    if (!m.length) return [];
    return [{ key: "dm:" + ch, title: `Reply to ${m.length} ${CHANNEL_LABEL[ch]} DM${m.length === 1 ? "" : "s"}`, why: `${m[0].from || "Someone"}: "${m[0].body.slice(0, 90)}"`, overdue: true, href: INBOX_URL[ch], action: "Open",
      onClick: () => { window.open(INBOX_URL[ch], "_blank", "noopener"); setDms(d => d.filter(x => x.channel !== ch)); void fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch }) }).catch(() => {}); } }];
  });
  const refRows: Todo[] = referrals.flatMap(r => {
    const key = "ref:" + r.dealId;
    if (doneKeys[key]) return [];
    const first = r.firstName && r.firstName !== r.company ? r.firstName : "";
    return [{ key, title: `Ask ${r.company || r.firstName || "your client"} for a referral`, why: `Client since ${short(r.wonAt)}, ask for a referral`, overdue: false, href: `/crm?contact=${r.id}`, action: "Text", name: r.company || r.firstName, body: referralText({ firstName: first }),
      onClick: () => { const body = referralText({ firstName: first }); window.location.href = smsHref(r.phone, body); void fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: r.id, direction: "outbound", body }) }).catch(() => {}); setDoneKeys(k => ({ ...k, [key]: true })); } }];
  });
  // Hiring for the phones: text before the first call (the 6am Autopilot emails them first). Texting moves them to Call mode.
  const hiringRows: Todo[] = hiring.flatMap(h => {
    const key = "hire:" + h.id;
    if (doneKeys[key]) return [];
    const who = h.company || h.firstName || "this company";
    const body = hiringText({ firstName: h.firstName && h.firstName !== h.company ? h.firstName : "", company: h.company, role: h.role });
    const mail = h.emailed ? "emailed" : h.hasEmail ? "email goes out with Autopilot" : "no email found";
    return [{ key, title: `Text ${who} before you call`, why: `Hiring: ${h.role || "receptionist"} · ${mail}`, overdue: h.emailed || !h.hasEmail, href: `/crm?contact=${h.id}`, action: "Text", name: who, website: h.website, body, contactId: h.id,
      onClick: () => { window.location.href = smsHref(h.phone, body); void fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: h.id, direction: "outbound", body }) }).catch(() => {}); setDoneKeys(k => ({ ...k, [key]: true })); } }];
  });
  function sendLoom() {
    if (!loom || !/^https?:\/\/\S+$/.test(loom.url.trim())) return;
    const w = loom.w, first = w.firstName && w.firstName !== w.company ? w.firstName : "";
    const body = loomText({ firstName: first, company: w.company, loomUrl: loom.url });
    window.location.href = smsHref(w.phone, body);
    void fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: w.id, direction: "outbound", body }) }).catch(() => {});
    if (loom.taskId) void fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: loom.taskId, status: "done" }) }).catch(() => {});
    setDoneKeys(k => ({ ...k, [loom.key]: true })); setLoom(null);
  }
  const contentRows: Todo[] = content && !content.some(p => p.channel === "page" && localDay(new Date(p.at)) === localDay())
    ? [{ key: "content:page", title: "Post today's page post", why: "Facebook page and Instagram. It's written, copy it and post.", overdue: false, href: "/crm/content", action: "Open" }] : [];
  const all = [...dmRows, ...warmTexts, ...hiringRows, ...meetingTexts, ...refRows, ...contentRows];
  const list: Todo[] | null = todo === null || warm === null ? null : [...all.filter(t => t.overdue), ...todo.filter(t => t.overdue), ...all.filter(t => !t.overdue), ...todo.filter(t => !t.overdue)];
  const when = (e: Ev) => {
    const s = new Date(e.startsAt), isToday = localDay(s) === localDay();
    const t = e.allDay ? "All day" : s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return { t, day: isToday ? "" : "Tomorrow" };
  };
  const until = (iso: string) => {
    const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
    if (mins <= 0) return "Now";
    if (mins > 24 * 60) return "";
    const h = Math.floor(mins / 60), m = mins % 60;
    return "In " + (h ? `${h}h ` : "") + (m || !h ? `${m}m` : "");
  };

  if (err) return <div className="u-page db-page" role="region" aria-label="Dashboard"><div className="u-void"><h2>{err}</h2></div></div>;

  const g = b?.goal;
  const steps = b ? [
    { k: "Dials", n: b.month.calls, r: null as number | null, of: "" },
    { k: "Conversations", n: b.month.connects, r: b.rates.connectRate, of: "of dials" },
    { k: "Meetings booked", n: b.month.meetingsBooked, r: b.rates.meetingRate, of: "of conversations" },
    { k: "Meetings held", n: b.month.meetingsHeld, r: b.rates.showRate, of: "showed up" },
    { k: "Proposals", n: b.month.proposalsSent, r: null, of: "" },
    { k: "Won", n: b.month.won, r: b.rates.closeRate, of: "close rate" },
  ] : [];
  const openMrr = b?.pipeline.reduce((s, p) => s + p.monthly, 0) ?? 0;
  const byLabel = g?.by ? new Date(g.by + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";

  const left = Math.max(0, target - (b?.today.calls ?? 0));
  const next = upcoming[0];

  const haveText = new Set((list ?? []).map(t => t.contactId).filter(Boolean));
  const radarTodos: Todo[] = radar.filter(r => !haveText.has(r.contactId) && !doneKeys["radar:" + r.id]).map(r => ({
    key: "radar:" + r.id, title: `Follow up with ${r.company || r.firstName}`, why: r.author === "grok" ? `${r.reason} (drafted by Grok, check it first)` : r.reason, overdue: true, href: `/crm?contact=${r.contactId}`, action: r.channel === "email" ? "Email" : "Text",
    name: r.company || r.firstName, website: r.website, body: r.body, contactId: r.contactId,
    onClick: () => {
      if (r.channel === "email") {
        if (r.email) window.location.href = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(r.subject ?? "")}&body=${encodeURIComponent(r.body)}`;
        void fetch("/api/follow-up-drafts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status: "sent" }) }).catch(() => {});
        setDoneKeys(k => ({ ...k, ["radar:" + r.id]: true }));
        return;
      }
      if (r.phone) window.location.href = smsHref(r.phone, r.body);
      void fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: r.contactId, direction: "outbound", body: r.body }) }).catch(() => {});
      void fetch("/api/follow-up-drafts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status: "sent" }) }).catch(() => {});
      setDoneKeys(k => ({ ...k, ["radar:" + r.id]: true }));
    },
  }));
  const skipRadar = (key: string) => { const id = key.slice(6); void fetch("/api/follow-up-drafts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "skipped" }) }).catch(() => {}); };
  const drafts = [...radarTodos, ...(list ?? []).filter(t => t.onClick && !doneKeys[t.key])];
  const waiting = (list ?? []).filter(t => !t.onClick);
  // The written brief picks the order and the reasons; anyone it doesn't mention keeps the queue's order after them.
  const ranked = (() => {
    const q = queue ?? [];
    if (!dbrief?.calls?.length) return [...q];
    const byId = new Map(q.map(i => [i.contact!.id, i]));
    const first = dbrief.calls.map(c => { const i = byId.get(c.contactId); return i ? { ...i, why: c.reason || i.why } : null; }).filter(Boolean) as QueueItem[];
    const seen = new Set(first.map(i => i.contact!.id));
    return [...first, ...q.filter(i => !seen.has(i.contact!.id))];
  })().sort((x, y) => Number(/Audit:\s*No fit/i.test(x.why)) - Number(/Audit:\s*No fit/i.test(y.why)));
  const calls = ranked.slice(0, 6);
  firstDraft.current = drafts[0]?.onClick ?? null;
  const skip = (k: string) => { if (k.startsWith("radar:")) skipRadar(k); setDoneKeys(d => ({ ...d, [k]: true })); };
  const firstCall = calls[0];
  const men = (name: string, href: string, website?: string) => <Link key={href + name} className="td-men" href={href}><Logo name={name} website={website} size={18} />{name}</Link>;
  // [[contactId|Name]] in the written brief becomes a linked company chip.
  const written = dbrief?.text ? dbrief.text.split(/(\[\[[^|\]]+\|[^\]]+\]\])/g).map((part, i) => {
    const m = part.match(/^\[\[([^|\]]+)\|([^\]]+)\]\]$/);
    if (!m) return <span key={i}>{part}</span>;
    const q = (queue ?? []).find(x => x.contact?.id === m[1]);
    return men(m[2], `/crm?contact=${m[1]}`, q?.contact?.website);
  }) : null;
  async function writeNow() {
    setWriting(true);
    try {
      const r = await fetch("/api/daily-brief", { method: "POST" });
      if (r.ok) {
        const [b, f] = await Promise.all([fetch("/api/daily-brief", { cache: "no-store" }).then(x => x.json()), fetch("/api/follow-up-drafts", { cache: "no-store" }).then(x => x.json())]);
        setDbrief(b.brief ?? null); setRadar(f.drafts ?? []);
      }
    } finally { setWriting(false); }
  }
  const replies = waiting.filter(t => t.overdue).length;
  const nameOf = (c: QueueItem["contact"]) => c ? (c.company || c.name) : "";
  const brief: React.ReactNode[] = [];
  if (b) brief.push(b.today.calls >= target ? <span key="d"><b>{target} dials</b> done today. </span> : <span key="d"><b>{b.today.calls} dial{b.today.calls === 1 ? "" : "s"}</b> in, {left} to go. </span>);
  if (next) brief.push(<span key="m">Next up is {men(next.contactCompany || next.contactName || next.title, next.dealId ? `/crm/deals/${next.dealId}` : next.contactId ? `/crm?contact=${next.contactId}` : "/crm/calendar")} {when(next).day ? "tomorrow" : "today"} at {when(next).t}. </span>);
  else if (events) brief.push(<span key="m">No meetings on the books yet, so the calls are the day. </span>);
  if (firstCall) brief.push(<span key="c">Start with {men(nameOf(firstCall.contact), `/crm?contact=${firstCall.contact!.id}`, firstCall.contact!.website)}{firstCall.why ? <>: {firstCall.why.replace(/\.$/, "").charAt(0).toLowerCase() + firstCall.why.replace(/\.$/, "").slice(1)}</> : null}. </span>);
  if (replies) brief.push(<span key="r">{replies} conversation{replies === 1 ? " is" : "s are"} waiting on you. </span>);
  if (drafts.length) brief.push(<span key="t">{drafts.length === 1 ? "One text is" : `${drafts.length} texts are`} written and ready below.</span>);
  const loadingBrief = !b && queue === null;
  const hello = greeting === "Late night" ? "Late night" : `Good ${greeting.toLowerCase()}`;
  const askHref = (q: string) => `/crm/ask?q=${encodeURIComponent(q)}`;
  const shortAgo = (iso: string | null) => { if (!iso) return "—"; const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000); return d <= 0 ? "Today" : d === 1 ? "1d" : d + "d"; };

  return <div className="u-page db-page" role="region" aria-label="Today">
    <div className="u-head">
      <h1 className="u-title">Today<span className="u-dim">{now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span></h1>
      <div className="u-head-actions">
        {upcoming.length > 0 && <Link className="u-btn u-btn-bare td-hide-sm" href="/crm/calendar">{upcoming.length} meeting{upcoming.length === 1 ? "" : "s"}</Link>}
        <Link className="u-btn u-btn-light" href="/crm/call">Start calling <kbd>C</kbd></Link>
      </div>
    </div>

    <div className="td-shell">
      <div className="td-main">
      <h2 className="td-hello">{hello}, {ws.ownerFirstName}</h2>
      <p className="td-brief" aria-live="polite">{written ?? (loadingBrief || dbrief === undefined ? "\u00a0" : brief.length ? brief : "Nothing new overnight. Make the first call and the day starts moving.")}</p>
      <p className="td-brief-meta">{dbrief ? <>Written by Cinder at {new Date(dbrief.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} from your calls, meetings and deals.</> : dbrief === null ? <>Cinder writes this every morning at 5.</> : null}
        {dbrief !== undefined && <button type="button" className="td-rewrite" onClick={writeNow} disabled={writing}>{writing ? "Writing…" : dbrief ? "Rewrite" : "Write it now"}</button>}</p>

      <form className="td-ask" onSubmit={e => { e.preventDefault(); if (ask.trim()) window.location.href = askHref(ask.trim()); }}>
        <input value={ask} onChange={e => setAsk(e.target.value)} placeholder="Ask Cinder or tell it what to do…" aria-label="Ask Cinder" maxLength={500} />
        <div className="td-ask-row">
          <span className="lg-pill" data-tone="grey">Prospects</span><span className="lg-pill" data-tone="grey">Calls</span><span className="lg-pill" data-tone="grey">Deals</span>
          <button type="submit" className="td-ask-send" disabled={!ask.trim()} aria-label="Ask"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg></button>
        </div>
      </form>
      <div className="td-sugg">
        <Link href={askHref("Who should I call first today, and why?")}><svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2 6 6 2-6 2-2 6.5-2-6.5-6-2 6-2 2-6Z" /></svg>Who should I call first?</Link>
        {next ? <Link href={askHref(`Prep me for my meeting with ${next.contactCompany || next.contactName || next.title}.`)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M7.5 3v4M16.5 3v4M4 10h16" /></svg>Prep for {next.contactCompany || next.contactName || "my next meeting"}</Link>
          : <Link href={askHref("Which deals are stuck and what should I do about them?")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 16 10 10l4 4 6-8" /></svg>Which deals are stuck?</Link>}
        <Link href={askHref("Recap my last call and tell me the next step.")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg>Recap my last call</Link>
      </div>

      <section className="td-sec">
        <div className="td-sh">Ready to send{drafts.length > 0 && <span className="ct">{drafts.length}</span>}{upcomingTexts > 0 && <span className="r">{upcomingTexts} more due this week</span>}</div>
        <div className="td-card">
          {list === null ? <p className="td-empty" role="status">Loading…</p> : drafts.length === 0 ? <p className="td-empty">Nothing to send right now. Follow-ups land here, already written, the moment they&apos;re due.</p>
            : (allTodo ? drafts : drafts.slice(0, 5)).map((t, i) => <DraftCard key={t.key} active={i === 0} name={t.name || t.title} website={t.website} why={t.why} body={t.body} href={t.href.startsWith("/") ? t.href : undefined}
                sendLabel="Send" onSend={t.onClick!} onSkip={() => skip(t.key)} />)}
        </div>
        {drafts.length > 5 && <button type="button" className="u-btn u-btn-bare" style={{ marginTop: 8 }} onClick={() => setAllTodo(v => !v)}>{allTodo ? "Show fewer" : `Show all ${drafts.length}`}</button>}
      </section>

      <section className="td-sec">
        <div className="td-sh">Call first{queue && queue.length > 0 && <span className="ct">{queue.length}</span>}<span className="r">In the order Cinder would call them</span></div>
        <div className="td-card">
          {queue === null ? <p className="td-empty" role="status">Loading…</p> : calls.length === 0 ? <p className="td-empty">No one queued. Add prospects and they line up here in order.</p>
            : <table className="td-tbl">
                <thead><tr><th>Company</th><th>Why now</th><th className="num">Last touch</th></tr></thead>
                <tbody>{calls.map(q => <tr key={q.id} onClick={() => { window.location.href = `/crm?contact=${q.contact!.id}`; }}>
                  <td><span className="td-nm"><Logo name={nameOf(q.contact)} website={q.contact!.website} size={20} /><b>{nameOf(q.contact)}</b></span><span className="td-why-sm">{q.why || q.title}</span></td>
                  <td className="why">{q.why || q.title}</td>
                  <td className={"num" + (q.status === "overdue" ? " td-due" : "")}>{q.status === "overdue" ? "Overdue" : shortAgo(q.lastActivity)}</td>
                </tr>)}</tbody>
                <tfoot><tr><td><b>{queue.length}</b>to call</td><td /><td className="num">{left > 0 ? `${left} dials left` : "Target hit"}</td></tr></tfoot>
              </table>}
        </div>
      </section>
      </div>
      <aside className="td-side" aria-label="Today at a glance">
      <section className="td-sec td-side-sec">
        <div className="td-sh">Today</div>
        <div className="td-card td-stats-card">
          <dl className="td-kpis">
            <div><dt>Dials</dt><dd className="u-num">{b ? b.today.calls : "—"}<small> / {target}</small></dd><div className="u-meter td-kpi-meter"><i style={{ width: Math.min(100, ((b?.today.calls ?? 0) / Math.max(1, target)) * 100) + "%" }} /></div></div>
            <div><dt>Conversations</dt><dd className="u-num">{b ? b.today.connects : "—"}</dd></div>
            <div><dt>Meetings this week</dt><dd className="u-num">{b ? b.week.meetings : "—"}<small> / {WEEKLY_MEETING_TARGET}</small></dd></div>
            <div><dt>Streak</dt><dd className="u-num">{b ? b.streak : "—"}<small> days</small></dd></div>
          </dl>
        </div>
      </section>
      {waiting.length > 0 && <section className="td-sec td-side-sec">
        <div className="td-sh">Waiting on you<span className="ct">{waiting.length}</span></div>
        <div className="td-card">{waiting.map(t => <Link key={t.key} className="td-mt" href={t.href} target={t.href.startsWith("http") ? "_blank" : undefined}>
          <span className="dot" style={{ background: t.overdue ? "#F2431D" : "#b5bdc9" }} /><b>{t.title}</b>{t.why && <span className="what">{t.why}</span>}<span className="t">{t.action}</span>
        </Link>)}</div>
      </section>}

      <section className="td-sec td-side-sec">
        <div className="td-sh">Meetings{upcoming.length > 0 && <span className="ct">{upcoming.length}</span>}<span className="r"><Link href="/crm/calendar" style={{ color: "inherit" }}>Calendar</Link></span></div>
        <div className="td-card">
          {events === null ? <p className="td-empty">Loading…</p> : upcoming.length === 0 ? <p className="td-empty">Nothing booked today or tomorrow. Meetings come from dials.</p>
            : upcoming.slice(0, 5).map((e, i) => { const k = e.contactPhone ? meetingNudge(new Date(e.startsAt), new Date(), null) : null; const done = k && nudged[e.id + ":" + k]; const who = e.contactCompany || e.contactName || e.title;
              return <div key={e.id} className="td-mt">
                <span className="dot" style={{ background: i === 0 ? "#16a34a" : "#e3a008" }} />
                <Logo name={who} size={20} />
                <Link href={e.dealId ? `/crm/deals/${e.dealId}` : e.contactId ? `/crm?contact=${e.contactId}` : "/crm/calendar"} style={{ minWidth: 0, display: "flex", gap: 10, color: "inherit" }}><b>{who}</b><span className="what">{e.title !== who ? e.title : ""}</span></Link>
                <span className="t">{when(e).day ? "Tomorrow, " : i === 0 && until(e.startsAt) ? until(e.startsAt) + " · " : ""}{when(e).t}</span>
                {k && <button type="button" className={"u-btn" + (done ? " u-btn-bare" : "")} onClick={() => nudge(e, k)}>{done ? "Sent" : k === "confirm" ? "Confirm" : "Remind"}</button>}
              </div>; })}
        </div>
      </section>

      {grok && (grok.briefs.length > 0 || grok.runs.length > 0 || grok.drafts > 0) && <section className="td-sec td-side-sec" aria-label="Grok, last 24 hours">
        <div className="td-sh">Grok<span className="ct">{grok.briefs.length}</span><span className="r">{grok.drafts > 0 ? `${grok.drafts} draft${grok.drafts === 1 ? "" : "s"} to check` : "last 24 hours"}</span></div>
        <div className="td-card">
          {grok.runs.map((r, i) => <div key={"r" + i} className="td-mt">
            <span className="dot" style={{ background: r.status === "failed" ? "#F2431D" : "#b5bdc9" }} /><b>{r.agent}</b><span className="what">{r.summary || r.task}</span>
            <span className="t">{r.at ? new Date(r.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}</span>
          </div>)}
          {grok.briefs.slice(0, 8).map(b => <Link key={b.id} className="td-mt" href={b.contactId ? `/crm/call?contact=${b.contactId}` : "/crm"}>
            <span className="dot" style={{ background: "#b5bdc9" }} /><b>{b.who || "A prospect"}</b><span className="what">{b.type === "meeting_brief" ? "Meeting brief" : "Researched"}</span>
          </Link>)}
          {grok.briefs.length > 8 && <p className="td-empty">and {grok.briefs.length - 8} more on the call screen</p>}
        </div>
      </section>}

      </aside>
    </div>

    <div className="td-numbers">
    <section className="u-block cp-month-wrap">
      <div className="u-h2-row"><h2 className="u-h2">This month</h2></div>
    <div className="u-figs cp-month">
      <Link href="/crm/scoreboard" className="u-fig"><span className="u-fig-k">Dials this week</span><div className="u-fig-v">{b ? b.week.calls : "—"}<small>/ {target * 5}</small></div><div className="u-meter"><i style={{ width: Math.min(100, ((b?.week.calls ?? 0) / Math.max(1, target * 5)) * 100) + "%" }} /></div><div className="u-fig-sub">{b ? <><b>{b.week.connects}</b> conversations, <b>{b.week.meetings}</b> meeting{b.week.meetings === 1 ? "" : "s"}</> : ""}</div></Link>
      <Link href="/crm/finance" className="u-fig"><span className="u-fig-k">Monthly recurring</span><div className="u-fig-v">{b ? usd(b.recurring.mrr) : "—"}<small>/mo</small></div><div className="u-meter"><i style={{ width: Math.min(100, ((b?.recurring.mrr ?? 0) / MOVE_OUT_MRR) * 100) + "%" }} /></div><div className="u-fig-sub">{b ? <><b>{usd(Math.max(0, MOVE_OUT_MRR - b.recurring.mrr))}</b> short of {usd(MOVE_OUT_MRR)}, {b.recurring.clients} client{b.recurring.clients === 1 ? "" : "s"}</> : ""}</div></Link>
      <Link href="/crm/finance" className="u-fig"><span className="u-fig-k">{b?.targets?.goalLabel ?? "Revenue goal"}</span><div className="u-fig-v">{g ? usd(g.collected) : "—"}</div><div className="u-meter"><i style={{ width: (g?.progressPct ?? 0) + "%" }} /></div><div className="u-fig-sub">{g ? <><b>{g.daysLeft}</b> days left, {usd(g.goal)} goal</> : ""}</div></Link>
    </div>

    </section>

    <section className="u-block">
      <div className="u-h2-row"><h2 className="u-h2">Funnel, last 30 days</h2><span className="u-note">All-time close rate {pct(b?.allTime.closeRate ?? null)}</span></div>
      <div className="db-funnel">{steps.map((st, i) => <div key={st.k} className="db-step">
        <span className="u-fig-k">{st.k}</span>
        <b className="db-step-n">{b ? st.n.toLocaleString("en-US") : "—"}</b>
        <span className="db-step-r">{i === 0 ? "" : st.r != null ? `${st.r}% ${st.of}` : ""}</span>
      </div>)}</div>
    </section>

    {b?.working && b.working.trades.length > 0 && <section className="u-block">
      <div className="u-h2-row"><h2 className="u-h2">What&apos;s working</h2><span className="u-note">Last 30 days. Meetings per 100 dials is the number to compare.</span></div>
      <div className="u-split u-split-even">{(["trades", "cities"] as const).map(k => <div key={k} className="u-tablewrap">
        <table className="u-table">
          <thead><tr><th>{k === "trades" ? "Trade" : "City"}</th><th className="u-num">Dials</th><th className="u-num">Talked</th><th className="u-num">Meetings</th><th className="u-num" title="Meetings per 100 dials">Per 100</th></tr></thead>
          <tbody>{b.working![k].map(r => <tr key={r.label}><td>{r.label}</td><td className="u-num">{r.dials}</td><td className="u-num">{r.convos}</td><td className="u-num">{r.meetings}</td><td className="u-num">{r.dials >= 20 ? (r.meetings / r.dials * 100).toFixed(1) : <span className="u-quiet" title="Needs 20+ dials to mean anything">—</span>}</td></tr>)}</tbody>
        </table>
      </div>)}</div>
    </section>}

    <div className="u-split u-split-even u-block">
      <section>
        <div className="u-h2-row"><h2 className="u-h2">Open pipeline</h2><Link className="u-note" href="/crm/pipeline" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{usd(openMrr)}/mo if it all closes</Link></div>
        {!b ? null : b.pipeline.length === 0 ? <p className="u-note">No open deals yet. Booked meetings become deals.</p> : <div className="u-rows">{b.pipeline.map(p => <Link key={p.stage} href="/crm/pipeline" className="u-row" style={{ minHeight: 46 }}>
          <div className="u-row-main"><span style={{ color: "var(--u-soft)", fontSize: 13.5 }}>{STAGE_LABELS[p.stage as DealStage] ?? p.stage}</span></div>
          <span className="u-row-end">{p.deals} deal{p.deals === 1 ? "" : "s"}</span>
          <span className="u-row-end u-num" style={{ minWidth: 90, color: "var(--u-text)" }}>{usd(p.monthly)}/mo</span>
        </Link>)}</div>}
      </section>
      <section className="db-goal">{!g ? null : g.gapAfterExpected <= 0 ? <><div className="u-h2-row"><h2 className="u-h2">Goal</h2></div><p className="db-goal-need">Collected plus expected covers {g ? usd(g.goal) : ""}. Keep billing on time.</p></> : <>
      <div className="u-h2-row"><h2 className="u-h2">What closes the gap to {usd(g.goal)} by {byLabel}</h2></div>
      <div className="db-goalbar" aria-label={`${g.progressPct}% collected`}><i className="is-paid" style={{ width: g.progressPct + "%" }} /><i className="is-exp" style={{ left: g.progressPct + "%", width: Math.max(0, g.withExpectedPct - g.progressPct) + "%" }} /></div>
      <div className="u-legend" style={{ marginTop: 12 }}><span><i style={{ background: "#292c32" }} />Collected {usd(g.collected)}</span><span><i className="is-2" />Expected {usd(g.expected)}</span><span>Gap {usd(g.gapAfterExpected)}</span></div>
      <p className="db-goal-need">{g.perDeal.filter(p => p.dealsNeeded).map((p, i) => <span key={p.label}>{i > 0 && " or "}<b>{p.dealsNeeded} {p.label.split(" · ")[0]} deal{p.dealsNeeded === 1 ? "" : "s"}</b></span>)} signed soon.</p>
    </>}</section>
    </div>

    {b?.sources && b.sources.rows.length > 0 && <section className="u-block">
      <div className="u-h2-row"><h2 className="u-h2">Where deals come from</h2><span className="u-note">Last 180 days</span></div>
      <div className="u-tablewrap"><table className="u-table"><thead><tr><th>Channel</th><th className="is-num">Deals</th><th className="is-num">Meetings</th><th className="is-num">Won</th><th className="is-num">Won monthly</th><th className="is-num">Close rate</th></tr></thead><tbody>
        {b.sources.rows.map(r => <tr key={r.channel}><td className="is-strong">{r.label}</td><td className="is-num">{r.deals}</td><td className="is-num">{r.meetings}</td><td className="is-num">{r.won}</td><td className="is-num">{usd(r.wonMonthly)}</td><td className="is-num">{pct(r.closeRate)}</td></tr>)}
      </tbody></table></div>
      {b.sources.best && <p className="u-note" style={{ marginTop: 12 }}>{b.sources.best.label} books the most meetings per deal ({b.sources.best.meetingRate}%). Spend more time there.</p>}
    </section>}
    </div>
    {loom && <div className="u-scrim" role="dialog" aria-modal="true" aria-label="Send a Loom" onMouseDown={e => { if (e.target === e.currentTarget) setLoom(null); }}>
      <div className="u-dialog" style={{ width: "min(560px, 100%)" }}>
        <h3>Loom for {loom.w.company || loom.w.firstName}</h3>
        <p className="u-note" style={{ marginBottom: 10 }}>Record 2 minutes in Loom, paste the link, and it goes out by text. Talking points:</p>
        <ol className="db-loom">{loomPoints({ company: loom.w.company, city: (loom.w.location ?? "").split(",")[0], niche: nicheFor(loom.w.niche, loom.w.company), callNote: loom.w.callNote }).map((p, i) => <li key={i}>{p}</li>)}</ol>
        <label className="u-lab">Loom link<input className="u-field" value={loom.url} onChange={e => setLoom({ ...loom, url: e.target.value })} placeholder="https://www.loom.com/share/…" inputMode="url" /></label>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 18 }}>
          <a className="u-btn u-btn-bare" href="https://www.loom.com/record" target="_blank" rel="noreferrer">Open Loom</a>
          <div style={{ display: "flex", gap: 8 }}><button className="u-btn" onClick={() => setLoom(null)}>Cancel</button><button className="u-btn u-btn-light" disabled={!/^https?:\/\/\S+$/.test(loom.url.trim())} onClick={sendLoom}>Text it</button></div>
        </div>
      </div>
    </div>}
  </div>;
}
