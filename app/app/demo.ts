// The example business behind /app?demo=1: the real app over an in-memory copy of its API,
// so Sam (and prospects on a call) can click through exactly what a client sees. Nothing leaves the browser.
import { ballpark, cleanDate, cleanDetails, cleanOwnerSetup, cleanWinback, detailLine, parsePriceBook, stageFor, STAGES, winbackDraft, type Card, type Details } from "@/lib/crm";
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
      tx("out", "owner", "Hi Carla, here's your quote from Ridgeline Fence Co: $6,900 for 150 ft · 6 ft Vinyl · 1 gate. You can look it over and approve it here: https://app.cinderrevenue.com/q/example", 60 * 24 * 5),
      tx("in", "system", "Approved the quote online: $6,900", 60 * 24 * 4)] },
    w3: { thread: { id: "w3", customer_name: "Bill Turner", customer_phone: "+13035550187", source: "angi", status: "closed" }, texts: [
      tx("in", "system", "Job won: $11,200", 60 * 24 * 16)] },
    l2: { thread: { id: "l2", customer_name: "Ashley Kim", customer_phone: "+13035550141", source: "thumbtack", status: "closed" }, texts: [
      tx("in", "system", "Passed on the quote online: \u201cWent with a cheaper bid\u201d", 60 * 24 * 7)] },
  };
  const crm: Record<string, { stage?: string; details: Details; value?: number | null; notes: string; install?: string | null; reviewAuto?: boolean; reviewSent?: string | null }> = {
    t1: { details: { length_ft: 140, material: "cedar", height: "6 ft", gates: 1, address: "2210 Oak Dr, Littleton" }, notes: "Asked about financing. Call him." },
    t2: { details: { length_ft: 80, material: "Wood privacy", height: "6 ft", gates: 1, hoa: "No" }, notes: "Replacing chain link." },
    t3: { details: { material: "Vinyl" }, notes: "" },
    t4: { details: { length_ft: 120, material: "Horizontal cedar", gates: 2, hoa: "Yes" }, notes: "HOA needs drawings before install.", value: 6200 },
    t5: { details: {}, notes: "Went with someone else." },
    q1: { details: { length_ft: 160, material: "Vinyl", height: "6 ft", gates: 1, hoa: "Yes" }, notes: "", value: 7800 },
    q2: { details: { length_ft: 900, material: "Ranch rail", gates: 2 }, notes: "Horses. Needs it before spring.", value: 12400 },
    q3: { details: { length_ft: 110, material: "Chain link", height: "5 ft", gates: 1 }, notes: "", value: 4650 },
    w1: { details: { length_ft: 220, material: "cedar", height: "6 ft", gates: 2 }, notes: "Install done. Ask for a review.", value: 8600 },
    w2: { stage: "won", details: { length_ft: 150, material: "Vinyl", height: "6 ft", gates: 1 }, notes: "Approved from the link.", value: 6900, install: at(4, 8).slice(0, 10), reviewAuto: true },
    w3: { stage: "won", details: { length_ft: 260, material: "Wood privacy", height: "6 ft", gates: 2 }, notes: "", value: 11200, install: at(-12, 8).slice(0, 10), reviewSent: at(-11, 9) },
    l2: { stage: "lost", details: { length_ft: 90, material: "Chain link", height: "4 ft" }, notes: "Went with a cheaper bid." },
  };
  const setup: Record<string, string> = { display_name: "Ridgeline Fence Co.", owner_name: "Mike", trade: "Fence", website: "https://ridgelinefence.example", team_size: "2-5 people", years: "6-10 years",
    leads_month: "10-30", lead_sources: "Phone calls, Website form, Google, Angi", software: "None, just my phone", share_ballpark: "yes", priority: "quotes", onboarded_at: "2026-11-01T15:00:00.000Z",
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
      { id: "e1", title: "Henderson install (cedar, 220 ft)", start: at(1, 9, 30), end: at(1, 16), allDay: false, link: GC },
      { id: "e2", title: "Material pickup", start: at(2, 7), end: at(2, 8), allDay: false, link: GC },
      { id: "e4", title: "Crew off", start: at(3, 0), end: at(4, 0), allDay: true, link: GC }],
    quotes: [
      { id: "q1", customer_name: "Lena Ortiz", customer_phone: "+17205550191", amount: 7800 as number | null, sent_on: at(-6, 12).slice(0, 10), steps_sent: 2, status: "open", linked: true, viewed: ago(60 * 3) as string | null, note: "Remove old wood fence, 6 ft white vinyl privacy, one 4 ft gate." },
      { id: "q2", customer_name: "Kyle Brandt", customer_phone: "+13035550133", amount: 12400 as number | null, sent_on: at(-3, 12).slice(0, 10), steps_sent: 1, status: "open", linked: true, viewed: null as string | null, note: "" },
      { id: "q3", customer_name: "Jen Park", customer_phone: "+17205550120", amount: 4650 as number | null, sent_on: at(-1, 12).slice(0, 10), steps_sent: 0, status: "open", linked: false, viewed: null as string | null, note: "" }],
    winbackSent: false,
    won: 5, wonValue: 37500,
    wonJobs: [{ id: "w1", customer_name: "Henderson family", customer_phone: "+17205550110", amount: 8600 as number | null, won_at: at(-9, 12) }],
  };
}

