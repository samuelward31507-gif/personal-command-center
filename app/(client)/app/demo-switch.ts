// The switch-over center in the example business: a believable Jobber account to move in on a sales call. Its records go
// through the same mappers, merge rules and preview as a real pull; nothing leaves the browser.
import { dedupe, emptyStaged, jobberClient, jobberInvoice, jobberItem, jobberJob, jobberPlan, jobberQuote, mergeStaged, previewOf, cleanStaged, type Decisions, type Staged } from "@/lib/switch";

const FIRST = ["Dana", "Mike", "Lena", "Tom", "Priya", "Carlos", "Jen", "Rob", "Megan", "Luis", "Kara", "Sam", "Ashley", "Bill", "Grace", "Omar", "Hannah", "Eli", "Nora", "Ben", "Tess", "Raj", "Maya", "Cole"];
const LAST = ["Ruiz", "Turner", "Ortiz", "Becker", "Shah", "Mendez", "Park", "Hill", "Kim", "Brandt", "Lopez", "Smith", "Nguyen", "Patel", "Reed", "Foster", "Hayes", "Price", "Cruz", "Ward", "Lane", "Fox"];
const STREETS = ["Oak Dr", "Aspen Ct", "Willow Ln", "Cherry St", "Elm St", "Maple Ave", "Ridge Rd", "Pine Way", "Cedar Pl", "Birch Ct", "Spruce St", "Juniper Dr"];
const CITIES = [["Littleton", "80120"], ["Englewood", "80110"], ["Centennial", "80122"], ["Highlands Ranch", "80126"], ["Castle Rock", "80104"], ["Parker", "80134"]];
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function jobberAccount() {
  const clients: Record<string, unknown>[] = [];
  for (let i = 0; i < 412; i++) {
    const f = FIRST[i % FIRST.length], l = LAST[(i * 7) % LAST.length], [city, zip] = CITIES[i % CITIES.length];
    const missing = i % 69 === 5;                                     // 6 with no phone
    const phone = missing ? "" : `(720) 5${String(55 + (i % 4)).padStart(2, "0")}-${String(1000 + i).slice(-4)}`;
    clients.push({ id: `c${i}`, name: `${f} ${l}`, firstName: f, lastName: l, createdAt: day(-900 + i * 2) + "T15:00:00Z",
      phones: phone ? [{ number: phone, primary: true }] : [], emails: [{ address: `${f}.${l}${i}@example.com`.toLowerCase(), primary: true }],
      billingAddress: { street1: `${100 + i * 3} ${STREETS[i % STREETS.length]}`, city, province: "CO", postalCode: zip },
      clientProperties: { nodes: i % 40 === 3 ? [{ id: `p${i}a`, address: { street1: `${100 + i * 3} ${STREETS[i % STREETS.length]}`, city, province: "CO", postalCode: zip } }, { id: `p${i}b`, address: { street1: `${20 + i} Mountain View Rd`, city: "Evergreen", province: "CO", postalCode: "80439" } }] : [] },
      notes: { nodes: i % 25 === 0 ? [{ message: "Dog in the back yard. Gate code 4418.", fileAttachments: { nodes: [{ fileName: "site-photo.jpg", url: "https://example.com/files/site-photo.jpg" }] } }] : [] } });
  }
  // Three people entered twice in Jobber over the years (same phone).
  for (const k of [11, 120, 301]) clients.push({ ...clients[k], id: `c${k}dup`, name: String(clients[k].name).split(" ")[0] + " " + String(clients[k].lastName).charAt(0) + ".", createdAt: day(-30) + "T15:00:00Z", notes: { nodes: [] }, clientProperties: { nodes: [] } });
  const c = (i: number) => ({ id: `c${i}` });
  const fence = ["6 ft cedar privacy", "Vinyl privacy", "Chain link", "Ranch rail", "Horizontal cedar", "Aluminum"];
  const quotes = Array.from({ length: 47 }, (_, i) => { const ft = 80 + (i * 13) % 160, price = [43, 48, 22, 15, 52, 61][i % 6], status = i < 27 ? "awaiting_response" : i < 39 ? "approved" : "archived";
    return { id: `q${i}`, quoteNumber: 1300 + i, quoteStatus: status, title: `${ft} ft ${fence[i % 6]}`, createdAt: day(-40 + i) + "T16:00:00Z", sentAt: day(-38 + i) + "T16:00:00Z", client: c(i * 7 + 2),
      amounts: { total: ft * price + 550 }, lineItems: { nodes: [{ name: `${fence[i % 6]}, installed`, quantity: ft, unitPrice: price }, { name: "Walk gate", quantity: 1, unitPrice: 550 }] } }; });
  const jobs = Array.from({ length: 54 }, (_, i) => ({ id: `j${i}`, jobNumber: 800 + i, title: `${fence[i % 6]} install`, jobStatus: i < 14 ? "upcoming" : "archived", jobType: "ONE_OFF",
    startAt: (i < 14 ? day(2 + i * 2) : day(-200 + i * 3)) + "T14:00:00Z", total: 4200 + (i * 377) % 6000, client: c(i * 5 + 1) }));
  const plans = Array.from({ length: 31 }, (_, i) => ({ id: `r${i}`, jobNumber: 900 + i, title: i % 2 ? "Seasonal fence wash" : "Stain and seal", jobStatus: "active", jobType: "RECURRING", startAt: day(5 + i * 3) + "T15:00:00Z", total: i % 2 ? 240 : 1350, client: c(i * 11 + 4) }));
  const unpaid = [1480, 960, 2200, 640, 1850, 1120, 1530, 700, 1000];  // 9 invoices, $11,480 owed
  const invoices = [...unpaid.map((t, i) => ({ id: `iu${i}`, invoiceNumber: 2100 + i, invoiceStatus: i < 3 ? "past_due" : "awaiting_payment", subject: "Fence work", issuedDate: day(-20 + i), dueDate: day(-6 + i * 2), client: c(i * 9 + 3), amounts: { total: t, invoiceBalance: t } })),
    ...Array.from({ length: 50 }, (_, i) => ({ id: `ip${i}`, invoiceNumber: 2000 + i, invoiceStatus: "paid", subject: "Fence install", issuedDate: day(-300 + i * 5), dueDate: day(-290 + i * 5), client: c(i * 8), amounts: { total: 3000 + (i * 211) % 7000, invoiceBalance: 0 } }))];
  const products = Array.from({ length: 58 }, (_, i) => ({ id: `pr${i}`, name: i < 6 ? `${fence[i]}, per ft` : i < 12 ? `Walk gate, ${3 + (i % 3)} ft ${["cedar", "vinyl", "chain link"][i % 3]}` : `${["Post", "Rail", "Picket", "Cap", "Hinge", "Latch", "Stain", "Concrete"][i % 8]} ${["replacement", "repair", "upgrade", "add-on"][i % 4]} ${i}`, defaultUnitCost: 12 + (i * 37) % 600 }));
  return { clients, requests: [] as Record<string, unknown>[], quotes, jobs: [...jobs, ...plans], invoices, productOrServices: products };
}

