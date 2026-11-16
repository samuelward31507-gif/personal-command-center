// The example business behind /app?demo=1: the real app over an in-memory copy of its API,
// so Sam (and prospects on a call) can click through exactly what a client sees. Nothing leaves the browser.
import { ballpark, cleanDate, cleanDetails, cleanOwnerSetup, cleanWinback, detailLine, parsePriceBook, stageFor, STAGES, winbackDraft, type Card, type CardInvoice, type Details , cleanPayMethod, type Payment, type Photo } from "@/lib/crm";
import type { Report, ReportNumbers } from "@/lib/client-reports";
import { cleanItems, cleanTax, totals, type Item } from "@/lib/billing";
import { cleanImportRows, importAs } from "@/lib/customer-import";
import { demoSwitch } from "./demo-switch";
import { nextChaseDay } from "@/lib/client-runtime";
import { addInterval, changeOrderLines, cleanCatalog, cleanChangeOrder, cleanPlan, cleanSignoff, type ChangeOrder, type Plan, type Signoff, type TimeEntry } from "@/lib/service";
const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const at = (days: number, hour: number, min = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, min, 0, 0); return d.toISOString(); };
const GC = "https://calendar.google.com/calendar/r/week";

type T = { id: string; direction: "in" | "out"; author: string; body: string; at: string };
type Th = { id: string; customer_name: string; customer_phone: string; source: string; status: string };
let n = 0;
const tx = (direction: "in" | "out", author: string, body: string, m: number): T => ({ id: "d" + ++n, direction, author, body, at: ago(m) });