const EXAMPLE_LINK = (typeof location !== "undefined" ? location.origin : "") + "/q/example";
const quoteSms = (name: string, amount: number | null, id: string) => {
  const d = st().crm[id]; const line = d ? detailLine("Fence", cleanDetails("Fence", d.details)) : "";
  return `Hi ${name.split(" ")[0] || "there"}, here's your quote from Ridgeline Fence Co${amount ? `: $${amount.toLocaleString("en-US")}${line ? ` for ${line}` : ""}` : ""}. You can look it over and approve it here: https://app.cinderrevenue.com/q/example`;
};

let S: ReturnType<typeof seed> | null = null;
const st = () => (S ??= seed());
const money = (v: unknown) => Number(String(v ?? "").replace(/[$,\s]/g, "").replace(/k$/i, "000")) || null;

function data() {
  const s = st();
  const conversations = Object.values(s.threads).map(({ thread, texts }) => {
    const last = texts.filter(x => x.author !== "system").at(-1) ?? texts.at(-1)!;
    const ask = texts.filter(x => x.direction === "in" && x.author !== "system").at(-1)?.body ?? "";
    return { id: thread.id, name: thread.customer_name || "(303) 555-0199", source: thread.source, status: thread.status, at: last.at, last: last.body, ask };
  }).sort((a, b) => b.at.localeCompare(a.at));
  return {
    project: "demo", business: "Ridgeline Fence Co. (example)", number: "+17205550100", canCall: true,
    businesses: [{ project_id: "demo", name: "Ridgeline Fence Co. (example)" }], unreadFromSam: 0,
    live: { leads: 41, needs: conversations.filter(c => c.status === "paused").length, answered: 41, booked: 14, replySec: 9,
      chasing: s.quotes.length, chasingValue: s.quotes.reduce((t, q) => t + (q.amount || 0), 0), won: s.won, wonValue: s.wonValue, revived: 4, reviews: 11,
      weeks: [{ week: "a", leads: 8, booked: 3 }, { week: "b", leads: 11, booked: 4 }, { week: "c", leads: 9, booked: 3 }, { week: "d", leads: 13, booked: 4 }], conversations },
    owner: "Mike", appointments: s.appts, quotes: s.quotes, quoteSteps: 4, wonJobs: s.wonJobs, hasReviewLink: true,
    calendar: { connected: true, email: "mike@ridgelinefence.com", events: s.events, error: "", connectUrl: "#" },
    messages: s.messages, board: board(), setup: { ...s.setup, has_review_link: "yes", has_number: "yes" },
    winback: { past: 23, eligible: s.winbackSent ? 0 : 4, names: ["Rob", "Megan", "Luis", "Kara"], draft: winbackDraft(s.setup.trade, s.setup.owner_name, s.setup.display_name) },
  };
}

/** The Jobs board for the example business, worked out the same way the server does. */
function board(): Card[] {
  const s = st(), book = parsePriceBook(s.setup.price_book);
  const d10 = (p: string) => p.replace(/\D/g, "").slice(-10);
  return Object.values(s.threads).map(({ thread, texts }) => {
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
      quote: q ? { id: q.id, amount: q.amount, status: q.status, steps: q.steps_sent, linked: q.linked, url: q.linked ? EXAMPLE_LINK : null, viewed: q.viewed, note: q.note } : null,
      next, at: texts.at(-1)?.at ?? new Date().toISOString(), install: c.install ?? null, reviewAuto: !!c.reviewAuto, reviewSent: c.reviewSent ?? null, pastCustomer: false };
  }).sort((a, b) => b.at.localeCompare(a.at));
}

