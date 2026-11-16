import { appSession, bridgeCall, clientFor, db, json } from "@/lib/client-app-run";
import { askCinder, markNoShow, previewReply, rescheduleAppointment, sendReviewRequest, sendToCustomer } from "@/lib/client-runtime-run";
import { sendSms } from "@/lib/twilio";
import { sendCustomerEmail } from "@/lib/client-email";
import { quoteUrl } from "@/lib/client-runtime-run";
import { invoiceUrl } from "@/lib/client-billing-run";
import { cleanOwnerSetup } from "@/lib/crm";
import { parseAmount } from "@/lib/client-schedule";
import { digits10 } from "@/lib/client-runtime";
import { sendAlert } from "@/lib/notify";
import { replyToFor } from "@/lib/client-lead-mail-run";
import { addExpense, deleteExpense } from "@/lib/client-expenses-run";
import { addFile, removeEquipment, removeFile, saveEquipment, saveTask, serviceEquipment, setTask } from "@/lib/client-records-run";
import { setPhone, addLead, addPhoto, assignCrew, importCustomers, moveStage, removePhoto, saveCard, saveOwnerSetup, setJobCosts, setJobStep, setReminder } from "@/lib/client-crm-run";
import { reviewNow, sendQuoteLink, sendWinback } from "@/lib/client-close-run";
import { createInvoice, deletePayment, recordPayment, saveInvoice, saveQuoteLines, scheduleInstall, sendInvoice, setInvoice } from "@/lib/client-billing-run";
import { clockIn, clockOut, editTime, planVisit, saveChangeOrder, savePlan, sendChangeOrder, setChangeOrder, setPlan } from "@/lib/client-service-run";
import { portalLink, saveSignoff } from "@/lib/client-portal-run";
import { saveProperty, setChecklist, tickChecklist } from "@/lib/client-parity-run";
import { qboSyncAll } from "@/lib/qbo";
import { cleanCatalog } from "@/lib/service";
import { addMailLead, dismissMail } from "@/lib/client-lead-mail-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["auto", "paused", "booked", "closed"]);
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * POST { p, action, ... } for the signed-in owner:
 *  reply { thread, body } — text the customer from the business number; Cinder steps back on that conversation.
 *  status { thread, status } — auto (Cinder handles it) | paused (you handle it) | booked | closed
 *  call { thread } — ring your cell, then connect the customer from the business number.
 *  message { body } — write to Sam.
 *  outcome { appt, result, amount?, review? } — how an estimate went: quoted (Cinder follows up on the quote), won (counts the job,
 *    optionally asks for a Google review), no_show (texts them to rebook).
 *  quote { quote, status, amount? } — a quote Cinder is chasing was won or lost.
 *  stage { thread, stage, amount?, link?, note?, install?, review? } — move a card. Quoted with link texts the customer a quote they
 *    can approve; won with install and review asks for a Google review the day after the install.
 *  quotelink { thread, note? } — text (or re-text) the quote link. reviewnow { thread } — the job's done: ask for the review now.
 *  winback { body } — the owner's text to past customers who agreed to offers.
 *  import { rows, as?, consent?, from? } — the owner's existing customers from a Jobber export or a spreadsheet, up to 250 a call; nobody gets texted.
 *  quotelines { thread, items, tax?, note?, send? } — the quote's lines (the owner sends it himself). install { thread, install, time?, days? } — on Google Calendar.
 *  invoice { thread } — a draft invoice for the job. invoicesave / invoicesend / invoiceset { invoice, ... } — edit, text it, paid | unpaid | void | pause | resume.
 */
