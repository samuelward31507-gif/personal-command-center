// Moving a business in: the pure parts (no network, no database), so every rule is tested on its own.
// Everything that comes in is first turned into one plain shape (Staged), whatever the source: Jobber's API, QuickBooks,
// a Housecall Pro or ServiceTitan export, any spreadsheet, or a phone's contacts. Then duplicates are merged (phone, then
// email, then name plus address), every merge is shown and can be undone, and only then is anything written.
import { parseCsv } from "@/lib/customer-import";

// ---------- The plain shape ----------
export type NProperty = { ref: string; address: string; gate?: string; notes?: string };
export type NCustomer = { ref: string; name: string; company?: string; phone: string; email: string; notes: string; tags?: string; since?: string | null; properties: NProperty[]; lead?: boolean };
export type NLine = { name: string; qty: number; unit: string; price: number };
export type NQuote = { ref: string; customerRef: string; number?: string; status: "draft" | "open" | "approved" | "declined"; items: NLine[]; total: number; sent?: string | null; title?: string };
export type NJob = { ref: string; customerRef: string; number?: string; title: string; status: "scheduled" | "active" | "done"; start?: string | null; total?: number; address?: string };
export type NInvoice = { ref: string; customerRef: string; number?: string; status: "draft" | "open" | "paid" | "void"; items: NLine[]; total: number; paid: number; issued?: string | null; due?: string | null };
export type NPlan = { ref: string; customerRef: string; name: string; total: number; every: number; unit: "week" | "month"; next_on: string | null };
export type NItem = { ref: string; name: string; unit: string; price: number; cost?: number };
export type Staged = { customers: NCustomer[]; quotes: NQuote[]; jobs: NJob[]; invoices: NInvoice[]; plans: NPlan[]; items: NItem[]; notes: string[] };
export const emptyStaged = (): Staged => ({ customers: [], quotes: [], jobs: [], invoices: [], plans: [], items: [], notes: [] });

export const SOURCES = [
  { key: "jobber", name: "Jobber", how: "connect" },
  { key: "housecall", name: "Housecall Pro", how: "csv" },
  { key: "servicetitan", name: "ServiceTitan", how: "csv" },
  { key: "quickbooks", name: "QuickBooks", how: "connect" },
  { key: "contacts", name: "Google or phone contacts", how: "file" },
  { key: "spreadsheet", name: "A spreadsheet", how: "csv" },
  { key: "none", name: "Nothing, just my phone", how: "none" },
] as const;
export type SourceKey = (typeof SOURCES)[number]["key"];
/** What the owner said in setup ("Jobber", "Housecall Pro"...) as a source to pre-select. */
export function sourceFromSoftware(s: string | undefined): SourceKey {
  const t = (s || "").toLowerCase();
  return t.includes("jobber") ? "jobber" : t.includes("housecall") ? "housecall" : t.includes("servicetitan") ? "servicetitan" : t.includes("spreadsheet") || t.includes("paper") ? "spreadsheet" : t.includes("none") ? "none" : "spreadsheet";
}

// ---------- Small cleaners ----------
const ctl = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, max);
export const phone10 = (v: unknown): string => {
  for (const part of String(v ?? "").split(/[;,/|]|\s{2,}|\bor\b/i)) {
    const d = part.replace(/\D/g, "");
    const ten = d.length === 11 && d[0] === "1" ? d.slice(1) : d.length === 10 ? d : d.length > 11 && d[0] === "1" ? d.slice(1, 11) : d.length > 10 ? d.slice(0, 10) : "";
    if (/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return ten;
  }
  return "";
};
export const e164 = (v: unknown) => { const d = phone10(v); return d ? "+1" + d : ""; };
export const cleanEmailAddr = (v: unknown) => { const s = String(v ?? "").trim().toLowerCase().slice(0, 120); return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(s) ? s : ""; };
export const money = (v: unknown): number => { if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; const s = String(v ?? "").replace(/[$,\s]/g, ""); const neg = /^\(.*\)$/.test(s) || s.startsWith("-"); const n = Number(s.replace(/[()-]/g, "")); return Number.isFinite(n) ? Math.round((neg ? -n : n) * 100) / 100 : 0; };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** Any date a spreadsheet or an API gives (2024-06-03, 6/3/2024, Jun 3, 2024, an ISO timestamp) as YYYY-MM-DD, past or future. */
export function anyDate(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let y = 0, m = 0, d = 0, hit: RegExpMatchArray | null;
  if ((hit = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +hit[1]; m = +hit[2]; d = +hit[3]; }
  else if ((hit = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) { m = +hit[1]; d = +hit[2]; y = +hit[3]; if (y < 100) y += 2000; }
  else if ((hit = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/))) { m = MONTHS.indexOf(hit[1].toLowerCase()) + 1; d = +hit[2]; y = +hit[3]; }
  else if ((hit = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/))) { d = +hit[1]; m = MONTHS.indexOf(hit[2].toLowerCase()) + 1; y = +hit[3]; }
  else return null;
  if (y < 1980 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return new Date(iso + "T12:00:00Z").toISOString().slice(0, 10) === iso ? iso : null;
}
const joinAddr = (...p: unknown[]) => { const [street, street2, city, state, zip] = p.map(x => ctl(x, 120)); return [[street, street2].filter(Boolean).join(" "), city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", "); };
const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const normAddr = (s: string) => s.toLowerCase().replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|place|pl|way)\b\.?/g, "").replace(/[^a-z0-9]/g, "");

