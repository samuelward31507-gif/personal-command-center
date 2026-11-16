// The switch-over center on the server: a batch per move, filled from an API pull (Jobber, QuickBooks) or from files the
// owner adds (parsed in the browser, cleaned again here), previewed, then written a slice at a time so the progress bar is
// real and nothing outlives a serverless request. Nobody is texted: imported quotes don't chase, imported invoices don't
// remind and imported plans start paused until the owner says so. A batch can be undone for 7 days: customers it created
// are hidden (never deleted), customers it changed get their old values back, and everything else it wrote is removed.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Client } from "@/lib/client-runtime-run";
import { gql, jobberToken } from "@/lib/jobber";
import { qboRead } from "@/lib/qbo";
import { cleanCatalog } from "@/lib/service";
import { parseTeam } from "@/lib/crm";
import { PHASES, cleanStaged, dedupe, emptyStaged, jobberClient, jobberItem, jobberPlan, jobberInvoice, jobberJob, jobberQuote, jobberRequest, mergeStaged, previewOf, qboCustomer, qboInvoice, qboItem,
  type Decisions, type NCustomer, type Phase, type Preview, type Staged, noPhoneKey, invoiceRefOf, type NPayment, jobberUser } from "@/lib/switch";

type Sql = NeonQueryFunction<false, false>;
const UUID = /^[0-9a-f-]{36}$/i;
const todayIn = (c: Client) => new Date().toLocaleDateString("en-CA", { timeZone: c.setup.timezone || "America/Denver" });
export const UNDO_DAYS = 7;
const SOURCE_NAME: Record<string, string> = { jobber: "Jobber", quickbooks: "QuickBooks", housecall: "Housecall Pro", servicetitan: "ServiceTitan", spreadsheet: "a spreadsheet", contacts: "your contacts", none: "nothing" };

export type ImportView = { id: string; source: string; status: string; preview: Preview | null; pull: PullState; progress: number; total: number; result: Result; error: string;
  created_at: string; finished_at: string | null; undone_at: string | null; canUndo: boolean; existing: number };
type PullState = { kind?: number; after?: string | null; start?: number; done?: boolean; counts?: Record<string, number>; warnings?: string[]; files?: { ref: string; name: string; url: string }[]; photos?: { saved: number; failed: number } };
const MAX_IMPORT_PHOTOS = 400;

/** Download queued photos for a few seconds. Each one lands in client_import_files until the import places it. */
async function downloadQueued(sql: Sql, c: Client, importId: string, p: PullState, ms = 6000): Promise<void> {
  const started = Date.now(), tally = (p.photos ??= { saved: 0, failed: 0 });
  while (p.files?.length && Date.now() - started < ms) {
    const f = p.files.shift()!;
    if (tally.saved >= MAX_IMPORT_PHOTOS) { tally.failed++; continue; }
    try {
      const r = await fetch(f.url, { signal: AbortSignal.timeout(6000), redirect: "follow" });
      const mime = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!r.ok || !/^image\/(jpeg|png|webp|gif)$/.test(mime)) { tally.failed++; continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length || buf.length > 4_000_000) { tally.failed++; continue; }
      await sql`INSERT INTO public.client_import_files (import_id, project_id, customer_ref, name, mime, bytes, size) VALUES (${importId}::uuid, ${c.projectId}::uuid, ${f.ref}, ${f.name.slice(0, 120)}, ${mime}, ${buf}, ${buf.length})`;
      tally.saved++;
    } catch { tally.failed++; }
  }
}
type Result = Record<string, { created: number; updated: number; skipped: number }> & { merged?: { created: 0; updated: 0; skipped: number } };
type Cursor = { phase?: number; i?: number; ids?: Record<string, string> };

async function load(sql: Sql, c: Client, id: string) {
  if (!UUID.test(id)) return null;
  const [r] = await sql`SELECT * FROM public.client_imports WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid` as Record<string, unknown>[];
  return r ?? null;
}
const staged = (r: Record<string, unknown>): Staged => ({ ...emptyStaged(), ...(r.staged as Staged) });
const iso = (v: unknown) => v ? new Date(String(v)).toISOString() : null;

async function view(sql: Sql, c: Client, r: Record<string, unknown>): Promise<ImportView> {
  const s = staged(r), d = (r.decisions ?? {}) as Decisions;
  const has = s.customers.length + s.items.length + s.invoices.length + s.quotes.length > 0;
  const preview = has ? previewOf(s, d, todayIn(c)) : null;
  let existing = 0;
  if (preview) {
    const phones = [...new Set(dedupe(s.customers, d.splits).customers.map(x => (d.phones?.[x.ref] || x.phone).replace(/\D/g, "").slice(-10)).filter(Boolean))];
    if (phones.length) { const [n] = await sql`SELECT count(*)::int AS n FROM public.client_threads WHERE project_id = ${c.projectId}::uuid AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ANY(${phones}::text[])` as { n: number }[]; existing = n.n; }
  }
  const finished = r.finished_at ? Date.parse(String(r.finished_at)) : 0;
  return { id: String(r.id), source: String(r.source), status: String(r.status), preview, pull: (r.pull ?? {}) as PullState, progress: Number(r.progress ?? 0), total: Number(r.total ?? 0), result: (r.result ?? {}) as Result,
    error: String(r.error ?? ""), created_at: iso(r.created_at)!, finished_at: iso(r.finished_at), undone_at: iso(r.undone_at), existing,
    canUndo: r.status === "done" && !!finished && Date.now() - finished < UNDO_DAYS * 86400000 };
}

