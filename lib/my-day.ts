// Pure ranking rules for the My Day queue. The API route loads owner-scoped rows;
// this module decides what shows, in what order, and why. No I/O — unit tested.

export type QueueStatus = "overdue" | "today" | "blocked" | "upcoming";
export type QueueGroup = "revenue" | "prospects" | "meetings" | "deals" | "delivery" | "admin";

export type QueueItem = {
  id: string;
  group: QueueGroup;
  status: QueueStatus;
  title: string;
  why: string;
  lastActivity: string | null;
  due: string | null;
  href: string;
  contact: { id: string; name: string; company: string; phone: string } | null;
  callable: boolean; // shows Call + one-tap outcome logging
  rank: number;
};

export const GROUP_LABELS: Record<QueueGroup, string> = {
  revenue: "Revenue follow-ups",
  prospects: "New prospects to call",
  meetings: "Meetings & prep",
  deals: "Deal next steps",
  delivery: "Client delivery",
  admin: "Money & admin",
};
const GROUP_ORDER: QueueGroup[] = ["revenue", "prospects", "meetings", "deals", "delivery", "admin"];

/** How many never-contacted prospects to put in front of the founder per day. */
export const DAILY_NEW_PROSPECTS = 15;
const STATUS_ORDER: Record<QueueStatus, number> = { blocked: 0, overdue: 1, today: 2, upcoming: 3 };

type ContactRef = { id: string; name: string; company: string; phone: string; lastOutcome: string | null; lastAt: string | null; verdict: string | null };
export type QueueInput = {
  today: string; // owner's local YYYY-MM-DD
  now: string; // ISO
  outreach: { id: string; step: number; nextActionAt: string; contact: ContactRef }[];
  activeOutreachContactIds: string[];
  followUps: { followUpAt: string; contact: ContactRef }[];
  meetings: { id: string; title: string; startsAt: string; type: string; hasPrep: boolean; contact: ContactRef | null; dealTitle: string | null }[];
  deals: { id: string; title: string; stage: string; closeDate: string | null; lastActivityAt: string | null; contact: ContactRef | null }[];
  delivery: { id: string; kind: "project" | "milestone"; title: string; project: string; status: string; due: string | null }[];
  receivables: { id: string; title: string; amount: number; status: string; due: string | null; client: string }[];
  tasks: { id: string; title: string; status: string; priority: string; dueAt: string | null; contactName: string | null; dealTitle: string | null }[];
  /** Never-contacted, not suppressed, no follow-up, not in a sequence. */
  prospects?: { contact: ContactRef; location: string; website: string; createdAt: string }[];
  /** Prospects whose first-ever logged call happened today (counts against the daily cap). */
  firstTouchesToday?: number;
  dailyNewProspects?: number;
};

const NICHE = /\b(fence|fencing)\b/i;
const POOL = /\b(pool|pools|spa|spas)\b/i;

/** Fit audits first, then the agency's Tier 1/2 niches (fence, pool), then everyone else. No-fit audits never appear. */
export function prospectScore(p: { contact: ContactRef; website: string }): number | null {
  const v = (p.contact.verdict ?? "").toLowerCase();
  if (/\bno fit\b/.test(v)) return null;
  let score = 0;
  if (/\bconditional fit\b/.test(v)) score += 40;
  else if (/\bfit\b/.test(v)) score += 50;
  if (NICHE.test(p.contact.company) || POOL.test(p.contact.company)) score += 20;
  if (p.website) score += 5;
  return score;
}

