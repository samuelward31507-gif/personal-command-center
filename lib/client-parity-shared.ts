// Job checklists: the pure parts, shared by the server and the app.
const ctl = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);
/** The owner's reusable checklists, by job type: up to 20 lists of up to 30 items. */
export function cleanChecklists(v: unknown): { name: string; items: string[] }[] {
  let arr: unknown = v;
  if (typeof v === "string") { try { arr = JSON.parse(v); } catch { arr = []; } }
  return (Array.isArray(arr) ? arr : []).slice(0, 20).map(x => { const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return { name: ctl(o.name, 60), items: (Array.isArray(o.items) ? o.items : []).map(i => ctl(i, 100)).filter(Boolean).slice(0, 30) }; }).filter(x => x.name && x.items.length);
}
export const DEFAULT_CHECKLISTS = (trade: string): { name: string; items: string[] }[] => /fenc/i.test(trade)
  ? [{ name: "Fence install", items: ["811 locate marks checked", "Property line and HOA approval confirmed", "Posts set and plumb", "Panels or pickets hung, level", "Gates hung, swing and latch", "Debris hauled, yard raked", "Final walk with the customer"] },
     { name: "Fence repair", items: ["Damage photographed before", "Posts checked for rot", "Boards or panels replaced", "Gate adjusted", "After photo"] }]
  : [{ name: "Job", items: ["Before photo", "Work matches the quote", "Site cleaned up", "After photo", "Walked it with the customer"] }];


export function installReminderText(v: { first: string; business: string; what: string; time: string | null }): string {
  const biz = v.business.trim().replace(/\.+$/, "") || "us";
  const at = v.time ? (() => { const [h, m] = v.time.split(":").map(Number); return ` at ${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`; })() : "";
  return `Hi${v.first ? " " + v.first : ""}, it's ${biz}. Reminder: we start your ${v.what || "job"} tomorrow${at}. Reply here with anything we should know before we get there.`;
}
