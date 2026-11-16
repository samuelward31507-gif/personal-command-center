// What owners expect from the tool they're leaving, on the server: more than one property per customer, reusable job
// checklists filled in on the crew's phone, and the day-before reminder for installs.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { inTextingHours } from "@/lib/client-runtime";
import { clientById, sendToCustomer, type Client } from "@/lib/client-runtime-run";
import { cleanChecklists, DEFAULT_CHECKLISTS, installReminderText } from "@/lib/client-parity-shared";
export { cleanChecklists, DEFAULT_CHECKLISTS, installReminderText };

type Sql = NeonQueryFunction<false, false>;
const ctl = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);
const tz = (c: Client) => c.setup.timezone || "America/Denver";

// ---------- Properties ----------
export type Property = { id: string; address: string; gate_code: string; notes: string };
export async function propertiesByThread(sql: Sql, c: Client): Promise<Record<string, Property[]>> {
  const rows = await sql`SELECT id, thread_id, address, gate_code, notes FROM public.client_properties WHERE project_id = ${c.projectId}::uuid ORDER BY created_at` as Record<string, unknown>[];
  const out: Record<string, Property[]> = {};
  for (const r of rows) (out[String(r.thread_id)] ??= []).push({ id: String(r.id), address: String(r.address), gate_code: String(r.gate_code ?? ""), notes: String(r.notes ?? "") });
  return out;
}
/** Add a property, change one, or take one off. The first property is also the customer's main address. */
export async function saveProperty(sql: Sql, c: Client, threadId: string, input: { id?: unknown; address?: unknown; gate?: unknown; notes?: unknown; remove?: unknown }): Promise<{ ok: boolean; error?: string }> {
  const id = typeof input.id === "string" && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null;
  if (input.remove === true) {
    if (!id) return { ok: false, error: "Which property?" };
    await sql`DELETE FROM public.client_properties WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid AND thread_id = ${threadId}::uuid`;
    return { ok: true };
  }
  const address = ctl(input.address, 300), gate = ctl(input.gate, 120), notes = ctl(input.notes, 600);
  if (!address) return { ok: false, error: "Add the address." };
  const [t] = await sql`SELECT id, details FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { id: string; details: Record<string, unknown> | null }[];
  if (!t) return { ok: false, error: "Not found." };
  if (id) await sql`UPDATE public.client_properties SET address = ${address}, gate_code = ${gate}, notes = ${notes} WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid`;
  else {
    // The customer's existing address becomes their first property, so nothing is lost when a second one is added.
    const [n] = await sql`SELECT count(*)::int AS n FROM public.client_properties WHERE thread_id = ${t.id}::uuid` as { n: number }[];
    const main = String(t.details?.address ?? "");
    if (!n.n && main && main.toLowerCase() !== address.toLowerCase()) await sql`INSERT INTO public.client_properties (owner_id, project_id, thread_id, address) VALUES (${c.owner}, ${c.projectId}::uuid, ${t.id}::uuid, ${main})`;
    await sql`INSERT INTO public.client_properties (owner_id, project_id, thread_id, address, gate_code, notes) VALUES (${c.owner}, ${c.projectId}::uuid, ${t.id}::uuid, ${address}, ${gate}, ${notes})`;
  }
  if (!t.details?.address) await sql`UPDATE public.client_threads SET details = coalesce(details, '{}'::jsonb) || jsonb_build_object('address', ${address}::text) WHERE id = ${t.id}::uuid`;
  return { ok: true };
}

// ---------- Job checklists ----------
export type Checklist = { name: string; items: { label: string; done: boolean; at?: string; by?: string }[] };
export async function setChecklist(sql: Sql, c: Client, threadId: string, name: string | null): Promise<{ ok: boolean; error?: string }> {
  if (name === null) { await sql`UPDATE public.client_threads SET checklist = NULL WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid`; return { ok: true }; }
  const list = [...cleanChecklists(c.setup.checklists), ...DEFAULT_CHECKLISTS(c.setup.trade || "")].find(l => l.name === name);
  if (!list) return { ok: false, error: "That checklist isn't saved." };
  const cl: Checklist = { name: list.name, items: list.items.map(label => ({ label, done: false })) };
  const r = await sql`UPDATE public.client_threads SET checklist = ${JSON.stringify(cl)}::jsonb WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid RETURNING id`;
  return r.length ? { ok: true } : { ok: false, error: "Not found." };
}
/** Tick (or untick) one item, with when and who: the crew does this on the job. */
export async function tickChecklist(sql: Sql, c: Client, threadId: string, i: number, done: boolean, by: string): Promise<{ ok: boolean; error?: string }> {
  const [t] = await sql`SELECT checklist FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { checklist: Checklist | null }[];
  if (!t?.checklist || !t.checklist.items[i]) return { ok: false, error: "That item isn't on the checklist." };
  const items = t.checklist.items.map((x, k) => k === i ? (done ? { ...x, done: true, at: new Date().toISOString(), by } : { label: x.label, done: false }) : x);
  await sql`UPDATE public.client_threads SET checklist = ${JSON.stringify({ ...t.checklist, items })}::jsonb, updated_at = now() WHERE id = ${threadId}::uuid`;
  return { ok: true };
}

// ---------- The day before an install ----------
export async function runInstallReminders(sql: Sql, limit = 80): Promise<{ sent: number; skipped: number }> {
  const rows = await sql`SELECT t.id, t.owner_id, t.project_id, t.customer_phone, t.customer_name, t.install_on::text AS install_on, t.install_time, t.details, t.status
    FROM public.client_threads t WHERE t.stage = 'won' AND t.hidden_at IS NULL AND t.install_on BETWEEN current_date AND current_date + 2
      AND (t.install_reminded_on IS NULL OR t.install_reminded_on <> t.install_on) AND t.status <> 'opted_out' LIMIT 400` as Record<string, unknown>[];
  const clients = new Map<string, Client | null>();
  let sent = 0, skipped = 0;
  for (const r of rows) {
    if (sent >= limit) break;
    const key = String(r.owner_id) + r.project_id;
    if (!clients.has(key)) clients.set(key, await clientById(sql, String(r.owner_id), String(r.project_id)));
    const c = clients.get(key);
    if (!c?.setup.texting_number) { skipped++; continue; }
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: tz(c) });
    if (String(r.install_on) !== tomorrow) continue;
    if (!inTextingHours(tz(c))) { skipped++; continue; }
    const [claimed] = await sql`UPDATE public.client_threads SET install_reminded_on = install_on WHERE id = ${String(r.id)}::uuid AND (install_reminded_on IS NULL OR install_reminded_on <> install_on) RETURNING id`;
    if (!claimed) continue;
    const what = /fenc/i.test(c.setup.trade || "") ? "fence install" : "job";
    const ok = await sendToCustomer(sql, c, String(r.id), String(r.customer_phone), installReminderText({ first: String(r.customer_name ?? "").split(" ")[0], business: c.setup.display_name || "", what, time: r.install_time ? String(r.install_time) : null }), "template");
    if (ok) sent++; else skipped++;
  }
  return { sent, skipped };
}