/** Answers the app's API calls for the example business. Throws like the real API on errors. */
export async function demoApi(path: string, b: Record<string, unknown> = {}): Promise<unknown> {
  await new Promise(r => setTimeout(r, 140));
  const s = st();
  const fail = (msg: string, status = 400) => { const e = new Error(msg) as Error & { status?: number }; e.status = status; throw e; };
  const now = new Date().toISOString();
  if (path.startsWith("/api/app/data")) {
    const th = new URL(path, "https://x").searchParams.get("thread");
    return th ? (s.threads[th] ?? fail("Not found", 404)) : data();
  }
  if (path.startsWith("/api/app/act")) {
    const t = typeof b.thread === "string" ? s.threads[b.thread] : undefined;
    if (b.action === "outcome") {
      const a = s.appts.find(x => x.id === b.appt) ?? fail("That estimate was already updated.", 409);
      s.appts = s.appts.filter(x => x !== a);
      const amt = money(b.amount), th = s.threads[a.thread_id];
      if (b.result === "quoted") {
        s.quotes.unshift({ id: "q" + Date.now(), customer_name: a.customer_name, customer_phone: a.customer_phone, amount: amt, sent_on: now.slice(0, 10), steps_sent: 0, status: "open", linked: false, viewed: null, note: "" });
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
    if (b.action === "lead") {
      const digits = String(b.phone ?? "").replace(/\D/g, "").slice(-10);
      if (digits.length !== 10) fail("Add a 10-digit phone number.");
      const id = "n" + Date.now();
      s.threads[id] = { thread: { id, customer_name: String(b.name ?? ""), customer_phone: "+1" + digits, source: "owner", status: "paused" }, texts: [{ id: "d" + ++n, direction: "in", author: "system", body: "Added by you", at: now }] };
      s.crm[id] = { details: cleanDetails(s.setup.trade, b.details), notes: String(b.notes ?? ""), stage: "new" };
      return { ok: true, id };
    }
    if (b.action === "stage" || b.action === "card") {
      const th = typeof b.thread === "string" ? s.threads[b.thread] : undefined;
      if (!th) fail("Not found", 404);
      const c = (s.crm[th!.thread.id] ??= { details: {}, notes: "" });
      if (b.action === "card") {
        if (b.details !== undefined) c.details = cleanDetails(s.setup.trade, b.details);
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
        if (q && b.link) { q.linked = true; th!.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: quoteSms(th!.thread.customer_name, q.amount, th!.thread.id), at: now }); }
        else s.quotes.unshift({ id: "q" + Date.now(), customer_name: th!.thread.customer_name, customer_phone: th!.thread.customer_phone, amount: amt, sent_on: now.slice(0, 10), steps_sent: 0, status: "open", linked: false, viewed: null, note: "" });
        const nq = s.quotes.find(x => x.customer_phone.replace(/\D/g, "").slice(-10) === d10)!;
        if (typeof b.note === "string") nq.note = b.note.trim().slice(0, 600);
        if (b.link) { nq.linked = true; th!.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: quoteSms(th!.thread.customer_name, nq.amount, th!.thread.id), at: now }); }
        th!.texts.push({ id: "d" + ++n, direction: "out", author: "system", body: `Quote sent${amt ? `: $${amt.toLocaleString()}` : ""}. Cinder follows up until they answer.`, at: now });
      }
      if (stage === "won" || stage === "lost") {
        if (q) s.quotes = s.quotes.filter(x => x !== q);
        if (stage === "won") { s.won++; s.wonValue += amt ?? q?.amount ?? 0; }
        th!.thread.status = "closed";
        th!.texts.push({ id: "d" + ++n, direction: "out", author: "system", body: stage === "won" ? `Job won${amt ? `: $${amt.toLocaleString()}` : ""}` : "Marked lost. Follow-ups stopped.", at: now });
      }
      if (stage === "won") { c.install = cleanDate(b.install); c.reviewAuto = !!b.review; }
      c.stage = stage; if (amt) c.value = amt;
      return stage === "quoted" && b.link ? { ok: true, sent: true, link: EXAMPLE_LINK } : { ok: true };
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