function seed() {
  const threads: Record<string, { thread: Th; texts: T[] }> = {
    t1: { thread: { id: "t1", customer_name: "Tom Becker", customer_phone: "+17205550177", source: "web form", status: "paused" }, texts: [
      tx("in", "system", "New web form lead: “Cedar fence, 140 ft, side and back yard”", 40),
      tx("out", "template", "Hi Tom, this is Ridgeline Fence. Thanks for reaching out. What’s the address so I can give you a price range?", 40),
      tx("in", "customer", "2210 Oak Dr, Littleton", 30),
      tx("out", "ai", "Thanks Tom. For about 140 ft of cedar privacy, it usually runs $8,400 to $9,800. I can measure Thursday at 10:30 or Friday at 3.", 29),
      tx("in", "customer", "Do you guys offer financing on the $9,400 job?", 12),
      tx("out", "template", "Good question. Mike will get back to you on that directly today.", 12)] },
    t2: { thread: { id: "t2", customer_name: "Dana Ruiz", customer_phone: "+17205550148", source: "missed_call", status: "booked" }, texts: [
      tx("in", "system", "Missed call from (720) 555-0148", 55),
      tx("out", "template", "Hi, this is Ridgeline Fence. Sorry we missed your call. What can we help with?", 55),
      tx("in", "customer", "Need a quote to replace about 80 ft of chain link with wood", 52),
      tx("out", "ai", "We can do that. Wood privacy for 80 ft usually runs $3,900 to $4,800. I can have Mike measure Thursday at 8:00 AM or Friday at 1:00 PM. Which works?", 51),
      tx("in", "customer", "Thursday 8", 49),
      tx("out", "ai", "You’re booked: Thursday at 8:00 AM. Mike will see you then.", 48)] },
    t3: { thread: { id: "t3", customer_name: "Marcus Hill", customer_phone: "+13035550112", source: "web chat", status: "auto" }, texts: [
      tx("in", "system", "New chat from the website", 140),
      tx("in", "customer", "How much is vinyl per foot?", 138),
      tx("out", "ai", "Vinyl usually runs $38–48 a foot. I can measure Friday at 3.", 130)] },
    t4: { thread: { id: "t4", customer_name: "Priya Shah", customer_phone: "+17205550163", source: "google", status: "auto" }, texts: [
      tx("in", "system", "Quote sent: $6,200 horizontal cedar. Follow-up started.", 60 * 74),
      tx("out", "template", "Hi Priya, Mike here. Happy to walk through the quote.", 60 * 26)] },
    t5: { thread: { id: "t5", customer_name: "", customer_phone: "+13035550199", source: "text", status: "closed" }, texts: [
      tx("in", "customer", "Do you do gates?", 60 * 52),
      tx("out", "ai", "We do. Single walk gates start around $450 installed. Want me to set up a time to measure?", 60 * 51),
      tx("in", "customer", "Thanks, we went with someone else.", 60 * 50)] },
    q1: { thread: { id: "q1", customer_name: "Lena Ortiz", customer_phone: "+17205550191", source: "facebook", status: "auto" }, texts: [
      tx("in", "system", "Quote sent: $7,800. Cinder follows up until they answer.", 60 * 24 * 6),
      tx("out", "template", "Hi Lena, it's Mike with Ridgeline Fence. Just making sure the quote came through. Any questions I can answer?", 60 * 24 * 4),
      tx("out", "template", "Hi Lena, Mike here. Happy to walk through the quote, or look at a smaller option if that would help.", 60 * 24)] },
    q2: { thread: { id: "q2", customer_name: "Kyle Brandt", customer_phone: "+13035550133", source: "angi", status: "auto" }, texts: [
      tx("in", "system", "New Angi lead: “Ranch rail around 2 acres”", 60 * 24 * 5),
      tx("in", "system", "Quote sent: $12,400. Cinder follows up until they answer.", 60 * 24 * 3)] },
    q3: { thread: { id: "q3", customer_name: "Jen Park", customer_phone: "+17205550120", source: "web form", status: "auto" }, texts: [
      tx("in", "system", "Quote sent: $4,650. Cinder follows up until they answer.", 60 * 24)] },
    w1: { thread: { id: "w1", customer_name: "Henderson family", customer_phone: "+17205550110", source: "missed_call", status: "closed" }, texts: [
      tx("in", "system", "Job won: $8,600", 60 * 24 * 9)] },
    w2: { thread: { id: "w2", customer_name: "Carla Mendez", customer_phone: "+17205550124", source: "angi", status: "closed" }, texts: [
      tx("out", "owner", "Hi Carla, here's your quote from Ridgeline Fence Co: $6,900 for 150 ft, 6 ft Vinyl, 1 gate. You can look it over and approve it here: https://app.cinderrevenue.com/q/example", 60 * 24 * 5),
      tx("in", "system", "Approved the quote online: $6,900", 60 * 24 * 4)] },
    w3: { thread: { id: "w3", customer_name: "Bill Turner", customer_phone: "+13035550187", source: "angi", status: "closed" }, texts: [
      tx("in", "system", "Job won: $11,200", 60 * 24 * 16)] },
    l2: { thread: { id: "l2", customer_name: "Ashley Kim", customer_phone: "+13035550141", source: "thumbtack", status: "closed" }, texts: [
      tx("in", "system", "Passed on the quote online: \u201cWent with a cheaper bid\u201d", 60 * 24 * 7)] },
  };
  const crm: Record<string, { stage?: string; details: Details; value?: number | null; notes: string; install?: string | null; installTime?: string | null; installDays?: number; onCalendar?: boolean; reviewAuto?: boolean; reviewSent?: string | null; job?: Record<string, string>; costs?: Record<string, number>; stageAt?: string; lostReason?: string; crew?: string; email?: string; remind?: { at: string; note: string; sent: boolean } | null; crewMember?: string; reviewAfter?: string | null }> = {
    t1: { details: { length_ft: 140, material: "cedar", height: "6 ft", gates: 1, address: "2210 Oak Dr, Littleton" }, notes: "Asked about financing. Call him.", email: "tom.becker@example.com", remind: { at: ago(30), note: "Call Tom back about financing", sent: false } },
    t2: { details: { length_ft: 80, material: "Wood privacy", height: "6 ft", gates: 1, hoa: "No", address: "77 Aspen Ct, Englewood" }, notes: "Replacing chain link.", crewMember: "+17205550188", crew: "Side gate is unlocked. Measure the back line from the shed." },
    t3: { details: { material: "Vinyl" }, notes: "" },
    t4: { details: { length_ft: 120, material: "Horizontal cedar", gates: 2, hoa: "Yes" }, notes: "HOA needs drawings before install.", value: 6200 },
    t5: { details: {}, notes: "Went with someone else." },
    q1: { details: { length_ft: 160, material: "Vinyl", height: "6 ft", gates: 1, hoa: "Yes" }, notes: "", value: 7800, email: "lena.ortiz@example.com" },
    q2: { details: { length_ft: 900, material: "Ranch rail", gates: 2 }, notes: "Horses. Needs it before spring.", value: 12400 },
    q3: { details: { length_ft: 110, material: "Chain link", height: "5 ft", gates: 1 }, notes: "", value: 4650 },
    w1: { details: { length_ft: 220, material: "cedar", height: "6 ft", gates: 2, address: "418 Willow Ln, Littleton" }, notes: "Install done. Ask for a review.", crew: "Gate code 4418. Two dogs, keep the side gate shut. Park on Willow, not the driveway.", value: 8600, install: at(-11, 8).slice(0, 10), installTime: "07:30", installDays: 1, onCalendar: true, job: { deposit: at(-26, 9).slice(0, 10), permit: at(-21, 9).slice(0, 10), locate: at(-18, 9).slice(0, 10), materials: at(-16, 9).slice(0, 10), installed: at(-11, 9).slice(0, 10), walk: at(-10, 9).slice(0, 10) }, costs: { materials: 3150, labor: 1900, other: 120 } },
    w2: { stage: "won", crewMember: "+17205550188", crew: "Old fence is already down. Dumpster in the driveway, park on the street.", details: { length_ft: 150, material: "Vinyl", height: "6 ft", gates: 1, address: "905 Cherry St, Centennial" }, notes: "Approved from the link.", value: 6900, costs: { materials: 2950, labor: 1400, other: 90 }, job: { deposit: at(-1, 9).slice(0, 10), materials: at(-1, 9).slice(0, 10) }, install: at(0, 8).slice(0, 10), installTime: "08:00", installDays: 1, onCalendar: true, reviewAuto: true },
    w3: { stage: "won", details: { length_ft: 260, material: "Wood privacy", height: "6 ft", gates: 2 }, notes: "", value: 11200, costs: { materials: 5400, labor: 3600, other: 350 }, install: at(-12, 8).slice(0, 10), installDays: 2, onCalendar: true, reviewSent: at(-11, 9) },
    l2: { stage: "lost", details: { length_ft: 90, material: "Chain link", height: "4 ft" }, notes: "Went with a cheaper bid.", lostReason: "Price" },
  };
  const setup: Record<string, string> = { display_name: "Ridgeline Fence Co.", owner_name: "Mike", trade: "Fence", website: "https://ridgelinefence.example", team_size: "2-5 people", years: "6-10 years",
    leads_month: "10-30", lead_sources: "Phone calls, Website form, Google, Angi", software: "None, just my phone", share_ballpark: "yes", priority: "quotes", onboarded_at: "2026-11-01T15:00:00.000Z", pay_link: "https://square.link/u/example", tax_rate: "0", invoice_days: "7",
    hours: "Mon-Fri 7:00-18:00, Sat 8:00-12:00", timezone: "America/Denver", service_area: "Littleton, Highlands Ranch, Castle Rock and 25 miles around", rules: "No repairs under $500. No commercial bids.", questions: "Rough length in feet, material, and the address.",
    prices: "Cedar privacy runs $38–48 a foot installed. Vinyl $40–55. Chain link $18–26.", financing: "We offer 12 months no interest through Wisetack on jobs over $3,000.", tone: "Hey Mark, Mike here with Ridgeline. We can swing by Thursday at 4 to measure, that work?\nSounds good, see you then. Gate's on the left side of the house.", avoid: "Never quote a firm price. Don't promise a date for the install.",
    handoff: "The job is over $20,000, or they mention a neighbor dispute over the property line.", book_lead_hours: "3", book_per_day: "2", book_buffer_min: "30", quote_days: "2,5,10,21", nudge_hours: "2,20,68", dnt: "+17205550177", a2p_status: "Approved", forwarding: "Their number forwards missed calls here", team: JSON.stringify([{ name: "Luis", cell: "+17205550188", role: "crew", rate: 28 }, { name: "Jess", cell: "+17205550166", role: "office", rate: 24 }, { name: "Tony", cell: "+17205550155", role: "crew", rate: 26 }]), monthly_report: "yes", labor_rate: "45", review_on_paid: "yes", catalog: JSON.stringify([{"name":"6 ft cedar privacy, installed","unit":"ft","price":43,"cost":24},{"name":"6 ft vinyl privacy, installed","unit":"ft","price":48,"cost":27},{"name":"5 ft chain link, installed","unit":"ft","price":22,"cost":11},{"name":"Ranch rail, 3 rail","unit":"ft","price":15,"cost":7},{"name":"Walk gate, 4 ft","unit":"","price":550,"cost":240},{"name":"Double drive gate, 12 ft","unit":"","price":1450,"cost":720},{"name":"Tear-out and haul-away","unit":"ft","price":4,"cost":1.5},{"name":"Stain and seal","unit":"ft","price":5.25,"cost":1.8},{"name":"Post replacement, in concrete","unit":"","price":140,"cost":45},{"name":"Soft wash, both sides","unit":"ft","price":1.1,"cost":0.3}]),
    warranty: "Two years on workmanship. Materials carry the maker's warranty.", financing_link: "https://example.com/financing", financing_note: "Pay over time, as low as $120 a month",
    quote_terms: "Prices hold for 30 days. The deposit holds the install date and comes off the final invoice. The balance is due when the job is done.",
    price_book: JSON.stringify({ unit: "ft", rates: [{ name: "Wood privacy (cedar)", low: 38, high: 48 }, { name: "Vinyl", low: 40, high: 55 }, { name: "Chain link", low: 18, high: 26 }, { name: "Ranch rail", low: 12, high: 18 }], gate: [450, 650] }) };
  return {
    threads, crm, setup,
    messages: [{ author: "client", body: "Can we add Saturday mornings?", created_at: ago(60 * 30) }, { author: "owner", body: "Done. Saturday 8 to noon is live now.", created_at: ago(60 * 27) }],
    appts: [
      { id: "a0", starts_at: at(-1, 15), thread_id: "t4", customer_name: "Priya Shah", customer_phone: "+17205550163", event_id: "g0", link: GC },
      { id: "a1", starts_at: at(1, 8), thread_id: "t2", customer_name: "Dana Ruiz", customer_phone: "+17205550148", event_id: "g1", link: GC },
      { id: "a2", starts_at: at(2, 15), thread_id: "t3", customer_name: "Marcus Hill", customer_phone: "+13035550112", event_id: "g2", link: GC },
      { id: "a3", starts_at: at(4, 10, 30), thread_id: "t1", customer_name: "Tom Becker", customer_phone: "+17205550177", event_id: "g3", link: GC }],
    events: [
      { id: "e1", title: "Gate repair, 1180 Elm St", start: at(1, 9, 30), end: at(1, 16), allDay: false, link: GC },
      { id: "e2", title: "Material pickup", start: at(2, 7), end: at(2, 8), allDay: false, link: GC },
      { id: "e4", title: "Crew off", start: at(3, 0), end: at(4, 0), allDay: true, link: GC }],
    quotes: [
      { id: "q1", customer_name: "Lena Ortiz", customer_phone: "+17205550191", amount: 7800 as number | null, sent_on: at(-6, 12).slice(0, 10), steps_sent: 2, status: "open", linked: true, viewed: ago(60 * 3) as string | null, note: "Remove old wood fence, 6 ft white vinyl privacy, one 4 ft gate.", deposit: 1500 as number | null,
        items: [{ name: "6 ft White vinyl privacy", qty: 160, unit: "ft", price: 42, tier: "Good" }, { name: "6 ft Vinyl privacy with lattice top", qty: 160, unit: "ft", price: 49, tier: "Better" }, { name: "6 ft Tan vinyl, heavy-duty posts, lifetime warranty", qty: 160, unit: "ft", price: 56, tier: "Best" },
          { name: "Walk gate", qty: 1, unit: "", price: 760 }, { name: "Tear-out and haul-away", qty: 160, unit: "ft", price: 2 }, { name: "Second walk gate", qty: 1, unit: "", price: 760, opt: true }, { name: "Post caps, solar lit", qty: 18, unit: "", price: 28, opt: true }] as Item[], tax_rate: 0 },
      { id: "q2", customer_name: "Kyle Brandt", customer_phone: "+13035550133", amount: 12400 as number | null, sent_on: at(-3, 12).slice(0, 10), steps_sent: 1, status: "open", linked: true, viewed: null as string | null, note: "", deposit: null as number | null, items: [] as Item[], tax_rate: 0 },
      { id: "q3", customer_name: "Jen Park", customer_phone: "+17205550120", amount: 4650 as number | null, sent_on: at(-1, 12).slice(0, 10), steps_sent: 0, status: "open", linked: false, viewed: null as string | null, note: "", items: [] as Item[], tax_rate: 0 }],
    winbackSent: false,
    invoices: [
      { id: "iv1", thread_id: "w3", number: 1041, status: "paid", items: [{ name: "6 ft Wood privacy fence, installed", qty: 260, unit: "ft", price: 39 }, { name: "Walk gate", qty: 2, unit: "", price: 530 }], tax_rate: 0, total: 11200, note: "", due_on: at(-6, 12).slice(0, 10),
        sent_at: at(-10, 12), viewed_at: at(-10, 15), paid_at: at(-8, 12), paid_claimed_at: null, reminders: 0, reminders_paused: false, url: "/i/example" },
      { id: "iv2", thread_id: "w1", number: 1042, status: "sent", items: [{ name: "6 ft cedar privacy fence, installed", qty: 220, unit: "ft", price: 35 }, { name: "Walk gate", qty: 2, unit: "", price: 450 }], tax_rate: 0, total: 8600, note: "", due_on: at(-2, 12).slice(0, 10),
        sent_at: at(-9, 12), viewed_at: at(-9, 18), paid_at: null, paid_claimed_at: null, reminders: 1, reminders_paused: false, url: "/i/example" },
    ] as (CardInvoice & { thread_id: string })[],
    payments: [
      { id: "pm1", invoice_id: "iv1", thread_id: "w3", amount: 5000, method: "check", paid_on: at(-26, 12).slice(0, 10), note: "Deposit, check 1182" },
      { id: "pm2", invoice_id: "iv1", thread_id: "w3", amount: 6200, method: "card", paid_on: at(-8, 12).slice(0, 10), note: "" },
      { id: "pm3", invoice_id: "iv2", thread_id: "w1", amount: 2500, method: "bank", paid_on: at(-24, 12).slice(0, 10), note: "Deposit by Zelle" },
    ] as Payment[],
    photos: {} as Record<string, Photo[]>,
    // Service plans: the Henderson wash is due today (Luis goes), Bill Turner's yearly seal is next month.
    plans: [
      { id: "pl1", thread_id: "w1", name: "Seasonal fence wash", items: [{ name: "Soft wash, both sides, 220 ft", qty: 1, unit: "", price: 240 }], tax_rate: 0, total: 240, every: 3, unit: "month", next_on: at(0, 12).slice(0, 10), time: "09:00", ends_on: null, status: "active", remind: true, invoice: true, crew_member: "+17205550188", visits_done: 2, last_on: at(-92, 12).slice(0, 10), created_at: at(-200, 12) },
      { id: "pl2", thread_id: "w3", name: "Stain and seal", items: [{ name: "Stain and seal, 260 ft", qty: 1, unit: "", price: 1350 }, { name: "Gate hardware check", qty: 2, unit: "", price: 50 }], tax_rate: 0, total: 1450, every: 12, unit: "month", next_on: at(24, 12).slice(0, 10), time: null, ends_on: null, status: "active", remind: true, invoice: true, crew_member: "", visits_done: 0, last_on: null, created_at: at(-10, 12) },
      { id: "pl3", thread_id: "q2", name: "Ranch rail inspection", items: [{ name: "Walk the line, tighten and replace rails", qty: 1, unit: "", price: 180 }], tax_rate: 0, total: 180, every: 6, unit: "month", next_on: at(3, 12).slice(0, 10), time: "08:00", ends_on: null, status: "paused", remind: true, invoice: true, crew_member: "", visits_done: 1, last_on: at(-180, 12).slice(0, 10), created_at: at(-300, 12) },
    ] as Omit<Plan, "customer" | "phone">[],
    // Carla's job: a second gate, texted this morning and opened.
    cos: [
      { id: "co1", thread_id: "w2", number: 1, title: "Add a second walk gate on the east side", items: [{ name: "4 ft vinyl walk gate, installed", qty: 1, unit: "", price: 760 }, { name: "Gate post in concrete", qty: 1, unit: "", price: 140 }], tax_rate: 0, total: 900,
        note: "Matches the new fence. Goes in the same day as the install.", status: "sent", url: "", sent_at: ago(180), viewed_at: ago(95), decided_at: null, signed_by: "", invoiced: false },
    ] as ChangeOrder[],
    // Clocked hours: Luis is on Carla's install now; the last two weeks on Bill Turner's and the Henderson job.
    time: [
      { id: "tm1", thread_id: "w2", member: "+17205550188", started_at: ago(172), ended_at: null, note: "" },
      { id: "tm2", thread_id: "w3", member: "+17205550188", started_at: at(-12, 7, 30), ended_at: at(-12, 16, 15), note: "" },
      { id: "tm3", thread_id: "w3", member: "", started_at: at(-12, 7, 30), ended_at: at(-12, 15, 0), note: "" },
      { id: "tm4", thread_id: "w3", member: "+17205550188", started_at: at(-11, 7, 30), ended_at: at(-11, 14, 40), note: "" },
      { id: "tm5", thread_id: "w3", member: "", started_at: at(-11, 8, 0), ended_at: at(-11, 13, 30), note: "" },
      { id: "tm6", thread_id: "w1", member: "+17205550188", started_at: at(-11, 7, 30), ended_at: at(-11, 15, 50), note: "" },
      { id: "tm7", thread_id: null, member: "", started_at: at(-3, 13, 0), ended_at: at(-3, 14, 30), note: "Material pickup" },
    ] as TimeEntry[],
    signoffs: {} as Record<string, Signoff>,
    won: 5, wonValue: 37500,
    wonJobs: [{ id: "w1", customer_name: "Henderson family", customer_phone: "+17205550110", amount: 8600 as number | null, won_at: at(-9, 12) }],
  };
}

