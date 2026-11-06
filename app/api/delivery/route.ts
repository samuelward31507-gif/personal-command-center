import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import {
  BOOKING_SOURCES, atRiskTaskTitle, cleanDelivery, cleanReviews, deliveryState, monthlyFigures, monthlyReport,
  readDelivery, readDiscovery, readReviews, spotsLeft, type Booking,
} from "@/lib/founding-offer";
import { isPeriod, periodLabel } from "@/lib/client-report";
import { loadOffer } from "@/lib/offer-data";
import { todayIn } from "@/lib/workspace";
import { loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sql = NeonQueryFunction<false, false>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
const ymd = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").slice(0, 10));
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

async function load(sql: Sql, owner: string, projectId: string) {
  const pr = await sql`
    SELECT p.id, p.name, p.client_name, p.status, p.offer, p.contact_id, c.company, c.discovery
    FROM public.projects p LEFT JOIN public.contacts c ON c.id = p.contact_id AND c.owner_id = p.owner_id
    WHERE p.id = ${projectId}::uuid AND p.owner_id = ${owner}` as Record<string, unknown>[];
  if (!pr.length) return null;
  const [ops, bookings, reports] = await Promise.all([
    sql`SELECT delivery, reviews FROM public.client_ops WHERE project_id = ${projectId}::uuid AND owner_id = ${owner}` as Promise<Record<string, unknown>[]>,
    sql`SELECT id, booked_on, estimate_at, homeowner, source, note FROM public.client_bookings WHERE project_id = ${projectId}::uuid AND owner_id = ${owner} ORDER BY booked_on DESC, created_at DESC LIMIT 500` as Promise<Record<string, unknown>[]>,
    sql`SELECT period, status, updated_at FROM public.client_reports WHERE project_id = ${projectId}::uuid AND owner_id = ${owner} ORDER BY period DESC LIMIT 24` as Promise<Record<string, unknown>[]>,
  ]);
  return { p: pr[0], ops: ops[0] ?? null, bookings, reports };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;
const clientName = (d: Loaded) => String(d.p.company || d.p.client_name || d.p.name || "Client");
const asBookings = (rows: Record<string, unknown>[]): Booking[] => rows.map(b => ({ bookedOn: ymd(b.booked_on), source: String(b.source) }));

/** The at-risk rule creates one open task for Sam per client (no duplicates while one is open). */
async function ensureAtRiskTask(sql: Sql, owner: string, d: Loaded, windowEnd: string | null) {
  const title = atRiskTaskTitle(clientName(d));
  const open = await sql`SELECT 1 FROM public.tasks WHERE owner_id = ${owner} AND title = ${title} AND status IN ('todo','in_progress','blocked') LIMIT 1`;
  if (open.length) return false;
  await sql`INSERT INTO public.tasks (owner_id, title, description, status, priority, due_at, contact_id)
    VALUES (${owner}, ${title}, ${`Fewer than 2 booked estimates by day 15 of the 30-day guarantee window${windowEnd ? ` (ends ${windowEnd})` : ""}. Check the revival list, the call forwarding and the calendar availability.`}, 'todo', 'high', now(), ${d.p.contact_id ? String(d.p.contact_id) : null}::uuid)`;
  return true;
}

async function view(sql: Sql, owner: string, d: Loaded, today: string) {
  const delivery = readDelivery(d.ops?.delivery);
  const reviews = readReviews(d.ops?.reviews);
  const discovery = readDiscovery(d.p.discovery);
  const state = deliveryState(delivery, asBookings(d.bookings), today);
  let taskCreated = false;
  if (state.atRisk) taskCreated = await ensureAtRiskTask(sql, owner, d, state.guaranteeWindowEnd);
  const { offer, used } = await loadOffer(owner);
  return {
    project: { id: String(d.p.id), name: clientName(d), status: String(d.p.status), offer: String(d.p.offer ?? "standard"), contactId: d.p.contact_id ? String(d.p.contact_id) : null },
    delivery, reviews, discovery, state, taskCreated,
    bookings: d.bookings.map(b => ({ id: String(b.id), bookedOn: ymd(b.booked_on), estimateAt: iso(b.estimate_at), homeowner: String(b.homeowner ?? ""), source: String(b.source), note: String(b.note ?? "") })),
    reports: d.reports.map(r => ({ period: String(r.period), status: String(r.status) })),
    offer: { name: offer.offerName, spotsTotal: offer.spotsTotal, used, left: spotsLeft(offer, used) },
    today,
  };
}

/** The one-page monthly report for a period: booked estimates from the log, value from the client's discovery numbers. */
function buildReport(d: Loaded, period: string, extra: { leadsIn?: number; under10Pct?: number; reviewRequests?: number; newReviews?: number }) {
  const inMonth = asBookings(d.bookings).filter(b => b.bookedOn.slice(0, 7) === period);
  const disc = readDiscovery(d.p.discovery);
  const figures = monthlyFigures({ ...extra, bookings: inMonth, avgJobValue: disc.avgJobValue, closeRatePct: disc.closeRate });
  return { figures, ...monthlyReport(clientName(d), periodLabel(period), figures) };
}

const optInt = (v: unknown, max: number) => { if (v === undefined || v === null || v === "") return undefined; const n = Number(String(v).replace(/[,%\s]/g, "")); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : NaN; };

/** GET /api/delivery?project=… [&report=YYYY-MM] — delivery tracker, guarantee status, bookings, Review Builder setup; or one monthly report. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const url = new URL(request.url);
  const id = url.searchParams.get("project") ?? "";
  if (!UUID.test(id)) return reply({ error: "Valid project id is required." }, 400);
  const sql = neon(process.env.DATABASE_URL);
  const d = await load(sql, user.id, id);
  if (!d) return reply({ error: "Client not found." }, 404);
  const report = url.searchParams.get("report");
  if (report) {
    if (!isPeriod(report)) return reply({ error: "Report month must look like 2026-11." }, 400);
    const saved = await sql`SELECT figures, content, status FROM public.client_reports WHERE project_id = ${id}::uuid AND owner_id = ${user.id} AND period = ${report}`;
    const sp = (saved[0]?.figures as Record<string, unknown> | undefined)?.sprint as Record<string, unknown> | undefined;
    const r = buildReport(d, report, { leadsIn: sp?.leadsIn as number | undefined, under10Pct: sp?.under10Pct as number | undefined, reviewRequests: sp?.reviewRequests as number | undefined, newReviews: sp?.newReviews as number | undefined });
    return reply({ client: clientName(d), period: report, label: periodLabel(report), ...r, status: saved[0]?.status ?? null });
  }
  const ws = await loadWorkspace(user.id);
  return reply(await view(sql, user.id, d, todayIn(ws.timezone)));
}

/**
 * POST /api/delivery — { project, action, ... }
 * save {delivery, offer?} · reviews {reviews} · add-booking {bookedOn, source, homeowner?, estimateAt?, note?} · remove-booking {id}
 * · report {period, leadsIn?, under10Pct?, reviewRequests?, newReviews?}. Nothing is sent to anyone.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in to continue." }, 401);
  if (!process.env.DATABASE_URL) return reply({ error: "Database not configured." }, 503);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof body?.project === "string" ? body.project : "";
  if (!body || !UUID.test(id)) return reply({ error: "Valid project id is required." }, 400);
  try {
    const sql = neon(process.env.DATABASE_URL);
    let d = await load(sql, user.id, id);
    if (!d) return reply({ error: "Client not found." }, 404);
    const ws = await loadWorkspace(user.id);
    const today = todayIn(ws.timezone);
    await sql`INSERT INTO public.client_ops (project_id, owner_id) VALUES (${id}::uuid, ${user.id}) ON CONFLICT (project_id) DO NOTHING`;

    switch (body.action) {
      case "save": {
        const checked = cleanDelivery(body.delivery);
        if ("error" in checked) return reply({ error: checked.error }, 400);
        if (body.offer === "founding" || body.offer === "standard") {
          if (body.offer === "founding" && String(d.p.offer) !== "founding") {
            const { offer, used } = await loadOffer(user.id);
            if (spotsLeft(offer, used) <= 0) return reply({ error: `All ${offer.spotsTotal} founding spots are taken. Raise the number in Settings first.` }, 409);
          }
          await sql`UPDATE public.projects SET offer = ${body.offer}, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${user.id}`;
        }
        await sql`UPDATE public.client_ops SET delivery = ${JSON.stringify(checked.ok)}::jsonb, updated_at = now() WHERE project_id = ${id}::uuid AND owner_id = ${user.id}`;
        break;
      }
      case "reviews": {
        const checked = cleanReviews(body.reviews);
        if ("error" in checked) return reply({ error: checked.error }, 400);
        await sql`UPDATE public.client_ops SET reviews = ${JSON.stringify(checked.ok)}::jsonb, updated_at = now() WHERE project_id = ${id}::uuid AND owner_id = ${user.id}`;
        break;
      }
      case "add-booking": {
        const bookedOn = typeof body.bookedOn === "string" && DATE.test(body.bookedOn) ? body.bookedOn : "";
        if (!bookedOn || bookedOn > today) return reply({ error: "Booked date must be a real date, not in the future." }, 400);
        const source = typeof body.source === "string" && (BOOKING_SOURCES as readonly string[]).includes(body.source) ? body.source : "";
        if (!source) return reply({ error: "Pick where the estimate came from." }, 400);
        const estimateAt = typeof body.estimateAt === "string" && body.estimateAt && Number.isFinite(Date.parse(body.estimateAt)) ? new Date(body.estimateAt).toISOString() : null;
        const homeowner = typeof body.homeowner === "string" ? body.homeowner.trim().slice(0, 120) : "";
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
        await sql`INSERT INTO public.client_bookings (owner_id, project_id, booked_on, estimate_at, homeowner, source, note)
          VALUES (${user.id}, ${id}::uuid, ${bookedOn}::date, ${estimateAt}::timestamptz, ${homeowner}, ${source}, ${note})`;
        break;
      }
      case "remove-booking": {
        const bid = typeof body.id === "string" && UUID.test(body.id) ? body.id : "";
        if (!bid) return reply({ error: "Valid booking id is required." }, 400);
        await sql`DELETE FROM public.client_bookings WHERE id = ${bid}::uuid AND project_id = ${id}::uuid AND owner_id = ${user.id}`;
        break;
      }
      case "report": {
        const period = typeof body.period === "string" ? body.period : "";
        if (!isPeriod(period)) return reply({ error: "Report month must look like 2026-11." }, 400);
        const extra = { leadsIn: optInt(body.leadsIn, 1_000_000), under10Pct: optInt(body.under10Pct, 100), reviewRequests: optInt(body.reviewRequests, 1_000_000), newReviews: optInt(body.newReviews, 1_000_000) };
        if (Object.values(extra).some(v => Number.isNaN(v))) return reply({ error: "Report numbers must be whole numbers (and % under 10 seconds 0–100)." }, 400);
        const r = buildReport(d, period, extra);
        const figures = { inquiries: r.figures.leadsIn ?? undefined, estimates: r.figures.booked, sprint: r.figures };
        await sql`INSERT INTO public.client_reports (owner_id, project_id, period, figures, content, status)
          VALUES (${user.id}, ${id}::uuid, ${period}, ${JSON.stringify(figures)}::jsonb, ${r.text}, 'draft')
          ON CONFLICT (owner_id, project_id, period) DO UPDATE SET figures = EXCLUDED.figures, content = EXCLUDED.content, updated_at = now()`;
        return reply({ client: clientName(d), period, label: periodLabel(period), ...r });
      }
      default: return reply({ error: "Unknown action." }, 400);
    }
    d = await load(sql, user.id, id);
    return reply(await view(sql, user.id, d!, today));
  } catch (error) {
    console.error("Delivery update failed", { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message.slice(0, 200) : "" });
    return reply({ error: "Could not save that. Nothing was changed." }, 500);
  }
}
