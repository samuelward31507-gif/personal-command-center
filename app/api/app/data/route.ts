import { appSession, clientFor, db, json } from "@/lib/client-app-run";
import { liveFor } from "@/lib/client-live";
import { calState, clientCalendar, listEvents, type CalEvent } from "@/lib/client-calendar";
import { isRepeatTrade, SEQUENCES } from "@/lib/client-runtime";
import { connectionsReport, loadBoard, ownerSetupView } from "@/lib/client-crm-run";
import { jobberConfigured, jobberState } from "@/lib/jobber-core";
import { winbackAudience } from "@/lib/client-close-run";
import { loadCustomers, loadInvoices, loadPayments } from "@/lib/client-billing-run";
import { reportFor } from "@/lib/client-reports";
import { isPeriodKey, type PeriodKey } from "@/lib/periods";
import { customerEmailReady } from "@/lib/client-email";
import { winbackDraft } from "@/lib/crm";
import { loadPlans, loadTime, loadVisits } from "@/lib/client-service-run";
import { qboConfigured, qboState } from "@/lib/qbo";
import { eveningFor } from "@/lib/client-evening";
import { leadMailAddressFor, loadMail } from "@/lib/client-lead-mail-run";
import { loadExpenses } from "@/lib/client-expenses-run";
import { loadOrders } from "@/lib/client-orders-run";
import { loadEquipment, loadFiles, loadTasks } from "@/lib/client-records-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?p=<project>&thread=<id>&tab=cal|sam — the signed-in owner's business: numbers, every lead, estimates, quotes, their calendar, one conversation. */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return json({ error: "Sign in" }, 401);
  const q = new URL(req.url).searchParams;
  try {
    const sql = db();
    const c = await clientFor(sql, s, q.get("p"));
    if (!c) return json({ error: "Sign in" }, 401);
    // Reports for the period the owner picked: its own request, so the rest of the app stays quick.
    if (q.get("report")) {
      if (s.role === "crew") return json({ error: "Only the owner sees reports." }, 403);
      const key = isPeriodKey(q.get("report")) ? q.get("report") as PeriodKey : "30";
      return json({ report: await reportFor(sql, c.projectId, c.setup.timezone || "America/Denver", key) });
    }
    // Crew limited to their own jobs (Settings, Account): only threads assigned to them, in every list and every conversation.
    const crewOnlyMine = s.role === "crew" && c.setup.crew_scope === "assigned";
    const me10 = (s.phone || "").replace(/\D/g, "").slice(-10);
    const th = q.get("thread");
    if (th && /^[0-9a-f-]{36}$/i.test(th)) {
      const [t] = await sql`SELECT id, customer_name, customer_phone, source, status, lang, crew_member FROM public.client_threads WHERE id = ${th}::uuid AND project_id = ${c.projectId}::uuid` as Record<string, unknown>[];
      if (!t) return json({ error: "Not found" }, 404);
      if (crewOnlyMine && String(t.crew_member ?? "").replace(/\D/g, "").slice(-10) !== me10) return json({ error: "That job isn't assigned to you." }, 403);
      delete t.crew_member;
      const texts = await sql`SELECT id, direction, author, body, at, media, status FROM public.client_texts WHERE thread_id = ${th}::uuid ORDER BY at LIMIT 400`;
      return json({ thread: t, texts });
    }
    const me = s.phone ? "+1" + s.phone.replace(/\D/g, "").slice(-10) : "", crewMe = s.role === "crew" ? me : "";
    // A part of the screen that fails to load is logged and named to the owner, never shown as an empty list.
    const failed: string[] = [];
    const miss = (what: string, e: unknown) => { console.error(`Load failed: ${what}`, e instanceof Error ? e.message : e); if (!failed.includes(what)) failed.push(what); };
    const [live, biz, appts, unread, msgs, quotes, calRow, jobberRow, keyRow, wonJobs, board, past, customers, invoices, wires, payments, plans, visits, time, qboRow] = await Promise.all([
      liveFor(sql, c.projectId, 80, c.setup.timezone || "America/Denver"),
      sql`SELECT o.project_id, coalesce(o.setup->>'display_name', p.client_name, p.name) AS name, o.portal_token FROM public.client_ops o JOIN public.projects p ON p.id = o.project_id WHERE o.project_id = ANY(${s.projects}::uuid[])`,
      // Booked estimates still waiting on an outcome (up to two weeks back) and everything coming up.
      sql`SELECT a.id, a.starts_at, a.status, a.event_id, a.crew_member, t.id AS thread_id, t.customer_name, t.customer_phone FROM public.client_appointments a JOIN public.client_threads t ON t.id = a.thread_id
        WHERE a.project_id = ${c.projectId}::uuid AND a.status = 'booked' AND a.starts_at > now() - interval '14 days' ORDER BY a.starts_at LIMIT 60`.catch(() => []),
      sql`SELECT count(*)::int AS n FROM public.client_messages WHERE project_id = ${c.projectId}::uuid AND author = 'owner' AND read_at IS NULL`.catch(() => [{ n: 0 }]),
      sql`SELECT author, body, created_at FROM public.client_messages WHERE project_id = ${c.projectId}::uuid ORDER BY created_at DESC LIMIT 60`.catch(() => []),
      sql`SELECT id, customer_name, customer_phone, amount::float AS amount, sent_on::text AS sent_on, steps_sent, status FROM public.client_quotes
        WHERE project_id = ${c.projectId}::uuid AND kind = 'quote' AND status IN ('open','replied') ORDER BY sent_on DESC LIMIT 40`.catch(() => []),
      sql`SELECT google_email FROM public.client_calendars WHERE project_id = ${c.projectId}::uuid`.catch(() => []),
      sql`SELECT account_name, last_error, last_push_at, connected_at FROM public.client_jobber WHERE project_id = ${c.projectId}::uuid`.catch(() => []),
      // The website key: the chat bubble and the intake webhook both name the client with it.
      sql`SELECT chat_key FROM public.client_ops WHERE project_id = ${c.projectId}::uuid`.catch(() => []),
      // Won jobs from the last 90 days that haven't had a review request: "Job done" sends it at the right time.
      sql`SELECT q.id, q.customer_name, q.customer_phone, q.amount::float AS amount, q.last_step_at AS won_at FROM public.client_quotes q
        WHERE q.project_id = ${c.projectId}::uuid AND q.status = 'won' AND q.last_step_at > now() - interval '90 days'
          AND NOT EXISTS (SELECT 1 FROM public.client_reviews r WHERE r.project_id = q.project_id AND right(regexp_replace(r.customer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(q.customer_phone, '[^0-9]', '', 'g'), 10))
        ORDER BY q.last_step_at DESC LIMIT 20`.catch(() => []),
      loadBoard(sql, c).catch(e => { miss("jobs", e); return []; }),
      winbackAudience(sql, c).catch(() => ({ past: 0, eligible: [] })),
      loadCustomers(sql, c).catch(e => { miss("customers", e); return []; }),
      loadInvoices(sql, c).catch(e => { miss("invoices", e); return []; }),
      connectionsReport(sql, c).catch(e => { miss("connections", e); return { sources: [], failures: [], log: [] }; }),
      loadPayments(sql, c).catch(e => { miss("payments", e); return []; }),
      loadPlans(sql, c).catch(e => { miss("service plans", e); return []; }),
      loadVisits(sql, c).catch(e => { miss("plan visits", e); return []; }),
      // The owner sees everyone's hours; a crew member sees their own.
      loadTime(sql, c, s.role === "crew" ? crewMe : null).catch(e => { miss("hours", e); return []; }),
      sql`SELECT company_name, last_error, last_push_at FROM public.client_qbo WHERE project_id = ${c.projectId}::uuid`.catch(() => []),
    ]);
    const mailRows = s.role === "crew" ? [] : await loadMail(sql, c).catch(e => { miss("lead emails", e); return []; });
    const autoSent = s.role !== "owner" ? [] : await sql`SELECT rule_id, count(*) FILTER (WHERE ok)::int AS n, max(sent_at) AS last FROM public.client_auto_sends WHERE project_id = ${c.projectId}::uuid GROUP BY 1`.catch(() => []) as { rule_id: string; n: number; last: Date | string }[];
    const orders = s.role === "crew" ? [] : await loadOrders(sql, c).catch(e => { miss("material orders", e); return []; });
    const expenses = s.role === "crew" ? [] : await loadExpenses(sql, c).catch(e => { miss("expenses", e); return []; });
    const activity = s.role !== "owner" ? [] : await sql`SELECT a.at, a.who, a.role, a.action, a.detail, a.thread_id, t.customer_name FROM public.client_activity a LEFT JOIN public.client_threads t ON t.id = a.thread_id
      WHERE a.project_id = ${c.projectId}::uuid ORDER BY a.at DESC LIMIT 200`.catch(() => []) as Record<string, unknown>[];
    const [rt] = s.role === "crew" ? [] : await sql`SELECT round(avg(rating)::numeric, 1)::float AS avg, count(*)::int AS n, count(*) FILTER (WHERE rating <= 3)::int AS low FROM public.client_feedback WHERE project_id = ${c.projectId}::uuid AND created_at > now() - interval '365 days'`.catch(() => []) as { avg: number | null; n: number; low: number }[];
    const [equipment0, files0, tasks] = await Promise.all([loadEquipment(sql, c).catch(e => { miss("equipment", e); return []; }), loadFiles(sql, c).catch(e => { miss("documents", e); return []; }), s.role === "crew" ? Promise.resolve([]) : loadTasks(sql, c).catch(e => { miss("to-dos", e); return []; })]);
    const evening = s.role === "crew" ? undefined : await eveningFor(sql, c.projectId, c.setup.timezone || "America/Denver").catch(() => undefined);
    // Their real calendar, read only on the Calendar tab (it's a Google call).
    let events: CalEvent[] = [], calError = "";
    const connected = (calRow as unknown[]).length > 0;
    if (connected && q.get("tab") === "cal") {
      const cal = await clientCalendar(sql, c.projectId).catch(() => null);
      if (!cal) calError = "Reconnect your calendar: Google stopped letting Cinder read it.";
      else events = await listEvents(cal, new Date(Date.now() - 12 * 3600_000), new Date(Date.now() + 8 * 86400_000)).catch(() => { calError = "Couldn't read your calendar just now."; return []; });
    }
    const links = new Map(events.map(e => [e.id, e.link]));
    const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || new URL(req.url).origin;
    const calendar = { connected, email: String((calRow as { google_email?: string }[])[0]?.google_email ?? ""), events, error: calError,
      connectUrl: `${origin}/api/client-calendar?state=${encodeURIComponent(calState(c.projectId))}` };
    if (q.get("tab") === "sam") await sql`UPDATE public.client_messages SET read_at = now() WHERE project_id = ${c.projectId}::uuid AND author = 'owner' AND read_at IS NULL`.catch(() => null);
    const crew = s.role === "crew";
    const mine = new Set(crewOnlyMine ? board.filter(b => (b.crewMember || "").replace(/\D/g, "").slice(-10) === me10).map(b => b.id) : []);
    const scoped = <T,>(list: T[], idOf: (x: T) => string) => (crewOnlyMine ? list.filter(x => mine.has(idOf(x))) : list);
    if (crewOnlyMine) live.conversations = scoped(live.conversations, x => x.id);
    return json({
      role: s.role === "crew" ? "crew" : s.role === "office" ? "office" : "owner", me, project: c.projectId,
      evening,
      plans: crew ? scoped(plans, p => p.thread_id).map(p => ({ ...p, items: [], total: 0, tax_rate: 0 })) : plans, visits, time,
      emailReady: customerEmailReady(), business: c.setup.display_name || "", number: c.setup.texting_number || "", canCall: !!(c.setup.owner_cell && c.setup.texting_number),
      owner: c.setup.owner_name || "", businesses: biz, live,
      appointments: scoped(appts as { event_id?: string; thread_id: string }[], a => a.thread_id).map(a => ({ ...a, link: (a.event_id && links.get(a.event_id)) || "" })), quotes, quoteSteps: SEQUENCES.quote.days.length, wonJobs, hasReviewLink: !!c.setup.review_link, repeat: isRepeatTrade(c.setup.trade), calendar, messages: (msgs as Record<string, unknown>[]).reverse(), unreadFromSam: (unread as { n: number }[])[0]?.n ?? 0,
      board: crewOnlyMine ? scoped(board, b => b.id).map(b => c.setup.crew_prices === "yes" ? { ...b, costs: { materials: 0, labor: 0, other: 0 } } : { ...b, value: null, ballpark: null, quote: null, invoice: null, costs: { materials: 0, labor: 0, other: 0 }, changeOrders: (b.changeOrders ?? []).map(x => ({ ...x, items: [], total: 0, url: null })) })
        : crew && c.setup.crew_prices === "yes" ? board.map(b => ({ ...b, costs: { materials: 0, labor: 0, other: 0 } })) : crew ? board.map(b => ({ ...b, value: null, ballpark: null, quote: null, invoice: null, costs: { materials: 0, labor: 0, other: 0 }, changeOrders: (b.changeOrders ?? []).map(x => ({ ...x, items: [], total: 0, url: null })) })) : board,
      setup: crew ? { display_name: c.setup.display_name || "", owner_name: c.setup.owner_name || "", trade: c.setup.trade || "", checklists: c.setup.checklists || "", crew_prices: c.setup.crew_prices || "", brand_color: c.setup.brand_color || "", brand_logo: c.setup.brand_logo || "" } : { ...ownerSetupView(c.setup), has_calendar: (calRow as unknown[]).length ? "yes" : "", team: c.setup.team || "[]", monthly_report: c.setup.monthly_report || "" },
      customers: crew ? [] : customers, invoices: crew ? [] : invoices, payments: crew ? [] : payments, failed, expenses, orders, autoSent: Object.fromEntries(autoSent.map(a => [a.rule_id, { n: Number(a.n) || 0, last: a.last instanceof Date ? a.last.toISOString() : String(a.last) }])), tasks, activity: activity.map(a => ({ at: a.at instanceof Date ? a.at.toISOString() : String(a.at), who: String(a.who ?? ""), role: String(a.role ?? ""), action: String(a.action), detail: String(a.detail ?? ""), thread: a.thread_id ? String(a.thread_id) : null, customer: a.customer_name ? String(a.customer_name) : "" })), ratings: rt ? { avg: rt.avg, n: rt.n, low: rt.low } : undefined,
      equipment: crewOnlyMine ? equipment0.filter(e => mine.has(e.thread_id)) : equipment0, files: crewOnlyMine ? files0.filter(f => mine.has(f.thread_id)) : files0,
      key: String((keyRow as { chat_key?: string }[])[0]?.chat_key ?? ""), origin, wires,
      mail: crew ? undefined : { address: leadMailAddressFor(String((keyRow as { chat_key?: string }[])[0]?.chat_key ?? "")), recent: mailRows },
      jobber: (() => { const j = (jobberRow as { account_name?: string; last_error?: string; last_push_at?: unknown; connected_at?: unknown }[])[0];
        return { available: jobberConfigured(), connected: !!j, account: String(j?.account_name ?? ""), error: String(j?.last_error ?? ""), lastPush: j?.last_push_at ? new Date(String(j.last_push_at)).toISOString() : null,
          connectUrl: jobberConfigured() ? `${origin}/api/client-jobber?state=${encodeURIComponent(jobberState(c.projectId))}` : "" }; })(),
      quickbooks: crew ? undefined : (() => { const j = (qboRow as { company_name?: string; last_error?: string; last_push_at?: unknown }[])[0];
        return { available: qboConfigured(), connected: !!j, company: String(j?.company_name ?? ""), error: String(j?.last_error ?? ""), lastPush: j?.last_push_at ? new Date(String(j.last_push_at)).toISOString() : null,
          connectUrl: qboConfigured() ? `${origin}/api/client-qbo?state=${encodeURIComponent(qboState(c.projectId))}` : "" }; })(),
      winback: { past: past.past, eligible: past.eligible.length, names: past.eligible.slice(0, 6).map(e => e.name.split(" ")[0] || "").filter(Boolean),
        draft: winbackDraft(c.setup.trade, c.setup.owner_name || "", c.setup.display_name || "") },
    });
  } catch (e) { console.error("App data failed", e instanceof Error ? e.message : e); return json({ error: "Couldn't load." }, 500); }
}