// ---------- Status words, from any tool, in our terms ----------
export function quoteStatus(v: unknown): NQuote["status"] {
  const s = String(v ?? "").toLowerCase().replace(/[_-]/g, " ");
  if (/approv|accept|convert|won|sold|signed/.test(s)) return "approved";
  if (/declin|reject|lost|archiv|expired|cancel/.test(s)) return "declined";
  if (/draft|not sent|unsent/.test(s)) return "draft";
  return "open";
}
export function invoiceStatus(v: unknown, balance?: number, total?: number): NInvoice["status"] {
  const s = String(v ?? "").toLowerCase().replace(/[_-]/g, " ");
  if (/void|cancel|bad debt|written off/.test(s)) return "void";
  if (/draft/.test(s)) return "draft";
  if (/^paid|paid in full|closed/.test(s) || (balance === 0 && (total ?? 0) > 0 && !/due|open|awaiting|unpaid|partial/.test(s))) return "paid";
  return "open";
}
export function jobStatus(v: unknown, start?: string | null, today = new Date().toLocaleDateString("en-CA")): NJob["status"] {
  const s = String(v ?? "").toLowerCase().replace(/[_-]/g, " ");
  if (/complet|done|finish|closed|archiv|requires invoic|invoiced|paid/.test(s)) return "done";
  if (/progress|active|today|working|dispatched|late/.test(s) && !(start && start > today)) return "active";
  return start && start < today && !/upcoming|scheduled/.test(s) ? "done" : "scheduled";
}

