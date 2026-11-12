import { neon } from "@neondatabase/serverless";
import { sendAlert } from "@/lib/notify";
import { hashToken, isTokenShape } from "@/lib/esign";
import { fieldsFor, validateKickoff, kickoffSummary, FILE_KEYS, type KickoffTier } from "@/lib/kickoff";
import { sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

async function load(token: string) {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT k.id, k.owner_id, k.deal_id, k.project_id, k.tier, k.status, k.submitted_at, c.company, c.id AS contact_id, d.title AS deal_title
    FROM public.kickoff_requests k
    JOIN public.deals d ON d.id = k.deal_id AND d.owner_id = k.owner_id
    LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
    WHERE k.token_hash = ${hashToken(token)} LIMIT 1`;
  return { sql, row: rows[0] };
}

/** GET /api/kickoff?token=… — public: the checklist behind a kickoff link. Never returns earlier answers. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isTokenShape(token)) return reply({ error: "This kickoff link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "The checklist is unavailable right now." }, 503);
  try {
    const { row } = await load(token);
    if (!row || row.status === "void") return reply({ error: "This kickoff link is no longer active. Ask for a new one." }, 404);
    const tier = String(row.tier) as KickoffTier;
    const files = row.status === "open" ? await uploadsFor(row.id) : [];
    return reply({
      files,
      status: row.status === "submitted" ? "submitted" : "open",
      client: String(row.company || String(row.deal_title).split(" — ")[0] || ""),
      tier, fields: fieldsFor(tier),
      submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : null,
    });
  } catch (error) {
    console.error("Kickoff GET failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't load the checklist. Try again." }, 500);
  }
}

/**
 * POST /api/kickoff { token, answers } — the client submits the checklist. Answers land on the project,
 * the kickoff steps are checked off, and the owner gets an email (without the EIN).
 */
export async function POST(request: Request) {
  if (new URL(request.url).searchParams.has("upload")) return upload(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const token = body?.token;
  if (!isTokenShape(token)) return reply({ error: "This kickoff link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "The checklist is unavailable right now." }, 503);
  try {
    const { sql, row } = await load(token);
    if (!row || row.status === "void") return reply({ error: "This kickoff link is no longer active. Ask for a new one." }, 404);
    if (row.status === "submitted") return reply({ error: "This checklist was already sent. Thanks!" }, 409);
    const tier = String(row.tier) as KickoffTier;
    const have = (await uploadsFor(row.id)).map(f => f.field);
    const v = validateKickoff(body?.answers, tier, have);
    if ("error" in v) return reply({ error: v.error }, 400);
    const owner = String(row.owner_id);
    const saved = await sql`UPDATE public.kickoff_requests SET answers = ${JSON.stringify(v.ok)}::jsonb, status = 'submitted', submitted_at = now(), updated_at = now()
      WHERE id = ${row.id}::uuid AND status = 'open' RETURNING id`;
    if (!saved.length) return reply({ error: "This checklist was already sent. Thanks!" }, 409);

    const company = String(row.company || String(row.deal_title).split(" — ")[0] || "the client");
    const summary = kickoffSummary(v.ok, tier);
    const uploaded = have.length ? `\nUploaded files (open them on the deal's Kickoff tab): ${have.join(", ")}` : "";
    const project = row.project_id ? String(row.project_id) : (await sql`SELECT id FROM public.projects WHERE owner_id = ${owner} AND deal_id = ${row.deal_id}::uuid LIMIT 1`)[0]?.id;
    if (project) {
      await sql`UPDATE public.projects SET notes = left(trim(both from concat_ws(E'\n\n', NULLIF(notes, ''), ${"KICKOFF CHECKLIST (" + new Date().toISOString().slice(0, 10) + ")\n" + summary + uploaded})), 20000), updated_at = now()
        WHERE id = ${String(project)}::uuid AND owner_id = ${owner}`;
      await sql`UPDATE public.project_milestones SET status = 'done', completed_at = COALESCE(completed_at, now()), updated_at = now()
        WHERE owner_id = ${owner} AND project_id = ${String(project)}::uuid AND status <> 'done'
          AND lower(title) IN ('send the kickoff checklist link', 'collect the kickoff checklist')`;
    }
    if (row.contact_id) {
      await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
        VALUES (${owner}, ${String(row.contact_id)}::uuid, 'note', 'note', 'other', 'Sent the kickoff checklist. The 21-business-day go-live clock starts now.')`;
    }
    await sendAlert({ subject: `Kickoff checklist in: ${company}`, lines: [
      `${company} sent their kickoff checklist. The 21-business-day go-live clock starts now.`,
      "Next: book the kickoff call and submit the SMS registration (the EIN letter is on the deal's Kickoff tab, not in this email).",
    ], link: { label: "Open the deal", path: `/crm/deals/${String(row.deal_id)}` } });
    return reply({ ok: true });
  } catch (error) {
    console.error("Kickoff POST failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return reply({ error: "Couldn't send the checklist. Try again." }, 500);
  }
}

// ---------- Uploads: the EIN letter and the quote / customer lists. Stored in the database, read back only in the CRM. ----------

const MAX_BYTES = 4_000_000;
const FILE_FIELDS = new Set<string>(FILE_KEYS);

async function uploadsFor(kickoffId: unknown): Promise<{ field: string; name: string; size: number }[]> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT DISTINCT ON (field) field, filename, size FROM public.kickoff_files
    WHERE kickoff_id = ${String(kickoffId)}::uuid ORDER BY field, created_at DESC`;
  return rows.map(r => ({ field: String(r.field), name: String(r.filename), size: Number(r.size) }));
}

/** What the bytes actually are (never trust the name or the browser's type). */
function sniff(b: Uint8Array): string | null {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(4, 0x66, 0x74, 0x79, 0x70)) { const brand = String.fromCharCode(...b.slice(8, 12)); if (/^(heic|heix|hevc|mif1|msf1)$/.test(brand)) return "image/heic"; }
  if (at(0, 0x50, 0x4b, 0x03, 0x04)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (at(0, 0xd0, 0xcf, 0x11, 0xe0)) return "application/vnd.ms-excel";
  const head = b.slice(0, 4096);
  if (head.length && !head.includes(0)) return "text/csv";
  return null;
}

const DOC_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic"]);

/** POST /api/kickoff?upload=<field> (raw file body; headers x-kickoff-token, x-file-name). Replaces that field's earlier upload. */
async function upload(request: Request) {
  const url = new URL(request.url);
  const field = url.searchParams.get("upload") ?? "";
  const token = request.headers.get("x-kickoff-token");
  if (!isTokenShape(token)) return reply({ error: "This kickoff link isn't valid." }, 404);
  if (!FILE_FIELDS.has(field)) return reply({ error: "Unknown upload." }, 400);
  if (!process.env.DATABASE_URL) return reply({ error: "Uploads are unavailable right now." }, 503);
  try {
    const { sql, row } = await load(token);
    if (!row || row.status === "void") return reply({ error: "This kickoff link is no longer active. Ask for a new one." }, 404);
    if (row.status === "submitted") return reply({ error: "This checklist was already sent. Text Sam the file instead." }, 409);
    if (!fieldsFor(String(row.tier) as KickoffTier).some(f => f.key === field)) return reply({ error: "Unknown upload." }, 400);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return reply({ error: "That file is empty." }, 400);
    if (bytes.length > MAX_BYTES) return reply({ error: "That file is over 4 MB. Try a PDF, or a photo of just the page." }, 413);
    const mime = sniff(bytes);
    if (!mime || (field === "ein_letter" && !DOC_TYPES.has(mime))) {
      return reply({ error: field === "ein_letter" ? "Upload a PDF or a photo (JPG, PNG or HEIC) of the letter." : "Upload a spreadsheet (CSV or Excel), a PDF or a photo." }, 415);
    }
    let name = "upload";
    try { name = decodeURIComponent(request.headers.get("x-file-name") ?? "upload"); } catch { /* keep the default */ }
    name = name.replace(/[\\/\u0000-\u001f]/g, "").trim().slice(0, 120) || "upload";
    const owner = String(row.owner_id);
    await sql`DELETE FROM public.kickoff_files WHERE kickoff_id = ${row.id}::uuid AND field = ${field}`;
    await sql`INSERT INTO public.kickoff_files (owner_id, kickoff_id, field, filename, mime, size, data)
      VALUES (${owner}, ${row.id}::uuid, ${field}, ${name}, ${mime}, ${bytes.length}, ${"\\x" + Buffer.from(bytes).toString("hex")}::bytea)`;
    return reply({ ok: true, file: { field, name, size: bytes.length } });
  } catch (error) {
    console.error("Kickoff upload failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return reply({ error: "Couldn't upload that file. Try again." }, 500);
  }
}

/** DELETE /api/kickoff?file=<field> (header x-kickoff-token): the client removes an upload before sending. */
export async function DELETE(request: Request) {
  const field = new URL(request.url).searchParams.get("file") ?? "";
  const token = request.headers.get("x-kickoff-token");
  if (!isTokenShape(token)) return reply({ error: "This kickoff link isn't valid." }, 404);
  if (!FILE_FIELDS.has(field) || !process.env.DATABASE_URL) return reply({ error: "Unknown upload." }, 400);
  try {
    const { sql, row } = await load(token);
    if (!row || row.status !== "open") return reply({ error: "This checklist can't be changed now." }, 409);
    await sql`DELETE FROM public.kickoff_files WHERE kickoff_id = ${row.id}::uuid AND field = ${field}`;
    return reply({ ok: true });
  } catch {
    return reply({ error: "Couldn't remove that file. Try again." }, 500);
  }
}
