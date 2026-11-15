// Bringing an owner's existing customers into the client CRM from a Jobber export or any spreadsheet saved as CSV.
// Pure functions: the app reads the file in the browser and shows what will happen; the server re-checks every row
// before it writes. Nothing here texts anyone: imported people are the owner's, and Cinder never messages them unasked.
// No imports: the tests run this file on its own in Node, like the other pure CRM modules.

export type ImportRow = { name: string; phone: string; address: string; notes: string; since: string | null; email?: string };
export type Skipped = { line: number; name: string; reason: string };
export type ImportRead = { rows: ImportRow[]; skipped: Skipped[]; duplicates: number; total: number; jobber: boolean; columns: string[] };

/** Rows per file the app will take, and rows per request the server will take. */
export const MAX_IMPORT_ROWS = 2000;
export const IMPORT_BATCH = 250;

// Header aliases, normalised the way the agency import does (lowercase, no spaces, underscores or hyphens), so
// "Phone Number", "phone_number" and "PhoneNumber" all match. Phones list every column worth trying, best first.
const ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "clientname", "customername", "contactname", "client", "customer", "displayname"],
  first: ["firstname", "first", "givenname"],
  last: ["lastname", "last", "surname", "familyname"],
  company: ["companyname", "company", "business", "businessname", "organization", "organisation"],
  email: ["email", "emailaddress", "primaryemail", "mainemail", "email1"],
  phone: ["phone", "phonenumber", "mobile", "mobilephone", "mobilenumber", "cell", "cellphone", "cellnumber", "primaryphone", "mainphone", "phone1", "telephone", "contactphone",
    "homephone", "home", "workphone", "work", "otherphone", "phone2", "secondaryphone"],
  street: ["street", "street1", "address", "address1", "addressline1", "streetaddress", "billingstreet", "billingstreet1", "billingaddress", "billingaddressstreet1",
    "propertystreet", "propertystreet1", "propertyaddress", "serviceaddress", "servicestreet", "street1billing", "street1property"],
  street2: ["street2", "address2", "addressline2", "billingstreet2", "propertystreet2", "unit", "apt", "suite"],
  city: ["city", "billingcity", "propertycity", "servicecity", "town"],
  state: ["state", "province", "stateprovince", "region", "billingstate", "billingprovince", "propertystate", "propertyprovince", "servicestate"],
  zip: ["zip", "zipcode", "postal", "postalcode", "postcode", "billingzip", "billingpostalcode", "propertyzip", "propertypostalcode", "servicezip"],
  notes: ["notes", "note", "comments", "description", "internalnotes", "clientnotes", "customernotes"],
  tags: ["tags", "tag", "labels", "label"],
  source: ["leadsource", "source", "referredby", "howdidyouhearaboutus", "howtheyfoundus"],
  since: ["clientsince", "customersince", "since", "createdat", "created", "createddate", "datecreated", "dateadded", "added", "firstjob", "firstjobdate", "startdate", "membersince"],
  lastjob: ["lastjob", "lastjobdate", "lastvisit", "lastvisitdate", "lastservice", "lastservicedate", "lastinvoice", "lastinvoicedate"],
  spent: ["totalrevenue", "lifetimevalue", "totalspent", "revenue", "totalbilled", "totalinvoiced", "lifetimerevenue"],
};

/** "Phone Number", "phone_number" and "PhoneNumber" are one header. Same rule as the agency's contact import. */
export const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[ _-]/g, "");

/** A CSV as rows of cells: quoted cells, doubled quotes inside them, CRLF or LF line ends. Blank lines are dropped. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') { if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

/** Every column index that means this field, in alias order. */
function columnsFor(headers: string[], field: string): number[] {
  const out: number[] = [];
  for (const alias of ALIASES[field]) headers.forEach((h, i) => { if (h === alias && !out.includes(i)) out.push(i); });
  return out;
}

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
/** "NOT FOUND", "n/a", "-" and friends mean nothing was there. */
const empty = (v: string) => /^\s*(not\s*found|n\/?a|none|unknown|null|-+)\s*$/i.test(v);