const EXAMPLE_LINK = (typeof location !== "undefined" ? location.origin : "") + "/q/example";
const EXAMPLE_INVOICE = (typeof location !== "undefined" ? location.origin : "") + "/i/example";
const quoteSms = (name: string, amount: number | null, id: string) => {
  const d = st().crm[id]; const line = d ? detailLine("Fence", cleanDetails("Fence", d.details)) : "";
  return `Hi ${name.split(" ")[0] || "there"}, here's your quote from Ridgeline Fence Co${amount ? `: $${amount.toLocaleString("en-US")}${line ? ` for ${line}` : ""}` : ""}. You can look it over and approve it here: https://app.cinderrevenue.com/q/example`;
};

let S: ReturnType<typeof seed> | null = null;
/** Paid in full: the review ask is queued for a couple of hours later, unless they were already asked. */
const queueReview = (thread: string) => { const c = (st().crm[thread] ??= { details: {}, notes: "" }); if (!c.reviewSent && !c.reviewAfter) c.reviewAfter = new Date(Date.now() + 2 * 3600000).toISOString(); };
const st = () => (S ??= seed());
const paidOn = (invoiceId: string) => st().payments.filter(p => p.invoice_id === invoiceId).reduce((a, p) => a + p.amount, 0);

/** The example business's report: believable numbers for a fence shop with a few dozen leads a month. */
function demoReport(days: 30 | 90 | 365): Report {
  const k = days === 30 ? 1 : days === 90 ? 3.1 : 12.4;
  const num = (leads: number, booked: number, quoted: number, won: number, wonValue: number, extra: Partial<ReportNumbers> = {}): ReportNumbers => ({ leads, booked, quoted, won, wonValue, lost: Math.round(quoted * 0.3),
    replySec: 9, afterHoursLeads: Math.round(leads * 0.34), afterHoursWon: Math.round(won * 0.4), afterHoursValue: Math.round(wonValue * 0.38), cycleDays: 11.4, payDays: 6.2,
    costed: Math.max(0, won - 1), costedValue: Math.round(wonValue * 0.8), costs: Math.round(wonValue * 0.8 * 0.58), collected: Math.round(wonValue * 0.82), invoiced: Math.round(wonValue * 0.9), appts: booked, noShows: Math.max(0, Math.round(booked * 0.07)), reviews: Math.round(won * 0.9), ...extra });
  const r = (x: number) => Math.round(x * k);
  return { days,
    now: num(r(41), r(14), r(9), r(5), r(37500)),
    before: num(r(33), r(10), r(8), r(4), r(29800), { replySec: 14, cycleDays: 13.8, payDays: 8.5 }),
    sources: [{ source: "angi", leads: r(9), booked: r(4), quoted: r(3), won: r(2), wonValue: r(18100) }, { source: "missed_call", leads: r(13), booked: r(4), quoted: r(3), won: r(1), wonValue: r(8600) },
      { source: "web form", leads: r(8), booked: r(3), quoted: r(2), won: r(1), wonValue: r(6900) }, { source: "google", leads: r(6), booked: r(2), quoted: r(1), won: r(1), wonValue: r(3900) },
      { source: "booking page", leads: r(3), booked: r(1), quoted: 0, won: 0, wonValue: 0 }, { source: "thumbtack", leads: r(2), booked: 0, quoted: 0, won: 0, wonValue: 0 }],
    lostReasons: [{ reason: "Price", n: r(2) }, { reason: "Went with someone else", n: r(1) }, { reason: "Timing", n: Math.max(1, r(0.5)) }],
    openQuotes: { n: 4, value: 32627 },
    // A believable trend: weeks for 30 and 90 days, months for a year, oldest first.
    series: Array.from({ length: days === 30 ? 5 : days === 90 ? 13 : 12 }, (_, i) => {
      const n = days === 30 ? 5 : days === 90 ? 13 : 12, back = n - 1 - i, d = new Date(); if (days === 365) d.setMonth(d.getMonth() - back, 1); else d.setDate(d.getDate() - back * 7);
      const w = days === 365 ? 4.3 : 1, wave = 1 + 0.35 * Math.sin(i * 1.3) + i * 0.03;
      const leads = Math.round(9 * w * wave), booked = Math.round(leads * (0.3 + 0.08 * Math.cos(i))), won = Math.max(0, Math.round(booked * 0.38));
      return { label: d.toLocaleDateString("en-CA"), leads, booked, won, wonValue: won * 7300, collected: Math.round(won * 7300 * 0.85) };
    }) };
}
const money = (v: unknown) => Number(String(v ?? "").replace(/[$,\s]/g, "").replace(/k$/i, "000")) || null;

