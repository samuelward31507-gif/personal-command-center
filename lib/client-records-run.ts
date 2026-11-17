// Equipment, documents and to-dos: the server side. Equipment and documents belong to a customer; crew can see and
// add them on their jobs (a serial number off a nameplate, a permit photo). To-dos are the owner's and the office's.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Client } from "@/lib/client-runtime-run";
import { cleanEquipment, cleanFile, cleanTask, type Equipment, type Task } from "@/lib/records";

type Sql = NeonQueryFunction<false, false>;
const today = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });
async function ownThread(sql: Sql, c: Client, id: unknown): Promise<string | null> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [t] = await sql`SELECT id FROM public.client_threads WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid` as { id: string }[];
  return t?.id ?? null;
}

// ---------- Equipment ----------
export async function saveEquipment(sql: Sql, c: Client, threadId: string, id: string | null, input: unknown): Promise<{ ok: boolean; id?: string; error?: string }> {
  const t = await ownThread(sql, c, threadId);
  if (!t) return { ok: false, error: "That customer isn't here." };
  const e = cleanEquipment(input);
  if ("error" in e) return { ok: false, error: e.error };
  if (id) {
    const r = await sql`UPDATE public.client_equipment SET kind = ${e.kind}, make = ${e.make}, model = ${e.model}, serial = ${e.serial}, location = ${e.location}, installed_on = ${e.installed_on}::date,
        warranty_until = ${e.warranty_until}::date, notes = ${e.notes} WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid AND removed_at IS NULL RETURNING id`;
    return r.length ? { ok: true, id } : { ok: false, error: "Not found." };
  }
  const [r] = await sql`INSERT INTO public.client_equipment (owner_id, project_id, thread_id, kind, make, model, serial, location, installed_on, warranty_until, notes)
    VALUES (${c.owner}, ${c.projectId}::uuid, ${t}::uuid, ${e.kind}, ${e.make}, ${e.model}, ${e.serial}, ${e.location}, ${e.installed_on}::date, ${e.warranty_until}::date, ${e.notes}) RETURNING id` as { id: string }[];
  return { ok: true, id: r.id };
}
/** A service on a piece of equipment: today's date, a note, who did it; newest first, the last 50. */
export async function serviceEquipment(sql: Sql, c: Client, id: string, note: unknown, by: string): Promise<{ ok: boolean; error?: string }> {
  const entry = { on: today(c), note: String(note ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300) || "Serviced", by };
  const r = await sql`UPDATE public.client_equipment SET history = (SELECT coalesce(jsonb_agg(x ORDER BY i), '[]'::jsonb) FROM jsonb_array_elements(${JSON.stringify([entry])}::jsonb || history) WITH ORDINALITY AS h(x, i) WHERE i <= 50)
    WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid AND removed_at IS NULL RETURNING id`;
  return r.length ? { ok: true } : { ok: false, error: "Not found." };
}
/** Taken out (replaced, removed): kept for the history, hidden from the list. */
export async function removeEquipment(sql: Sql, c: Client, id: string): Promise<{ ok: boolean }> {
  await sql`UPDATE public.client_equipment SET removed_at = now() WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid`;
  return { ok: true };
}
export async function loadEquipment(sql: Sql, c: Client): Promise<Equipment[]> {
  const rows = await sql`SELECT e.id, e.thread_id, e.kind, e.make, e.model, e.serial, e.location, e.installed_on::text AS installed_on, e.warranty_until::text AS warranty_until, e.notes, e.history, t.customer_name
    FROM public.client_equipment e JOIN public.client_threads t ON t.id = e.thread_id WHERE e.project_id = ${c.projectId}::uuid AND e.removed_at IS NULL ORDER BY e.created_at LIMIT 2000` as Record<string, unknown>[];
  return rows.map(r => ({ id: String(r.id), thread_id: String(r.thread_id), kind: String(r.kind ?? ""), make: String(r.make ?? ""), model: String(r.model ?? ""), serial: String(r.serial ?? ""), location: String(r.location ?? ""),
    installed_on: r.installed_on ? String(r.installed_on) : null, warranty_until: r.warranty_until ? String(r.warranty_until) : null, notes: String(r.notes ?? ""),
    history: Array.isArray(r.history) ? (r.history as { on: string; note: string; by: string }[]).slice(0, 20) : [], customer: r.customer_name ? String(r.customer_name) : undefined }));
}

