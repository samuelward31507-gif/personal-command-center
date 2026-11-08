// Sunday review: one email with the week in numbers and the five moves that matter most. Pure: safe to unit test.
import type { Alert } from "./notify";

export type ReviewData = {
  week: { calls: number; conversations: number; meetings: number; proposals: number; won: number; wonValue: number };
  pipeline: { stage: string; count: number; monthly: number }[];
  money: { paidThisWeek: number; expectedNext14: number; overdue: number };
  agreementsWaiting: { company: string; days: number; dealId: string }[];
  proposalsWaiting: { company: string; days: number; dealId: string }[];
  overdueMoney: { title: string; amount: number; days: number }[];
  lateSteps: { company: string; step: string; days: number; dealId: string }[];
  lateMilestones: { client: string; title: string; days: number }[];
  overdueTasks: number;
};

export type Move = { text: string; weight: number };

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);

/** Rank what to do this week: money and signatures first, then stalled deals, then delivery. Always 5 when possible. */
export type ReviewOptions = { niche?: string; firstName?: string };

export function topMoves(d: ReviewData, o: ReviewOptions = {}): Move[] {
  const m: Move[] = [];
  for (const a of d.agreementsWaiting) m.push({ text: `Get ${a.company} to sign. The agreement went out ${days(a.days)} ago.`, weight: 100 + a.days });
  for (const o of d.overdueMoney) m.push({ text: `Collect ${usd(o.amount)}: ${o.title} (${days(o.days)} overdue).`, weight: 90 + o.days });
  for (const p of d.proposalsWaiting) m.push({ text: `Follow up on the ${p.company} proposal (sent ${days(p.days)} ago, no answer).`, weight: 70 + p.days });
  for (const l of d.lateMilestones) m.push({ text: `Delivery: ${l.title} for ${l.client} (${days(l.days)} late).`, weight: 60 + l.days });
  for (const s of d.lateSteps) m.push({ text: `${s.company}: ${s.step || "next step"} (${days(s.days)} late).`, weight: 40 + s.days });
  m.sort((a, b) => b.weight - a.weight);
  const out = m.slice(0, 5);
  if (out.length < 5 && d.week.meetings < 3) out.push({ text: `Book more calls: send 20 DMs to ${o.niche || "contractors and home-service companies"} on Monday morning.`, weight: 0 });
  if (out.length < 5 && d.overdueTasks > 0) out.push({ text: `Clear ${d.overdueTasks} overdue task${d.overdueTasks === 1 ? "" : "s"} in Tasks.`, weight: 0 });
  return out.slice(0, 5);
}

const STAGE_ORDER = ["new", "qualified", "contacted", "interested", "meeting_booked", "meeting_held", "proposal", "negotiation", "nurture"];
const STAGE_LABEL: Record<string, string> = { new: "New", contacted: "Contacted", meeting_booked: "Meeting booked", meeting_held: "Meeting held", proposal: "Proposal", nurture: "Nurture" };

export function buildWeeklyReview(d: ReviewData, weekOf: string, o: ReviewOptions = {}): Alert {
  const open = [...d.pipeline].filter(p => STAGE_ORDER.includes(p.stage)).sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  const openCount = open.reduce((s, p) => s + p.count, 0);
  const openMonthly = open.reduce((s, p) => s + p.monthly, 0);
  const moves = topMoves(d, o);
  const lines = [
    `Your Sunday review, week of ${weekOf}.`,
    "",
    "THIS WEEK",
    `${d.week.calls} calls · ${d.week.conversations} conversations · ${d.week.meetings} meetings booked · ${d.week.proposals} proposals sent · ${d.week.won} won${d.week.won ? ` (${usd(d.week.wonValue)}/mo)` : ""}`,
    "",
    "MONEY",
    `${usd(d.money.paidThisWeek)} collected · ${usd(d.money.expectedNext14)} expected in the next 14 days${d.money.overdue ? ` · ${usd(d.money.overdue)} overdue` : ""}`,
    "",
    "PIPELINE",
    openCount ? `${openCount} open deals worth ${usd(openMonthly)}/mo: ${open.filter(p => p.count).map(p => `${p.count} ${STAGE_LABEL[p.stage]}`).join(" · ")}` : "No open deals. That's the first thing to fix this week.",
    "",
    "WHAT SLIPPED",
    `${d.lateSteps.length} deal step${d.lateSteps.length === 1 ? "" : "s"} late · ${d.lateMilestones.length} delivery step${d.lateMilestones.length === 1 ? "" : "s"} late · ${d.overdueTasks} overdue task${d.overdueTasks === 1 ? "" : "s"}`,
    "",
    "YOUR 5 MOVES THIS WEEK",
    ...(moves.length ? moves.map((mv, i) => `${i + 1}. ${mv.text}`) : ["Nothing urgent. Spend the week booking calls."]),
  ];
  return { subject: `Sunday review: ${moves.length ? moves[0].text.split(".")[0] : "your week"}`.slice(0, 140), lines, link: { label: "Open Today", path: "/crm/needs-you" } };
}
