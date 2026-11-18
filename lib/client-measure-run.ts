// Measure-to-quote, the server side: saving the drawing on a job, pricing it into the quote (one fence type, or two
// or three as good / better / best), and turning one type's material list into a draft material order.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Client } from "@/lib/client-runtime-run";
import { cleanDrawing, cleanFenceTypes, measureOf, quoteLines, takeoff, type Drawing } from "@/lib/fence";
import { saveQuoteLines } from "@/lib/client-billing-run";
import { saveOrder } from "@/lib/client-orders-run";

type Sql = NeonQueryFunction<false, false>;

async function drawingOf(sql: Sql, c: Client, threadId: string): Promise<Drawing | null> {
  const [t] = await sql`SELECT measure FROM public.client_threads WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid` as { measure: unknown }[];
  if (!t) return null;
  return cleanDrawing(t.measure ?? {});
}

/** Saves the drawing on the job. An empty drawing clears it. */
export async function saveMeasure(sql: Sql, c: Client, threadId: string, input: unknown): Promise<{ ok: boolean; error?: string; feet?: number }> {
  const d = cleanDrawing(input);
  const r = await sql`UPDATE public.client_threads SET measure = ${d.runs.length ? JSON.stringify(d) : null}::jsonb, updated_at = now() WHERE id = ${threadId}::uuid AND project_id = ${c.projectId}::uuid RETURNING id`;
  if (!r.length) return { ok: false, error: "That job isn't here." };
  return { ok: true, feet: measureOf(d).newFeet };
}

/** Prices the saved drawing into the job's quote: one type, or up to three as options. Replaces the quote's lines. */
export async function measureQuote(sql: Sql, c: Client, threadId: string, typeIds: unknown): Promise<{ ok: boolean; error?: string; total?: number }> {
  const d = await drawingOf(sql, c, threadId);
  if (!d || !d.runs.some(r => r.kind === "new")) return { ok: false, error: "Draw the fence line first." };
  const all = cleanFenceTypes(c.setup.fence_types), ids = Array.isArray(typeIds) ? typeIds.map(String).slice(0, 3) : [];
  const types = ids.map(id => all.find(t => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);
  if (!types.length) return { ok: false, error: "Pick a fence type. Set them up once in Settings, Fence types." };
  if (types.some(t => !t.price.perFoot)) return { ok: false, error: `Add a price per foot for ${types.find(t => !t.price.perFoot)!.name} first.` };
  const ft = measureOf(d);
  return saveQuoteLines(sql, c, threadId, { items: quoteLines(d, types), note: `${ft.newFeet} ft measured on the map${ft.gates.single + ft.gates.double ? `, ${ft.gates.single + ft.gates.double} ${ft.gates.single + ft.gates.double === 1 ? "gate" : "gates"}` : ""}${ft.tearoutFeet ? `, ${ft.tearoutFeet} ft of old fence out` : ""}.` });
}

/** One fence type's material list as a draft material order on the job (supplier left for the owner to pick). */
export async function measureOrder(sql: Sql, c: Client, threadId: string, typeId: unknown, by: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const d = await drawingOf(sql, c, threadId);
  if (!d || !d.runs.some(r => r.kind === "new")) return { ok: false, error: "Draw the fence line first." };
  const t = cleanFenceTypes(c.setup.fence_types).find(x => x.id === String(typeId));
  if (!t) return { ok: false, error: "Pick the fence type you're building." };
  const k = takeoff(d, t);
  if (!k.materials.length) return { ok: false, error: "Nothing to order for that drawing." };
  return saveOrder(sql, c, threadId, null, { supplier: "", items: k.materials.map(m => ({ name: `${m.name}, ${t.name}`.slice(0, 120), qty: m.qty, unit: m.unit, cost: m.qty ? Math.round((m.cost / m.qty) * 100) / 100 : 0 })),
    note: `${t.name}, ${t.height} ft: ${k.fenceFeet} ft of fence, ${k.posts + k.gatePosts} posts.` }, by);
}

export async function saveFenceTypes(sql: Sql, c: Client, input: unknown): Promise<{ ok: boolean }> {
  const list = cleanFenceTypes(input);
  await sql`UPDATE public.client_ops SET setup = setup || ${JSON.stringify({ fence_types: JSON.stringify(list) })}::jsonb, updated_at = now() WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
  return { ok: true };
}
