// Publishing queued posts to Facebook and Instagram. Runs from the publish cron and from "Post now".
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { captionFor, type Platform } from "@/lib/content-engine";
import { metaConfig, publishFeed, publishReel, type MediaRef } from "@/lib/meta-publish";

type Sql = NeonQueryFunction<false, false>;
type Row = { id: string; platform: Platform; pillar: string; body: string; slides: unknown[]; publish_status: string };

async function mediaFor(sql: Sql, draftId: string, origin: string): Promise<MediaRef[]> {
  const rows = await sql`SELECT id, idx, mime, token FROM public.content_media WHERE draft_id = ${draftId}::uuid ORDER BY idx` as { id: string; idx: number; mime: string; token: string }[];
  return rows.map(r => ({ url: `${origin}/api/content/media?id=${r.id}&t=${r.token}`, mime: r.mime }));
}

/** Publish one post now. Marks it posted on success; keeps the error on the post otherwise. */
export async function publishOne(sql: Sql, o: string, id: string, origin: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = metaConfig();
  if (!cfg) return { ok: false, error: "Add META_PAGE_ID, META_PAGE_TOKEN and META_IG_USER_ID in Vercel to post automatically." };
  const [d] = await sql`UPDATE public.content_drafts SET publish_status = 'publishing' WHERE id = ${id}::uuid AND owner_id = ${o} AND publish_status <> 'publishing' AND status <> 'posted'
    RETURNING id, platform, pillar, body, slides, publish_status` as Row[];
  if (!d) return { ok: false, error: "That post is already posted or posting." };
  const media = await mediaFor(sql, id, origin);
  if (!media.length) {
    await sql`UPDATE public.content_drafts SET publish_status = 'failed', publish_error = 'No image or video saved yet. Prepare it on the Content page.' WHERE id = ${id}::uuid`;
    return { ok: false, error: "Prepare the image or video first." };
  }
  const caption = captionFor(d);
  const r = d.platform === "video" ? await publishReel(cfg, caption, media[0]) : await publishFeed(cfg, caption, media);
  const posted = !!(r.fb || r.ig);
  const error = r.errors.join(" · ").slice(0, 500);
  if (r.pending && !posted) {
    await sql`UPDATE public.content_drafts SET publish_status = 'queued', publish_error = ${error} WHERE id = ${id}::uuid`;
    return { ok: false, error };
  }
  await sql`UPDATE public.content_drafts SET publish_status = ${posted ? "published" : "failed"}, publish_error = ${error},
    fb_post_id = ${r.fb ?? ""}, ig_post_id = ${r.ig ?? ""},
    status = CASE WHEN ${posted}::boolean THEN 'posted' ELSE status END, posted_at = CASE WHEN ${posted}::boolean THEN coalesce(posted_at, now()) ELSE posted_at END
    WHERE id = ${id}::uuid`;
  return posted ? { ok: true, ...(error ? { error } : {}) } : { ok: false, error: error || "Meta didn't take the post." };
}

/** Everything queued whose time has come, a few at a time so the run stays inside its time limit. */
export async function publishDue(sql: Sql, o: string, origin: string, limit = 4): Promise<{ posted: number; failed: number }> {
  const due = await sql`SELECT id FROM public.content_drafts WHERE owner_id = ${o} AND publish_status = 'queued' AND scheduled_at <= now() + interval '10 minutes'
    ORDER BY scheduled_at LIMIT ${limit}` as { id: string }[];
  let posted = 0, failed = 0;
  for (const d of due) { const r = await publishOne(sql, o, d.id, origin); if (r.ok) posted++; else failed++; }
  return { posted, failed };
}