export async function POST(req: Request) {
  const s = appSession(req);
  if (!s) return json({ error: "Sign in" }, 401);
  const b = await req.json().catch(() => ({})) as { p?: string; action?: string; thread?: string; body?: string; status?: string; appt?: string; result?: string; amount?: string; review?: boolean; quote?: string;
    setup?: unknown; stage?: string; details?: unknown; value?: string | null; notes?: string; name?: string; phone?: string;
    link?: boolean; note?: string; install?: string | null; send?: boolean;
    items?: unknown; tax?: unknown; time?: string | null; days?: number; invoice?: string; what?: string; due?: string | null; step?: string; done?: boolean; on?: string; costs?: unknown;
    rows?: unknown; as?: unknown; consent?: unknown; from?: unknown; reason?: string; message?: string; deposit?: unknown; crew?: string; start?: string; question?: string; email?: string; at?: string | null; method?: string; payment?: string; data?: string; kind?: string; caption?: string; photo?: string; member?: string;
    plan?: string; input?: unknown; skip?: boolean; tags?: unknown; referredBy?: unknown; tag?: string; percent?: number; rest?: boolean; statement?: boolean; co?: string; entry?: string; end?: string | null; remove?: boolean };
  try {
    const sql = db();
    const c = await clientFor(sql, s, b.p);
    if (!c) return json({ error: "Sign in" }, 401);
    // The crew sees the schedule and the jobs and can text, call, tick steps, leave notes and clock hours. Money and settings stay with the owner.
    if (s.role === "crew" && !["reply", "status", "call", "jobstep", "card", "reschedule", "outcome", "photo", "clockin", "clockout", "visit", "signoff", "checktick", "expense", "equipment", "equipservice", "fileadd"].includes(String(b.action))) return json({ error: "Only the owner can do that." }, 403);
    if (s.role === "crew" && c.setup.crew_scope === "assigned") {
      const me10 = (s.phone || "").replace(/\D/g, "").slice(-10);
      const tid = b.thread && UUID.test(b.thread) ? b.thread : null;
      const [own] = tid ? await sql`SELECT crew_member FROM public.client_threads WHERE id = ${tid}::uuid AND project_id = ${c.projectId}::uuid` as { crew_member: string | null }[]
        : b.appt && UUID.test(b.appt) ? await sql`SELECT coalesce(a.crew_member, t.crew_member) AS crew_member FROM public.client_appointments a JOIN public.client_threads t ON t.id = a.thread_id WHERE a.id = ${b.appt}::uuid AND a.project_id = ${c.projectId}::uuid` as { crew_member: string | null }[]
        : [{ crew_member: me10 }];
      if ((tid || b.appt) && String(own?.crew_member ?? "").replace(/\D/g, "").slice(-10) !== me10) return json({ error: "That job isn't assigned to you." }, 403);
    }
    if (s.role === "crew" && b.action === "card") { b.details = undefined; b.value = undefined; b.notes = undefined; b.review = undefined; b.email = undefined; }
    // Crew hours: the person signed in clocks in on a job (or general time) and out again. The owner is "".
    // Office staff run the business day to day; settings and the team stay with the owner.
    if (s.role === "office" && b.action === "setup") return json({ error: "Only the owner can change settings." }, 403);
    const member = s.role !== "owner" && s.phone ? "+1" + s.phone.replace(/\D/g, "").slice(-10) : "";
    if (b.action === "clockin") {
      if (b.thread && !UUID.test(b.thread)) return json({ error: "Which job?" }, 400);
      const r = await clockIn(sql, c, member, b.thread || null, b.at);
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 400);
    }
    if (b.action === "clockout") { const r = await clockOut(sql, c, member, b.note, b.at); return r.ok ? json({ ok: true, minutes: r.minutes }) : json({ error: r.error }, 409); }
    // The end of the job: the customer signs on the phone, the install and walk-through steps tick.
    if (b.action === "signoff") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which job?" }, 400);
      const r = await saveSignoff(sql, c, b.thread, b.input, member);
      if (!r.ok) return json({ error: r.error }, 400);
      // The owner's choice at sign-off: the Google review ask now, and the invoice texted now (the job's done).
      const o = (b.input && typeof b.input === "object" ? b.input : {}) as { review?: boolean; invoice?: boolean };
      let review = "", invoice = "";
      if (o.review) { const rv = await reviewNow(sql, c, b.thread); review = rv.ok ? "sent" : rv.error ?? ""; }
      if (o.invoice && s.role !== "crew") { const inv = await createInvoice(sql, c, b.thread); if (inv.ok && inv.invoice) { const sent = await sendInvoice(sql, c, inv.invoice.id); invoice = sent.sent ? "sent" : sent.warn ?? sent.error ?? ""; } else invoice = inv.error ?? ""; }
      return json({ ok: true, id: r.id, review, invoice });
    }
    // The job's checklist: picked by the owner, ticked on the job by whoever's there.
    if (b.action === "checktick") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which job?" }, 400);
      const r = await tickChecklist(sql, c, b.thread, Number(b.step), !!b.done, member || "owner");
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 400);
    }
    if (b.action === "visit") {
      if (!b.plan || !UUID.test(b.plan)) return json({ error: "Which plan?" }, 400);
      const r = await planVisit(sql, c, b.plan, { skip: !!b.skip, member });
      return r.ok ? json({ ok: true, next: r.next, invoice: r.invoice, sent: r.sent, warn: r.warn }) : json({ error: r.error }, 409);
    }
    // The CRM: the owner's own setup, moving a customer between stages, editing a card, adding a lead by hand.
    if (b.action === "setup") { const saved = await saveOwnerSetup(sql, c, b.setup); return json({ ok: true, setup: saved }); }
    if (b.action === "lead") {
      const r = await addLead(sql, c, { name: b.name, phone: b.phone, details: b.details, notes: b.notes, stage: b.stage });
      return r.ok ? json({ ok: true, id: r.id }) : json({ error: r.error }, 400);
    }
    if (b.action === "import") {
      const r = await importCustomers(sql, c, b.rows, { as: b.as, consent: b.consent, from: b.from });
      return r.ok ? json({ ok: true, added: r.added, existing: r.existing, as: r.as }) : json({ error: r.error }, 400);
    }
    if (b.action === "stage" || b.action === "card") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      const amount = b.amount ? parseAmount(b.amount) : null;
      if (b.amount && amount == null) return json({ error: "Type the amount as a number, like 9400." }, 400);
      if (b.action === "stage") {
        const r = await moveStage(sql, c, b.thread, String(b.stage), amount, { install: b.install, review: b.review, reason: b.reason });
        if (!r.ok) return json({ error: r.error }, 409);
        // Won with an install date: it goes on the owner's Google Calendar.
        if (b.stage === "won" && b.install !== undefined) { const s2 = await scheduleInstall(sql, c, b.thread, { date: b.install, time: b.time, days: b.days }); return json({ ok: true, calendar: s2.calendar }); }
        // Quoted with lines: the owner's lines and tax set the total. Nothing goes to the customer unless he asked.
        if (b.stage === "quoted" && b.items !== undefined) { const l = await saveQuoteLines(sql, c, b.thread, { items: b.items, tax: b.tax, note: b.note, deposit: b.deposit }); if (!l.ok) return json({ error: l.error }, 400); }
        if (b.stage !== "quoted" || !b.link) return json({ ok: true });
        // Quoted, and the owner wants the customer to have it: text the link they approve from.
        const l = await sendQuoteLink(sql, c, b.thread, b.note);
        return json({ ok: true, link: l.url ?? "", sent: l.sent, warn: l.sent ? "" : l.error ?? "" });
      }
      let value: number | null | undefined;
      if (b.value !== undefined) { value = b.value === null || b.value === "" ? null : parseAmount(String(b.value)); if (b.value && value == null) return json({ error: "Type the job value as a number, like 9400." }, 400); }
      const r = await saveCard(sql, c, b.thread, { tags: s.role === "crew" ? undefined : b.tags, referredBy: s.role === "crew" ? undefined : b.referredBy, details: b.details, value, notes: b.notes, crew: b.crew, name: b.name, email: b.email, install: b.install, review: b.review });
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 404);
    }
    if (b.action === "quotelink" || b.action === "reviewnow") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      if (b.action === "reviewnow") { const r = await reviewNow(sql, c, b.thread); return r.ok ? json({ ok: true }) : json({ error: r.error }, 409); }
      const l = await sendQuoteLink(sql, c, b.thread, b.note, b.send !== false);
      return l.ok ? json({ ok: true, link: l.url ?? "", sent: l.sent, warn: l.sent ? "" : l.error ?? "" }) : json({ error: l.error }, 409);
    }
    if (b.action === "quotelines" || b.action === "install" || b.action === "invoice") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      if (b.action === "quotelines") {
        const l = await saveQuoteLines(sql, c, b.thread, { items: b.items, tax: b.tax, note: b.note, deposit: b.deposit });
        if (!l.ok) return json({ error: l.error }, 400);
        if (!b.send) return json({ ok: true, total: l.total });
        const q = await sendQuoteLink(sql, c, b.thread);
        return json({ ok: true, total: l.total, link: q.url ?? "", sent: q.sent, warn: q.sent ? "" : q.error ?? "" });
      }
      if (b.action === "install") { const r = await scheduleInstall(sql, c, b.thread, { date: b.install, time: b.time, days: b.days }); return r.ok ? json({ ok: true, calendar: r.calendar }) : json({ error: r.error }, 404); }
      const r = await createInvoice(sql, c, b.thread, b.percent || b.rest ? { percent: b.percent, rest: b.rest } : undefined);
      return r.ok ? json({ ok: true, invoice: r.invoice }) : json({ error: r.error }, 409);
    }
    if (b.action === "invoicesave" || b.action === "invoicesend" || b.action === "invoiceset") {
      if (!b.invoice || !UUID.test(b.invoice)) return json({ error: "Which invoice?" }, 400);
      if (b.action === "invoicesave") { const r = await saveInvoice(sql, c, b.invoice, { items: b.items, tax: b.tax, note: b.note, due: b.due }); return r.ok ? json({ ok: true }) : json({ error: r.error }, 409); }
      if (b.action === "invoicesend") { const r = await sendInvoice(sql, c, b.invoice); return r.ok ? json({ ok: true, sent: r.sent, link: r.url ?? "", warn: r.warn ?? "" }) : json({ error: r.error }, 409); }
      const what = String(b.what);
      if (!["paid", "unpaid", "void", "pause", "resume"].includes(what)) return json({ error: "Unknown change." }, 400);
      const r = await setInvoice(sql, c, b.invoice, what as "paid");
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 409);
    }
    if (b.action === "jobstep" || b.action === "jobcosts") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      if (b.action === "jobcosts") { const r = await setJobCosts(sql, c, b.thread, b.costs); return r.ok ? json({ ok: true }) : json({ error: r.error }, 404); }
      const r = await setJobStep(sql, c, b.thread, b.step, !!b.done, b.on);
      return r.ok ? json({ ok: true, job: r.job }) : json({ error: r.error }, 400);
    }
    // Service plans: a visit every N weeks or months, reminded the day before and invoiced after each visit.
    if (b.action === "plan") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      const r = await savePlan(sql, c, b.thread, b.plan, b.input);
      return r.ok ? json({ ok: true, id: r.id }) : json({ error: r.error }, 400);
    }
    if (b.action === "planset") {
      if (!b.plan || !UUID.test(b.plan) || !["pause", "resume", "end"].includes(String(b.what))) return json({ error: "Which plan?" }, 400);
      const r = await setPlan(sql, c, b.plan, b.what as "pause");
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 409);
    }
    // Change orders: extra work mid-job, approved by the customer from a link (or in person), added to the invoice.
    if (b.action === "co") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which job?" }, 400);
      const r = await saveChangeOrder(sql, c, b.thread, b.co, b.input);
      if (!r.ok) return json({ error: r.error }, 400);
      if (!b.send) return json({ ok: true, id: r.id });
      const s2 = await sendChangeOrder(sql, c, r.id!);
      return json({ ok: true, id: r.id, sent: s2.sent, link: s2.url ?? "", warn: s2.sent ? "" : s2.warn ?? s2.error ?? "" });
    }
    if (b.action === "cosend" || b.action === "coset") {
      if (!b.co || !UUID.test(b.co)) return json({ error: "Which change order?" }, 400);
      if (b.action === "cosend") { const r = await sendChangeOrder(sql, c, b.co); return r.ok ? json({ ok: true, sent: r.sent, link: r.url ?? "", warn: r.warn ?? "" }) : json({ error: r.error }, 409); }
      if (b.what !== "approved" && b.what !== "void") return json({ error: "Unknown change." }, 400);
      const r = await setChangeOrder(sql, c, b.co, b.what);
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 409);
    }
    if (b.action === "timeedit") {
      if (!b.entry || !UUID.test(b.entry)) return json({ error: "Which entry?" }, 400);
      const r = await editTime(sql, c, b.entry, { remove: b.remove, start: b.start, end: b.end });
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 400);
    }
    // The price list: lines saved once, picked on every quote and invoice. Office staff keep it too.
    if (b.action === "catalog") {
      const list = cleanCatalog(b.items);
      await sql`UPDATE public.client_ops SET setup = setup || jsonb_build_object('catalog', ${JSON.stringify(list)}::text), updated_at = now() WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
      return json({ ok: true, count: list.length });
    }
    // The photo report: the finished job's After photos, on the customer's page, in one text.
    if (b.action === "photoreport") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which job?" }, 400);
      const [n] = await sql`SELECT count(*)::int AS n FROM public.client_photos WHERE thread_id = ${b.thread}::uuid AND project_id = ${c.projectId}::uuid AND (kind = 'after' OR shared)` as { n: number }[];
      if (!n?.n) return json({ error: "Take a few After photos on the job first." }, 409);
      const r = await portalLink(sql, c, b.thread);
      if (!r.ok) return json({ error: r.error }, 404);
      const [t] = await sql`SELECT customer_phone, customer_name FROM public.client_threads WHERE id = ${b.thread}::uuid` as { customer_phone: string; customer_name: string }[];
      const firstName = (t.customer_name || "").split(" ")[0];
      const ok = await sendToCustomer(sql, c, b.thread, t.customer_phone, `Hi${firstName ? " " + firstName : ""}, it's ${(c.setup.display_name || "us").replace(/\.+$/, "")}. Here are the photos of your finished job (${n.n}): ${r.url}`, "owner");
      return ok ? json({ ok: true }) : json({ error: "That text didn't go. Check the number, or copy the customer page link instead." }, 502);
    }
    // The customer's own page: copy the link, or text it to them.
    if (b.action === "portallink") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      const r = await portalLink(sql, c, b.thread);
      if (!r.ok) return json({ error: r.error }, 404);
      if (!b.send) return json({ ok: true, link: r.url });
      const [t] = await sql`SELECT customer_phone, customer_name, status FROM public.client_threads WHERE id = ${b.thread}::uuid` as { customer_phone: string; customer_name: string; status: string }[];
      if (t.status === "opted_out") return json({ ok: true, link: r.url, sent: false, warn: "They opted out of texts. Copy the link and email it instead." });
      if (!c.setup.texting_number) return json({ ok: true, link: r.url, sent: false, warn: "Your texting number isn't connected yet. Copy the link instead." });
      const firstName = (t.customer_name || "").split(" ")[0];
      const [owe] = b.statement ? await sql`SELECT count(*)::int AS n, coalesce(sum(total - paid_amount), 0)::float AS owed FROM public.client_invoices WHERE thread_id = ${b.thread}::uuid AND status = 'sent'` as { n: number; owed: number }[] : [];
      if (b.statement && !owe?.n) return json({ error: "Nothing is owed on this customer." }, 409);
      const biz = (c.setup.display_name || "us").replace(/\.+$/, "");
      const ok = await sendToCustomer(sql, c, b.thread, t.customer_phone, b.statement
        ? `Hi${firstName ? " " + firstName : ""}, it's ${biz}. Your statement: ${owe.n} open ${owe.n === 1 ? "invoice" : "invoices"}, $${owe.owed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in all. See each one and pay here: ${r.url}`
        : `Hi${firstName ? " " + firstName : ""}, it's ${biz}. Here's your page with your quotes, invoices and upcoming visits, any time: ${r.url}`, "owner");
      return json({ ok: true, link: r.url, sent: ok, warn: ok ? "" : "The text didn't send. Copy the link instead." });
    }
    if (b.action === "checklist") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which job?" }, 400);
      const r = await setChecklist(sql, c, b.thread, b.name ? String(b.name) : null);
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 400);
    }
    // A lead email that came without a phone: the owner adds the number (nobody is texted), or dismisses it.
    if (b.action === "expense") { const r = await addExpense(sql, c, member, b.input); return r.ok ? json({ ok: true, id: r.id }) : json({ error: r.error }, 400); }
    if (b.action === "expensedelete") { if (!b.entry || !UUID.test(b.entry)) return json({ error: "Which expense?" }, 400); const r = await deleteExpense(sql, c, b.entry); return r.ok ? json({ ok: true }) : json({ error: r.error }, 404); }
    // Equipment at the customer's address, documents on the job, the office's to-dos.
    if (b.action === "equipment") { if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400); const r = await saveEquipment(sql, c, b.thread, b.entry && UUID.test(b.entry) ? b.entry : null, b.input); return r.ok ? json({ ok: true, id: r.id }) : json({ error: r.error }, 400); }
    if (b.action === "equipservice") { if (!b.entry || !UUID.test(b.entry)) return json({ error: "Which one?" }, 400); const r = await serviceEquipment(sql, c, b.entry, b.note, member); return r.ok ? json({ ok: true }) : json({ error: r.error }, 404); }
    if (b.action === "equipremove") { if (!b.entry || !UUID.test(b.entry)) return json({ error: "Which one?" }, 400); return json(await removeEquipment(sql, c, b.entry)); }
    if (b.action === "fileadd") { if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400); const r = await addFile(sql, c, b.thread, b.input, member); return r.ok ? json({ ok: true, id: r.id }) : json({ error: r.error }, 400); }
    if (b.action === "fileremove") { if (!b.entry || !UUID.test(b.entry)) return json({ error: "Which document?" }, 400); return json(await removeFile(sql, c, b.entry)); }
    if (b.action === "task") { const r = await saveTask(sql, c, b.input, member); return r.ok ? json({ ok: true, id: r.id }) : json({ error: r.error }, 400); }
    if (b.action === "taskdone") { if (!b.entry || !UUID.test(b.entry)) return json({ error: "Which to-do?" }, 400); return json(await setTask(sql, c, b.entry, b.done !== false)); }
    if (b.action === "setphone") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      const r = await setPhone(sql, c, b.thread, String(b.phone ?? ""));
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 400);
    }
    if (b.action === "mailadd" || b.action === "maildismiss") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which email?" }, 400);
      if (b.action === "maildismiss") return json(await dismissMail(sql, c, b.thread));
      const r = await addMailLead(sql, c, b.thread, String(b.phone ?? ""), b.name);
      return r.ok ? json({ ok: true, id: r.id }) : json({ error: r.error }, 400);
    }
    if (b.action === "property") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      const r = await saveProperty(sql, c, b.thread, (b.input ?? {}) as Record<string, unknown>);
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 400);
    }
    if (b.action === "qbosync") { const r = await qboSyncAll(sql, c.projectId); return r.error ? json({ error: r.error }, 502) : json({ ok: true, invoices: r.invoices, payments: r.payments }); }
    if (b.action === "quotechase" || b.action === "quotenudge") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      const [q] = await sql`SELECT q.id, q.status, q.token, t.id AS thread_id, t.customer_phone, t.customer_name, t.status AS thread_status FROM public.client_threads t JOIN public.client_quotes q ON q.project_id = t.project_id AND q.kind = 'quote'
          AND right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10)
        WHERE t.id = ${b.thread}::uuid AND t.project_id = ${c.projectId}::uuid ORDER BY q.created_at DESC LIMIT 1` as { id: string; status: string; token: string | null; thread_id: string; customer_phone: string; customer_name: string; thread_status: string }[];
      if (!q) return json({ error: "No quote on this customer." }, 404);
      if (b.action === "quotechase") {
        if (b.on) await sql`UPDATE public.client_quotes SET chase_paused = false, status = CASE WHEN status = 'stopped' THEN 'open' ELSE status END WHERE id = ${q.id}::uuid`;
        else await sql`UPDATE public.client_quotes SET status = CASE WHEN status IN ('open', 'replied') THEN 'stopped' ELSE status END WHERE id = ${q.id}::uuid`;
        return json({ ok: true });
      }
      if (q.thread_status === "opted_out") return json({ error: "They opted out of texts. Call instead." }, 409);
      if (!c.setup.texting_number) return json({ error: "Your texting number isn't set up yet." }, 409);
      const firstName = (q.customer_name || "").split(" ")[0];
      const ok = await sendToCustomer(sql, c, q.thread_id, q.customer_phone, `Hi${firstName ? " " + firstName : ""}, it's ${(c.setup.owner_name || "").split(" ")[0] || (c.setup.display_name || "us")}. Checking in on your quote. Any questions I can answer?${q.token ? ` Here it is: ${quoteUrl(q.token)}` : ""}`, "owner");
      return ok ? json({ ok: true }) : json({ error: "The text didn't send. Try again." }, 502);
    }
    if (b.action === "reviewcancel") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      await sql`UPDATE public.client_threads SET review_after = NULL WHERE id = ${b.thread}::uuid AND project_id = ${c.projectId}::uuid`;
      return json({ ok: true });
    }
    if (b.action === "winback") { const r = await sendWinback(sql, c, b.body, 150, b.tag); return r.ok ? json({ ok: true, sent: r.sent, left: r.left }) : json({ error: r.error }, 409); }
    if (b.action === "ask") {
      const q = String(b.question ?? "").trim().slice(0, 500);
      if (!q) return json({ error: "Ask something." }, 400);
      const a = await askCinder(sql, c, q);
      return a ? json({ ok: true, answer: a }) : json({ error: "Cinder couldn't answer just now." }, 503);
    }
    if (b.action === "assign") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which job?" }, 400);
      const r = await assignCrew(sql, c, b.thread, b.member ?? "", (to, body) => sendSms(to, c.setup.texting_number || "", body));
      return r.ok ? json({ ok: true, texted: r.texted }) : json({ error: r.error }, 400);
    }
    if (b.action === "emailquote" || b.action === "emailinvoice") {
      const quote = b.action === "emailquote";
      const [row] = quote
        ? await sql`SELECT q.id, q.token, q.amount::float AS amount, t.customer_name, t.customer_email, t.id AS thread FROM public.client_threads t JOIN public.client_quotes q ON q.project_id = t.project_id AND q.kind = 'quote' AND q.status IN ('open', 'replied')
            AND right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 10)
            WHERE t.id = ${b.thread ?? "00000000-0000-0000-0000-000000000000"}::uuid AND t.project_id = ${c.projectId}::uuid ORDER BY q.created_at DESC LIMIT 1` as Record<string, unknown>[]
        : await sql`SELECT i.id, i.token, i.number, (i.total - i.paid_amount)::float AS amount, i.due_on::text AS due_on, t.customer_name, t.customer_email, t.id AS thread FROM public.client_invoices i JOIN public.client_threads t ON t.id = i.thread_id
            WHERE i.id = ${b.invoice ?? "00000000-0000-0000-0000-000000000000"}::uuid AND i.project_id = ${c.projectId}::uuid AND i.status IN ('sent', 'draft')` as Record<string, unknown>[];
      if (!row) return json({ error: quote ? "Save the quote first." : "That invoice isn't open." }, 404);
      if (!row.token) return json({ error: quote ? "Text or copy the quote link once first, then email it." : "Send the invoice once first, then email it." }, 409);
      const to = String(row.customer_email ?? "");
      if (!to) return json({ error: "Add their email on the customer first." }, 409);
      const firstName = String(row.customer_name ?? "").split(" ")[0], biz = c.setup.display_name || "", amt = Number(row.amount) || 0;
      const money = amt.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: amt % 1 ? 2 : 0 });
      // Replies come back onto this customer's record when receiving is set up; until then, to the owner's own inbox.
      const r = await sendCustomerEmail({ to, business: biz, replyTo: replyToFor(String(row.thread)) || c.setup.alert_email || undefined,
        subject: quote ? `Your quote from ${biz}` : `Invoice #${row.number} from ${biz}`,
        lines: quote ? [`Hi${firstName ? " " + firstName : ""},`, `Here's your quote${amt ? ` for ${money}` : ""}. You can look it over and approve it from your phone in a minute.`, "Questions? Just reply to this email or text us."]
          : [`Hi${firstName ? " " + firstName : ""},`, `Here's invoice #${row.number}${amt ? ` for ${money}` : ""}${row.due_on ? `, due ${new Date(String(row.due_on) + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}.`, "You can see it and pay online. Thank you for your business."],
        button: quote ? { label: `See your quote${amt ? ", " + money : ""}`, url: quoteUrl(String(row.token)) } : { label: `Pay ${money}`, url: invoiceUrl(String(row.token)) } });
      if (!r.ok) return json({ error: r.error, fallback: true }, 503);
      if (quote) await sql`UPDATE public.client_quotes SET emailed_at = now(), link_sent_at = coalesce(link_sent_at, now()) WHERE id = ${String(row.id)}::uuid`;
      else await sql`UPDATE public.client_invoices SET emailed_at = now() WHERE id = ${String(row.id)}::uuid`;
      await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${String(row.thread)}::uuid, 'out', 'system', ${`${quote ? "Quote" : `Invoice #${row.number}`} emailed to ${to}.`})`;
      return json({ ok: true });
    }
    if (b.action === "payment") {
      if (!b.invoice || !UUID.test(b.invoice)) return json({ error: "Which invoice?" }, 400);
      const r = await recordPayment(sql, c, b.invoice, { amount: b.amount, method: b.method, on: b.on, note: b.note });
      return r.ok ? json({ ok: true, balance: r.balance }) : json({ error: r.error }, 400);
    }
    if (b.action === "paymentdelete") {
      if (!b.payment || !UUID.test(b.payment)) return json({ error: "Which payment?" }, 400);
      const r = await deletePayment(sql, c, b.payment);
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 404);
    }
    if (b.action === "photo") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      const r = await addPhoto(sql, c, b.thread, { data: b.data, kind: b.kind, caption: b.caption });
      return r.ok ? json({ ok: true, id: r.id }) : json({ error: r.error }, 400);
    }
    if (b.action === "photodelete") {
      if (!b.photo || !UUID.test(b.photo)) return json({ error: "Which photo?" }, 400);
      const r = await removePhoto(sql, c, b.photo);
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 404);
    }
    if (b.action === "remind") {
      if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which customer?" }, 400);
      const r = await setReminder(sql, c, b.thread, b.at ?? null, b.note);
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 400);
    }
    if (b.action === "reschedule") {
      if (!b.appt || !UUID.test(b.appt)) return json({ error: "Which estimate?" }, 400);
      const r = await rescheduleAppointment(sql, c, b.appt, String(b.start ?? ""));
      return r.ok ? json({ ok: true, texted: r.texted, when: r.when }) : json({ error: r.error }, 409);
    }
    if (b.action === "preview") {
      // The owner tries the agent with unsaved settings. Nothing is stored and nobody is texted.
      const message = String(b.message ?? "").trim().slice(0, 500);
      if (!message) return json({ error: "Type what a lead might say." }, 400);
      const r = await previewReply(c, message, b.setup ? cleanOwnerSetup(b.setup) : {});
      return r ? json({ ok: true, ...r }) : json({ error: "The agent couldn't answer just now." }, 503);
    }
    if (b.action === "testtext") {
      // A real text from the business number to the owner's own cell, so he knows the number works.
      if (!c.setup.texting_number) return json({ error: "No texting number yet." }, 409);
      if (!c.setup.owner_cell) return json({ error: "No cell on file for you." }, 409);
      const ok = await sendSms(c.setup.owner_cell, c.setup.texting_number, `Test from Cinder: this is ${c.setup.display_name || "your"} texting number. Customers get replies from here.`);
      return ok ? json({ ok: true }) : json({ error: "The text didn't go out. Check the connection log." }, 502);
    }
    if (b.action === "message") {
      const body = String(b.body ?? "").trim().slice(0, 4000);
      if (!body) return json({ error: "Write a message first." }, 400);
      await sql`INSERT INTO public.client_messages (owner_id, project_id, author, body) VALUES (${c.owner}, ${c.projectId}::uuid, 'client', ${body})`;
      await sendAlert({ subject: `Message from ${c.setup.display_name || "a client"}`, lines: [`${c.setup.display_name || "A client"} wrote from the Cinder app:`, body.slice(0, 1200)], link: { label: "Reply in the CRM", path: `/crm/client-success/${c.projectId}` } }).catch(() => false);
      return json({ ok: true });
    }
    if (b.action === "outcome") {
      if (!b.appt || !UUID.test(b.appt)) return json({ error: "Which estimate?" }, 400);
      if (b.result === "no_show") { const r = await markNoShow(sql, c, b.appt); return r.ok ? json({ ok: true }) : json({ error: r.error }, 409); }
      if (b.result !== "quoted" && b.result !== "won") return json({ error: "Pick how it went." }, 400);
      const amount = b.amount ? parseAmount(b.amount) : null;
      if (b.amount && amount == null) return json({ error: "Type the amount as a number, like 9400." }, 400);
      const [a] = await sql`UPDATE public.client_appointments a SET status = 'done' FROM public.client_threads t
        WHERE a.id = ${b.appt}::uuid AND a.project_id = ${c.projectId}::uuid AND a.status = 'booked' AND t.id = a.thread_id
        RETURNING t.id AS thread_id, t.customer_phone, t.customer_name` as { thread_id: string; customer_phone: string; customer_name: string }[];
      if (!a) return json({ error: "That estimate was already updated." }, 409);
      const phone10 = digits10(a.customer_phone);
      const [open] = await sql`SELECT id FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND kind = 'quote' AND status IN ('open','replied')
        AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${phone10} ORDER BY created_at DESC LIMIT 1` as { id: string }[];
      const today = new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });
      if (b.result === "quoted") {
        if (open) await sql`UPDATE public.client_quotes SET amount = coalesce(${amount}, amount), sent_on = ${today}::date, status = 'open', steps_sent = 0 WHERE id = ${open.id}::uuid`;
        else await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, amount, sent_on) VALUES (${c.owner}, ${c.projectId}::uuid, ${a.customer_phone}, ${a.customer_name}, ${amount}, ${today}::date)`;
        await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${a.thread_id}::uuid, 'out', 'system', ${`Quote sent${amount ? `: $${amount.toLocaleString("en-US")}` : ""}. Cinder follows up until they answer.`})`;
        return json({ ok: true });
      }
      if (open) await sql`UPDATE public.client_quotes SET status = 'won', amount = coalesce(${amount}, amount), last_step_at = now() WHERE id = ${open.id}::uuid`;
      else await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, amount, sent_on, status, last_step_at) VALUES (${c.owner}, ${c.projectId}::uuid, ${a.customer_phone}, ${a.customer_name}, ${amount}, ${today}::date, 'won', now())`;
      await sql`UPDATE public.client_threads SET status = 'closed', updated_at = now() WHERE id = ${a.thread_id}::uuid AND status <> 'opted_out'`;
      await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${a.thread_id}::uuid, 'out', 'system', ${`Job won${amount ? `: $${amount.toLocaleString("en-US")}` : ""}`})`;
      let review = "";
      if (b.review) { const r = await sendReviewRequest(sql, c, a.customer_phone, a.customer_name); review = r.ok ? "sent" : r.error?.includes("already") ? "already" : r.error?.includes("texting hours") ? "later" : "no_link"; }
      return json({ ok: true, review });
    }
    if (b.action === "review") {
      // The job is finished: now is the right moment to ask for a Google review.
      if (!b.quote || !UUID.test(b.quote)) return json({ error: "Which job?" }, 400);
      const [q] = await sql`SELECT customer_phone, customer_name FROM public.client_quotes WHERE id = ${b.quote}::uuid AND project_id = ${c.projectId}::uuid AND status = 'won'` as { customer_phone: string; customer_name: string }[];
      if (!q) return json({ error: "That job isn't marked won." }, 404);
      const r = await sendReviewRequest(sql, c, q.customer_phone, q.customer_name);
      return r.ok ? json({ ok: true }) : json({ error: r.error?.includes("already") ? "They already got a review request." : r.error || "The text didn't send." }, 409);
    }
    if (b.action === "quote") {
      if (!b.quote || !UUID.test(b.quote) || (b.status !== "won" && b.status !== "lost")) return json({ error: "Which quote?" }, 400);
      const amount = b.amount ? parseAmount(b.amount) : null;
      const r = await sql`UPDATE public.client_quotes SET status = ${b.status}, amount = coalesce(${amount}, amount), last_step_at = CASE WHEN ${b.status} = 'won' THEN now() ELSE last_step_at END
        WHERE id = ${b.quote}::uuid AND project_id = ${c.projectId}::uuid AND status IN ('open','replied') RETURNING id`;
      return r.length ? json({ ok: true }) : json({ error: "That quote was already updated." }, 409);
    }
    if (!b.thread || !UUID.test(b.thread)) return json({ error: "Which conversation?" }, 400);
    const [t] = await sql`SELECT id, customer_phone, customer_name, status FROM public.client_threads WHERE id = ${b.thread}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; customer_phone: string; customer_name: string; status: string }[];
    if (!t) return json({ error: "Not found" }, 404);
    if (b.action === "reply") {
      const body = String(b.body ?? "").trim().slice(0, 1200);
      if (!body) return json({ error: "Write a text first." }, 400);
      if (t.status === "opted_out") return json({ error: "This customer opted out of texts." }, 409);
      if (!c.setup.texting_number) return json({ error: "Your texting number isn't set up yet." }, 409);
      const ok = await sendToCustomer(sql, c, t.id, t.customer_phone, body, "owner");
      if (t.status !== "booked") await sql`UPDATE public.client_threads SET status = 'paused', updated_at = now() WHERE id = ${t.id}::uuid`;
      return ok ? json({ ok: true }) : json({ error: "The text didn't send. Try again." }, 502);
    }
    if (b.action === "status") {
      if (!STATUSES.has(String(b.status))) return json({ error: "Unknown status." }, 400);
      if (t.status === "opted_out") return json({ error: "This customer opted out of texts." }, 409);
      await sql`UPDATE public.client_threads SET status = ${String(b.status)}, updated_at = now() WHERE id = ${t.id}::uuid`;
      return json({ ok: true });
    }
    if (b.action === "call") {
      const cell = digits10(c.setup.owner_cell || ""), from = digits10(c.setup.texting_number || ""), to = digits10(t.customer_phone);
      if (cell.length !== 10 || from.length !== 10) return json({ error: "Calling needs your cell and texting number in setup." }, 409);
      const ok = await bridgeCall("+1" + cell, "+1" + from, "+1" + to, t.customer_name);
      if (ok) await sql`INSERT INTO public.client_texts (owner_id, thread_id, direction, author, body) VALUES (${c.owner}, ${t.id}::uuid, 'out', 'system', 'You called them back')`;
      return ok ? json({ ok: true }) : json({ error: "Couldn't start the call. Try again." }, 502);
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) { console.error("App action failed", e instanceof Error ? e.message : e); return json({ error: "Something went wrong." }, 500); }
}
