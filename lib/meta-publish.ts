// Posting to your Facebook Page and Instagram through Meta's Graph API. Free; needs three values in Vercel:
// META_PAGE_ID, META_PAGE_TOKEN (a long-lived Page access token) and META_IG_USER_ID (the Instagram business
// account linked to that Page). Meta fetches each image or video from a public URL, so media is served by
// /api/content/media/<id>?t=<token>. Pure helpers first, then the calls.

export type MetaConfig = { page: string; token: string; ig: string; version: string };
export type MediaRef = { url: string; mime: string };
export type PublishResult = { fb?: string; ig?: string; errors: string[]; pending?: boolean };

export function metaConfig(env: Record<string, string | undefined> = process.env): MetaConfig | null {
  const page = env.META_PAGE_ID?.trim(), token = env.META_PAGE_TOKEN?.trim(), ig = env.META_IG_USER_ID?.trim() ?? "";
  if (!page || !token) return null;
  return { page, token, ig, version: env.META_GRAPH_VERSION?.trim() || "v23.0" };
}

/** Five posting times a day, local, one per slot: 7:30, 10:30, 1:30, 4:30, 7:30. */
export const POST_TIMES = [[7, 30], [10, 30], [13, 30], [16, 30], [19, 30]] as const;

/** A wall-clock time in a time zone, as a UTC Date. */
export function zonedTime(ymd: string, hour: number, minute: number, tz: string): Date {
  const guess = new Date(`${ymd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess).map(p => [p.type, p.value]));
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

/** When slot n of a day goes out. Reels go 15 minutes after the feed post of the same slot. */
export function slotTime(ymd: string, n: number, platform: string, tz: string): Date {
  const [h, m] = POST_TIMES[Math.min(Math.max(0, n), POST_TIMES.length - 1)];
  return zonedTime(ymd, h, m + (platform === "video" ? 15 : 0), tz);
}

async function graph(cfg: MetaConfig, path: string, params: Record<string, string>, method = "POST"): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: cfg.token });
  const url = `https://graph.facebook.com/${cfg.version}/${path}` + (method === "GET" ? `?${body}` : "");
  const r = await fetch(url, method === "GET" ? { signal: AbortSignal.timeout(20_000) } : { method, body, signal: AbortSignal.timeout(45_000) });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok || j.error) throw new Error(String((j.error as { message?: string })?.message ?? `Meta returned ${r.status}`).slice(0, 300));
  return j;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function igWait(cfg: MetaConfig, id: string, maxMs: number): Promise<boolean> {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    const s = await graph(cfg, id, { fields: "status_code" }, "GET");
    if (s.status_code === "FINISHED") return true;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram couldn't process the video (${s.status_code}).`);
    await sleep(4000);
  }
  return false;
}

/** Feed post: one image or a carousel. Same caption on the Page and on Instagram. */
export async function publishFeed(cfg: MetaConfig, caption: string, media: MediaRef[]): Promise<PublishResult> {
  const res: PublishResult = { errors: [] };
  try {
    if (media.length === 1) res.fb = String((await graph(cfg, `${cfg.page}/photos`, { url: media[0].url, caption })).post_id ?? "");
    else {
      const ids: string[] = [];
      for (const m of media) ids.push(String((await graph(cfg, `${cfg.page}/photos`, { url: m.url, published: "false" })).id));
      const p: Record<string, string> = { message: caption };
      ids.forEach((id, i) => { p[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
      res.fb = String((await graph(cfg, `${cfg.page}/feed`, p)).id ?? "");
    }
  } catch (e) { res.errors.push("Facebook: " + (e instanceof Error ? e.message : "failed")); }
  if (cfg.ig) try {
    let creation: string;
    if (media.length === 1) creation = String((await graph(cfg, `${cfg.ig}/media`, { image_url: media[0].url, caption })).id);
    else {
      const kids: string[] = [];
      for (const m of media.slice(0, 10)) kids.push(String((await graph(cfg, `${cfg.ig}/media`, { image_url: m.url, is_carousel_item: "true" })).id));
      creation = String((await graph(cfg, `${cfg.ig}/media`, { media_type: "CAROUSEL", children: kids.join(","), caption })).id);
    }
    await igWait(cfg, creation, 30_000);
    res.ig = String((await graph(cfg, `${cfg.ig}/media_publish`, { creation_id: creation })).id ?? "");
  } catch (e) { res.errors.push("Instagram: " + (e instanceof Error ? e.message : "failed")); }
  return res;
}

/** Reel: a video on the Page and an Instagram Reel. Instagram needs MP4; a WebM recording is skipped there. */
export async function publishReel(cfg: MetaConfig, caption: string, video: MediaRef): Promise<PublishResult> {
  const res: PublishResult = { errors: [] };
  try { res.fb = String((await graph(cfg, `${cfg.page}/videos`, { file_url: video.url, description: caption })).id ?? ""); }
  catch (e) { res.errors.push("Facebook: " + (e instanceof Error ? e.message : "failed")); }
  if (cfg.ig) {
    if (!video.mime.includes("mp4")) res.errors.push("Instagram: the video was recorded as WebM. Render it again in Chrome to get MP4.");
    else try {
      const creation = String((await graph(cfg, `${cfg.ig}/media`, { media_type: "REELS", video_url: video.url, caption, share_to_feed: "true" })).id);
      if (!(await igWait(cfg, creation, 120_000))) { res.errors.push("Instagram: still processing the video; it will be tried again."); res.pending = true; }
      else res.ig = String((await graph(cfg, `${cfg.ig}/media_publish`, { creation_id: creation })).id ?? "");
    } catch (e) { res.errors.push("Instagram: " + (e instanceof Error ? e.message : "failed")); }
  }
  return res;
}
