import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { enrollContactInOutreach, DoNotContactError } from "@/lib/outreach";
import {
  MAX_IMPORT_ROWS,
  buildHeaderIndex,
  normalizeImportRow,
  normalizePhoneDigits,
  cleanText,
} from "@/lib/contact-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Large batches (up to MAX_IMPORT_ROWS=500) insert rows sequentially and can
// take 20s+ against a remote Postgres connection; raise the serverless
// function budget so a full legitimate batch doesn't get killed mid-import.
export const maxDuration = 60;

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
async function currentUser() {
  const result = await auth.getSession();
  const session = result?.data?.session;
  const user = result?.data?.user;
  if (!session || !user?.id) return null;
  return { id: String(user.id) };
}
function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

type RowReport = { row: number; name?: string; reason: string };
type ImportedReport = { row: number; id: string; name: string };

// Server-side, authoritative CSV import: re-validates and re-normalizes
// every row itself (never trusts client-side preview output), enforces the
// row-count limit, detects duplicates against the caller's full contact
// list, inserts contacts, and optionally enrolls newly-created contacts in
// the existing outreach sequence via the shared enrollContactInOutreach
// helper (same contact_outreach table /api/outreach already uses).
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();

    const headerRow = Array.isArray(body.header) ? body.header.map((h: unknown) => String(h ?? "")) : null;
    const dataRows = Array.isArray(body.rows) ? body.rows : null;
    if (!headerRow || !dataRows) return jsonError("A header row and data rows are required.", 400);
    if (dataRows.length === 0) return jsonError("No rows to import.", 400);
    if (dataRows.length > MAX_IMPORT_ROWS) return jsonError(`Import up to ${MAX_IMPORT_ROWS} contacts at a time.`, 400);
    for (const row of dataRows) {
      if (!Array.isArray(row)) return jsonError("Malformed CSV row data.", 400);
    }

    const enrollOutreach = body.enrollOutreach !== false;
    const niche = cleanText(body.niche, 120);
    const painPoint = cleanText(body.painPoint, 1000);

    const headerIndex = buildHeaderIndex(headerRow);
    const sql = db();

    const existing = await sql`SELECT email, phone FROM public.contacts WHERE owner_id = ${user.id}`;
    const existingEmails = new Set(
      existing.map((r: Record<string, unknown>) => String(r.email ?? "").trim().toLowerCase()).filter(Boolean)
    );
    const existingPhones = new Set(
      existing.map((r: Record<string, unknown>) => normalizePhoneDigits(String(r.phone ?? ""))).filter((v: string) => v.length > 0)
    );
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    const imported: ImportedReport[] = [];
    const skipped: RowReport[] = [];
    const failed: RowReport[] = [];
    const enrolled: ImportedReport[] = [];
    const enrollmentFailed: RowReport[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 1;
      const cells = (dataRows[i] as unknown[]).map((c) => String(c ?? ""));
      const outcome = normalizeImportRow(cells, headerIndex);
      if (outcome.kind === "invalid") {
        failed.push({ row: rowNum, reason: outcome.reason });
        continue;
      }
      const r = outcome.row;
      const emailKey = r.email.toLowerCase();
      const phoneKey = normalizePhoneDigits(r.phone);
      const isDuplicate =
        (emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey))) ||
        (phoneKey && (existingPhones.has(phoneKey) || seenPhones.has(phoneKey)));
      if (isDuplicate) {
        skipped.push({ row: rowNum, name: r.name, reason: "Duplicate email or phone (existing contact or earlier row in this import)." });
        continue;
      }
      let contactId: string;
      try {
        const insertedRows = await sql`
          INSERT INTO public.contacts
            (owner_id, first_name, last_name, company, role, email, phone, status, source, notes, follow_up_at, website, location, instagram_url, facebook_url)
          VALUES
            (${user.id}, ${r.firstName}, ${r.lastName}, ${r.company}, ${r.role}, ${r.email}, ${r.phone},
             ${r.status.toLowerCase()}, ${r.source}, ${r.notes}, ${r.nextFollowUp}, ${r.website}, ${r.location}, ${r.instagramUrl}, ${r.facebookUrl})
          RETURNING id
        `;
        contactId = String(insertedRows[0]?.id);
      } catch (e) {
        console.error("CRM contacts import row insert failed", e);
        failed.push({ row: rowNum, name: r.name, reason: "Could not save this contact." });
        continue;
      }
      imported.push({ row: rowNum, id: contactId, name: r.name });
      if (emailKey) { existingEmails.add(emailKey); seenEmails.add(emailKey); }
      if (phoneKey) { existingPhones.add(phoneKey); seenPhones.add(phoneKey); }

      if (enrollOutreach) {
        try {
          await enrollContactInOutreach(sql, user.id, contactId, niche, painPoint, r.notes);
          enrolled.push({ row: rowNum, id: contactId, name: r.name });
        } catch (e) {
          const reason = e instanceof DoNotContactError ? e.message : "Could not enroll this contact in outreach.";
          enrollmentFailed.push({ row: rowNum, name: r.name, reason });
        }
      }
    }

    return Response.json({
      summary: {
        totalRows: dataRows.length,
        imported: imported.length,
        skipped: skipped.length,
        failed: failed.length,
        enrollOutreach,
        enrolled: enrolled.length,
        enrollmentFailed: enrollmentFailed.length,
      },
      imported, skipped, failed, enrolled, enrollmentFailed,
    });
  } catch (error) {
    console.error("CRM contacts import failed", error);
    return jsonError("Unable to import contacts.", 500);
  }
}