/** /app?demo=empty: a business on day one, to see (and show) what a fresh account looks like. */
const emptyDemo = () => { try { return sessionStorage.getItem("cinder-demo-empty") === "1"; } catch { return false; } };
/** /app?demo=crew: the same business seen by Luis, a crew member: his day, the jobs, no money or settings. */
const crewDemo = () => { try { return sessionStorage.getItem("cinder-demo-crew") === "1"; } catch { return false; } };
function asCrew<T extends Record<string, unknown>>(x: T): T {
  const setup = x.setup as Record<string, string>;
  const me = "+17205550188";
  return { ...x, role: "crew", me, invoices: [], payments: [], customers: [], quotes: [], wonJobs: [], winback: undefined, setup: { display_name: setup.display_name, owner_name: setup.owner_name, trade: setup.trade },
    plans: ((x.plans ?? []) as Plan[]).map(p => ({ ...p, items: [], total: 0 })), time: ((x.time ?? []) as TimeEntry[]).filter(e => e.member === me),
    board: ((x.board ?? []) as Card[]).map(b => ({ ...b, value: null, quote: null, invoice: null, changeOrders: (b.changeOrders ?? []).map(c => ({ ...c, items: [], total: 0, url: null })) })) };
}
function blank<T extends Record<string, unknown>>(x: T): T {
  const live = { ...(x.live as Record<string, unknown>), leads: 0, needs: 0, answered: 0, booked: 0, replySec: null, chasing: 0, chasingValue: 0, won: 0, wonValue: 0, revived: 0, reviews: 0, weeks: [], conversations: [], afterHours: { leads: 0, won: 0, wonValue: 0 } };
  const setup = { ...(x.setup as Record<string, string>), price_book: "", pay_link: "", has_review_link: "", has_calendar: "" };
  return { ...x, live, setup, board: [], invoices: [], payments: [], customers: [], appointments: [], quotes: [], wonJobs: [], plans: [], time: [], visits: [], hasReviewLink: false, calendar: { connected: false, email: "", events: [], error: "", connectUrl: "#" }, wires: { sources: [], failures: [], log: [] }, winback: { past: 0, eligible: 0, names: [], draft: "" } };
}
const EXAMPLE_CO = (typeof location !== "undefined" ? location.origin : "") + "/c/example";
function plansOut() { const s = st(); return s.plans.map(p => ({ ...p, customer: s.threads[p.thread_id]?.thread.customer_name ?? "", phone: s.threads[p.thread_id]?.thread.customer_phone ?? "" })); }
function data() {
  const s = st();
  const conversations = Object.values(s.threads).filter(t => t.texts.length).map(({ thread, texts }) => {
    const last = texts.filter(x => x.author !== "system").at(-1) ?? texts.at(-1)!;
    const ask = texts.filter(x => x.direction === "in" && x.author !== "system").at(-1)?.body ?? "";
    const firstIn = texts.find(x => x.direction === "in"), stage = s.crm[thread.id]?.stage ?? (thread.id.startsWith("q") ? "quoted" : thread.id.startsWith("w") ? "won" : thread.id.startsWith("l") ? "lost" : "");
    const lastSpoke = texts.filter(x => x.author !== "system").at(-1);
    return { id: thread.id, name: thread.customer_name || "(303) 555-0199", source: thread.source, status: thread.status, at: last.at, last: last.body, ask,
      created: (firstIn ?? texts[0]).at, replySec: thread.source === "import" ? null : [6, 9, 4, 11, 7, 5, 8, 12, 6, 10][Object.keys(s.threads).indexOf(thread.id) % 10], lastDir: lastSpoke?.direction ?? "", stage };
  }).sort((a, b) => b.at.localeCompare(a.at));
  return {
    project: "demo", business: "Ridgeline Fence Co. (example)", number: "+17205550100", canCall: true, role: "owner" as const, me: "", emailReady: true,
    businesses: [{ project_id: "demo", name: "Ridgeline Fence Co. (example)" }], unreadFromSam: 0,
    evening: { since: ago(1440), leads: 6, afterHours: 4, replySec: 8, booked: 2, quotesBack: 1, quotesBackValue: 3400, paid: 2500, reviews: 1 },
    live: { replySecWeek: 8, leadsWeek: 11, leadsToday: conversations.filter(c => Date.parse(c.created) > Date.now() - 86400000).length, leads: 41, needs: conversations.filter(c => c.status === "paused").length, answered: 41, booked: 14, replySec: 9,
      afterHours: { leads: 14, won: 5, wonValue: 31400 }, chasing: s.quotes.length, chasingValue: s.quotes.reduce((t, q) => t + (q.amount || 0), 0), won: s.won, wonValue: s.wonValue, revived: 4, reviews: 11,
      weeks: [{ week: "a", leads: 8, booked: 3 }, { week: "b", leads: 11, booked: 4 }, { week: "c", leads: 9, booked: 3 }, { week: "d", leads: 13, booked: 4 }], conversations },
    owner: "Mike", appointments: s.appts, quotes: s.quotes, quoteSteps: 4, wonJobs: s.wonJobs, hasReviewLink: true,
    calendar: { connected: true, email: "mike@ridgelinefence.com", events: s.events, error: "", connectUrl: "#" },
    messages: s.messages, board: board(), setup: { ...s.setup, has_review_link: "yes", has_number: "yes", has_calendar: "yes", has_cell: "yes", has_booking_link: "yes" },
    key: "example-key-ridgeline-0000", origin: typeof location !== "undefined" ? location.origin : "",
    jobber: { available: true, connected: true, account: "Ridgeline Fence Co.", error: "", lastPush: ago(2880), connectUrl: "#" },
    quickbooks: { available: true, connected: true, company: "Ridgeline Fence Co. LLC", error: "", lastPush: ago(95), connectUrl: "#" },
    wires: { sources: [{ source: "missed_call", leads: 19, last30: 7, last: ago(40) }, { source: "web form", leads: 12, last30: 5, last: ago(300) }, { source: "angi", leads: 8, last30: 3, last: ago(2880) }, { source: "web chat", leads: 2, last30: 1, last: ago(8640) }],
      failures: [{ id: "f1", at: ago(12), body: "Good question. Mike will get back to you on that directly today.", name: "Tom Becker", phone: "+17205550177", thread: "t1", source: "web form" }],
      log: [{ at: ago(40), event: "inbound_call", source: "missed_call", phone: "+17205550161", evidence: "Missed call, texted back in 6s" }, { at: ago(300), event: "web_form", source: "web form", phone: "+17205550123", evidence: "Submitted a form asking to be contacted" }, { at: ago(540), event: "inbound_text", source: "text", phone: "+17205550139", evidence: "Texted the business number" },
        { at: ago(2880), event: "paid_lead", source: "angi", phone: "+17205550177", evidence: "Requested a quote on Angi" }, { at: ago(2940), event: "opt_out", source: "", phone: "+17205550177", evidence: "Replied STOP" }, { at: ago(5760), event: "owner_import", source: "jobber", phone: "+17205550112", evidence: "Imported from Jobber, past customer" }, { at: ago(8640), event: "web_form", source: "web chat", phone: "+17205550150", evidence: "Asked through the website chat" }] },
    plans: plansOut(), visits: [], time: s.time.map(e => ({ ...e, customer: e.thread_id ? s.threads[e.thread_id]?.thread.customer_name ?? "" : "" })),
    customers: customers(), invoices: s.invoices.map(i => { const th = s.threads[i.thread_id]?.thread; return { ...i, paid_amount: paidOn(i.id), customer: th?.customer_name ?? "", phone: th?.customer_phone ?? "" }; }),
    payments: s.payments.map(p => ({ ...p, number: s.invoices.find(i => i.id === p.invoice_id)?.number, customer: s.threads[p.thread_id]?.thread.customer_name ?? "" })),
    winback: { past: 23, eligible: s.winbackSent ? 0 : 4, names: ["Rob", "Megan", "Luis", "Kara"], draft: winbackDraft(s.setup.trade, s.setup.owner_name, s.setup.display_name) },
  };
}