/** The first ten-digit North American number in a cell: "+1 (720) 555-0177", "720.555.0177", "7205550177 ext 2". Null when there isn't one. */
export function importPhone(v: unknown): string | null {
  const s = String(v ?? "");
  if (!s.trim()) return null;
  // Several numbers in one cell: try each.
  for (const part of s.split(/[;,/|]|\s{2,}|\bor\b/i)) {
    const d = part.replace(/\D/g, "");
    const ten = d.length === 11 && d[0] === "1" ? d.slice(1) : d.length === 10 ? d : d.length > 11 && d[0] === "1" ? d.slice(1, 11) : d.length > 10 ? d.slice(0, 10) : "";
    if (ten.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return "+1" + ten;
  }
  return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** A date from a spreadsheet as YYYY-MM-DD: 2024-06-03, 6/3/2024, 06/03/24, "Jun 3, 2024", "3 Jun 2024", or an ISO timestamp. Null when it isn't one, is in the future, or is before 1990. */
export function importDate(v: unknown, today = new Date().toLocaleDateString("en-CA")): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let y = 0, m = 0, d = 0, hit: RegExpMatchArray | null;
  if ((hit = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +hit[1]; m = +hit[2]; d = +hit[3]; }
  else if ((hit = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) { m = +hit[1]; d = +hit[2]; y = +hit[3]; if (y < 100) y += 2000; }
  else if ((hit = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/))) { m = MONTHS.indexOf(hit[1].toLowerCase()) + 1; d = +hit[2]; y = +hit[3]; }
  else if ((hit = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/))) { d = +hit[1]; m = MONTHS.indexOf(hit[2].toLowerCase()) + 1; y = +hit[3]; }
  else return null;
  if (y < 1990 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const t = new Date(iso + "T12:00:00Z");
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso || iso > today) return null;
  return iso;
}

const dollars = (v: string) => { const n = Number(v.replace(/[^\d.]/g, "")); return n > 0 ? "$" + Math.round(n).toLocaleString("en-US") : ""; };

/**
 * Read a CSV the owner exported. The header row decides what each column is; every row becomes a customer with a
 * phone (the CRM keys on it), or a line in "skipped" saying why not. The same phone twice keeps the first row.
 */
export function readImportCsv(text: string, today = new Date().toLocaleDateString("en-CA")): ImportRead | { error: string } {
  const table = parseCsv(text.replace(/^﻿/, ""));
  if (table.length < 2) return { error: "That file has no rows under the header. Export your clients again and try once more." };
  const headers = table[0].map(normalizeHeader);
  const col = Object.fromEntries(Object.keys(ALIASES).map(f => [f, columnsFor(headers, f)])) as Record<keyof typeof ALIASES, number[]>;
  if (!col.phone.length) return { error: `Couldn't find a phone column. The first row has: ${table[0].map(h => h.trim()).filter(Boolean).slice(0, 12).join(", ")}.` };
  const jobber = headers.includes("jid") || headers.includes("iscompany") || (col.company.length > 0 && col.first.length > 0 && col.last.length > 0 && col.tags.length > 0);
  const get = (cells: string[], field: string) => { for (const i of col[field]) { const v = clean(cells[i], 400); if (v && !empty(v)) return v; } return ""; };
  const rows: ImportRow[] = [], skipped: Skipped[] = [], seen = new Set<string>();
  let duplicates = 0;
  const body = table.slice(1, 1 + MAX_IMPORT_ROWS);
  body.forEach((cells, k) => {
    const line = k + 2;
    if (!cells.some(x => x.trim())) return;
    const person = get(cells, "name") || [get(cells, "first"), get(cells, "last")].filter(Boolean).join(" ");
    const company = get(cells, "company");
    const name = clean(person || company, 80);
    let phone: string | null = null;
    for (const i of col.phone) { phone = importPhone(cells[i]); if (phone) break; }
    if (!phone) { skipped.push({ line, name: name || "(no name)", reason: "No phone number" }); return; }
    if (seen.has(phone)) { duplicates++; return; }
    seen.add(phone);
    const street = [get(cells, "street"), get(cells, "street2")].filter(Boolean).join(" ");
    const town = [get(cells, "city"), [get(cells, "state"), get(cells, "zip")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const address = clean([street, town].filter(Boolean).join(", "), 120);
    const extras: string[] = [];
    if (person && company && company !== person) extras.push(company);
    const email = get(cells, "email").trim().toLowerCase(); const emailOk = !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const tags = get(cells, "tags"); if (tags) extras.push(`Tags: ${tags}`);
    const source = get(cells, "source"); if (source) extras.push(`Found you through: ${source}`);
    const last = importDate(get(cells, "lastjob"), today); if (last) extras.push(`Last job ${last}`);
    const spent = dollars(get(cells, "spent")); if (spent) extras.push(`${spent} lifetime`);
    const own = clean(get(cells, "notes"), 1200);
    const notes = [own, ...extras].filter(Boolean).join("\n").slice(0, 2000);
    rows.push({ name, phone, address, notes, since: importDate(get(cells, "since"), today) ?? last, email: emailOk ? email : "" });
  });
  const used = Object.entries(col).filter(([, v]) => v.length).map(([f]) => f);
  return { rows, skipped, duplicates, total: body.filter(c => c.some(x => x.trim())).length, jobber, columns: used };
}

/** The server's view of a batch: the same shape, every field checked again, bad rows dropped, duplicates folded. */
export function cleanImportRows(input: unknown, today = new Date().toLocaleDateString("en-CA")): ImportRow[] {
  if (!Array.isArray(input)) return [];
  const out: ImportRow[] = [], seen = new Set<string>();
  for (const r of input.slice(0, IMPORT_BATCH)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const phone = importPhone(o.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(o.email ?? "")) ? String(o.email).trim().toLowerCase().slice(0, 120) : "", name: clean(o.name, 80), phone, address: clean(o.address, 120), notes: String(o.notes ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, 2000), since: importDate(o.since, today) });
  }
  return out;
}

export type ImportAs = "customers" | "leads";
export const importAs = (v: unknown): ImportAs => (v === "leads" ? "leads" : "customers");

/** The one-line result the owner reads after an import. */
export function importSummary(r: { added: number; existing: number; skipped: number; as: ImportAs }): string {
  const what = r.as === "leads" ? "lead" : "customer";
  const parts = [`Imported ${r.added} ${r.added === 1 ? what : what + "s"}.`];
  if (r.existing) parts.push(`${r.existing} ${r.existing === 1 ? "was" : "were"} already here.`);
  if (r.skipped) parts.push(`${r.skipped} skipped with no phone.`);
  return parts.join(" ");
}
