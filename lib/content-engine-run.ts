// Content engine, I/O: reads the week's real numbers and call notes, has Claude write the week, saves the drafts.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { claudeText } from "@/lib/ai-text";
import { contentSystem, contentUser, parseDrafts, planWeek, PLATFORMS, type Context, type Draft, type Platform, type Posted, type Slot } from "@/lib/content-engine";

type Sql = NeonQueryFunction<false, false>;
const OFFER = "First 3 founding clients get half-price setup. Book & Close guarantees 5 booked appointments in the first 30 days or the next month is free, and the monthly doesn't start until the first booked appointment. No contract.";
const n = (v: unknown) => Number(v) || 0;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> { try { return await p; } catch (e) { console.error("Content context query failed", e instanceof Error ? e.message : e); return fallback; } }

/** The last 7 days, as the engine needs them. Every query is optional: a missing table just means a zero. */
export async function contentContext(sql: Sql, o: string): Promise<Context> {
  const [calls] = await safe(sql`SELECT
      count(*) FILTER (WHERE channel = 'call')::int AS dials,
      count(*) FILTER (WHERE channel = 'call' AND outcome IN ('answered','meeting_booked','completed'))::int AS conv,
      count(*) FILTER (WHERE outcome = 'meeting_booked')::int AS meetings,
      count(*) FILTER (WHERE notes LIKE 'Email sent:%')::int AS emails,
      count(DISTINCT date_trunc('day', occurred_at)) FILTER (WHERE channel = 'call')::int AS days
    FROM public.contact_activities WHERE owner_id = ${o} AND occurred_at > now() - interval '7 days'` as Promise<Record<string, unknown>[]>, [{}]);
  const notes = await safe(sql`SELECT notes FROM public.contact_activities WHERE owner_id = ${o} AND channel = 'call'
      AND occurred_at > now() - interval '7 days' AND length(notes) > 12 AND notes NOT LIKE 'Email sent:%'
      ORDER BY occurred_at DESC LIMIT 30` as Promise<{ notes: string }[]>, []);
  const [clients] = await safe(sql`SELECT count(*)::int AS live FROM public.client_ops WHERE owner_id = ${o} AND coalesce(setup->>'texting_number','') <> ''` as Promise<Record<string, unknown>[]>, [{}]);
  const [runtime] = await safe(sql`SELECT count(DISTINCT thread_id) FILTER (WHERE direction = 'out')::int AS answered FROM public.client_texts WHERE owner_id = ${o} AND at > now() - interval '7 days'` as Promise<Record<string, unknown>[]>, [{}]);
  const [booked] = await safe(sql`SELECT count(*)::int AS n FROM public.client_threads WHERE owner_id = ${o} AND status = 'booked' AND updated_at > now() - interval '7 days'` as Promise<Record<string, unknown>[]>, [{}]);
  const recent = await safe(sql`SELECT hook FROM public.content_drafts WHERE owner_id = ${o} AND created_at > now() - interval '56 days' ORDER BY created_at DESC LIMIT 60` as Promise<{ hook: string }[]>, []);
  // Notes can hold names and numbers: strip phone numbers and emails, keep it short. The prompt also forbids names.
  const heard = notes.map(r => r.notes.replace(/\S+@\S+/g, "").replace(/\+?\d[\d\s().-]{7,}\d/g, "").replace(/\s+/g, " ").trim().slice(0, 160)).filter(s => s.length > 12).slice(0, 20);
  return {
    dials: n(calls?.dials), conversations: n(calls?.conv), meetings: n(calls?.meetings), emailsSent: n(calls?.emails), streakDays: n(calls?.days),
    clientsLive: n(clients?.live), leadsAnswered: n(runtime?.answered), estimatesBooked: n(booked?.n),
    heard, recent: recent.map(r => r.hook), trades: ["fence companies", "contractors", "home-service shops", "auto detailers"], offer: OFFER,
  };
}

