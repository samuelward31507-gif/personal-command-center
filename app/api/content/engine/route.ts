import { neon } from "@neondatabase/serverless";
import { getAllowedSession } from "@/lib/auth/server";
import { captionFor, lint, pillarScores, PILLARS, weekStart, type Platform } from "@/lib/content-engine";
import { generateWeek, rewriteDraft } from "@/lib/content-engine-run";
import { AiTextError } from "@/lib/ai-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const db = () => { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); return neon(process.env.DATABASE_URL); };
async function owner() { const r = await getAllowedSession(); return r?.data?.session && r?.data?.user?.id ? String(r.data.user.id) : null; }
const bad = (error: string, status = 400) => Response.json({ error }, { status });
const isWeek = (w: unknown): w is string => typeof w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w);
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const num = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);

type Row = Record<string, unknown>;
function shape(r: Row) {
  const d = { id: String(r.id), day: Number(r.day), platform: String(r.platform) as Platform, pillar: String(r.pillar), format: String(r.format), hook: String(r.hook), body: String(r.body), card: r.card, slides: r.slides, shoot: String(r.shoot ?? ""), status: String(r.status), postedAt: r.posted_at ? new Date(r.posted_at as string).toISOString() : null, url: String(r.url ?? ""), views: r.views as number | null, comments: r.comments as number | null, leads: r.leads as number | null };
  return { ...d, caption: captionFor(d), issues: lint(d), pillarName: PILLARS[d.pillar]?.name ?? d.pillar };
}

/** GET ?week=YYYY-MM-DD (any day in it): that week's drafts, plus how each topic has done over the last 120 days. */
export async function GET(req: Request) {
  const o = await owner(); if (!o) return bad("Unauthorized", 401);
  const q = new URL(req.url).searchParams.get("week");
  const week = weekStart(isWeek(q) ? q : new Date().toISOString().slice(0, 10));
  try {
    const sql = db();
    const rows = await sql`SELECT * FROM public.content_drafts WHERE owner_id = ${o} AND week = ${week}::date ORDER BY day, platform, created_at` as Row[];
    const hist = await sql`SELECT pillar, platform, views, comments, leads FROM public.content_drafts WHERE owner_id = ${o} AND status = 'posted' AND posted_at > now() - interval '120 days'` as { pillar: string; platform: string; views: number | null; comments: number | null; leads: number | null }[];
    const scores = pillarScores(hist);
    const totals = hist.reduce((t, h) => ({ posts: t.posts + 1, views: t.views + (h.views ?? 0), comments: t.comments + (h.comments ?? 0), leads: t.leads + (h.leads ?? 0) }), { posts: 0, views: 0, comments: 0, leads: 0 });
    const topics = Object.entries(PILLARS).map(([k, v]) => ({ key: k, name: v.name, score: Math.round(scores[k] * 10) / 10, posts: hist.filter(h => h.pillar === k).length, leads: hist.filter(h => h.pillar === k).reduce((s, h) => s + (h.leads ?? 0), 0) })).sort((a, b) => b.score - a.score);
    return Response.json({ week, drafts: rows.map(shape), topics, totals, canWrite: !!process.env.ANTHROPIC_API_KEY }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("Content engine GET failed", e); return bad("Couldn't load this week's posts.", 500); }
}

/** POST { action, ... }: generate | rewrite | edit | posted | unpost | metrics | skip */
export async function POST(req: Request) {
  const o = await owner(); if (!o) return bad("Unauthorized", 401);
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const sql = db();
    if (b.action === "generate") {
      if (!process.env.ANTHROPIC_API_KEY) return bad("Add ANTHROPIC_API_KEY in Vercel to have Cinder write posts.", 503);
      const week = weekStart(isWeek(b.week) ? b.week : new Date().toISOString().slice(0, 10));
      const r = await generateWeek(sql, o, week);
      if (!r.written && r.error) return bad(r.error, 502);
      return Response.json({ ok: true, ...r });
    }
    if (!isId(b.id)) return bad("Which post?");
    if (b.action === "rewrite") {
      const d = await rewriteDraft(sql, o, b.id, typeof b.note === "string" ? b.note : "");
      return d ? Response.json({ ok: true }) : bad("Couldn't rewrite that one. Try again.", 502);
    }
    if (b.action === "edit") {
      const hook = String(b.hook ?? "").slice(0, 200).trim(), body = String(b.body ?? "").slice(0, 3000).trim();
      if (!hook || !body) return bad("A post needs a first line and a body.");
      await sql`UPDATE public.content_drafts SET hook = ${hook}, body = ${body} WHERE id = ${b.id}::uuid AND owner_id = ${o}`;
    } else if (b.action === "posted") {
      const url = String(b.url ?? "").slice(0, 500).trim();
      if (url && !/^https?:\/\//.test(url)) return bad("Paste the full link to the post, starting with https://");
      await sql`UPDATE public.content_drafts SET status = 'posted', posted_at = coalesce(posted_at, now()), url = ${url} WHERE id = ${b.id}::uuid AND owner_id = ${o}`;
    } else if (b.action === "unpost") {
      await sql`UPDATE public.content_drafts SET status = 'draft', posted_at = NULL WHERE id = ${b.id}::uuid AND owner_id = ${o}`;
    } else if (b.action === "skip") {
      await sql`UPDATE public.content_drafts SET status = 'skipped' WHERE id = ${b.id}::uuid AND owner_id = ${o} AND status = 'draft'`;
    } else if (b.action === "metrics") {
      await sql`UPDATE public.content_drafts SET views = ${num(b.views)}, comments = ${num(b.comments)}, leads = ${num(b.leads)} WHERE id = ${b.id}::uuid AND owner_id = ${o}`;
    } else return bad("Unknown action.");
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AiTextError) return bad(e.message, e.status);
    console.error("Content engine POST failed", e); return bad("Couldn't save that.", 500);
  }
}