const KINDS = ["clients", "requests", "quotes", "jobs", "invoices", "productOrServices"] as const;
type View = { id: string; source: string; status: string; preview: ReturnType<typeof previewOf> | null; pull: { kind: number; done: boolean; counts: Record<string, number>; warnings: string[] }; progress: number; total: number;
  result: Record<string, { created: number; updated: number; skipped: number }>; error: string; created_at: string; finished_at: string | null; undone_at: string | null; canUndo: boolean; existing: number };
const S: { imp: (View & { staged: Staged; decisions: Decisions }) | null; golive: Record<string, string>; start: string | null; resend: { quotes: number; invoices: number } } = { imp: null, golive: {}, start: null, resend: { quotes: 2, invoices: 1 } };
const out = () => S.imp ? { import: (({ staged: _s, decisions: _d, ...v }) => { void _s; void _d; return v; })({ ...S.imp, preview: S.imp.staged.customers.length + S.imp.staged.items.length ? previewOf(S.imp.staged, S.imp.decisions) : null }) } : { import: null };

/** Answers /api/app/switch for the example business. `land` adds the moved customers to the example's own list. */
export function demoSwitch(path: string, b: Record<string, unknown>, land: (customers: { ref: string; name: string; phone: string; email: string; address: string; since: string | null }[]) => void, unland: () => void): unknown {
  const a = String(b.action ?? "");
  if (!a) return { ...out(), golive: S.golive, goliveStart: S.start, resend: S.imp?.status === "done" ? S.resend : { quotes: 0, invoices: 0 } };
  if (a === "resend") { const sent = S.resend.quotes + S.resend.invoices; S.resend = { quotes: 0, invoices: 0 }; return { ok: true, sent, waiting: 0, failed: 0, left: S.resend }; }
  const now = new Date().toISOString();
  if (a === "golive") { if (b.done) S.golive[String(b.key)] = now.slice(0, 10); else delete S.golive[String(b.key)]; return { ok: true }; }
  if (a === "start") { if (!S.imp || S.imp.status !== "draft") S.imp = { id: "demo-import", source: String(b.source), status: "draft", staged: emptyStaged(), decisions: {}, preview: null, pull: { kind: 0, done: false, counts: {}, warnings: [] }, progress: 0, total: 0, result: {}, error: "", created_at: now, finished_at: null, undone_at: null, canUndo: false, existing: 3 }; else S.imp.source = String(b.source); return { ok: true, ...out() }; }
  const imp = S.imp; if (!imp) throw Object.assign(new Error("Start a move first."), { status: 400 });
  if (a === "clear") { imp.staged = emptyStaged(); imp.decisions = {}; imp.pull = { kind: 0, done: false, counts: {}, warnings: [] }; return { ok: true, ...out() }; }
  if (a === "stage") { imp.staged = mergeStaged(imp.staged, cleanStaged(b.rows)); return { ok: true, ...out() }; }
  if (a === "decide") { imp.decisions = (b.decisions ?? {}) as Decisions; return { ok: true, ...out() }; }
  if (a === "pull") {
    if (imp.source !== "jobber" && imp.source !== "quickbooks") throw Object.assign(new Error("This source comes in from files."), { status: 400 });
    const acct = jobberAccount(), kind = KINDS[imp.pull.kind], add = emptyStaged(), list = acct[kind];
    for (const n of list) {
      if (kind === "clients") add.customers.push(jobberClient(n));
      else if (kind === "quotes") add.quotes.push(jobberQuote(n));
      else if (kind === "jobs") { const pl = jobberPlan(n); if (pl) add.plans.push(pl); else add.jobs.push(jobberJob(n)); }
      else if (kind === "invoices") add.invoices.push(jobberInvoice(n));
      else if (kind === "productOrServices") add.items.push(jobberItem(n));
    }
    imp.staged = mergeStaged(imp.staged, add); imp.pull.counts[kind] = list.length; imp.pull.kind++; imp.pull.done = imp.pull.kind >= KINDS.length;
    return { ok: true, ...out() };
  }
  if (a === "run") {
    if (imp.status === "draft") { imp.status = "running"; const p = previewOf(imp.staged, imp.decisions); imp.total = p.customers + p.missingPhone.length + imp.staged.quotes.length + imp.staged.jobs.length + imp.staged.invoices.length + imp.staged.plans.length + 1; imp.progress = 0; }
    imp.progress = Math.min(imp.total, imp.progress + 60);
    if (imp.progress >= imp.total) {
      const p = previewOf(imp.staged, imp.decisions), { customers } = dedupe(imp.staged.customers, imp.decisions.splits);
      const withPhone = customers.filter(c => c.phone || imp.decisions.phones?.[c.ref]);
      land(withPhone.map(c => ({ ref: c.ref, name: c.name, phone: c.phone || "+1" + String(imp.decisions.phones![c.ref]).replace(/\D/g, "").slice(-10), email: c.email, address: c.properties[0]?.address ?? "", since: c.since ?? null })));
      imp.status = "done"; imp.finished_at = now; imp.canUndo = true; S.start ??= now.slice(0, 10);
      imp.result = { customers: { created: withPhone.length - 3, updated: 3, skipped: customers.length - withPhone.length }, merged: { created: 0, updated: 0, skipped: p.merged }, quotes: { created: imp.staged.quotes.filter(q => q.status !== "draft").length, updated: 0, skipped: 0 },
        jobs: { created: p.scheduledJobs, updated: imp.staged.jobs.length - p.scheduledJobs, skipped: 0 }, invoices: { created: imp.staged.invoices.length, updated: 0, skipped: 0 }, plans: { created: imp.staged.plans.length, updated: 0, skipped: 0 }, items: { created: imp.staged.items.length, updated: 0, skipped: 0 } };
      return { ok: true, done: true, ...out() };
    }
    return { ok: true, done: false, ...out() };
  }
  if (a === "undo") { unland(); imp.status = "undone"; imp.undone_at = now; imp.canUndo = false; const v = out(); S.imp = null; return { ok: true, ...v }; }
  throw Object.assign(new Error("Unknown action."), { status: 400 });
}