/** The move in progress (or the last one), for the screen. */
export async function currentImport(sql: Sql, c: Client): Promise<ImportView | null> {
  const [r] = await sql`SELECT * FROM public.client_imports WHERE project_id = ${c.projectId}::uuid ORDER BY created_at DESC LIMIT 1` as Record<string, unknown>[];
  return r ? view(sql, c, r) : null;
}
export async function startImport(sql: Sql, c: Client, source: string): Promise<ImportView> {
  const [open] = await sql`SELECT * FROM public.client_imports WHERE project_id = ${c.projectId}::uuid AND status = 'draft' ORDER BY created_at DESC LIMIT 1` as Record<string, unknown>[];
  if (open) {
    if (open.source !== source && !Object.values(staged(open)).some(v => Array.isArray(v) && v.length)) await sql`UPDATE public.client_imports SET source = ${source}, pull = '{}'::jsonb WHERE id = ${String(open.id)}::uuid`;
    return view(sql, c, (await load(sql, c, String(open.id)))!);
  }
  const [r] = await sql`INSERT INTO public.client_imports (owner_id, project_id, source) VALUES (${c.owner}, ${c.projectId}::uuid, ${source}) RETURNING *` as Record<string, unknown>[];
  return view(sql, c, r);
}
/** Start over: the draft's staged rows go (nothing was written yet). */
export async function clearImport(sql: Sql, c: Client, id: string) {
  await sql`UPDATE public.client_imports SET staged = '{}'::jsonb, decisions = '{}'::jsonb, pull = '{}'::jsonb WHERE id = ${id}::uuid AND project_id = ${c.projectId}::uuid AND status = 'draft'`;
}
/** Rows from a file the owner added, already read in the browser. Cleaned again, then added to what's staged. */
export async function stageRows(sql: Sql, c: Client, id: string, rows: unknown): Promise<{ ok: boolean; view?: ImportView; error?: string }> {
  const r = await load(sql, c, id);
  if (!r || r.status !== "draft") return { ok: false, error: "That move already ran. Start a new one." };
  const next = mergeStaged(staged(r), cleanStaged(rows));
  await sql`UPDATE public.client_imports SET staged = ${JSON.stringify(next)}::jsonb WHERE id = ${id}::uuid`;
  return { ok: true, view: await view(sql, c, (await load(sql, c, id))!) };
}
export async function decide(sql: Sql, c: Client, id: string, d: unknown): Promise<{ ok: boolean; view?: ImportView; error?: string }> {
  const r = await load(sql, c, id);
  if (!r || r.status !== "draft") return { ok: false, error: "That move already ran." };
  const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
  const splits = (Array.isArray(o.splits) ? o.splits : []).map(String).slice(0, 5000);
  const phones = Object.fromEntries(Object.entries((o.phones && typeof o.phones === "object" ? o.phones : {}) as Record<string, unknown>).slice(0, 5000).map(([k, v]) => [k, String(v ?? "").slice(0, 30)]));
  await sql`UPDATE public.client_imports SET decisions = ${JSON.stringify({ splits, phones })}::jsonb WHERE id = ${id}::uuid`;
  return { ok: true, view: await view(sql, c, (await load(sql, c, id))!) };
}

// ---------- Pulling from an API, one page per call ----------
const JOBBER_KINDS = ["clients", "requests", "quotes", "jobs", "invoices", "productOrServices", "users"] as const;
const LINES = `lineItems(first: 50) { nodes { name description quantity unitPrice } }`;
const JQ: Record<(typeof JOBBER_KINDS)[number], [string, string]> = {
  clients: [`query($after: String) { clients(first: 25, after: $after) { nodes { id name firstName lastName companyName createdAt emails { address primary } phones { number primary }
      billingAddress { street1 street2 city province postalCode } clientProperties(first: 10) { nodes { id address { street1 street2 city province postalCode } } }
      notes(first: 10) { nodes { ... on ClientNote { message fileAttachments(first: 5) { nodes { fileName url } } } } } } pageInfo { hasNextPage endCursor } } }`,
    `query($after: String) { clients(first: 50, after: $after) { nodes { id name firstName lastName companyName createdAt emails { address primary } phones { number primary } billingAddress { street1 street2 city province postalCode } } pageInfo { hasNextPage endCursor } } }`],
  requests: [`query($after: String) { requests(first: 50, after: $after) { nodes { id title createdAt client { id } } pageInfo { hasNextPage endCursor } } }`, ""],
  quotes: [`query($after: String) { quotes(first: 25, after: $after) { nodes { id quoteNumber quoteStatus title createdAt sentAt client { id } amounts { total } ${LINES} } pageInfo { hasNextPage endCursor } } }`,
    `query($after: String) { quotes(first: 50, after: $after) { nodes { id quoteNumber quoteStatus title createdAt client { id } amounts { total } } pageInfo { hasNextPage endCursor } } }`],
  jobs: [`query($after: String) { jobs(first: 50, after: $after) { nodes { id jobNumber title jobStatus jobType startAt total client { id } property { address { street1 street2 city province postalCode } } } pageInfo { hasNextPage endCursor } } }`,
    `query($after: String) { jobs(first: 50, after: $after) { nodes { id jobNumber title jobStatus startAt total client { id } } pageInfo { hasNextPage endCursor } } }`],
  invoices: [`query($after: String) { invoices(first: 25, after: $after) { nodes { id invoiceNumber invoiceStatus subject issuedDate dueDate createdAt client { id } amounts { total invoiceBalance } ${LINES} } pageInfo { hasNextPage endCursor } } }`,
    `query($after: String) { invoices(first: 50, after: $after) { nodes { id invoiceNumber invoiceStatus subject issuedDate dueDate createdAt client { id } amounts { total invoiceBalance } } pageInfo { hasNextPage endCursor } } }`],
  productOrServices: [`query($after: String) { productOrServices(first: 50, after: $after) { nodes { id name defaultUnitCost internalUnitCost } pageInfo { hasNextPage endCursor } } }`,
    `query($after: String) { productOrServices(first: 50, after: $after) { nodes { id name defaultUnitCost } pageInfo { hasNextPage endCursor } } }`],
  users: [`query($after: String) { users(first: 50, after: $after) { nodes { id isAccountOwner name { full } phone { raw friendly } } pageInfo { hasNextPage endCursor } } }`,
    `query($after: String) { users(first: 50, after: $after) { nodes { id name { full } } pageInfo { hasNextPage endCursor } } }`],
};
const QBO_KINDS = ["customers", "items", "invoices"] as const;
const QQ: Record<(typeof QBO_KINDS)[number], (start: number) => string> = {
  customers: s => `select * from Customer where Active = true startposition ${s} maxresults 200`,
  items: s => `select * from Item where Active = true startposition ${s} maxresults 200`,
  invoices: s => `select * from Invoice where Balance > '0' startposition ${s} maxresults 100`,
};
const MAX_PER_KIND = 5000;

