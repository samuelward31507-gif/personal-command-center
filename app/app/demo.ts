// The example business behind /app?demo=1: the real app over an in-memory copy of its API,
// so Sam (and prospects on a call) can click through exactly what a client sees. Nothing leaves the browser.
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
    t4: { thread: { id: "t4", customer_name: "Priya Shah", customer_phone: "+17205550163", source: "quote", status: "auto" }, texts: [
      tx("in", "system", "Quote sent: $6,200 horizontal cedar. Follow-up started.", 60 * 74),
      tx("out", "template", "Hi Priya, Mike here. Happy to walk through the quote.", 60 * 26)] },
    t5: { thread: { id: "t5", customer_name: "", customer_phone: "+13035550199", source: "text", status: "closed" }, texts: [
      tx("in", "customer", "Do you do gates?", 60 * 52),
      tx("out", "ai", "We do. Single walk gates start around $450 installed. Want me to set up a time to measure?", 60 * 51),
      tx("in", "customer", "Thanks, we went with someone else.", 60 * 50)] },
  };
  return {
    threads,
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
      { id: "q1", customer_name: "Lena Ortiz", customer_phone: "+17205550191", amount: 7800 as number | null, sent_on: at(-6, 12).slice(0, 10), steps_sent: 2, status: "open" },
      { id: "q2", customer_name: "Kyle Brandt", customer_phone: "+13035550133", amount: 12400 as number | null, sent_on: at(-3, 12).slice(0, 10), steps_sent: 1, status: "open" },
      { id: "q3", customer_name: "Jen Park", customer_phone: "+17205550120", amount: 4650 as number | null, sent_on: at(-1, 12).slice(0, 10), steps_sent: 0, status: "open" }],
    won: 3, wonValue: 19400,
  };
}

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
    owner: "Mike", appointments: s.appts, quotes: s.quotes, quoteSteps: 4,
    calendar: { connected: true, email: "mike@ridgelinefence.com", events: s.events, error: "", connectUrl: "#" },
    messages: s.messages,
  };
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
        s.quotes.unshift({ id: "q" + Date.now(), customer_name: a.customer_name, customer_phone: a.customer_phone, amount: amt, sent_on: now.slice(0, 10), steps_sent: 0, status: "open" });
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
    if (b.action === "message") { s.messages.push({ author: "client", body: String(b.body ?? ""), created_at: now }); return { ok: true }; }
    if (!t) fail("Not found", 404);
    if (b.action === "reply") { t!.texts.push({ id: "d" + ++n, direction: "out", author: "owner", body: String(b.body ?? ""), at: now }); t!.thread.status = "paused"; }
    if (b.action === "status") t!.thread.status = String(b.status);
    if (b.action === "call") fail("In the real app, this rings your cell and connects you to the customer.", 400);
    return { ok: true };
  }
  return { ok: true };
}
