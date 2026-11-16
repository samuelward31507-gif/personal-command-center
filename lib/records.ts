// Equipment at an address, documents on a job, and the office's to-dos: the pure part (what each may hold, which
// warranties run out soon, which tasks are due), so the rules are tested on their own.

const ctl = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const ymd = (v: unknown) => { const s = String(v ?? "").trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T12:00:00Z")) ? s : null; };

// ---------- Equipment ----------
export const EQUIPMENT_KINDS = ["Furnace", "Air conditioner", "Heat pump", "Mini-split", "Boiler", "Water heater", "Tankless water heater", "Water softener", "Sump pump",
  "Electrical panel", "Generator", "EV charger", "Pool pump", "Pool heater", "Pool filter", "Irrigation controller", "Garage door opener", "Roof", "Fence", "Gate operator", "Other"] as const;
export type EquipmentIn = { kind: string; make: string; model: string; serial: string; location: string; installed_on: string | null; warranty_until: string | null; notes: string };
export function cleanEquipment(input: unknown): EquipmentIn | { error: string } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const e = { kind: ctl(o.kind, 40), make: ctl(o.make, 60), model: ctl(o.model, 60), serial: ctl(o.serial, 60).toUpperCase(), location: ctl(o.location, 60),
    installed_on: ymd(o.installed_on), warranty_until: ymd(o.warranty_until), notes: ctl(o.notes, 500) };
  if (!e.kind && !e.make && !e.model) return { error: "Say what it is: the kind, or the make and model." };
  if (e.installed_on && e.warranty_until && e.warranty_until < e.installed_on) return { error: "The warranty can't end before it was installed." };
  return e;
}
export type Equipment = EquipmentIn & { id: string; thread_id: string; customer?: string; history: { on: string; note: string; by: string }[] };
/** Warranties that end within `days` (and haven't ended yet): worth a call before they do. */
export function warrantyEndingSoon<T extends { warranty_until: string | null }>(list: T[], today: string, days = 60): T[] {
  const until = new Date(Date.parse(today + "T12:00:00Z") + days * 86400000).toISOString().slice(0, 10);
  return list.filter(e => e.warranty_until && e.warranty_until >= today && e.warranty_until <= until).sort((a, b) => a.warranty_until!.localeCompare(b.warranty_until!));
}
/** Years since it went in, for "12 years old, due for replacement" talk. */
export const ageYears = (installed: string | null, today: string) => (installed ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(installed)) / (365.25 * 86400000))) : null);

// ---------- Documents ----------
export const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FILE_BYTES = 3_000_000;
/** A document from the browser as a data URL: its name, type and bytes, or why not. */
export function cleanFile(input: unknown): { name: string; mime: string; data: string } | { error: string } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const m = String(o.data ?? "").match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m || !(FILE_TYPES as readonly string[]).includes(m[1])) return { error: "Add a PDF or a photo." };
  if (Math.floor(m[2].length * 3 / 4) > MAX_FILE_BYTES) return { error: "That file is over 3 MB. Save a smaller copy and try again." };
  const name = ctl(o.name, 120).replace(/[\\/:*?"<>|]/g, "-") || (m[1] === "application/pdf" ? "Document.pdf" : "Photo.jpg");
  return { name, mime: m[1], data: m[2] };
}

// ---------- Office to-dos ----------
export type TaskIn = { title: string; due_on: string | null; assignee: string; thread: string | null };
export function cleanTask(input: unknown): TaskIn | { error: string } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const title = ctl(o.title, 200);
  if (!title) return { error: "Say what needs doing." };
  return { title, due_on: ymd(o.due_on), assignee: String(o.assignee ?? "").replace(/[^\d+]/g, "").slice(0, 16), thread: typeof o.thread === "string" && /^[0-9a-f-]{36}$/i.test(o.thread) ? o.thread : null };
}
export type Task = TaskIn & { id: string; done_at: string | null; customer?: string; created_at: string };
/** Open tasks in the order to do them: overdue, then due today, then dated, then undated, oldest first within each. */
export function taskOrder<T extends { due_on: string | null; done_at: string | null; created_at: string }>(list: T[], today: string): T[] {
  const rank = (t: T) => (!t.due_on ? 3 : t.due_on < today ? 0 : t.due_on === today ? 1 : 2);
  return list.filter(t => !t.done_at).sort((a, b) => rank(a) - rank(b) || (a.due_on ?? "").localeCompare(b.due_on ?? "") || a.created_at.localeCompare(b.created_at));
}