export async function postedHistory(sql: Sql, o: string): Promise<Posted[]> {
  return safe(sql`SELECT pillar, platform, views, comments, leads FROM public.content_drafts WHERE owner_id = ${o} AND status = 'posted' AND posted_at > now() - interval '120 days'` as Promise<Posted[]>, []);
}

async function write(ctx: Context, slots: Slot[], week: string): Promise<Draft[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !slots.length) return [];
  const text = await claudeText({ apiKey: key, system: contentSystem(), user: contentUser(ctx, slots, week), label: "Content week", model: process.env.CINDER_CONTENT_MODEL?.trim() || undefined, maxTokens: 9000, timeoutMs: 120_000 });
  return parseDrafts(text, slots, ctx);
}

async function save(sql: Sql, o: string, week: string, drafts: Draft[]) {
  for (const d of drafts) {
    await sql`INSERT INTO public.content_drafts (owner_id, week, day, platform, pillar, format, hook, body, card, slides, shoot)
      VALUES (${o}, ${week}::date, ${d.day}, ${d.platform}, ${d.pillar}, ${d.format}, ${d.hook}, ${d.body}, ${JSON.stringify(d.card)}::jsonb, ${JSON.stringify(d.slides)}::jsonb, ${d.shoot})`;
  }
}

/**
 * Write the week. Platforms that already have drafts that week are left alone, so it's safe to run twice.
 * The three platform groups are written in parallel to stay inside the time limit.
 */
export async function generateWeek(sql: Sql, o: string, week: string, only?: Platform[]): Promise<{ written: number; skipped: string[]; error?: string }> {
  const have = await sql`SELECT DISTINCT platform FROM public.content_drafts WHERE owner_id = ${o} AND week = ${week}::date AND status <> 'skipped'` as { platform: string }[];
  const done = new Set(have.map(r => r.platform));
  const want = PLATFORMS.map(p => p.id).filter(p => (!only || only.includes(p)) && !done.has(p));
  if (!want.length) return { written: 0, skipped: [...done] };
  const [ctx, history] = await Promise.all([contentContext(sql, o), postedHistory(sql, o)]);
  const slots = planWeek(history).filter(s => want.includes(s.platform));
  const groups: Slot[][] = [slots.filter(s => s.platform === "feed"), slots.filter(s => s.platform === "video"), slots.filter(s => s.platform === "linkedin" || s.platform === "group")];
  const results = await Promise.allSettled(groups.map(g => write(ctx, g, week)));
  const drafts = results.flatMap(r => (r.status === "fulfilled" ? r.value : []));
  const failed = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
  await save(sql, o, week, drafts);
  return { written: drafts.length, skipped: [...done], ...(failed ? { error: failed.reason instanceof Error ? failed.reason.message : "Part of the week didn't write. Run it again." } : {}) };
}

/** Rewrite one draft in place: same day, platform and topic, a fresh angle. */
export async function rewriteDraft(sql: Sql, o: string, id: string, note = ""): Promise<Draft | null> {
  const [row] = await sql`SELECT week, day, platform, pillar, hook FROM public.content_drafts WHERE id = ${id}::uuid AND owner_id = ${o}` as { week: string; day: number; platform: Platform; pillar: string; hook: string }[];
  if (!row) return null;
  const ctx = await contentContext(sql, o);
  ctx.recent = [row.hook, ...ctx.recent];
  if (note) ctx.heard = [`(Sam's note for this post: ${note.slice(0, 300)})`, ...ctx.heard];
  const week = String(row.week).slice(0, 10);
  const [d] = await write(ctx, [{ day: row.day, platform: row.platform, pillar: row.pillar }], week);
  if (!d) return null;
  await sql`UPDATE public.content_drafts SET format = ${d.format}, hook = ${d.hook}, body = ${d.body}, card = ${JSON.stringify(d.card)}::jsonb, slides = ${JSON.stringify(d.slides)}::jsonb, shoot = ${d.shoot} WHERE id = ${id}::uuid AND owner_id = ${o}`;
  return d;
}