/** One page from Jobber or QuickBooks into the batch. Call until `done`. A kind the account can't read becomes a warning, not a failure. */
export async function pullStep(sql: Sql, c: Client, id: string): Promise<{ ok: boolean; view?: ImportView; error?: string }> {
  const r = await load(sql, c, id);
  if (!r || r.status !== "draft") return { ok: false, error: "That move already ran." };
  const p: PullState = { kind: 0, counts: {}, warnings: [], ...(r.pull as PullState) };
  if (p.done) return { ok: true, view: await view(sql, c, r) };
  const add = emptyStaged();
  const today = todayIn(c);
  if (r.source === "jobber") {
    // Photos queued from the last page come first: their links won't last.
    if (p.files?.length) {
      await downloadQueued(sql, c, id, p);
      if (p.files.length) { await sql`UPDATE public.client_imports SET pull = ${JSON.stringify(p)}::jsonb WHERE id = ${id}::uuid`; return { ok: true, view: await view(sql, c, (await load(sql, c, id))!) }; }
    }
    const token = await jobberToken(sql, c.projectId).catch(() => null);
    if (!token) return { ok: false, error: "Connect Jobber first, then pull." };
    const kind = JOBBER_KINDS[p.kind!];
    const [rich, lean] = JQ[kind];
    let res = await gql<Record<string, { nodes: Record<string, unknown>[]; pageInfo: { hasNextPage: boolean; endCursor: string } }>>(token, rich, { after: p.after ?? null }).catch(e => ({ errors: [{ message: e instanceof Error ? e.message : String(e) }] }) as { data?: undefined; errors: { message: string }[] });
    if ((!res.data || !res.data[kind]) && lean) res = await gql<Record<string, { nodes: Record<string, unknown>[]; pageInfo: { hasNextPage: boolean; endCursor: string } }>>(token, lean, { after: p.after ?? null }).catch(e => ({ errors: [{ message: e instanceof Error ? e.message : String(e) }] }) as { data?: undefined; errors: { message: string }[] });
    const page = res.data?.[kind];
    if (!page) {
      p.warnings!.push(`Jobber didn't share ${kind === "productOrServices" ? "your products and services" : kind} (${(res.errors?.[0]?.message ?? "no access").slice(0, 120)}). Add Jobber's export of those as a file below.`);
      p.kind!++; p.after = null;
    } else {
      const cur = staged(r);
      for (const n of page.nodes) {
        if (kind === "clients") { const x = jobberClient(n); for (const f of x.files ?? []) (p.files ??= []).push({ ref: x.ref, name: f.name, url: f.url }); delete x.files; add.customers.push(x); }
        else if (kind === "quotes") add.quotes.push(jobberQuote(n));
        else if (kind === "jobs") { const pl = jobberPlan(n); if (pl) add.plans.push(pl); else add.jobs.push(jobberJob(n, today)); }
        else if (kind === "productOrServices") { const it = jobberItem(n); if (it.name) add.items.push(it); }
        else if (kind === "invoices") add.invoices.push(jobberInvoice(n));
        else if (kind === "users") { const u = jobberUser(n); if (u) add.team.push(u); }
        else { const q = jobberRequest(n), who = cur.customers.find(x => x.ref === q.customerRef); if (who) add.customers.push({ ...who, lead: true, notes: [who.notes, q.note].filter(Boolean).join("\n").slice(0, 4000) }); }
      }
      p.counts![kind] = (p.counts![kind] ?? 0) + page.nodes.length;
      if (page.pageInfo?.hasNextPage && p.counts![kind] < MAX_PER_KIND) p.after = page.pageInfo.endCursor; else { p.kind!++; p.after = null; }
    }
    if (p.files?.length) await downloadQueued(sql, c, id, p, 4000);
    p.done = p.kind! >= JOBBER_KINDS.length && !p.files?.length;
    if (p.done && p.photos && (p.photos.saved || p.photos.failed)) p.warnings!.push(`${p.photos.saved} ${p.photos.saved === 1 ? "photo" : "photos"} downloaded from Jobber${p.photos.failed ? `; ${p.photos.failed} couldn't be (not a photo, too large, or the link expired)` : ""}.`);
  } else if (r.source === "quickbooks") {
    const kind = QBO_KINDS[p.kind!], start = p.start ?? 1;
    let page: Record<string, Record<string, unknown>[]> | null;
    try { page = await qboRead<Record<string, unknown>>(sql, c.projectId, QQ[kind](start)); }
    catch (e) { p.warnings!.push(`QuickBooks didn't share ${kind} (${(e instanceof Error ? e.message : String(e)).slice(0, 120)}).`); page = {}; p.kind!++; p.start = 1; p.done = p.kind! >= QBO_KINDS.length;
      await sql`UPDATE public.client_imports SET pull = ${JSON.stringify(p)}::jsonb WHERE id = ${id}::uuid`; return { ok: true, view: await view(sql, c, (await load(sql, c, id))!) }; }
    if (!page) return { ok: false, error: "Connect QuickBooks first, then pull." };
    const list = page[kind === "customers" ? "Customer" : kind === "items" ? "Item" : "Invoice"] ?? [];
    for (const n of list) {
      if (kind === "customers") add.customers.push(qboCustomer(n));
      else if (kind === "items") { if (["Service", "NonInventory", "Inventory"].includes(String(n.Type))) add.items.push(qboItem(n)); }
      else add.invoices.push(qboInvoice(n));
    }
    p.counts![kind] = (p.counts![kind] ?? 0) + list.length;
    const pageSize = kind === "invoices" ? 100 : 200;
    if (list.length === pageSize && p.counts![kind] < MAX_PER_KIND) p.start = start + pageSize; else { p.kind!++; p.start = 1; }
    p.done = p.kind! >= QBO_KINDS.length;
  } else return { ok: false, error: "This source comes in from files." };
  const next = mergeStaged(staged(r), add);
  await sql`UPDATE public.client_imports SET staged = ${JSON.stringify(next)}::jsonb, pull = ${JSON.stringify(p)}::jsonb WHERE id = ${id}::uuid`;
  return { ok: true, view: await view(sql, c, (await load(sql, c, id))!) };
}

// ---------- Writing it, a slice per call ----------
const SLICE = 40;
type Plan = { customers: NCustomer[]; remap: Record<string, string>; staged: Staged; quoted: Set<string>; worked: Set<string> };
function planOf(r: Record<string, unknown>, today: string): Plan {
  const s = staged(r), d = (r.decisions ?? {}) as Decisions;
  const fixed = s.customers.map(x => d.phones?.[x.ref] ? { ...x, phone: (() => { const t = String(d.phones![x.ref]).replace(/\D/g, ""); const ten = t.length === 11 && t[0] === "1" ? t.slice(1) : t; return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? "+1" + ten : x.phone; })() } : x);
  const { customers, remap } = dedupe(fixed, d.splits);
  const root = (ref: string) => remap[ref] ?? ref;
  const quoted = new Set(s.quotes.filter(q => q.status === "open").map(q => root(q.customerRef)));
  const worked = new Set([...s.jobs.map(j => root(j.customerRef)), ...s.invoices.map(i => root(i.customerRef)), ...s.quotes.filter(q => q.status === "approved").map(q => root(q.customerRef))]);
  void today;
  return { customers, remap, staged: s, quoted, worked };
}
const listFor = (p: Plan, phase: Phase): { ref: string }[] => phase === "customers" ? p.customers : phase === "items" ? (p.staged.items.length ? [{ ref: "catalog" }] : []) : phase === "team" ? ((p.staged.team ?? []).length ? [{ ref: "team" }] : []) : p.staged[phase];
const record = (sql: Sql, importId: string, c: Client, target: string, targetId: string, action: "created" | "updated", before: unknown = null) =>
  sql`INSERT INTO public.client_import_items (import_id, project_id, target, target_id, action, before) VALUES (${importId}::uuid, ${c.projectId}::uuid, ${target}, ${targetId}, ${action}, ${before == null ? null : JSON.stringify(before)}::jsonb)`;

/** Writes the next slice. Call until `done`. Safe to call twice: rows already written by this batch are updated, not doubled. */
export async function runStep(sql: Sql, c: Client, id: string): Promise<{ ok: boolean; view?: ImportView; done?: boolean; error?: string }> {
  const r = await load(sql, c, id);
  if (!r) return { ok: false, error: "Not found." };
  if (r.status === "done") return { ok: true, done: true, view: await view(sql, c, r) };
  if (r.status !== "draft" && r.status !== "running") return { ok: false, error: "That move can't run now." };
  const today = todayIn(c), p = planOf(r, today), sys = String(r.source), from = SOURCE_NAME[sys] ?? sys;
  const cur: Cursor = { phase: 0, i: 0, ids: {}, ...(r.cursor as Cursor) };
  const result = (r.result ?? {}) as Result;
  const bump = (k: string, f: "created" | "updated" | "skipped", n = 1) => { (result[k] ??= { created: 0, updated: 0, skipped: 0 })[f] += n; };
  if (r.status === "draft") {
    const total = PHASES.reduce((a, ph) => a + listFor(p, ph).length, 0);
    await sql`UPDATE public.client_imports SET status = 'running', started_at = now(), total = ${total}, progress = 0 WHERE id = ${id}::uuid`;
    result.merged = { created: 0, updated: 0, skipped: p.staged.customers.length - p.customers.length };
  }
  const thread = (ref: string) => cur.ids![p.remap[ref] ?? ref];
  const started = Date.now();
  let progress = Number(r.progress ?? 0);
  try {
    // Invoices that a payments file covers get their real payments, not one "paid before the move" lump.
    const payInv = new Set((p.staged.payments ?? []).map(x => invoiceRefOf(p.staged, x)).filter(Boolean));
    while (cur.phase! < PHASES.length && Date.now() - started < 8000) {
      const phase = PHASES[cur.phase!], list = listFor(p, phase);
      if (cur.i! >= list.length) { cur.phase!++; cur.i = 0; continue; }
      const slice = list.slice(cur.i!, cur.i! + SLICE);
      for (const row of slice) {
        if (phase === "items") {
          const before = c.setup.catalog ?? "[]";
          const merged = cleanCatalog([...cleanCatalog(before), ...p.staged.items.map(i => ({ name: i.name, unit: i.unit, price: i.price, cost: i.cost }))]);
          await sql`UPDATE public.client_ops SET setup = setup || jsonb_build_object('catalog', ${JSON.stringify(merged)}::text) WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
          await record(sql, id, c, "catalog", c.projectId, "updated", { catalog: before });
          bump("items", "created", merged.length - cleanCatalog(before).length);
          continue;
        }
        if (phase === "customers") {
          const x = row as NCustomer;
          // No phone: still comes in, under a stand-in key, so its quotes, jobs and open invoices aren't lost.
          if (!x.phone && !x.name && !x.email) { bump("customers", "skipped"); continue; }
          const phoneKey = x.phone || noPhoneKey(sys, x.ref);
          const lead = !!x.lead && !p.worked.has(x.ref), stage = p.worked.has(x.ref) ? "won" : p.quoted.has(x.ref) ? "quoted" : lead ? "new" : "won";
          const address = x.properties[0]?.address ?? "";
          const note = [x.notes, x.company ? `Company: ${x.company}` : "", x.tags ? `Tags: ${x.tags}` : "", `Moved in from ${from} on ${today}.`].filter(Boolean).join("\n").slice(0, 4000);
          const [ex] = await sql`SELECT id, customer_name, customer_email, details, notes, hidden_at, source_system, source_ref, import_id, stage FROM public.client_threads WHERE project_id = ${c.projectId}::uuid
            AND ((source_system = ${sys} AND source_ref = ${x.ref}) OR customer_phone = ${phoneKey} OR (${x.phone.length >= 10} AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 10) = ${x.phone.slice(-10)})) ORDER BY (source_ref = ${x.ref}) DESC LIMIT 1` as Record<string, unknown>[];
          let tid: string;
          if (ex) {
            tid = String(ex.id);
            await record(sql, id, c, "threads", tid, "updated", { customer_name: ex.customer_name, customer_email: ex.customer_email, details: ex.details, notes: ex.notes, hidden_at: ex.hidden_at, source_system: ex.source_system, source_ref: ex.source_ref, import_id: ex.import_id, stage: ex.stage });
            await sql`UPDATE public.client_threads SET customer_name = CASE WHEN customer_name = '' THEN ${x.name} ELSE customer_name END, customer_email = CASE WHEN coalesce(customer_email, '') = '' THEN ${x.email} ELSE customer_email END,
                details = CASE WHEN coalesce(details->>'address', '') = '' AND ${address} <> '' THEN coalesce(details, '{}'::jsonb) || jsonb_build_object('address', ${address}::text) ELSE details END,
                notes = CASE WHEN position(${`Moved in from ${from}`} in coalesce(notes, '')) > 0 THEN notes ELSE trim(both E'\n' from coalesce(notes, '') || E'\n' || ${note}) END,
                hidden_at = NULL, source_system = CASE WHEN source_system = '' THEN ${sys} ELSE source_system END, source_ref = CASE WHEN source_ref = '' THEN ${x.ref} ELSE source_ref END,
                import_id = coalesce(import_id, ${id}::uuid), updated_at = now() WHERE id = ${tid}::uuid`;
            bump("customers", "updated");
          } else {
            const stageAt = stage === "won" ? (x.since ? `${x.since}T12:00:00Z` : new Date(Date.now() - 31 * 86400000).toISOString()) : new Date().toISOString();
            const [ins] = await sql`INSERT INTO public.client_threads (owner_id, project_id, customer_phone, customer_name, customer_email, source, status, details, notes, stage, stage_at, source_system, source_ref, import_id, created_at)
              VALUES (${c.owner}, ${c.projectId}::uuid, ${phoneKey}, ${x.name}, ${x.email}, 'import', ${stage === "won" ? "closed" : "paused"}, ${JSON.stringify(address ? { address } : {})}::jsonb, ${note}, ${stage}, ${stageAt}::timestamptz,
                ${sys}, ${x.ref}, ${id}::uuid, ${x.since ? `${x.since}T12:00:00Z` : new Date().toISOString()}::timestamptz) RETURNING id` as { id: string }[];
            tid = ins.id;
            await record(sql, id, c, "threads", tid, "created");
            bump("customers", "created");
          }
          cur.ids![x.ref] = tid;
          {
            const refs = [x.ref, ...Object.keys(p.remap).filter(k => p.remap[k] === x.ref)];
            const placed = await sql`INSERT INTO public.client_photos (owner_id, project_id, thread_id, kind, caption, mime, bytes, size)
              SELECT ${c.owner}, ${c.projectId}::uuid, ${tid}::uuid, 'other', left('From Jobber: ' || name, 120), mime, bytes, size FROM public.client_import_files
              WHERE import_id = ${id}::uuid AND customer_ref = ANY(${refs}::text[]) ORDER BY created_at LIMIT 40 RETURNING id`.catch(() => []) as { id: string }[];
            for (const ph of placed) await record(sql, id, c, "photos", ph.id, "created");
            if (placed.length) { bump("photos", "created", placed.length); await sql`DELETE FROM public.client_import_files WHERE import_id = ${id}::uuid AND customer_ref = ANY(${refs}::text[])`.catch(() => null); }
          }
          if (sys === "quickbooks") await sql`UPDATE public.client_threads SET qbo_customer_id = ${x.ref.replace(/^qbo:/, "")} WHERE id = ${tid}::uuid AND qbo_customer_id = ''`;
          for (const pr of x.properties) {
            const [has] = await sql`SELECT 1 FROM public.client_properties WHERE thread_id = ${tid}::uuid AND (source_ref = ${pr.ref} OR lower(address) = lower(${pr.address})) LIMIT 1`;
            if (has) continue;
            const [pi] = await sql`INSERT INTO public.client_properties (owner_id, project_id, thread_id, address, gate_code, notes, source_system, source_ref, import_id) VALUES (${c.owner}, ${c.projectId}::uuid, ${tid}::uuid, ${pr.address}, ${pr.gate ?? ""}, ${pr.notes ?? ""}, ${sys}, ${pr.ref}, ${id}::uuid) RETURNING id` as { id: string }[];
            await record(sql, id, c, "properties", pi.id, "created");
          }
          continue;
        }
        const tid = thread((row as unknown as { customerRef: string }).customerRef);
        if (!tid) { bump(phase, "skipped"); continue; }
        const [t] = await sql`SELECT customer_phone, customer_name, stage, install_on::text AS install_on, value::float AS value, notes FROM public.client_threads WHERE id = ${tid}::uuid` as { customer_phone: string; customer_name: string; stage: string | null; install_on: string | null; value: number | null; notes: string }[];
        if (phase === "quotes") {
          const q = row as Staged["quotes"][number];
          if (q.status === "draft") { bump("quotes", "skipped"); continue; }
          const st = q.status === "approved" ? "won" : q.status === "declined" ? "lost" : "open";
          const [ex] = await sql`SELECT id, status, amount::float AS amount FROM public.client_quotes WHERE project_id = ${c.projectId}::uuid AND source_system = ${sys} AND source_ref = ${q.ref}` as { id: string; status: string; amount: number | null }[];
          if (ex) { await record(sql, id, c, "quotes", ex.id, "updated", { status: ex.status, amount: ex.amount }); await sql`UPDATE public.client_quotes SET status = ${st}, amount = ${q.total} WHERE id = ${ex.id}::uuid`; bump("quotes", "updated"); continue; }
          const [qi] = await sql`INSERT INTO public.client_quotes (owner_id, project_id, customer_phone, customer_name, amount, sent_on, status, note, items, tax_rate, kind, source_system, source_ref, import_id, chase_paused, last_step_at)
            VALUES (${c.owner}, ${c.projectId}::uuid, ${t.customer_phone}, ${t.customer_name}, ${q.total}, ${(q.sent || today)}::date, ${st}, ${[q.number ? `Quote #${q.number} from ${from}` : `From ${from}`, q.title ?? ""].filter(Boolean).join(": ").slice(0, 600)},
              ${JSON.stringify(q.items)}::jsonb, 0, 'quote', ${sys}, ${q.ref}, ${id}::uuid, true, ${st === "open" ? null : new Date().toISOString()}::timestamptz) RETURNING id` as { id: string }[];
          await record(sql, id, c, "quotes", qi.id, "created");
          bump("quotes", "created");
          continue;
        }
        if (phase === "jobs") {
          const j = row as Staged["jobs"][number];
          await record(sql, id, c, "threads", tid, "updated", { stage: t.stage, install_on: t.install_on, value: t.value, notes: t.notes });
          const next = j.status !== "done" && j.start && j.start >= today && (!t.install_on || t.install_on < today || j.start < t.install_on) ? j.start : null;
          const line = `Job${j.number ? " #" + j.number : ""}${j.start ? ` ${j.start}` : ""}: ${j.title}${j.total ? `, $${Math.round(j.total).toLocaleString("en-US")}` : ""} (${j.status === "done" ? "done" : "scheduled"} in ${from})`;
          await sql`UPDATE public.client_threads SET stage = 'won', stage_at = coalesce(stage_at, now()), install_on = coalesce(${next}::date, install_on), value = coalesce(value, ${j.total ?? null}::numeric),
              notes = CASE WHEN position(${line} in coalesce(notes, '')) > 0 THEN notes ELSE left(coalesce(notes, '') || E'\n' || ${line}, 4000) END, updated_at = now() WHERE id = ${tid}::uuid`;
          bump("jobs", j.status === "done" ? "updated" : "created");
          continue;
        }
        // The team joins the existing list once: new cells only, never the owner's, at most 10. Undo puts the old list back.
        if (phase === "team") {
          const before = c.setup.team ?? "[]", now = parseTeam(before), owner10 = (c.setup.owner_cell || "").replace(/\D/g, "").slice(-10);
          const add = (p.staged.team ?? []).filter(x => x.phone.slice(-10) !== owner10 && !now.some(y => y.cell.slice(-10) === x.phone.slice(-10)));
          const next = parseTeam([...now, ...add.map(x => ({ name: x.name, cell: x.phone, role: x.role, ...(x.rate ? { rate: x.rate } : {}) }))].slice(0, 10));
          await sql`UPDATE public.client_ops SET setup = setup || jsonb_build_object('team', ${JSON.stringify(next)}::text) WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
          await record(sql, id, c, "team", c.projectId, "updated", { team: before });
          bump("team", "created", next.length - now.length);
          if (add.length > next.length - now.length) bump("team", "skipped", add.length - (next.length - now.length));
          continue;
        }
        if (phase === "payments") {
          const x = row as NPayment, invRef = invoiceRefOf(p.staged, x);
          const [inv] = invRef ? await sql`SELECT id, thread_id FROM public.client_invoices WHERE project_id = ${c.projectId}::uuid AND source_system = ${sys} AND source_ref = ${invRef} AND import_id = ${id}::uuid AND status <> 'void'` as { id: string; thread_id: string }[] : [];
          if (!inv) { bump("payments", "skipped"); continue; }
          const on = x.date || today;
          const [pm] = await sql`INSERT INTO public.client_payments (owner_id, project_id, invoice_id, thread_id, amount, method, paid_on, note, import_id)
            VALUES (${c.owner}, ${c.projectId}::uuid, ${inv.id}::uuid, ${inv.thread_id}::uuid, ${x.amount}, ${x.method}, ${on}::date, ${(x.note ? x.note + ". " : "") + `Paid before the move to Cinder (${from})`}, ${id}::uuid) RETURNING id` as { id: string }[];
          await record(sql, id, c, "payments", pm.id, "created");
          await sql`UPDATE public.client_invoices i SET paid_amount = s.paid,
              status = CASE WHEN i.status IN ('sent', 'draft') AND s.paid >= i.total - 0.005 THEN 'paid' ELSE i.status END,
              paid_at = CASE WHEN s.paid >= i.total - 0.005 THEN coalesce(i.paid_at, ${on}::date::timestamptz) ELSE i.paid_at END
            FROM (SELECT coalesce(sum(amount), 0)::numeric AS paid FROM public.client_payments WHERE invoice_id = ${inv.id}::uuid) s WHERE i.id = ${inv.id}::uuid`;
          bump("payments", "created");
          continue;
        }
        if (phase === "invoices") {
          const v = row as Staged["invoices"][number];
          const [ex] = await sql`SELECT id FROM public.client_invoices WHERE project_id = ${c.projectId}::uuid AND source_system = ${sys} AND source_ref = ${v.ref}` as { id: string }[];
          if (ex) { bump("invoices", "skipped"); continue; }
          const want = Number(v.number);
          const [free] = Number.isInteger(want) && want > 0 && want < 2_000_000_000 ? await sql`SELECT NOT EXISTS (SELECT 1 FROM public.client_invoices WHERE project_id = ${c.projectId}::uuid AND number = ${want}) AS ok` as { ok: boolean }[] : [{ ok: false }];
          const items = v.items.length ? v.items : [{ name: "Work", qty: 1, unit: "", price: v.total }];
          const status = v.status === "open" ? "sent" : v.status, issued = v.issued ? `${v.issued}T12:00:00Z` : new Date().toISOString();
          const [vi] = await sql`INSERT INTO public.client_invoices (owner_id, project_id, thread_id, number, items, tax_rate, total, note, status, due_on, sent_at, paid_at, reminders_paused, source_system, source_ref, import_id, qbo_id, created_at)
            VALUES (${c.owner}, ${c.projectId}::uuid, ${tid}::uuid, ${free?.ok ? want : null}::int, ${JSON.stringify(items)}::jsonb, 0, ${v.total}, ${`${v.number ? `Invoice #${v.number}` : "Invoice"} from ${from}`}, ${status},
              ${v.due ?? null}::date, ${status === "draft" ? null : issued}::timestamptz, ${status === "paid" ? issued : null}::timestamptz, true, ${sys}, ${v.ref}, ${id}::uuid, ${sys === "quickbooks" ? v.ref.replace(/^qbo:/, "") : ""}, ${issued}::timestamptz)
            ON CONFLICT DO NOTHING RETURNING id` .catch(async () => [] as { id: string }[]) as { id: string }[];
          let invId = vi?.id;
          if (!invId) {
            const [vj] = await sql`INSERT INTO public.client_invoices (owner_id, project_id, thread_id, number, items, tax_rate, total, note, status, due_on, sent_at, paid_at, reminders_paused, source_system, source_ref, import_id, qbo_id, created_at)
              VALUES (${c.owner}, ${c.projectId}::uuid, ${tid}::uuid, (SELECT coalesce(max(number), 1000) + 1 FROM public.client_invoices WHERE project_id = ${c.projectId}::uuid), ${JSON.stringify(items)}::jsonb, 0, ${v.total},
                ${`${v.number ? `Invoice #${v.number}` : "Invoice"} from ${from}`}, ${status}, ${v.due ?? null}::date, ${status === "draft" ? null : issued}::timestamptz, ${status === "paid" ? issued : null}::timestamptz, true, ${sys}, ${v.ref}, ${id}::uuid, ${sys === "quickbooks" ? v.ref.replace(/^qbo:/, "") : ""}, ${issued}::timestamptz) RETURNING id` as { id: string }[];
            invId = vj.id;
          }
          await record(sql, id, c, "invoices", invId, "created");
          if (v.paid > 0.005 && status !== "void" && !payInv.has(v.ref)) {
            const [pm] = await sql`INSERT INTO public.client_payments (owner_id, project_id, invoice_id, thread_id, amount, method, paid_on, note, import_id) VALUES (${c.owner}, ${c.projectId}::uuid, ${invId}::uuid, ${tid}::uuid, ${v.paid}, 'other', ${(v.issued || today)}::date, ${`Paid before the move, recorded in ${from}`}, ${id}::uuid) RETURNING id` as { id: string }[];
            await sql`UPDATE public.client_invoices SET paid_amount = ${v.paid} WHERE id = ${invId}::uuid`;
            await record(sql, id, c, "payments", pm.id, "created");
          }
          bump("invoices", "created");
          continue;
        }
        const pl = row as Staged["plans"][number];
        const [ex] = await sql`SELECT id FROM public.client_plans WHERE project_id = ${c.projectId}::uuid AND source_system = ${sys} AND source_ref = ${pl.ref}` as { id: string }[];
        if (ex) { bump("plans", "skipped"); continue; }
        const [pi] = await sql`INSERT INTO public.client_plans (owner_id, project_id, thread_id, name, items, total, every_n, every_unit, next_on, status, source_system, source_ref, import_id)
          VALUES (${c.owner}, ${c.projectId}::uuid, ${tid}::uuid, ${pl.name}, ${JSON.stringify([{ name: pl.name, qty: 1, unit: "", price: pl.total }])}::jsonb, ${pl.total}, ${pl.every}, ${pl.unit}, ${pl.next_on}::date, 'paused', ${sys}, ${pl.ref}, ${id}::uuid) RETURNING id` as { id: string }[];
        await record(sql, id, c, "plans", pi.id, "created");
        bump("plans", "created");
      }
      cur.i! += slice.length;
      progress += slice.length;
    }
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("Import step failed", msg);
    await sql`UPDATE public.client_imports SET cursor = ${JSON.stringify(cur)}::jsonb, result = ${JSON.stringify(result)}::jsonb, progress = ${progress}, error = ${msg} WHERE id = ${id}::uuid`;
    return { ok: false, error: "Part of the move didn't go through. Tap Continue to pick up where it stopped." };
  }
  const done = cur.phase! >= PHASES.length;
  await sql`UPDATE public.client_imports SET cursor = ${JSON.stringify(cur)}::jsonb, result = ${JSON.stringify(result)}::jsonb, progress = ${progress}, error = '',
      status = ${done ? "done" : "running"}, finished_at = CASE WHEN ${done}::boolean THEN now() ELSE finished_at END WHERE id = ${id}::uuid`;
  if (done) await sql`UPDATE public.client_ops SET setup = setup || jsonb_build_object('golive_start', coalesce(setup->>'golive_start', ${today}::text)) WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
  return { ok: true, done, view: await view(sql, c, (await load(sql, c, id))!) };
}

/** Takes a finished batch back, within 7 days. Customers it created are hidden (never deleted); what it changed goes back. */
export async function undoImport(sql: Sql, c: Client, id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await load(sql, c, id);
  if (!r || r.status !== "done") return { ok: false, error: "Only a finished move can be undone." };
  if (r.finished_at && Date.now() - Date.parse(String(r.finished_at)) > UNDO_DAYS * 86400000) return { ok: false, error: `A move can be undone for ${UNDO_DAYS} days. This one is older.` };
  const items = await sql`SELECT target, target_id, action, before FROM public.client_import_items WHERE import_id = ${id}::uuid ORDER BY id DESC` as { target: string; target_id: string; action: string; before: Record<string, unknown> | null }[];
  for (const it of items) {
    const b = it.before ?? {};
    if (it.target === "threads") {
      if (it.action === "created") await sql`UPDATE public.client_threads SET hidden_at = now() WHERE id = ${it.target_id}::uuid AND project_id = ${c.projectId}::uuid`;
      else await sql`UPDATE public.client_threads SET
          customer_name = CASE WHEN ${"customer_name" in b}::boolean THEN ${String(b.customer_name ?? "")} ELSE customer_name END,
          customer_email = CASE WHEN ${"customer_email" in b}::boolean THEN ${String(b.customer_email ?? "")} ELSE customer_email END,
          details = CASE WHEN ${"details" in b}::boolean THEN ${JSON.stringify(b.details ?? {})}::jsonb ELSE details END,
          notes = CASE WHEN ${"notes" in b}::boolean THEN ${String(b.notes ?? "")} ELSE notes END,
          stage = CASE WHEN ${"stage" in b}::boolean THEN ${b.stage == null ? null : String(b.stage)} ELSE stage END,
          install_on = CASE WHEN ${"install_on" in b}::boolean THEN ${b.install_on == null ? null : String(b.install_on)}::date ELSE install_on END,
          value = CASE WHEN ${"value" in b}::boolean THEN ${b.value == null ? null : Number(b.value)}::numeric ELSE value END,
          hidden_at = CASE WHEN ${"hidden_at" in b}::boolean THEN ${b.hidden_at == null ? null : String(b.hidden_at)}::timestamptz ELSE hidden_at END,
          source_system = CASE WHEN ${"source_system" in b}::boolean THEN ${String(b.source_system ?? "")} ELSE source_system END,
          source_ref = CASE WHEN ${"source_ref" in b}::boolean THEN ${String(b.source_ref ?? "")} ELSE source_ref END,
          import_id = CASE WHEN ${"import_id" in b}::boolean THEN ${b.import_id == null ? null : String(b.import_id)}::uuid ELSE import_id END
        WHERE id = ${it.target_id}::uuid AND project_id = ${c.projectId}::uuid`;
    } else if (it.target === "catalog") await sql`UPDATE public.client_ops SET setup = setup || jsonb_build_object('catalog', ${String(b.catalog ?? "[]")}::text) WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
    else if (it.target === "quotes" && it.action === "updated") await sql`UPDATE public.client_quotes SET status = ${String(b.status ?? "open")}, amount = ${b.amount == null ? null : Number(b.amount)} WHERE id = ${it.target_id}::uuid AND project_id = ${c.projectId}::uuid`;
    else if (it.target === "payments") await sql`DELETE FROM public.client_payments WHERE id = ${it.target_id}::uuid AND project_id = ${c.projectId}::uuid AND import_id = ${id}::uuid`;
    else if (it.target === "invoices") await sql`DELETE FROM public.client_invoices WHERE id = ${it.target_id}::uuid AND project_id = ${c.projectId}::uuid AND import_id = ${id}::uuid`;
    else if (it.target === "quotes") await sql`DELETE FROM public.client_quotes WHERE id = ${it.target_id}::uuid AND project_id = ${c.projectId}::uuid AND import_id = ${id}::uuid`;
    else if (it.target === "plans") await sql`DELETE FROM public.client_plans WHERE id = ${it.target_id}::uuid AND project_id = ${c.projectId}::uuid AND import_id = ${id}::uuid`;
    else if (it.target === "properties") await sql`DELETE FROM public.client_properties WHERE id = ${it.target_id}::uuid AND project_id = ${c.projectId}::uuid AND import_id = ${id}::uuid`;
    else if (it.target === "team") await sql`UPDATE public.client_ops SET setup = setup || jsonb_build_object('team', ${String(b.team ?? "[]")}::text) WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
    else if (it.target === "photos") await sql`DELETE FROM public.client_photos WHERE id = ${it.target_id}::uuid AND project_id = ${c.projectId}::uuid`;
  }
  await sql`UPDATE public.client_imports SET status = 'undone', undone_at = now() WHERE id = ${id}::uuid`;
  return { ok: true };
}

/** The go-live list: which items the owner ticked, and when the side-by-side week started. */
export async function setGoLive(sql: Sql, c: Client, key: string, done: boolean) {
  if (!/^[a-z]{2,12}$/.test(key)) return;
  const cur = (() => { try { return JSON.parse(c.setup.golive || "{}") as Record<string, string>; } catch { return {}; } })();
  if (done) cur[key] = new Date().toISOString().slice(0, 10); else delete cur[key];
  await sql`UPDATE public.client_ops SET setup = setup || jsonb_build_object('golive', ${JSON.stringify(cur)}::text) WHERE project_id = ${c.projectId}::uuid AND owner_id = ${c.owner}`;
}