// ---------- Tags ----------
/** Tags as the owner types them: trimmed, lowercased, letters, numbers, spaces and dashes, 30 characters, 12 at most, no repeats. */
export function cleanTags(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  const out: string[] = [];
  for (const x of list) { const t = String(x ?? "").toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30); if (t && !out.includes(t)) out.push(t); if (out.length >= 12) break; }
  return out;
}

// ---------- Custom fields ----------
/** The owner's field labels: up to 10, 40 characters each, no repeats (any case). */
export function cleanFieldLabels(v: unknown): string[] {
  let arr: unknown = v;
  if (typeof v === "string") { try { arr = JSON.parse(v); } catch { arr = v.split(","); } }
  const out: string[] = [];
  for (const x of Array.isArray(arr) ? arr : []) { const l = ctl(x, 40); if (l && !out.some(o => o.toLowerCase() === l.toLowerCase())) out.push(l); if (out.length >= 10) break; }
  return out;
}
/** A customer's values: only for labels that exist, 200 characters each; blanks dropped. */
export function cleanFieldValues(v: unknown, labels: string[]): Record<string, string> {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>, out: Record<string, string> = {};
  for (const l of labels) { const x = ctl(o[l], 200); if (x) out[l] = x; }
  return out;
}

// ---------- Activity log ----------
/** The actions worth a line in the log, and how each one reads. Reading the screen or ticking a checklist isn't logged. */
export const LOGGED: Record<string, string> = {
  stage: "Moved a job", status: "Changed who's replying", reply: "Texted a customer", assign: "Assigned a job", lead: "Added a lead", card: "Edited a customer",
  quotelines: "Edited a quote", quotelink: "Sent a quote", quote: "Marked a quote", invoice: "Drafted an invoice", invoicesend: "Sent an invoice", invoicesave: "Edited an invoice",
  invoiceset: "Changed an invoice", payment: "Recorded a payment", paymentdelete: "Deleted a payment", refund: "Recorded a refund", refunddelete: "Deleted a refund", automations: "Changed follow-ups", order: "Saved a material order", orderstatus: "Changed a material order", orderdelete: "Deleted a material order", expense: "Logged an expense", expensedelete: "Deleted an expense",
  photodelete: "Deleted a photo", fileadd: "Added a document", fileremove: "Deleted a document", equipment: "Saved equipment", equipremove: "Removed equipment",
  setup: "Changed settings", winback: "Sent a group text", import: "Imported customers", timeedit: "Fixed a time entry", outcome: "Logged an estimate's outcome",
  reschedule: "Moved an estimate", setphone: "Added a phone number", mailadd: "Added a lead from email", portallink: "Sent a customer their page", photoreport: "Sent a photo report",
  reviewnow: "Asked for a review", changeorder: "Saved a change order", plan: "Saved a service plan", task: "Added a to-do",
};
/** The short detail kept with a log line: the stage, the status, which settings changed. Never message text or money details. */
export function activityDetail(action: string, b: Record<string, unknown>): string {
  if (action === "stage") return String(b.stage ?? "");
  if (action === "status") return String(b.status ?? "");
  if (action === "invoiceset") return String(b.what ?? "");
  if (action === "orderstatus") return String(b.status ?? "");
  if (action === "setup" && b.setup && typeof b.setup === "object") return Object.keys(b.setup as object).filter(k => !/link|token|cell|phone/i.test(k)).slice(0, 8).join(", ");
  if (action === "winback") return b.tag ? `tag: ${String(b.tag).slice(0, 30)}` : "past customers";
  return "";
}
