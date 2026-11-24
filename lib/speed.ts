// Speed: the health of every client's speed-to-lead system, for Sam only.
// Pure: no I/O. The API feeds it rows; tests feed it fixtures.

export type SpeedLead = { at: string; firstOut: string | null; source: string; name: string };
export type SpeedClient = {
  id: string;
  name: string;
  live: boolean;
  textingNumber: string | null;
  calendar: boolean;
  failed24h: number;
  unanswered: number;
  leads: SpeedLead[]; // last 30 days, any order
  lastLeadAt: string | null;
};
export type Status = "broken" | "watch" | "healthy" | "not_live";
export type Problem = { level: "broken" | "watch"; text: string; fix: string };
export type ClientHealthRow = {
  id: string;
  name: string;
  status: Status;
  problems: Problem[];
  leads24h: number;
  leads30d: number;
  answered30d: number;
  medianSec: number | null;
  p95Sec: number | null;
  over60: number;
  missed24h: number;
  replies: number[]; // seconds, oldest first, for the sparkline
  sources: { source: string; count: number; lastAt: string }[];
  calendar: boolean;
  lastLeadAt: string | null;
};

export const PROMISE_SEC = 10; // what the site promises ("in about 10 seconds")
export const GUARANTEE_SEC = 60; // past this a lead counts as slow
export const MISSED_MIN = 15; // no reply after this is a missed lead

const sec = (l: SpeedLead) => (l.firstOut ? Math.max(0, (Date.parse(l.firstOut) - Date.parse(l.at)) / 1000) : null);

/** Nearest-rank percentile of a sorted list. */
export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

export function median(sorted: number[]): number | null {
  if (!sorted.length) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

const SOURCE_LABEL: Record<string, string> = {
  missed_call: "Missed calls", text: "Texts", "web form": "Web form", web_form: "Web form", "web chat": "Web chat",
  facebook: "Facebook ads", angi: "Angi", thumbtack: "Thumbtack", google: "Google", referral: "Referrals",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, " ") : "Other");

export function assess(c: SpeedClient, now: number): ClientHealthRow {
  const day = 86_400_000;
  const leads = [...c.leads].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const in30 = leads.filter(l => now - Date.parse(l.at) <= 30 * day);
  const in24 = in30.filter(l => now - Date.parse(l.at) <= day);
  const times = in30.map(sec).filter((s): s is number => s != null);
  const sorted = [...times].sort((a, b) => a - b);
  const missed24h = in24.filter(l => {
    const s = sec(l);
    return now - Date.parse(l.at) > MISSED_MIN * 60_000 && (s == null || s > MISSED_MIN * 60);
  }).length;
  const bySource = new Map<string, { count: number; lastAt: string }>();
  for (const l of in30) {
    const k = sourceLabel(l.source);
    const e = bySource.get(k);
    bySource.set(k, { count: (e?.count ?? 0) + 1, lastAt: !e || l.at > e.lastAt ? l.at : e.lastAt });
  }
  const medianSec = median(sorted);
  const problems: Problem[] = [];
  if (c.live) {
    if (c.failed24h) problems.push({ level: "broken", text: `${c.failed24h} text${c.failed24h === 1 ? "" : "s"} failed to send in the last 24 hours`, fix: "Check the texting number and its A2P registration in Twilio." });
    if (missed24h) problems.push({ level: "broken", text: `${missed24h} lead${missed24h === 1 ? "" : "s"} got no reply within ${MISSED_MIN} minutes`, fix: "Open their Inbox and reply now, then send a test lead." });
    if (c.unanswered) problems.push({ level: "broken", text: `${c.unanswered} customer text${c.unanswered === 1 ? "" : "s"} never got a reply`, fix: "Open their Inbox and answer, or hand the thread to the owner." });
    if (!c.calendar) problems.push({ level: "watch", text: "Calendar isn't connected, so estimates can't book themselves", fix: "Send the owner the calendar connect link." });
    if (medianSec != null && medianSec > PROMISE_SEC) problems.push({ level: "watch", text: `Typical first reply is ${fmtSec(medianSec)}, over the ${PROMISE_SEC}s promise`, fix: "Send a test lead and check where the delay is." });
    const last = c.lastLeadAt ? Date.parse(c.lastLeadAt) : null;
    if (last == null || now - last > 7 * day) problems.push({ level: "watch", text: last == null ? "No leads yet" : `No leads in ${Math.floor((now - last) / day)} days`, fix: "Check their call forwarding and website form, then send a test lead." });
  }
  const status: Status = !c.live ? "not_live" : problems.some(p => p.level === "broken") ? "broken" : problems.length ? "watch" : "healthy";
  return {
    id: c.id, name: c.name, status, problems,
    leads24h: in24.length, leads30d: in30.length, answered30d: times.length,
    medianSec, p95Sec: percentile(sorted, 95), over60: times.filter(t => t > GUARANTEE_SEC).length, missed24h,
    replies: in30.map(sec).filter((s): s is number => s != null).slice(-30),
    sources: [...bySource].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.count - a.count),
    calendar: c.calendar, lastLeadAt: c.lastLeadAt,
  };
}

export function summary(rows: ClientHealthRow[]) {
  const live = rows.filter(r => r.status !== "not_live");
  const all = live.flatMap(r => r.replies).sort((a, b) => a - b);
  return {
    broken: live.filter(r => r.status === "broken").length,
    watch: live.filter(r => r.status === "watch").length,
    healthy: live.filter(r => r.status === "healthy").length,
    live: live.length,
    medianSec: median(all),
    p95Sec: percentile(all, 95),
    leads24h: live.reduce((s, r) => s + r.leads24h, 0),
    missed24h: live.reduce((s, r) => s + r.missed24h, 0),
  };
}

export function fmtSec(s: number | null): string {
  if (s == null) return "–";
  if (s < 60) return `${s < 10 ? s.toFixed(1).replace(/\.0$/, "") : Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}