/** The Jobs board for the example business, worked out the same way the server does. */
function board(all = false): Card[] {
  const s = st(), book = parsePriceBook(s.setup.price_book);
  const d10 = (p: string) => p.replace(/\D/g, "").slice(-10);
  // Imported past customers stay off the board until they text or the owner moves them, like the server.
  const quiet = (t: { thread: Th; texts: T[] }) => t.thread.source === "import" && !t.texts.length && ["won", "lost"].includes(s.crm[t.thread.id]?.stage ?? "");
  return Object.values(s.threads).filter(t => all || !quiet(t)).map(({ thread, texts }) => {
    const c = s.crm[thread.id] ?? { details: {}, notes: "" };
    const q = s.quotes.find(x => d10(x.customer_phone) === d10(thread.customer_phone));
    const won = thread.id === "w1" || c.stage === "won";
    const quoteStatus = won ? "won" : q ? q.status : null;
    const next = s.appts.filter(a => a.thread_id === thread.id && Date.parse(a.starts_at) > Date.now() - 12 * 3600_000).map(a => a.starts_at).sort()[0] ?? null;
    const details = cleanDetails(s.setup.trade, c.details);
    const bp = s.setup.share_ballpark === "no" ? null : ballpark(book, details);
    return { id: thread.id, name: thread.customer_name, phone: thread.customer_phone, source: thread.source, status: thread.status,
      stage: stageFor({ stage: c.stage ?? null, status: thread.status, quote_status: quoteStatus, next_appt: next }), details, line: detailLine(s.setup.trade, details),
      value: c.value ?? q?.amount ?? null, ballpark: bp ? { low: bp.low, high: bp.high } : null, notes: c.notes,
      quote: q ? { id: q.id, amount: q.amount, status: q.status, steps: q.steps_sent, linked: q.linked, url: q.linked ? EXAMPLE_LINK : null, viewed: q.viewed, note: q.note, items: q.items, tax: q.tax_rate, deposit: q.deposit ?? null,
        views: q.id === "q1" ? 3 : q.viewed ? 1 : 0, lastViewed: q.viewed, chasePaused: false, nextChase: q.status === "open" ? nextChaseDay(q.sent_on, q.steps_sent) : null } : null,
      next, at: texts.at(-1)?.at ?? new Date().toISOString(), install: c.install ?? null, installTime: c.installTime ?? null, installDays: c.installDays ?? 1, onCalendar: !!c.onCalendar,
      reviewAuto: !!c.reviewAuto, reviewSent: c.reviewSent ?? null, pastCustomer: false, job: { ...(c.job ?? {}) }, costs: { materials: 0, labor: 0, other: 0, ...(c.costs ?? {}) }, invoice: s.invoices.filter(i => i.thread_id === thread.id && i.status !== "void" && !(i as { plan_id?: string }).plan_id).at(-1) ?? null,
      stageAt: c.stageAt ?? texts[0]?.at ?? null, lostReason: c.lostReason ?? "", crewMember: c.crewMember ?? "", crew: c.crew ?? "", email: c.email ?? "", remind: c.remind ?? null, photos: s.photos[thread.id] ?? [],
      changeOrders: s.cos.filter(x => x.thread_id === thread.id && x.status !== "void").map(x => ({ ...x, url: x.url ? EXAMPLE_CO : null })), reviewAfter: c.reviewSent ? null : c.reviewAfter ?? null, signoff: s.signoffs[thread.id] ?? null };
  }).sort((a, b) => b.at.localeCompare(a.at));
}

/** Every customer of the example business, the way the server lists them. */
function customers() {
  const s = st(), b = board(true);
  return b.map(c => { const inv = s.invoices.filter(i => i.thread_id === c.id && i.status !== "void");
    const won = c.stage === "won" ? (c.value ?? 0) : 0;
    return { id: c.id, name: c.name, phone: c.phone, email: c.email ?? "", address: String(c.details.address ?? ""), source: c.source, status: c.status, stage: c.stage, since: c.at, last: c.at,
      jobs: c.stage === "won" ? 1 : 0, spent: won, owed: inv.filter(i => i.status === "sent").reduce((a, i) => a + i.total, 0), open_quote: c.stage === "quoted" ? c.quote?.amount ?? null : null, line: c.line }; });
}