export function pickProspects(input: QueueInput): QueueInput["prospects"] {
  const cap = Math.max(0, (input.dailyNewProspects ?? DAILY_NEW_PROSPECTS) - (input.firstTouchesToday ?? 0));
  return (input.prospects ?? [])
    .filter(p => p.contact.phone)
    .map(p => ({ p, score: prospectScore(p) }))
    .filter((x): x is { p: NonNullable<QueueInput["prospects"]>[number]; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score || a.p.createdAt.localeCompare(b.p.createdAt) || a.p.contact.name.localeCompare(b.p.contact.name))
    .slice(0, cap)
    .map(x => x.p);
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
}
function dateStatus(dueDay: string | null, today: string): QueueStatus {
  if (!dueDay) return "upcoming";
  return dueDay < today ? "overdue" : dueDay === today ? "today" : "upcoming";
}
function ago(dueDay: string, today: string) {
  const d = daysBetween(dueDay, today);
  return d <= 0 ? "due today" : d === 1 ? "1 day overdue" : `${d} days overdue`;
}
function lastTouch(c: ContactRef | null): string | null {
  if (!c?.lastOutcome || !c.lastAt) return null;
  return `${c.lastOutcome.replaceAll("_", " ")} · ${c.lastAt.slice(0, 10)}`;
}
const hot = (c: ContactRef) => c.lastOutcome === "interested" || c.lastOutcome === "callback_requested" || c.lastOutcome === "connected";

export function buildQueue(input: QueueInput): QueueItem[] {
  const { today } = input;
  const items: QueueItem[] = [];
  const active = new Set(input.activeOutreachContactIds);
  const seenContacts = new Set<string>();

  // 1. Revenue: due outreach steps are the source of truth for contacts in a sequence.
  for (const o of input.outreach) {
    const dueDay = day(o.nextActionAt)!;
    if (dueDay > today) continue;
    seenContacts.add(o.contact.id);
    items.push({
      id: "outreach:" + o.id, group: "revenue", status: dateStatus(dueDay, today),
      title: `Call ${o.contact.name}${o.contact.company ? " · " + o.contact.company : ""}`,
      why: [`Outreach step ${o.step} of 6, ${ago(dueDay, today)}`, o.contact.verdict].filter(Boolean).join(" · "),
      lastActivity: lastTouch(o.contact), due: o.nextActionAt, href: "/crm/outreach",
      contact: o.contact, callable: Boolean(o.contact.phone),
      rank: hot(o.contact) ? 0 : 1,
    });
  }
  // Standalone follow-ups, never duplicating a contact already driven by an active sequence.
  for (const f of input.followUps) {
    if (f.followUpAt > today || active.has(f.contact.id) || seenContacts.has(f.contact.id)) continue;
    seenContacts.add(f.contact.id);
    const isHot = hot(f.contact);
    items.push({
      id: "followup:" + f.contact.id, group: "revenue", status: dateStatus(f.followUpAt, today),
      title: `${isHot ? "Follow up with" : "Call"} ${f.contact.name}${f.contact.company ? " · " + f.contact.company : ""}`,
      why: [isHot ? `Last call: ${f.contact.lastOutcome!.replaceAll("_", " ")}` : "Follow-up " + ago(f.followUpAt, today), f.contact.verdict].filter(Boolean).join(" · "),
      lastActivity: lastTouch(f.contact), due: f.followUpAt, href: "/crm",
      contact: f.contact, callable: Boolean(f.contact.phone), rank: isHot ? 0 : 1,
    });
  }

  // 1b. New prospects: a capped daily slice of never-contacted contacts, best fit first.
  (pickProspects(input) ?? []).forEach((p, i) => {
    if (seenContacts.has(p.contact.id)) return;
    seenContacts.add(p.contact.id);
    const niche = NICHE.test(p.contact.company) ? "Fence" : POOL.test(p.contact.company) ? "Pool" : null;
    items.push({
      id: "prospect:" + p.contact.id, group: "prospects", status: "today",
      title: `Call ${p.contact.name}${p.contact.company && p.contact.company !== p.contact.name ? " · " + p.contact.company : ""}`,
      why: [niche, p.location || null, p.contact.verdict ?? "No audit yet — run one first"].filter(Boolean).join(" · "),
      lastActivity: null, due: null, href: p.contact.verdict ? "/crm" : "/crm/audit",
      contact: p.contact, callable: true, rank: i,
    });
  });

  // 2. Meetings in the next ~36h; unprepared ones rank first.
  for (const m of input.meetings) {
    const when = new Date(m.startsAt);
    const isToday = day(m.startsAt) === today;
    items.push({
      id: "meeting:" + m.id, group: "meetings", status: isToday ? "today" : "upcoming",
      title: m.title,
      why: [m.hasPrep ? "Prep brief ready" : "No prep brief yet", m.dealTitle].filter(Boolean).join(" · "),
      lastActivity: lastTouch(m.contact), due: when.toISOString(),
      href: m.hasPrep ? "/crm/preparation" : m.contact ? "/crm/audit" : "/crm/calendar",
      contact: m.contact, callable: false, rank: m.hasPrep ? 1 : 0,
    });
  }

  // 3. Deals that need a next step: past their close date, or no touch in 7+ days.
  for (const d of input.deals) {
    const closeDay = d.closeDate;
    const lastDay = day(d.lastActivityAt);
    const quiet = lastDay ? daysBetween(lastDay, today) : null;
    const pastClose = closeDay !== null && closeDay < today;
    const stale = quiet === null || quiet >= 7;
    if (!pastClose && !stale) continue;
    items.push({
      id: "deal:" + d.id, group: "deals", status: pastClose ? "overdue" : "today",
      title: `Move “${d.title}” forward`,
      why: [`Stage: ${d.stage}`, pastClose ? `expected close ${closeDay} has passed` : quiet === null ? "no logged activity" : `no activity in ${quiet} days`].join(" · "),
      lastActivity: lastTouch(d.contact), due: closeDay, href: "/crm/pipeline",
      contact: d.contact, callable: Boolean(d.contact?.phone), rank: pastClose ? 0 : 1,
    });
  }

  // 4. Delivery: blocked first, then overdue / due today.
  for (const x of input.delivery) {
    const dueDay = day(x.due);
    const status: QueueStatus = x.status === "blocked" ? "blocked" : dateStatus(dueDay, today);
    if (status === "upcoming") continue;
    items.push({
      id: x.kind + ":" + x.id, group: "delivery", status,
      title: x.kind === "project" ? `${status === "blocked" ? "Unblock" : "Review deadline"}: ${x.title}` : `${x.title} · ${x.project}`,
      why: status === "blocked" ? "Blocked — client commitment at risk" : `Client delivery ${ago(dueDay!, today)}`,
      lastActivity: null, due: x.due, href: "/crm/projects", contact: null, callable: false, rank: 0,
    });
  }

  // 5. Money (receivables) and tasks.
  for (const r of input.receivables) {
    if (r.status !== "overdue" && !(r.status === "expected" && r.due && r.due <= today)) continue;
    items.push({
      id: "receivable:" + r.id, group: "admin", status: r.status === "overdue" || (r.due !== null && r.due < today) ? "overdue" : "today",
      title: `Collect $${Math.round(r.amount).toLocaleString("en-US")} — ${r.title}`,
      why: [r.client, r.due ? `due ${r.due}` : null, "recorded manually; not payment-verified"].filter(Boolean).join(" · "),
      lastActivity: null, due: r.due, href: "/crm/finance", contact: null, callable: false, rank: 0,
    });
  }
  for (const t of input.tasks) {
    if (t.status === "done" || t.status === "cancelled") continue;
    const dueDay = day(t.dueAt);
    const status: QueueStatus = t.status === "blocked" ? "blocked" : dateStatus(dueDay, today);
    if (status === "upcoming" && t.priority !== "urgent") continue;
    items.push({
      id: "task:" + t.id, group: "admin", status: status === "upcoming" ? "today" : status,
      title: t.title,
      why: [t.status === "blocked" ? "Blocked" : t.priority === "urgent" ? "Urgent" : dueDay ? ago(dueDay, today) : null, t.contactName, t.dealTitle].filter(Boolean).join(" · "),
      lastActivity: null, due: t.dueAt, href: "/crm/tasks", contact: null, callable: false,
      rank: t.priority === "urgent" ? 0 : t.priority === "high" ? 1 : 2,
    });
  }

  return items.sort((a, b) =>
    GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
    || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || a.rank - b.rank
    || String(a.due ?? "9999").localeCompare(String(b.due ?? "9999")));
}