// ---------- Spreadsheets: what each column is ----------
export type Kind = "customers" | "quotes" | "jobs" | "invoices" | "items";
export const KIND_LABEL: Record<Kind, string> = { customers: "Customers", quotes: "Quotes or estimates", jobs: "Jobs or visits", invoices: "Invoices", items: "Price list or items" };
export type Field = { key: string; label: string; aliases: string[] };
const F = (key: string, label: string, aliases: string[]): Field => ({ key, label, aliases });
const PERSON = [
  F("ref", "ID in the old app", ["id", "clientid", "customerid", "customernumber", "accountnumber", "clientnumber", "customerno", "jobberid", "recordid"]),
  F("name", "Full name", ["name", "fullname", "clientname", "customername", "contactname", "displayname", "client", "customer", "billto", "customerfullname"]),
  F("first", "First name", ["firstname", "first", "givenname", "contactfirstname", "customerfirstname"]),
  F("last", "Last name", ["lastname", "last", "surname", "familyname", "contactlastname", "customerlastname"]),
  F("phone", "Phone", ["mobilenumber", "mobile", "mobilephone", "cell", "cellphone", "phone", "phonenumber", "primaryphone", "mainphone", "phone1", "telephone", "contactphone", "customerphone", "clientphone", "homephone", "homenumber", "home", "workphone", "worknumber", "phone2", "otherphone"]),
  F("email", "Email", ["email", "emailaddress", "primaryemail", "mainemail", "email1", "customeremail", "clientemail", "contactemail"]),
];
const ADDRESS = [
  F("street", "Street", ["street", "street1", "address", "address1", "addressline1", "streetaddress", "serviceaddress", "servicestreet", "propertyaddress", "propertystreet", "propertystreet1", "billingstreet", "billingstreet1", "billingaddress", "locationaddress", "jobaddress", "servicelocation", "locationstreet"]),
  F("street2", "Street line 2", ["street2", "address2", "addressline2", "unit", "apt", "suite", "propertystreet2", "billingstreet2"]),
  F("city", "City", ["city", "servicecity", "propertycity", "billingcity", "locationcity", "town"]),
  F("state", "State", ["state", "province", "stateprovince", "servicestate", "propertystate", "propertyprovince", "billingstate", "billingprovince", "locationstate"]),
  F("zip", "Zip", ["zip", "zipcode", "postalcode", "postal", "postcode", "servicezip", "propertyzip", "propertypostalcode", "billingzip", "billingpostalcode", "locationzip"]),
];
export const FIELDS: Record<Kind, Field[]> = {
  customers: [...PERSON, F("company", "Company", ["companyname", "company", "business", "businessname", "organization"]), ...ADDRESS,
    F("gate", "Gate code or access", ["gatecode", "accesscode", "accessnotes", "access", "lockbox", "entryinstructions"]),
    F("notes", "Notes", ["notes", "note", "comments", "internalnotes", "clientnotes", "customernotes", "description"]), F("tags", "Tags", ["tags", "tag", "labels", "customertags", "customertype", "type"]),
    F("since", "Customer since", ["clientsince", "customersince", "createdat", "created", "createddate", "datecreated", "dateadded", "membersince", "startdate"])],
  quotes: [F("ref", "Quote ID", ["id", "quoteid", "estimateid"]), F("number", "Quote number", ["quotenumber", "quote", "estimatenumber", "estimate", "number", "quoteno", "estimateno"]),
    ...PERSON.slice(1), F("status", "Status", ["status", "quotestatus", "estimatestatus", "state", "outcome"]), F("total", "Total", ["total", "amount", "quotetotal", "estimatetotal", "totalprice", "subtotal", "value"]),
    F("date", "Date sent", ["sentdate", "datesent", "sent", "createddate", "created", "date", "createdat", "issueddate"]), F("title", "What it's for", ["title", "jobtitle", "description", "summary", "lineitems", "items", "message"]), ...ADDRESS.slice(0, 1)],
  jobs: [F("ref", "Job ID", ["id", "jobid", "visitid"]), F("number", "Job number", ["jobnumber", "job", "number", "jobno", "workorder", "workordernumber"]), ...PERSON.slice(1),
    F("title", "What the job is", ["title", "jobtitle", "description", "jobdescription", "summary", "jobtype", "service", "businessunit"]), F("status", "Status", ["status", "jobstatus", "state", "visitstatus"]),
    F("date", "Date scheduled", ["startdate", "scheduleddate", "scheduledstart", "date", "start", "startat", "appointmentdate", "scheduledfor", "visitdate", "completedon", "completeddate"]),
    F("total", "Job total", ["total", "jobtotal", "amount", "revenue", "value", "invoicetotal"]), ...ADDRESS],
  invoices: [F("ref", "Invoice ID", ["id", "invoiceid"]), F("number", "Invoice number", ["invoicenumber", "invoice", "number", "invoiceno", "invoicenum", "docnumber"]), ...PERSON.slice(1),
    F("status", "Status", ["status", "invoicestatus", "state", "paymentstatus"]), F("total", "Total", ["total", "amount", "invoicetotal", "totalamount", "grandtotal", "invoiceamount"]),
    F("balance", "Balance owed", ["balance", "balancedue", "amountdue", "due", "outstanding", "openbalance", "remainingbalance", "invoicebalance"]), F("paid", "Amount paid", ["paid", "amountpaid", "totalpaid", "payments", "paidamount"]),
    F("date", "Issued", ["issueddate", "issued", "invoicedate", "date", "createddate", "created", "txndate", "createdat"]), F("due", "Due", ["duedate", "due", "dueon", "paymentdue"]),
    F("title", "What it's for", ["subject", "title", "description", "jobtitle", "summary", "memo"])],
  items: [F("name", "Name", ["name", "itemname", "productservice", "productname", "service", "servicename", "item", "title", "lineitem", "description"]), F("unit", "Unit", ["unit", "unitofmeasure", "uom", "per"]),
    F("price", "Price", ["price", "unitprice", "rate", "salesprice", "saleprice", "unitcost", "defaultprice", "pricerate", "amount"]), F("cost", "Your cost", ["cost", "purchasecost", "yourcost", "materialcost", "costprice"])],
};
export const normHeader = (h: string) => h.replace(/^﻿/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
export type Mapping = Record<string, number>;
/** Each field's column, guessed from the header row: exact alias first, the alias's own order wins, a column is used once. */
export function guessMapping(headers: string[], kind: Kind): Mapping {
  const hs = headers.map(normHeader), used = new Set<number>(), out: Mapping = {};
  for (const f of FIELDS[kind]) {
    let at = -1;
    for (const a of f.aliases) { const i = hs.findIndex((h, k) => h === a && !used.has(k)); if (i >= 0) { at = i; break; } }
    if (at < 0 && f.key !== "ref") for (const a of f.aliases) { if (a.length < 5) continue; const i = hs.findIndex((h, k) => !used.has(k) && h.includes(a)); if (i >= 0) { at = i; break; } }
    if (at >= 0) used.add(at);
    out[f.key] = at;
  }
  return out;
}
/** What a file most likely is, from its headers. */
export function guessKind(headers: string[]): Kind {
  const hs = headers.map(normHeader).join(" ");
  if (/invoice|balancedue|amountdue|amountpaid/.test(hs)) return "invoices";
  if (/quote|estimate/.test(hs)) return "quotes";
  if (/job|visit|workorder|scheduled|appointment/.test(hs)) return "jobs";
  if (/(unitprice|salesprice|rate|price)/.test(hs) && !/phone|mobile|email/.test(hs)) return "items";
  return "customers";
}
export type Sheet = { headers: string[]; rows: string[][] };
export function readSheet(text: string, max = 20000): Sheet | { error: string } {
  const all = parseCsv(text.replace(/^﻿/, ""));
  if (all.length < 2) return { error: "That file has no rows under the header." };
  if (all.length - 1 > max) return { error: `That file has ${all.length - 1} rows. Split it into files of ${max} or fewer.` };
  return { headers: all[0].map(h => h.trim()), rows: all.slice(1) };
}

const cellOf = (row: string[], m: Mapping, k: string) => (m[k] ?? -1) >= 0 ? String(row[m[k]] ?? "").trim() : "";
const personOf = (row: string[], m: Mapping) => {
  const g = (k: string) => cellOf(row, m, k);
  const name = ctl(g("name") || [g("first"), g("last")].filter(Boolean).join(" ") || g("company"), 80);
  return { name, phone: e164(g("phone")), email: cleanEmailAddr(g("email")) };
};
/** The customer a quote, job or invoice row belongs to: its phone, else its email, else its name. */
const custKey = (p: { name: string; phone: string; email: string }) => p.phone ? "p:" + p.phone.slice(-10) : p.email ? "e:" + p.email : p.name ? "n:" + normName(p.name) : "";
function stub(s: Staged, p: { name: string; phone: string; email: string }, address = ""): string {
  const ref = custKey(p);
  if (!ref) return "";
  if (!s.customers.some(c => c.ref === ref)) s.customers.push({ ref, name: p.name, phone: p.phone, email: p.email, notes: "", properties: address ? [{ ref: ref + ":a", address }] : [] });
  return ref;
}
const linesFrom = (title: string, total: number): NLine[] => total > 0 || title ? [{ name: ctl(title, 120) || "Work", qty: 1, unit: "", price: Math.max(0, total) }] : [];

/** A mapped sheet into the plain shape. Rows that can't be read go in `skipped` with why. */
export function stageSheet(sheet: Sheet, kind: Kind, m: Mapping, prefix: string, into: Staged = emptyStaged(), today = new Date().toLocaleDateString("en-CA")): { staged: Staged; skipped: { line: number; why: string }[] } {
  const skipped: { line: number; why: string }[] = [];
  sheet.rows.forEach((row, i) => {
    const g = (k: string) => cellOf(row, m, k), line = i + 2, own = g("ref") ? `${prefix}:${g("ref")}` : "";
    if (kind === "items") {
      const name = ctl(g("name"), 120); if (!name) { skipped.push({ line, why: "No name" }); return; }
      into.items.push({ ref: own || `${prefix}:item:${normName(name)}`, name, unit: ctl(g("unit"), 12), price: Math.max(0, money(g("price"))), ...(money(g("cost")) > 0 ? { cost: money(g("cost")) } : {}) });
      return;
    }
    const p = personOf(row, m);
    const address = joinAddr(g("street"), g("street2"), g("city"), g("state"), g("zip"));
    if (kind === "customers") {
      if (!p.name && !p.phone && !p.email) { skipped.push({ line, why: "No name, phone or email" }); return; }
      const ref = own || custKey(p) || `${prefix}:row${line}`;
      into.customers.push({ ref, name: p.name, company: ctl(g("company"), 80) || undefined, phone: p.phone, email: p.email, notes: ctl(g("notes"), 2000), tags: ctl(g("tags"), 200) || undefined,
        since: anyDate(g("since")), properties: address ? [{ ref: ref + ":a", address, ...(g("gate") ? { gate: ctl(g("gate"), 120) } : {}) }] : [] });
      return;
    }
    const cref = stub(into, p, kind === "jobs" ? address : "");
    if (!cref) { skipped.push({ line, why: "No customer name, phone or email" }); return; }
    const total = money(g("total")), title = ctl(g("title"), 120), number = ctl(g("number"), 30), ref = own || `${prefix}:${kind}:${number || line}`;
    if (kind === "quotes") into.quotes.push({ ref, customerRef: cref, number: number || undefined, status: quoteStatus(g("status")), items: linesFrom(title || (number ? `Quote ${number}` : "Quote"), total), total, sent: anyDate(g("date")), title: title || undefined });
    else if (kind === "jobs") { const start = anyDate(g("date")); into.jobs.push({ ref, customerRef: cref, number: number || undefined, title: title || "Job", status: jobStatus(g("status"), start, today), start, total: total || undefined, address: address || undefined }); }
    else {
      const bal = g("balance") ? money(g("balance")) : NaN, paidCol = g("paid") ? money(g("paid")) : NaN;
      const paid = Number.isFinite(paidCol) ? paidCol : Number.isFinite(bal) ? Math.max(0, total - bal) : 0;
      const status = invoiceStatus(g("status"), Number.isFinite(bal) ? bal : total - paid, total);
      into.invoices.push({ ref, customerRef: cref, number: number || undefined, status, items: linesFrom(title || (number ? `Invoice ${number}` : "Work"), total), total, paid: status === "paid" ? total : Math.min(total, paid), issued: anyDate(g("date")), due: anyDate(g("due")) });
    }
  });
  return { staged: into, skipped };
}

// ---------- Phone contacts (vCard) ----------
export function stageVcards(text: string, into: Staged = emptyStaged()): { staged: Staged; skipped: number } {
  let skipped = 0;
  const cards = text.replace(/\r\n[ \t]/g, "").split(/BEGIN:VCARD/i).slice(1);
  for (const card of cards) {
    const lines = card.split(/\r?\n/), get = (k: string) => lines.filter(l => l.toUpperCase().startsWith(k + ":") || l.toUpperCase().startsWith(k + ";")).map(l => l.slice(l.indexOf(":") + 1).replace(/\\,/g, ",").replace(/\\n/gi, " ").trim());
    const fn = get("FN")[0] || (get("N")[0] ?? "").split(";").slice(0, 2).reverse().join(" ").trim();
    const phone = get("TEL").map(e164).find(Boolean) ?? "", email = get("EMAIL").map(cleanEmailAddr).find(Boolean) ?? "";
    const adr = get("ADR")[0]; const address = adr ? (() => { const p = adr.split(";"); return joinAddr(p[2], "", p[3], p[4], p[5]); })() : "";
    const name = ctl(fn, 80);
    if (!name && !phone) { skipped++; continue; }
    const ref = "vcf:" + (phone ? phone.slice(-10) : email || normName(name));
    into.customers.push({ ref, name, phone, email, notes: ctl(get("NOTE")[0], 2000), company: ctl(get("ORG")[0]?.split(";")[0], 80) || undefined, properties: address ? [{ ref: ref + ":a", address }] : [] });
  }
  return { staged: into, skipped };
}

// ---------- Duplicates ----------
export type Merge = { keep: string; keepName: string; merged: { ref: string; name: string; why: "phone" | "email" | "name and address" }[] };
/**
 * One customer per person: the same phone, else the same email, else the same name at the same address. The first record
 * keeps its name; the others' phones, emails, properties and notes are added to it. `splits` are merges the owner undid.
 */
export function dedupe(customers: NCustomer[], splits: string[] = []): { customers: NCustomer[]; merges: Merge[]; remap: Record<string, string> } {
  const parent = new Map<string, string>(), why = new Map<string, Merge["merged"][number]["why"]>();
  const find = (r: string): string => { let x = r; while (parent.get(x) !== x) x = parent.get(x)!; return x; };
  for (const c of customers) parent.set(c.ref, c.ref);
  const noSplit = new Set(splits);
  const index = (key: (c: NCustomer) => string[], reason: Merge["merged"][number]["why"]) => {
    const seen = new Map<string, string>();
    for (const c of customers) {
      if (noSplit.has(c.ref)) continue;
      for (const k of key(c)) {
        if (!k) continue;
        const other = seen.get(k);
        if (!other) { seen.set(k, c.ref); continue; }
        const a = find(other), b = find(c.ref);
        if (a !== b) { parent.set(b, a); if (!why.has(c.ref)) why.set(c.ref, reason); }
      }
    }
  };
  index(c => [c.phone ? c.phone.slice(-10) : ""], "phone");
  index(c => [c.email], "email");
  index(c => c.name ? c.properties.map(p => normAddr(p.address) ? normName(c.name) + "|" + normAddr(p.address) : "") : [], "name and address");
  const byRoot = new Map<string, NCustomer>(), merges = new Map<string, Merge>(), remap: Record<string, string> = {};
  for (const c of customers) {
    const root = find(c.ref);
    remap[c.ref] = root;
    const keep = byRoot.get(root);
    if (!keep) { byRoot.set(root, { ...c, properties: [...c.properties] }); continue; }
    if (!keep.phone && c.phone) keep.phone = c.phone;
    if (!keep.email && c.email) keep.email = c.email;
    if (!keep.name && c.name) keep.name = c.name;
    if (c.since && (!keep.since || c.since < keep.since)) keep.since = c.since;
    for (const p of c.properties) if (!keep.properties.some(x => normAddr(x.address) === normAddr(p.address))) keep.properties.push(p);
    if (c.notes && !keep.notes.includes(c.notes)) keep.notes = [keep.notes, c.notes].filter(Boolean).join("\n").slice(0, 4000);
    const m = merges.get(root) ?? { keep: root, keepName: keep.name, merged: [] };
    m.merged.push({ ref: c.ref, name: c.name || c.phone || c.email, why: why.get(c.ref) ?? "phone" });
    merges.set(root, m);
  }
  return { customers: [...byRoot.values()], merges: [...merges.values()], remap };
}

export type Decisions = { splits?: string[]; phones?: Record<string, string> };
export type Preview = {
  customers: number; merged: number; properties: number; openQuotes: number; openQuotesValue: number; scheduledJobs: number; unpaidInvoices: number; unpaidValue: number;
  plans: number; items: number; missingPhone: { ref: string; name: string; email: string }[]; merges: Merge[]; sourceCustomers: number;
};
/**
 * The stand-in for a customer who has no phone (common for commercial and email-only customers). Records key on the
 * phone, so this keeps each one unique. It has no digits at all, so no phone match (they compare the last 10 digits)
 * can ever land on it, and nothing can text or call it. The owner can add the real number later.
 */
export function noPhoneKey(sys: string, ref: string): string {
  return "nophone:" + [...(sys + ":" + ref)].map(ch => ch.charCodeAt(0).toString(16).replace(/[0-9]/g, d => "ghijklmnop"[Number(d)])).join("");
}
export const isNoPhone = (p: string | null | undefined) => !!p && p.startsWith("nophone:");

/** What will come in, by type, after merges and the owner's phone fixes. A customer with no phone still comes in (as "No phone") if it has a name or an email. */
export function previewOf(s: Staged, d: Decisions = {}, today = new Date().toLocaleDateString("en-CA")): Preview {
  const fixed = s.customers.map(c => d.phones?.[c.ref] ? { ...c, phone: e164(d.phones[c.ref]) || c.phone } : c);
  const { customers, merges } = dedupe(fixed, d.splits);
  const open = s.invoices.filter(i => i.status === "open" && i.total - i.paid > 0.005);
  const q = s.quotes.filter(x => x.status === "open");
  const comes = (c: NCustomer) => !!c.phone || !!c.name || !!c.email;
  return { sourceCustomers: s.customers.length, customers: customers.filter(comes).length, merged: merges.reduce((a, m) => a + m.merged.length, 0),
    properties: customers.filter(comes).reduce((a, c) => a + c.properties.length, 0), openQuotes: q.length, openQuotesValue: Math.round(q.reduce((a, x) => a + x.total, 0)),
    scheduledJobs: s.jobs.filter(j => j.status !== "done" && (!j.start || j.start >= today)).length, unpaidInvoices: open.length, unpaidValue: Math.round(open.reduce((a, i) => a + i.total - i.paid, 0) * 100) / 100,
    plans: s.plans.length, items: s.items.length, missingPhone: customers.filter(c => !c.phone).map(c => ({ ref: c.ref, name: c.name, email: c.email })), merges };
}

/** Merge a fresh batch into what's already staged (a second file, the next API page). Same ref replaces. */
export function mergeStaged(a: Staged, b: Staged): Staged {
  const by = <T extends { ref: string }>(x: T[], y: T[]) => { const m = new Map(x.map(r => [r.ref, r])); for (const r of y) m.set(r.ref, r); return [...m.values()]; };
  return { customers: by(a.customers, b.customers), quotes: by(a.quotes, b.quotes), jobs: by(a.jobs, b.jobs), invoices: by(a.invoices, b.invoices), plans: by(a.plans, b.plans), items: by(a.items, b.items), notes: [...a.notes, ...b.notes].slice(-50) };
}

// ---------- Jobber's API, into the plain shape ----------
type J = Record<string, unknown>;
const nodes = (v: unknown): J[] => { const o = v as { nodes?: J[] } | J[] | null; return Array.isArray(o) ? o : Array.isArray(o?.nodes) ? o!.nodes! : []; };
const jAddr = (a: unknown) => { const x = (a ?? {}) as J; return joinAddr(x.street1 ?? x.street, x.street2, x.city, x.province ?? x.state, x.postalCode ?? x.zip); };
export function jobberClient(n: J): NCustomer {
  const phones = nodes(n.phones), emails = nodes(n.emails);
  const phone = e164((phones.find(p => p.primary) ?? phones[0])?.number), email = cleanEmailAddr((emails.find(e => e.primary) ?? emails[0])?.address);
  const ref = "jobber:" + String(n.id);
  const props = nodes(n.clientProperties).map((p, i) => ({ ref: "jobber:" + String(p.id ?? `${n.id}:${i}`), address: jAddr((p as J).address) })).filter(p => p.address);
  if (!props.length && jAddr(n.billingAddress)) props.push({ ref: ref + ":billing", address: jAddr(n.billingAddress) });
  const notes = nodes(n.notes).map(x => { const files = nodes(x.fileAttachments).map(f => `${f.fileName ?? "file"}: ${f.url}`).join(" "); return [ctl(x.message, 600), files].filter(Boolean).join(" "); }).filter(Boolean).join("\n");
  return { ref, name: ctl(n.name || [n.firstName, n.lastName].filter(Boolean).join(" ") || n.companyName, 80), company: ctl(n.companyName, 80) || undefined, phone, email, notes: notes.slice(0, 4000), since: anyDate(n.createdAt), properties: props };
}
const jLines = (n: J): NLine[] => nodes(n.lineItems).map(l => ({ name: ctl(l.name || l.description, 120) || "Line", qty: Math.max(0.01, Number(l.quantity) || 1), unit: "", price: Math.max(0, money(l.unitPrice)) }));
const cRef = (n: J) => "jobber:" + String((n.client as J | undefined)?.id ?? "");
export const jobberQuote = (n: J): NQuote => { const items = jLines(n), total = money((n.amounts as J | undefined)?.total) || items.reduce((a, l) => a + l.qty * l.price, 0);
  return { ref: "jobber:" + String(n.id), customerRef: cRef(n), number: n.quoteNumber ? String(n.quoteNumber) : undefined, status: quoteStatus(n.quoteStatus), items: items.length ? items : linesFrom(ctl(n.title, 120) || "Quote", total), total, sent: anyDate(n.sentAt ?? n.createdAt), title: ctl(n.title, 120) || undefined }; };
export const jobberJob = (n: J, today = new Date().toLocaleDateString("en-CA")): NJob => { const start = anyDate(n.startAt);
  return { ref: "jobber:" + String(n.id), customerRef: cRef(n), number: n.jobNumber ? String(n.jobNumber) : undefined, title: ctl(n.title, 120) || "Job", status: jobStatus(n.jobStatus, start, today), start, total: money(n.total) || undefined, address: jAddr((n.property as J | undefined)?.address) || undefined }; };
export const jobberInvoice = (n: J): NInvoice => { const a = (n.amounts ?? {}) as J, total = money(a.total), bal = a.invoiceBalance == null ? NaN : money(a.invoiceBalance), status = invoiceStatus(n.invoiceStatus, Number.isFinite(bal) ? bal : undefined, total);
  const items = jLines(n);
  return { ref: "jobber:" + String(n.id), customerRef: cRef(n), number: n.invoiceNumber ? String(n.invoiceNumber) : undefined, status, items: items.length ? items : linesFrom(ctl(n.subject, 120) || "Work", total), total,
    paid: status === "paid" ? total : Number.isFinite(bal) ? Math.max(0, total - bal) : 0, issued: anyDate(n.issuedDate ?? n.createdAt), due: anyDate(n.dueDate) }; };
/** A Jobber request is a lead: the customer comes in as New, with what they asked for in the notes. */
export const jobberRequest = (n: J): { customerRef: string; note: string } => ({ customerRef: cRef(n), note: `Request${n.createdAt ? " " + anyDate(n.createdAt) : ""}: ${ctl(n.title, 200) || "no title"}` });

// ---------- QuickBooks, into the plain shape ----------
export function qboCustomer(n: J): NCustomer {
  const addr = (n.ShipAddr ?? n.BillAddr ?? {}) as J;
  const address = joinAddr(addr.Line1, addr.Line2, addr.City, addr.CountrySubDivisionCode, addr.PostalCode);
  const ref = "qbo:" + String(n.Id);
  return { ref, name: ctl(n.DisplayName || [n.GivenName, n.FamilyName].filter(Boolean).join(" ") || n.CompanyName, 80), company: ctl(n.CompanyName, 80) || undefined,
    phone: e164((n.Mobile as J | undefined)?.FreeFormNumber || (n.PrimaryPhone as J | undefined)?.FreeFormNumber || (n.AlternatePhone as J | undefined)?.FreeFormNumber),
    email: cleanEmailAddr((n.PrimaryEmailAddr as J | undefined)?.Address), notes: ctl(n.Notes, 2000), since: anyDate((n.MetaData as J | undefined)?.CreateTime), properties: address ? [{ ref: ref + ":a", address }] : [] };
}
export const qboItem = (n: J): NItem => ({ ref: "qbo:" + String(n.Id), name: ctl(n.Name || n.FullyQualifiedName, 120), unit: "", price: Math.max(0, money(n.UnitPrice)), ...(money(n.PurchaseCost) > 0 ? { cost: money(n.PurchaseCost) } : {}) });
export function qboInvoice(n: J): NInvoice {
  const total = money(n.TotalAmt), bal = money(n.Balance);
  const items: NLine[] = (Array.isArray(n.Line) ? n.Line as J[] : []).filter(l => l.DetailType === "SalesItemLineDetail").map(l => { const d = (l.SalesItemLineDetail ?? {}) as J;
    return { name: ctl(l.Description || (d.ItemRef as J | undefined)?.name, 120) || "Line", qty: Math.max(0.01, Number(d.Qty) || 1), unit: "", price: money(d.UnitPrice) || money(l.Amount) }; });
  return { ref: "qbo:" + String(n.Id), customerRef: "qbo:" + String((n.CustomerRef as J | undefined)?.value ?? ""), number: n.DocNumber ? String(n.DocNumber) : undefined, status: bal <= 0.005 && total > 0 ? "paid" : "open",
    items: items.length ? items : linesFrom("Work", total), total, paid: Math.max(0, Math.round((total - bal) * 100) / 100), issued: anyDate(n.TxnDate), due: anyDate(n.DueDate) };
}

// ---------- Exports from the tools without an open API: the steps, in plain words ----------
export const EXPORT_STEPS: Record<string, { files: string; steps: string[] }> = {
  housecall: { files: "Customers, and if you want them, Jobs and Invoices", steps: [
    "Sign in to Housecall Pro on a computer, not the phone app.",
    "Open Customers. Use the export button above the list and save the CSV file.",
    "For past work, open Jobs, filter to the dates you want, and export that list too. Do the same in Invoices.",
    "If you don't see an export button, your plan may not include it: ask Housecall Pro support to send you a customer export.",
    "Come back here and add the files. You can add one at a time." ] },
  servicetitan: { files: "Customers, and if you want them, Jobs and Invoices", steps: [
    "Sign in to ServiceTitan on a computer.",
    "Open Reports and run a customer list report (Customers, with phone, email and service address). Export it to Excel or CSV.",
    "For past work, run a Jobs report and an Invoices report for the dates you want and export those too.",
    "If you save them as Excel, open each one and use Save As, CSV.",
    "Come back here and add the files. You can add one at a time." ] },
  jobber: { files: "Clients, and if you want them, Quotes, Jobs and Invoices", steps: [
    "Sign in to Jobber on a computer.",
    "Open Clients and use Export (top right of the list). Jobber emails you the CSV.",
    "Do the same in Quotes, Jobs and Invoices if you want those too.",
    "Add the files here. Or connect Jobber above and skip the files." ] },
  spreadsheet: { files: "Any sheet with a name and a phone on each row", steps: [
    "In Excel or Google Sheets, use File, Download (or Save As), CSV.",
    "One file per kind of thing: customers, quotes, jobs, invoices or your price list.",
    "Add each file here. You'll match the columns before anything comes in." ] },
  contacts: { files: "A contacts file (.vcf) or a Google Contacts CSV", steps: [
    "iPhone: open Contacts on iCloud.com, select the contacts, and use Export vCard.",
    "Android or Google: open contacts.google.com, select, then Export, Google CSV or vCard.",
    "Add the file here. Only people with a phone number come in." ] },
};

// ---------- The go-live list ----------
export const GOLIVE = [
  { key: "website", title: "Point your website's quote form at your booking link", how: "Replace the form's link or button with your booking link below. Or keep the form and connect it in Settings, Connections, Website form." },
  { key: "google", title: "Put the booking link on your Google Business profile", how: "In your Google Business profile, edit Contact, then Appointment links, and paste your booking link." },
  { key: "leads", title: "Connect Angi, Thumbtack, HomeAdvisor and Facebook leads", how: "Settings, Connections shows each one's link. Paste it where that service sends new leads, then send yourself a test." },
  { key: "calls", title: "Forward missed calls to your texting number", how: "Ask your phone carrier to forward unanswered calls to your texting number. Settings, Connections shows the number and sends a test." },
  { key: "pay", title: "Connect your payment link and your review link", how: "Money, Pay link and tax for the payment link. Your Google review link goes in Settings, Account." },
  { key: "books", title: "Keep QuickBooks syncing", how: "Settings, Connections, QuickBooks. Invoices and payments flow in from here on." },
  { key: "week", title: "Run both apps for 7 days, then cancel the old one", how: "Day 7 brings a summary of what came in here that week, so you can cancel with confidence." },
] as const;

// ---------- What the browser sends (a parsed file) is cleaned again here before it's staged ----------
const arr = (v: unknown, max: number): Record<string, unknown>[] => (Array.isArray(v) ? v.slice(0, max) : []).filter(x => x && typeof x === "object") as Record<string, unknown>[];
const lines = (v: unknown): NLine[] => arr(v, 60).map(l => ({ name: ctl(l.name, 120) || "Line", qty: Math.max(0.01, Math.min(100000, Number(l.qty) || 1)), unit: ctl(l.unit, 12), price: Math.max(0, Math.min(10_000_000, money(l.price))) }));
const refOf = (v: unknown) => ctl(v, 120);
export function cleanStaged(v: unknown): Staged {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    customers: arr(o.customers, 20000).map(c => ({ ref: refOf(c.ref), name: ctl(c.name, 80), company: ctl(c.company, 80) || undefined, phone: e164(c.phone), email: cleanEmailAddr(c.email), notes: ctl(c.notes, 4000), tags: ctl(c.tags, 200) || undefined,
      since: anyDate(c.since), lead: c.lead === true, properties: arr(c.properties, 20).map(p => ({ ref: refOf(p.ref), address: ctl(p.address, 300), gate: ctl(p.gate, 120) || undefined, notes: ctl(p.notes, 600) || undefined })).filter(p => p.ref && p.address) })).filter(c => c.ref),
    quotes: arr(o.quotes, 20000).map(q => ({ ref: refOf(q.ref), customerRef: refOf(q.customerRef), number: ctl(q.number, 30) || undefined, status: quoteStatus(q.status), items: lines(q.items), total: Math.max(0, money(q.total)), sent: anyDate(q.sent), title: ctl(q.title, 120) || undefined })).filter(q => q.ref && q.customerRef),
    jobs: arr(o.jobs, 20000).map(j => ({ ref: refOf(j.ref), customerRef: refOf(j.customerRef), number: ctl(j.number, 30) || undefined, title: ctl(j.title, 120) || "Job", status: (["scheduled", "active", "done"].includes(String(j.status)) ? j.status : "scheduled") as NJob["status"], start: anyDate(j.start), total: money(j.total) || undefined, address: ctl(j.address, 300) || undefined })).filter(j => j.ref && j.customerRef),
    invoices: arr(o.invoices, 20000).map(i => { const total = Math.max(0, money(i.total)); return { ref: refOf(i.ref), customerRef: refOf(i.customerRef), number: ctl(i.number, 30) || undefined, status: (["draft", "open", "paid", "void"].includes(String(i.status)) ? i.status : "open") as NInvoice["status"], items: lines(i.items), total, paid: Math.min(total, Math.max(0, money(i.paid))), issued: anyDate(i.issued), due: anyDate(i.due) }; }).filter(i => i.ref && i.customerRef),
    plans: arr(o.plans, 5000).map(p => ({ ref: refOf(p.ref), customerRef: refOf(p.customerRef), name: ctl(p.name, 80) || "Service plan", total: Math.max(0, money(p.total)), every: Math.max(1, Math.min(52, Math.round(Number(p.every) || 1))), unit: (p.unit === "week" ? "week" : "month") as "week" | "month", next_on: anyDate(p.next_on) })).filter(p => p.ref && p.customerRef),
    items: arr(o.items, 2000).map(i => ({ ref: refOf(i.ref), name: ctl(i.name, 120), unit: ctl(i.unit, 12), price: Math.max(0, money(i.price)), ...(money(i.cost) > 0 ? { cost: money(i.cost) } : {}) })).filter(i => i.ref && i.name),
    notes: (Array.isArray(o.notes) ? o.notes : []).slice(0, 50).map(n => ctl(n, 300)).filter(Boolean),
  };
}
/** The import's order: the price list, then people, then what hangs off them. */
export const PHASES = ["items", "customers", "quotes", "jobs", "invoices", "plans"] as const;
export type Phase = (typeof PHASES)[number];
/** Jobber's products and services, into the price list. */
export const jobberItem = (n: J): NItem => ({ ref: "jobber:" + String(n.id), name: ctl(n.name, 120), unit: "", price: Math.max(0, money(n.defaultUnitCost ?? n.unitPrice)), ...(money(n.internalUnitCost) > 0 ? { cost: money(n.internalUnitCost) } : {}) });
/** A recurring Jobber job becomes a service plan, paused until the owner checks how often it runs. */
export const jobberPlan = (n: J): NPlan | null => String(n.jobType ?? "").toUpperCase() !== "RECURRING" ? null
  : { ref: "jobber:plan:" + String(n.id), customerRef: "jobber:" + String((n.client as J | undefined)?.id ?? ""), name: ctl(n.title, 80) || "Service plan", total: money(n.total), every: 1, unit: "month", next_on: anyDate(n.startAt) };