// ---------- Documents ----------
export async function addFile(sql: Sql, c: Client, threadId: string, input: unknown, member: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const t = await ownThread(sql, c, threadId);
  if (!t) return { ok: false, error: "That customer isn't here." };
  const f = cleanFile(input);
  if ("error" in f) return { ok: false, error: f.error };
  const [n] = await sql`SELECT count(*)::int AS n FROM public.client_files WHERE thread_id = ${t}::uuid` as { n: number }[];
  if ((n?.n ?? 0) >= 40) return { ok: false, error: "40 documents is the most for one customer. Remove one first." };
  const bytes = Buffer.from(f.data, "base64");
  const [r] = await sql`INSERT INTO public.client_files (owner_id, project_id, thread_id, name, mime, bytes, size, member) VALUES (${c.owner}, ${c.projectId}::uuid, ${t}::uuid, ${f.name}, ${f.mime}, ${bytes}, ${bytes.length}, ${member}) RETURNING id` as { id: string }[];
  return { ok: true, id: r.id };
}
export async function removeFile(sql: Sql, c: Client, id: string): Promise<{ ok: boolean }> {
  await sql`DELETE FROM public.client_files WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid`;
  return { ok: true };
}
export type FileRow = { id: string; thread_id: string; name: string; mime: string; size: number; created_at: string };
export async function loadFiles(sql: Sql, c: Client): Promise<FileRow[]> {
  const rows = await sql`SELECT id, thread_id, name, mime, size, created_at FROM public.client_files WHERE project_id = ${c.projectId}::uuid ORDER BY created_at DESC LIMIT 2000` as Record<string, unknown>[];
  return rows.map(r => ({ id: String(r.id), thread_id: String(r.thread_id), name: String(r.name), mime: String(r.mime), size: Number(r.size) || 0, created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at) }));
}

// ---------- To-dos ----------
export async function saveTask(sql: Sql, c: Client, input: unknown, by: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const t = cleanTask(input);
  if ("error" in t) return { ok: false, error: t.error };
  const thread = t.thread ? await ownThread(sql, c, t.thread) : null;
  const [r] = await sql`INSERT INTO public.client_tasks (owner_id, project_id, title, due_on, assignee, thread_id, created_by) VALUES (${c.owner}, ${c.projectId}::uuid, ${t.title}, ${t.due_on}::date, ${t.assignee}, ${thread}::uuid, ${by}) RETURNING id` as { id: string }[];
  return { ok: true, id: r.id };
}
export async function setTask(sql: Sql, c: Client, id: string, done: boolean): Promise<{ ok: boolean }> {
  await sql`UPDATE public.client_tasks SET done_at = ${done ? new Date().toISOString() : null}::timestamptz WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid`;
  return { ok: true };
}
/** Open tasks and those finished in the last week. */
export async function loadTasks(sql: Sql, c: Client): Promise<Task[]> {
  const rows = await sql`SELECT k.id, k.title, k.due_on::text AS due_on, k.assignee, k.thread_id, k.done_at, k.created_at, t.customer_name FROM public.client_tasks k LEFT JOIN public.client_threads t ON t.id = k.thread_id
    WHERE k.project_id = ${c.projectId}::uuid AND (k.done_at IS NULL OR k.done_at > now() - interval '7 days') ORDER BY k.created_at LIMIT 500` as Record<string, unknown>[];
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
  return rows.map(r => ({ id: String(r.id), title: String(r.title), due_on: r.due_on ? String(r.due_on) : null, assignee: String(r.assignee ?? ""), thread: r.thread_id ? String(r.thread_id) : null,
    done_at: iso(r.done_at), created_at: iso(r.created_at) ?? "", customer: r.customer_name ? String(r.customer_name) : undefined }));
}