/** Answers the app's API calls for the example business. Throws like the real API on errors. */
export async function demoApi(path: string, b: Record<string, unknown> = {}): Promise<unknown> {
  await new Promise(r => setTimeout(r, 140));
  const s = st();
  const fail = (msg: string, status = 400) => { const e = new Error(msg) as Error & { status?: number }; e.status = status; throw e; };
  const now = new Date().toISOString();
  if (path.startsWith("/api/app/data")) {
    const rp = new URL(path, "https://x").searchParams.get("report");
    if (rp) { const r = demoReport(Number(rp) === 90 ? 90 : Number(rp) === 365 ? 365 : 30); if (!emptyDemo()) return { report: r };
      const z = { ...r.now, leads: 0, booked: 0, quoted: 0, won: 0, wonValue: 0, lost: 0, replySec: null, afterHoursLeads: 0, afterHoursWon: 0, afterHoursValue: 0, cycleDays: null, payDays: null, collected: 0, invoiced: 0, appts: 0, noShows: 0, reviews: 0 };
      return { report: { ...r, now: z, before: z, sources: [], lostReasons: [], openQuotes: { n: 0, value: 0 }, series: [] } }; }
    const th = new URL(path, "https://x").searchParams.get("thread");
    if (th) { const t = s.threads[th] ?? fail("Not found", 404); return { thread: t!.thread, texts: t!.texts.map((x, i, all) => ({ ...x, status: x.direction === "out" && x.author !== "system" ? (th === "t1" && i === all.length - 1 ? "undelivered" : "delivered") : "" })) }; }
    return emptyDemo() ? blank(data()) : crewDemo() ? asCrew(data()) : data();
  }
  if (path.startsWith("/api/app/switch")) return demoSwitch(path, b,
    list => { for (const c of list) { const id = "mv:" + c.ref; s.threads[id] = { thread: { id, customer_name: c.name, customer_phone: c.phone, source: "import", status: "closed" }, texts: [] }; s.crm[id] = { stage: "won", details: c.address ? { address: c.address } : {}, notes: "Moved in from Jobber.", email: c.email, stageAt: c.since ? c.since + "T12:00:00Z" : undefined }; } },
    () => { for (const k of Object.keys(s.threads)) if (k.startsWith("mv:")) { delete s.threads[k]; delete s.crm[k]; } });
  if (path.startsWith("/api/app/act")) {
    const t = typeof b.thread === "string" ? s.threads[b.thread] : undefined;
    if (b.action === "outcome") {
      const a = s.appts.find(x => x.id === b.appt) ?? fail("That estimate was already updated.", 409);
      s.appts = s.appts.filter(x => x !== a);
      const amt = money(b.amount), th = s.threads[a.thread_id];
      if (b.result === "quoted") {
        s.quotes.unshift({ id: "q" + Date.now(), customer_name: a.customer_name, customer_phone: a.customer_phone, amount: amt, sent_on: now.slice(0, 10), steps_sent: 0, status: "open", linked: false, viewed: null, note: "", items: [], tax_rate: 0 });
        th?.texts.push({ id: "d" + ++n, direction: "out", author: "system", body: `Quote sent${amt ? `: $${amt.toLocaleString()}` : ""}. Cinder follows up until they answer.`, at: now });
      }
      if (b.result === "won") { s.won++; s.wonValue += amt || 0; if (th) th.thread.status = "closed"; return { ok: true, review: b.review ? "sent" : "" }; }
      if (b.result === "no_show" && th) th.texts.push({ id: "d" + ++n, direction: "out", author: "template", body: "Hi, sorry we missed you today. Want to pick a new time? Reply with a day that works.", at: now });
      return { ok: true };
    }
    if (b.action === "quote") {
      const q = s.quotes.find(x => x.id === b.quote) ?? fail("That quote was already updated.", 409);
      s.quotes = s.quotes.filter(x => x !== q);
      if (b.status === "won") { s.won++; s.wonValue += money(b.amount) ?? q.amount ?? 0; }
      return { ok: true };
    }
    if (b.action === "review") { s.wonJobs = s.wonJobs.filter(j => j.id !== b.quote); return { ok: true }; }
    if (b.action === "setup") { Object.assign(s.setup, cleanOwnerSetup(b.setup)); return { ok: true }; }
    if (b.action === "testtext") return { ok: true };
    if (b.action === "assign") { const c = (s.crm[String(b.thread)] ??= { details: {}, notes: "" }); c.crewMember = String(b.member ?? ""); return { ok: true, texted: !!c.crewMember }; }
    if (b.action === "emailquote" || b.action === "emailinvoice") {
      const id = b.action === "emailquote" ? String(b.thread) : s.invoices.find(i => i.id === b.invoice)?.thread_id ?? "";
      if (!s.crm[id]?.email) fail("Add their email on the customer first.");
      return { ok: true };
    }
    if (b.action === "payment") {
      const inv = s.invoices.find(i => i.id === b.invoice) ?? fail("Which invoice?", 404);
      const bal = inv!.total - paidOn(inv!.id), amt = Math.round(Number(String(b.amount ?? "").replace(/[$,]/g, "")) * 100) / 100;
      if (!(amt > 0)) fail("Type the amount, like 1500.");
      if (amt > bal + 0.005) fail(`That's more than the ${bal.toLocaleString("en-US")} still owed.`);
      s.payments.unshift({ id: "pm" + ++n, invoice_id: inv!.id, thread_id: inv!.thread_id, amount: amt, method: cleanPayMethod(b.method), paid_on: cleanDate(b.on) ?? now.slice(0, 10), note: String(b.note ?? "") });
      if (paidOn(inv!.id) >= inv!.total - 0.005) { inv!.status = "paid"; inv!.paid_at = now; queueReview(inv!.thread_id); }
      return { ok: true, balance: Math.max(0, inv!.total - paidOn(inv!.id)) };
    }
    if (b.action === "paymentdelete") {
      const p = s.payments.find(x => x.id === b.payment) ?? fail("That payment was already removed.", 404);
      s.payments = s.payments.filter(x => x.id !== p!.id);
      const inv = s.invoices.find(i => i.id === p!.invoice_id);
      if (inv && inv.status === "paid" && paidOn(inv.id) < inv.total) { inv.status = inv.sent_at ? "sent" : "draft"; inv.paid_at = null; }
      return { ok: true };
    }
    if (b.action === "photo") { const id = String(b.data ?? ""); if (!id.startsWith("data:image/")) fail("That photo didn't come through."); (s.photos[String(b.thread)] ??= []).push({ id, kind: b.kind === "after" ? "after" : "before", caption: "", at: now, shared: false }); return { ok: true, id }; }
    if (b.action === "photodelete") { for (const k of Object.keys(s.photos)) s.photos[k] = s.photos[k].filter(p => p.id !== b.photo); return { ok: true }; }
    if (b.action === "remind") { const c = (s.crm[t!.thread.id] ??= { details: {}, notes: "" }); c.remind = b.at ? { at: String(b.at), note: String(b.note ?? ""), sent: false } : null; return { ok: true }; }
    if (b.action === "ask") {
      await new Promise(r => setTimeout(r, 700));
      const q = String(b.question ?? "").toLowerCase(), bd = board();
      const quoted = bd.filter(c => c.stage === "quoted"), paused = Object.values(s.threads).filter(t => t.thread.status === "paused");
      if (/quote/.test(q)) return { ok: true, answer: `${quoted.length} quotes are out: ${quoted.map(c => `${c.name.split(" ")[0]} (${c.quote?.amount ? "$" + c.quote.amount.toLocaleString("en-US") : "no amount"}${c.quote?.viewed ? ", opened" : ", not opened"})`).join(", ")}. Cinder follows up on its own; open Jobs to nudge one yourself.` };
      if (/owe|money|paid|invoice/.test(q)) { const owed = s.invoices.filter(i => i.status === "sent"); return { ok: true, answer: owed.length ? `${owed.length} invoices are out for ${owed.reduce((a, i) => a + i.total, 0).toLocaleString("en-US")}: ${owed.map(i => `${s.threads[i.thread_id]?.thread.customer_name.split(" ")[0]} ${i.total.toLocaleString("en-US")}`).join(", ")}. Reminders go out on their own; Money has the details.` : "Nothing is owed right now." }; }
      if (/book|week|calendar|estimate|schedule/.test(q)) return { ok: true, answer: `${s.appts.length} estimates are on the calendar: ${s.appts.map(a => `${a.customer_name.split(" ")[0]} ${new Date(a.starts_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}`).join(", ")}. Carla Mendez's install is Thursday.` };
      if (/reply|waiting|answer|needs/.test(q)) return { ok: true, answer: paused.length ? `${paused.length} waiting on you: ${paused.map(t => t.thread.customer_name).join(", ")}. Open Inbox to reply.` : "Nothing is waiting on you." };
      return { ok: true, answer: `Last 30 days: 41 leads, all answered, 14 estimates booked, ${s.wonValue.toLocaleString("en-US")} won. ${paused.length} conversation${paused.length === 1 ? "" : "s"} waiting on you and ${quoted.length} quotes out. Ask about quotes, money, the week, or who's waiting.` };
    }
    if (b.action === "reschedule") {
      const a = s.appts.find(x => x.id === b.appt); if (!a) fail("That estimate isn't open.", 409);
      const when = new Date(String(b.start)); if (!Number.isFinite(when.getTime())) fail("Pick a time.");
      a!.starts_at = when.toISOString();
      const th = s.threads[a!.thread_id]; const label = when.toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" });
      th?.texts.push({ id: "d" + ++n, direction: "out", author: "system", body: `Estimate moved to ${label}.`, at: now }, { id: "d" + ++n, direction: "out", author: "owner", body: `Hi ${th.thread.customer_name.split(" ")[0]}, Ridgeline Fence Co. here. We've moved your estimate to ${label}. If that doesn't work, reply and we'll find another time.`, at: now });
      return { ok: true, texted: true, when: label };
    }
    if (b.action === "preview") {
      // The example answers the way the agent would, without the model: a lead's question, Mike's rules, a next step.
      const m = String(b.message ?? "").toLowerCase(), o = { ...s.setup, ...cleanOwnerSetup(b.setup) };
      await new Promise(r => setTimeout(r, 600));
      const es = o.lang === "es";
      if (/call me|phone call|talk to (a )?(person|human)|someone call/.test(m)) return { ok: true, reply: es ? "Claro. Le aviso a Mike y él te llama hoy mismo." : "Of course. I'll have Mike call you today, what's a good time?", handoff: true };
      if (/saturday|weekend|sunday/.test(m)) return { ok: true, reply: /sat/i.test(o.hours || "") ? "Yes, Saturday mornings work. Want me to grab you a time to measure, 8:30 or 10:30?" : "We're out Monday to Friday. I can get you a time this week, does Thursday at 4 work?", handoff: false };
      if (/how much|price|cost|\$|quote|estimate/.test(m)) return { ok: true, reply: `Thanks for reaching out to ${o.display_name}! Cedar privacy at 6 ft usually lands around $5,700–$7,200 for 150 ft with two gates, final after we measure. Want a free estimate, Thursday at 4 or Friday at 9?`, handoff: false };
      return { ok: true, reply: `Hi, this is ${o.display_name}. Happy to help. Roughly how many feet, and what's the address? Then I can get ${o.owner_name} out to measure.`, handoff: false };
    }
    if (b.action === "lead") {
      const digits = String(b.phone ?? "").replace(/\D/g, "").slice(-10);
      if (digits.length !== 10) fail("Add a 10-digit phone number.");
      const id = "n" + Date.now();
      s.threads[id] = { thread: { id, customer_name: String(b.name ?? ""), customer_phone: "+1" + digits, source: "owner", status: "paused" }, texts: [{ id: "d" + ++n, direction: "in", author: "system", body: "Added by you", at: now }] };
      s.crm[id] = { details: cleanDetails(s.setup.trade, b.details), notes: String(b.notes ?? ""), stage: "new" };
      return { ok: true, id };
    }
    if (b.action === "import") {
      const rows = cleanImportRows(b.rows);
      if (!rows.length) fail("No rows with a phone number to import.");
      const as = importAs(b.as);
      let added = 0, existing = 0;
      for (const r of rows) {
        if (Object.values(s.threads).some(t => t.thread.customer_phone.slice(-10) === r.phone.slice(-10))) { existing++; continue; }
        const id = "im" + ++n;
        s.threads[id] = { thread: { id, customer_name: r.name, customer_phone: r.phone, source: "import", status: as === "leads" ? "paused" : "closed" }, texts: [] };
        s.crm[id] = { details: r.address ? { address: r.address } : {}, notes: r.notes, stage: as === "leads" ? "new" : "won" };
        added++;
      }
      return { ok: true, added, existing, as };
    }
    if (b.action === "stage" || b.action === "card") {
      const th = typeof b.thread === "string" ? s.threads[b.thread] : undefined;
      if (!th) fail("Not found", 404);
      const c = (s.crm[th!.thread.id] ??= { details: {}, notes: "" });
      if (b.action === "card") {
        if (b.details !== undefined) c.details = cleanDetails(s.setup.trade, b.details);
        if (typeof b.crew === "string") c.crew = b.crew;
        if (typeof b.email === "string") c.email = b.email.trim().toLowerCase();
        if (typeof b.notes === "string") c.notes = b.notes;
        if (b.value !== undefined) c.value = money(b.value);
        if (b.install !== undefined) c.install = cleanDate(b.install);
        if (b.review !== undefined) c.reviewAuto = !!b.review;
        return { ok: true };
      }
      const stage = String(b.stage);
      if (!(STAGES as readonly string[]).includes(stage)) fail("Unknown stage.");
      const amt = money(b.amount), d10 = th!.thread.customer_phone.replace(/\D/g, "").slice(-10);
      const q = s.quotes.find(x => x.customer_phone.replace(/\D/g, "").slice(-10) === d10);
      if (stage === "quoted") {
        if (q) Object.assign(q, { amount: amt ?? q.amount, steps_sent: 0, sent_on: now.slice(0, 10), status: "open" });
        if (q && typeof b.note === "string") q.note = b.note.trim().slice(0, 600);
        if (q && b.deposit !== undefined) q.deposit = money(b.deposit);
        const qq = s.quotes.find(x => x.customer_phone.replace(/\D/g, "").slice(-10) === d10);
        if (qq && b.items !== undefined) { qq.items = cleanItems(b.items); qq.tax_rate = cleanTax(b.tax); qq.amount = totals(qq.items, qq.tax_rate).total; c.value = qq.amount; }
        if (q && b.link) { q.linked = true; th!.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: quoteSms(th!.thread.customer_name, q.amount, th!.thread.id), at: now }); }
        else s.quotes.unshift({ id: "q" + Date.now(), customer_name: th!.thread.customer_name, customer_phone: th!.thread.customer_phone, amount: amt, sent_on: now.slice(0, 10), steps_sent: 0, status: "open", linked: false, viewed: null, note: "", items: [], tax_rate: 0 });
        const nq = s.quotes.find(x => x.customer_phone.replace(/\D/g, "").slice(-10) === d10)!;
        if (typeof b.note === "string") nq.note = b.note.trim().slice(0, 600);
        if (b.link) { nq.linked = true; th!.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: quoteSms(th!.thread.customer_name, nq.amount, th!.thread.id), at: now }); }
        th!.texts.push({ id: "d" + ++n, direction: "out", author: "system", body: `Quote sent${amt ? `: $${amt.toLocaleString()}` : ""}. Cinder follows up until they answer.`, at: now });
      }
      if (stage === "won" || stage === "lost") {
        if (q) s.quotes = s.quotes.filter(x => x !== q);
        if (stage === "won") { s.won++; s.wonValue += amt ?? q?.amount ?? 0; }
        th!.thread.status = "closed";
        th!.texts.push({ id: "d" + ++n, direction: "out", author: "system", body: stage === "won" ? `Job won${amt ? `: ${amt.toLocaleString()}` : ""}` : typeof b.reason === "string" && b.reason ? `Marked lost: ${b.reason}. Follow-ups stopped.` : "Marked lost. Follow-ups stopped.", at: now });
      }
      if (stage === "won") { c.install = cleanDate(b.install); c.installTime = typeof b.time === "string" ? b.time : null; c.installDays = Number(b.days) || 1; c.onCalendar = !!c.install; c.reviewAuto = !!b.review; }
      c.stage = stage; c.stageAt = now; if (stage === "lost") c.lostReason = typeof b.reason === "string" ? b.reason : ""; if (amt) c.value = amt;
      return stage === "quoted" && b.link ? { ok: true, sent: true, link: EXAMPLE_LINK } : stage === "won" && c.install ? { ok: true, calendar: "added" } : { ok: true };
    }
    if (b.action === "quotelink" || b.action === "reviewnow") {
      const th = typeof b.thread === "string" ? s.threads[b.thread] : undefined;
      if (!th) fail("Not found", 404);
      if (b.action === "reviewnow") { (s.crm[th!.thread.id] ??= { details: {}, notes: "" }).reviewSent = now; th!.texts.push({ id: "d" + ++n, direction: "out", author: "template", body: "Hi, thanks again for choosing Ridgeline Fence Co. Would you leave us a quick Google review? It really helps a small business: https://g.page/r/example", at: now }); return { ok: true }; }
      const d10 = th!.thread.customer_phone.replace(/\D/g, "").slice(-10);
      const q = s.quotes.find(x => x.customer_phone.replace(/\D/g, "").slice(-10) === d10) ?? fail("Move them to Quoted first.", 409);
      if (b.send === false) return { ok: true, link: EXAMPLE_LINK, sent: false };
      if (typeof b.note === "string" && b.note) q.note = b.note.trim().slice(0, 600);
      q.linked = true; th!.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: quoteSms(th!.thread.customer_name, q.amount, th!.thread.id), at: now });
      return { ok: true, link: EXAMPLE_LINK, sent: true };
    }
    if (b.action === "jobstep" || b.action === "jobcosts") {
      const c = (s.crm[String(b.thread)] ??= { details: {}, notes: "" });
      if (b.action === "jobcosts") { const o = (b.costs ?? {}) as Record<string, unknown>; const v = (x: unknown) => Math.max(0, Math.round(Number(String(x ?? "").replace(/[$,]/g, "")) || 0)); c.costs = { materials: v(o.materials), labor: v(o.labor), other: v(o.other) }; return { ok: true }; }
      const job = (c.job ??= {}); if (b.done) job[String(b.step)] = now.slice(0, 10); else delete job[String(b.step)]; return { ok: true, job };
    }
    if (b.action === "quotelines" || b.action === "install" || b.action === "invoice") {
      const th = typeof b.thread === "string" ? s.threads[b.thread] : undefined;
      if (!th) fail("Not found", 404);
      const c = (s.crm[th!.thread.id] ??= { details: {}, notes: "" });
      const d10 = th!.thread.customer_phone.replace(/\D/g, "").slice(-10);
      const q = s.quotes.find(x => x.customer_phone.replace(/\D/g, "").slice(-10) === d10);
      if (b.action === "quotelines") {
        if (!q) fail("Move them to Quoted first.", 409);
        const items = cleanItems(b.items); if (!items.length) fail("Add at least one line with a price.");
        q!.items = items; q!.tax_rate = cleanTax(b.tax); q!.amount = totals(items, q!.tax_rate).total; c.value = q!.amount;
        if (typeof b.note === "string") q!.note = b.note;
        if (b.deposit !== undefined) q!.deposit = money(b.deposit);
        if (b.send) { q!.linked = true; th!.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: quoteSms(th!.thread.customer_name, q!.amount, th!.thread.id), at: now }); return { ok: true, sent: true, link: EXAMPLE_LINK }; }
        return { ok: true, total: q!.amount };
      }
      if (b.action === "install") { c.install = cleanDate(b.install); c.installTime = typeof b.time === "string" ? b.time : null; c.installDays = Number(b.days) || 1; c.onCalendar = !!c.install; return { ok: true, calendar: c.install ? "added" : "removed" }; }
      const open = s.invoices.find(i => i.thread_id === th!.thread.id && (i.status === "draft" || i.status === "sent") && !(i as { plan_id?: string }).plan_id);
      if (open) return { ok: true, invoice: open };
      const items: Item[] = q?.items?.length ? q.items : [{ name: `${detailLine("Fence", cleanDetails("Fence", c.details)) || "Job"}, installed`, qty: 1, unit: "", price: c.value ?? q?.amount ?? 0 }];
      for (const co of s.cos.filter(x => x.thread_id === th!.thread.id && x.status === "approved" && !x.invoiced)) { items.push(...changeOrderLines(co)); co.invoiced = true; }
      const inv = { id: "iv" + Date.now(), thread_id: th!.thread.id, number: 1001 + s.invoices.length + 41, status: "draft", items, tax_rate: q?.tax_rate ?? 0, total: totals(items, q?.tax_rate ?? 0).total, note: "",
        due_on: at(7, 12).slice(0, 10), sent_at: null, viewed_at: null, paid_at: null, paid_claimed_at: null, reminders: 0, reminders_paused: false, url: null } as CardInvoice & { thread_id: string };
      s.invoices.push(inv);
      return { ok: true, invoice: inv };
    }
    if (b.action === "invoicesave" || b.action === "invoicesend" || b.action === "invoiceset") {
      const inv = s.invoices.find(i => i.id === b.invoice) ?? fail("Which invoice?", 404);
      if (b.action === "invoicesave") { if (b.items !== undefined) inv.items = cleanItems(b.items); if (b.tax !== undefined) inv.tax_rate = cleanTax(b.tax); if (typeof b.note === "string") inv.note = b.note; if (b.due !== undefined) inv.due_on = cleanDate(b.due); inv.total = totals(inv.items, inv.tax_rate).total; return { ok: true }; }
      if (b.action === "invoicesend") { inv.status = "sent"; inv.sent_at ??= now; inv.url = EXAMPLE_INVOICE; const th = s.threads[inv.thread_id];
        th?.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: `Hi ${(th.thread.customer_name || "").split(" ")[0]}, here's invoice #${inv.number} from Ridgeline Fence Co for $${inv.total.toLocaleString("en-US")}. You can see it and pay here: https://app.cinderrevenue.com/i/example`, at: now });
        return { ok: true, sent: true, link: EXAMPLE_INVOICE }; }
      const what = String(b.what);
      if (what === "paid") { const left = inv.total - paidOn(inv.id); if (left > 0) s.payments.unshift({ id: "pm" + ++n, invoice_id: inv.id, thread_id: inv.thread_id, amount: left, method: "other", paid_on: now.slice(0, 10), note: "Marked paid in full" }); inv.status = "paid"; inv.paid_at = now; queueReview(inv.thread_id); }
      else if (what === "unpaid") { s.payments = s.payments.filter(p => p.invoice_id !== inv.id); inv.status = inv.sent_at ? "sent" : "draft"; inv.paid_at = null; }
      else if (what === "void") inv.status = "void"; else if (what === "pause" || what === "resume") inv.reminders_paused = what === "pause";
      return { ok: true };
    }
    // Service plans, change orders, crew hours, the review after payment: the same rules as the server, in memory.
    if (b.action === "plan") {
      const p = cleanPlan(b.input); if (!p.ok) fail(p.error);
      const v = (p as Extract<ReturnType<typeof cleanPlan>, { ok: true }>).plan;
      const ex = s.plans.find(x => x.id === b.plan);
      if (ex) Object.assign(ex, v); else s.plans.push({ id: "pl" + ++n, thread_id: String(b.thread), ...v, status: "active", visits_done: 0, last_on: null, created_at: now });
      return { ok: true };
    }
    if (b.action === "planset") { const p = s.plans.find(x => x.id === b.plan) ?? fail("Which plan?", 404); p!.status = b.what === "pause" ? "paused" : b.what === "resume" ? "active" : "ended"; return { ok: true }; }
    if (b.action === "visit") {
      const p = s.plans.find(x => x.id === b.plan && x.status === "active") ?? fail("That plan isn't active.", 409);
      const on = p!.next_on!, next = addInterval(on, p!.every, p!.unit), done = !b.skip;
      p!.next_on = p!.ends_on && next > p!.ends_on ? null : next; if (!p!.next_on) p!.status = "ended";
      if (done) { p!.visits_done++; p!.last_on = on; }
      let invoice: string | null = null;
      if (done && p!.invoice) { const inv = { id: "iv" + Date.now(), thread_id: p!.thread_id, number: 1001 + s.invoices.length + 41, status: "sent", items: p!.items, tax_rate: p!.tax_rate, total: p!.total, note: `${p!.name}, visit on ${on}`,
          due_on: at(7, 12).slice(0, 10), sent_at: now, viewed_at: null, paid_at: null, paid_claimed_at: null, reminders: 0, reminders_paused: false, url: EXAMPLE_INVOICE, plan_id: p!.id } as CardInvoice & { thread_id: string };
        s.invoices.push(inv); invoice = inv.id; }
      s.threads[p!.thread_id]?.texts.push({ id: "d" + ++n, direction: "out", author: "system", body: done ? `${p!.name}: visit on ${on} done.${invoice ? ` Invoice for ${p!.total.toLocaleString("en-US")} texted.` : ""}` : `${p!.name}: visit on ${on} skipped.`, at: now });
      return { ok: true, next: p!.next_on, invoice, sent: !!invoice };
    }
    if (b.action === "co") {
      const v = cleanChangeOrder(b.input); if (!v.ok) fail(v.error);
      const x = v as Extract<ReturnType<typeof cleanChangeOrder>, { ok: true }>;
      let co = s.cos.find(c => c.id === b.co);
      if (co) Object.assign(co, { title: x.title, items: x.items, tax_rate: x.tax_rate, total: x.total, note: x.note });
      else { co = { id: "co" + ++n, thread_id: String(b.thread), number: s.cos.filter(c => c.thread_id === b.thread).length + 1, title: x.title, items: x.items, tax_rate: x.tax_rate, total: x.total, note: x.note, status: "draft", url: null, sent_at: null, viewed_at: null, decided_at: null, signed_by: "", invoiced: false }; s.cos.push(co); }
      if (b.send) { co.status = "sent"; co.sent_at ??= now; co.url = EXAMPLE_CO; s.threads[co.thread_id]?.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: `Here's change order #${co.number} (${co.title}) for ${co.total.toLocaleString("en-US")}. You can look it over and approve it here: https://app.cinderrevenue.com/c/example`, at: now }); return { ok: true, sent: true, link: EXAMPLE_CO }; }
      return { ok: true, id: co.id };
    }
    if (b.action === "cosend") { const co = s.cos.find(c => c.id === b.co) ?? fail("Which change order?", 404); co!.status = "sent"; co!.sent_at ??= now; co!.url = EXAMPLE_CO; return { ok: true, sent: true, link: EXAMPLE_CO }; }
    if (b.action === "coset") {
      const co = s.cos.find(c => c.id === b.co && (c.status === "draft" || c.status === "sent")) ?? fail("That change order was already answered.", 409);
      co!.status = b.what === "approved" ? "approved" : "void"; co!.decided_at = now;
      if (co!.status === "approved") {
        const open = s.invoices.find(i => i.thread_id === co!.thread_id && (i.status === "draft" || i.status === "sent") && !(i as { plan_id?: string }).plan_id); if (open) { open.items = [...open.items, ...changeOrderLines(co!)]; open.total = totals(open.items, open.tax_rate).total; co!.invoiced = true; } }
      return { ok: true };
    }
    if (b.action === "clockin" || b.action === "clockout") {
      const me = crewDemo() ? "+17205550188" : "";
      for (const e of s.time) if (e.member === me && !e.ended_at) e.ended_at = now;
      if (b.action === "clockin") s.time.unshift({ id: "tm" + ++n, thread_id: typeof b.thread === "string" ? b.thread : null, member: me, started_at: now, ended_at: null, note: "" });
      return { ok: true };
    }
    if (b.action === "timeedit") { if (b.remove) s.time = s.time.filter(e => e.id !== b.entry); return { ok: true }; }
    if (b.action === "catalog") { s.setup.catalog = JSON.stringify(cleanCatalog(b.items)); return { ok: true }; }
    if (b.action === "portallink") { const link = (typeof location !== "undefined" ? location.origin : "") + "/p/example"; if (b.send) s.threads[String(b.thread)]?.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: `Here's your page with your quotes, invoices and upcoming visits, any time: https://app.cinderrevenue.com/p/example`, at: now }); return { ok: true, link, sent: !!b.send }; }
    if (b.action === "quotechase") { const d10 = (p: string) => p.replace(/D/g, "").slice(-10), th = s.threads[String(b.thread)], q = th && s.quotes.find(x => d10(x.customer_phone) === d10(th.thread.customer_phone)); if (q) q.status = b.on ? "open" : "stopped"; return { ok: true }; }
    if (b.action === "quotenudge") { s.threads[String(b.thread)]?.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: "Hi, it's Mike. Checking in on your quote. Any questions I can answer? Here it is: https://app.cinderrevenue.com/q/example", at: now }); return { ok: true }; }
    if (b.action === "qbosync") return { ok: true, invoices: 1, payments: 2 };
    if (b.action === "signoff") {
      const v = cleanSignoff(b.input); if (!v.ok) fail(v.error);
      const x = v as Extract<ReturnType<typeof cleanSignoff>, { ok: true }>, id = String(b.thread);
      s.signoffs[id] = { id: x.signature, thread_id: id, signed_by: x.signedBy, at: now, note: x.note, checklist: x.checklist, member: crewDemo() ? "+17205550188" : "" };
      const c = (s.crm[id] ??= { details: {}, notes: "" }), job = (c.job ??= {}); job.installed ??= now.slice(0, 10); job.walk ??= now.slice(0, 10);
      s.threads[id]?.texts.push({ id: "d" + ++n, direction: "in", author: "system", body: `Job signed off by ${x.signedBy}`, at: now });
      return { ok: true };
    }
    if (b.action === "reviewcancel") { const c = s.crm[String(b.thread)]; if (c) c.reviewAfter = null; return { ok: true }; }
    if (b.action === "winback") {
      const w = cleanWinback(b.body, s.setup.display_name);
      if (!w.ok) fail(w.error, 409);
      if (s.winbackSent) fail("No past customers can get this text right now.", 409);
      s.winbackSent = true;
      return { ok: true, sent: 4, left: 0 };
    }
    if (b.action === "message") { s.messages.push({ author: "client", body: String(b.body ?? ""), created_at: now }); return { ok: true }; }
    if (!t) fail("Not found", 404);
    if (b.action === "reply") { t!.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: String(b.body ?? ""), at: now }); t!.thread.status = "paused"; }
    if (b.action === "status") t!.thread.status = String(b.status);
    if (b.action === "call") fail("In the real app, this rings your cell and connects you to the customer.", 400);
    return { ok: true };
  }
  return { ok: true };
}
