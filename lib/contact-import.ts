// Shared CSV-row normalization and validation for the Contacts bulk import.
// Used by both the client-side preview (app/crm/page.tsx) and the
// server-side authoritative import route (app/api/contacts/import) so the
// two never drift out of sync — the preview should show what the server
// will actually do.

export type ContactStatusValue = "Lead" | "Contact" | "Customer" | "Partner";

export type ImportRowInput = Record<string, string | undefined>;

export type NormalizedImportRow = {
  name: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  website: string;
  instagram: string;
  facebook: string;
  location: string;
  source: string;
  notes: string;
  status: ContactStatusValue;
  nextFollowUp: string | null;
};

export type RowOutcome =
  | { kind: "valid"; row: NormalizedImportRow }
  | { kind: "invalid"; reason: string };

export const MAX_IMPORT_ROWS = 500;

// Header aliases, normalized (lowercase, spaces/underscores/hyphens stripped)
// so "Business Name", "business_name", and "businessname" all match.
export const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "contactname", "leadname"],
  firstName: ["firstname", "first"],
  lastName: ["lastname", "last"],
  company: ["company", "business", "businessname", "companyname"],
  role: ["role", "title", "jobtitle", "position"],
  email: ["email", "emailaddress"],
  phone: ["phone", "phonenumber", "mobile", "cell", "telephone"],
  website: ["website", "url", "site", "web"],
  instagram: ["instagram", "instagramurl", "instagramprofile", "instagramlink", "ig", "igurl"],
  facebook: ["facebook", "facebookurl", "facebookprofile", "facebooklink", "fb", "fburl"],
  location: ["location", "city", "address", "region", "state"],
  source: ["source", "leadsource"],
  notes: ["notes", "researchnotes", "comments", "description"],
  nextFollowUp: ["nextfollowup", "followup", "followupdate"],
  status: ["status"],
};

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[ _-]/g, "");
}

// RFC-4180-ish CSV parser: handles quoted cells, escaped quotes ("") inside
// quotes, and both CRLF and bare LF line endings. Blank lines are skipped.
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((ch.charCodeAt(0) === 10 || ch.charCodeAt(0) === 13) && !quoted) {
      if (ch.charCodeAt(0) === 13 && input.charCodeAt(i + 1) === 10) i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = []; cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Scraper/list placeholders like "NOT FOUND" or "N/A" mean "no value". */
export function isPlaceholder(v: unknown): boolean {
  return typeof v === "string" && /^\s*(not\s*found|n\/?a|none|unknown|null|-+)\s*$/i.test(v);
}
export function blankIfPlaceholder<T>(v: T): T | "" {
  return isPlaceholder(v) ? "" : v;
}

export function cleanText(v: unknown, maxLen: number): string {
  return typeof v === "string" && !isPlaceholder(v) ? v.trim().slice(0, maxLen) : "";
}

export function normalizeStatus(v: unknown): ContactStatusValue {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "contact") return "Contact";
  if (s === "customer") return "Customer";
  if (s === "partner") return "Partner";
  return "Lead";
}

export function normalizePhoneDigits(v: string): string {
  return v.replace(/\D/g, "");
}

// Lenient but real shape check — bulk-imported spreadsheets commonly have
// garbage in the email column (a second phone number, "n/a", etc.) and we
// want those rows flagged as failed rather than silently saved as "email".
export function isValidEmailShape(v: string): boolean {
  return v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// Accepts YYYY-MM-DD or M/D/YYYY, rejects anything else (including
// impossible calendar dates like 2026-02-30) rather than guessing.
export function normalizeFollowUpDate(raw: string): { value: string | null; valid: boolean } {
  const v = raw.trim();
  if (!v) return { value: null, valid: true };
  let candidate = v;
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    candidate = slash[3] + "-" + slash[1].padStart(2, "0") + "-" + slash[2].padStart(2, "0");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return { value: null, valid: false };
  const parsed = new Date(candidate + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) {
    return { value: null, valid: false };
  }
  return { value: candidate, valid: true };
}

function pick(cells: string[], headerIndex: Map<string, number>, keys: string[]): string {
  for (const key of keys) {
    const idx = headerIndex.get(key);
    if (idx !== undefined) {
      const cell = cells[idx] ?? "";
      if (cell.trim()) return cell.trim();
    }
  }
  return "";
}

// Builds a header -> column-index map from a raw CSV header row, applying
// HEADER_ALIASES. Multiple logical fields never collide onto the same index
// unless the source file itself repeats a header.
export function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const normalized = headerRow.map(normalizeHeader);
  const index = new Map<string, number>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = normalized.findIndex((h) => aliases.includes(h));
    if (i >= 0) index.set(field, i);
  }
  return index;
}

// Pure, side-effect-free normalization of one CSV data row into either a
// clean NormalizedImportRow or a reason it's invalid. Does not know about
// duplicates (those require the rest of the batch / existing contacts).
export function normalizeImportRow(cells: string[], headerIndex: Map<string, number>): RowOutcome {
  const g = (...keys: string[]) => pick(cells, headerIndex, keys);
  const explicitName = g("name");
  const first = g("firstName");
  const last = g("lastName");
  const name = explicitName || [first, last].filter(Boolean).join(" ");
  if (!name) return { kind: "invalid", reason: "Missing contact or business name." };
  if (name.length > 200) return { kind: "invalid", reason: "Name is too long (200 characters max)." };
  const email = cleanText(g("email"), 320);
  if (email && !isValidEmailShape(email)) return { kind: "invalid", reason: "Invalid email format." };
  const dateResult = normalizeFollowUpDate(g("nextFollowUp"));
  if (!dateResult.valid) return { kind: "invalid", reason: "Invalid follow-up date (use YYYY-MM-DD or M/D/YYYY)." };
  const [firstName, ...lastParts] = name.split(/\s+/);
  return {
    kind: "valid",
    row: {
      name,
      firstName,
      lastName: lastParts.join(" "),
      company: cleanText(g("company"), 300),
      role: cleanText(g("role"), 200),
      email,
      phone: cleanText(g("phone"), 100),
      website: cleanText(g("website"), 500),
      instagram: cleanText(g("instagram"), 500),
      facebook: cleanText(g("facebook"), 500),
      location: cleanText(g("location"), 300),
      source: cleanText(g("source"), 200) || "CSV import",
      notes: cleanText(g("notes"), 10000),
      status: normalizeStatus(g("status")),
      nextFollowUp: dateResult.value,
    },
  };
}
