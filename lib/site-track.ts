// Website analytics: clean one beacon from cinderrevenue.com, and roll events up into the numbers the CRM shows. Pure: tested.

export type TrackIn = { type: string; vid: string; sid: string; path: string; label?: string; ref?: string; utm?: { source?: string; medium?: string; campaign?: string }; n?: string; b?: string; ms?: number; mobile?: boolean };
export type TrackRow = { type: "view" | "click" | "play" | "leave" | "calc"; vid: string; sid: string; path: string; label: string; ref: string; utmSource: string; utmMedium: string; utmCampaign: string; whoName: string; whoCompany: string; ms: number | null; mobile: boolean };

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|facebookexternalhit|embedly|whatsapp|vercel-screenshot|python-requests|curl|wget/i;
const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, n) : "");

export function isBot(ua: string): boolean { return !ua || BOT.test(ua); }

export function parseTrack(raw: unknown): TrackRow | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as TrackIn;
  if (!["view", "click", "play", "leave", "calc"].includes(b.type)) return null;
  const vid = clean(b.vid, 40), sid = clean(b.sid, 40);
  if (!/^[a-z0-9]{8,40}$/i.test(vid) || !/^[a-z0-9]{8,40}$/i.test(sid)) return null;
  let ref = clean(b.ref, 300);
  try { const h = ref ? new URL(ref).hostname.replace(/^www\./, "") : ""; ref = /cinderrevenue\.com$/.test(h) ? "" : h; } catch { ref = ""; }
  const ms = typeof b.ms === "number" && Number.isFinite(b.ms) ? Math.max(0, Math.min(3_600_000, Math.round(b.ms))) : null;
  return { type: b.type as TrackRow["type"], vid, sid, path: clean(b.path, 200).split("?")[0] || "/", label: clean(b.label, 120), ref,
    utmSource: clean(b.utm?.source, 60), utmMedium: clean(b.utm?.medium, 60), utmCampaign: clean(b.utm?.campaign, 80),
    whoName: clean(b.n, 60), whoCompany: clean(b.b, 120), ms, mobile: !!b.mobile };
}

export type Ev = { type: string; vid: string; sid: string; path: string; label: string; ref: string; utm_source: string; ms: number | null; at: string };
export type SiteStats = { visitors: number; sessions: number; views: number; bounceRate: number | null; medianSeconds: number | null; bookClicks: number; bookClickRate: number | null; demoPlays: number; calcUses: number;
  pages: { path: string; views: number }[]; sources: { source: string; sessions: number }[]; byDay: { day: string; visitors: number }[] };

export function siteStats(evs: Ev[], tz = "America/Denver"): SiteStats {
  const sessions = new Map<string, Ev[]>();
  for (const e of evs) { const a = sessions.get(e.sid); if (a) a.push(e); else sessions.set(e.sid, [e]); }
  const visitors = new Set(evs.map(e => e.vid));
  let bounces = 0; const durs: number[] = [];
  const bookVisitors = new Set<string>();
  const srcCount = new Map<string, number>();
  for (const [, list] of sessions) {
    const views = list.filter(e => e.type === "view").length;
    const acted = list.some(e => e.type === "click" || e.type === "play" || e.type === "calc");
    const ms = Math.max(0, ...list.filter(e => e.type === "leave").map(e => e.ms ?? 0));
    if (views <= 1 && !acted && ms < 10_000) bounces++;
    if (ms > 0) durs.push(ms);
    const first = list.find(e => e.type === "view");
    const src = first?.utm_source || first?.ref || "Direct or text link";
    srcCount.set(src, (srcCount.get(src) ?? 0) + 1);
  }
  const bookClicks = evs.filter(e => e.type === "click" && /book|cal\.com|call/i.test(e.label));
  bookClicks.forEach(e => bookVisitors.add(e.vid));
  durs.sort((a, b) => a - b);
  const pages = new Map<string, number>();
  for (const e of evs) if (e.type === "view") pages.set(e.path, (pages.get(e.path) ?? 0) + 1);
  const days = new Map<string, Set<string>>();
  for (const e of evs) { const d = new Date(e.at).toLocaleDateString("en-CA", { timeZone: tz }); const s = days.get(d) ?? new Set(); s.add(e.vid); days.set(d, s); }
  return {
    visitors: visitors.size, sessions: sessions.size, views: evs.filter(e => e.type === "view").length,
    bounceRate: sessions.size ? Math.round((bounces / sessions.size) * 1000) / 10 : null,
    medianSeconds: durs.length ? Math.round(durs[Math.floor(durs.length / 2)] / 1000) : null,
    bookClicks: bookClicks.length, bookClickRate: visitors.size ? Math.round((bookVisitors.size / visitors.size) * 1000) / 10 : null,
    demoPlays: evs.filter(e => e.type === "play").length, calcUses: evs.filter(e => e.type === "calc").length,
    pages: [...pages].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 8),
    sources: [...srcCount].map(([source, n]) => ({ source, sessions: n })).sort((a, b) => b.sessions - a.sessions).slice(0, 8),
    byDay: [...days].map(([day, s]) => ({ day, visitors: s.size })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}
