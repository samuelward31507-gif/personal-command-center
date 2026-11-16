// The switch-over center: column guessing, reading each tool's export, de-duplication (and undoing a merge), the Jobber and
// QuickBooks mappers, the preview counts, and undoing a whole batch (customers hidden, never deleted).
import assert from "node:assert/strict";
import { register } from "node:module";
register("./test-alias-hooks.mjs", import.meta.url);
const S = await import("./lib/switch.ts");
const { zip, crc32 } = await import("./lib/zip.ts");

let n = 0; const ok = fn => { fn(); n++; };
const today = "2026-11-15";

// ---------- Column guessing ----------
const hcp = ["First Name", "Last Name", "Mobile Number", "Home Number", "Email", "Street", "City", "State", "Zip", "Tags", "Notes", "Customer ID"];
ok(() => { const m = S.guessMapping(hcp, "customers"); assert.equal(m.first, 0); assert.equal(m.last, 1); assert.equal(m.phone, 2); assert.equal(m.email, 4); assert.equal(m.street, 5); assert.equal(m.zip, 8); assert.equal(m.ref, 11); assert.equal(m.name, -1); });
const st = ["Customer Name", "Customer Type", "Service Address", "City", "State", "Zip Code", "Phone Number", "Email Address", "Balance"];
ok(() => { const m = S.guessMapping(st, "customers"); assert.equal(m.name, 0); assert.equal(m.street, 2); assert.equal(m.zip, 5); assert.equal(m.phone, 6); assert.equal(m.email, 7); assert.equal(m.tags, 1); });
const jobberInv = ["Invoice #", "Client name", "Client phone", "Status", "Issued date", "Due date", "Total ($)", "Balance ($)"];
ok(() => { assert.equal(S.guessKind(jobberInv), "invoices"); const m = S.guessMapping(jobberInv, "invoices"); assert.equal(m.number, 0); assert.equal(m.name, 1); assert.equal(m.phone, 2); assert.equal(m.total, 6); assert.equal(m.balance, 7); assert.equal(m.due, 5); });
ok(() => assert.equal(S.guessKind(["Name", "Unit Price", "Unit", "Cost"]), "items"));
ok(() => assert.equal(S.guessKind(["Job #", "Client", "Scheduled start", "Total"]), "jobs"));
ok(() => assert.equal(S.guessKind(["Estimate #", "Customer", "Status"]), "quotes"));
ok(() => assert.equal(S.guessKind(["Name", "Phone", "Email"]), "customers"));
ok(() => { const m = S.guessMapping(["Phone", "Phone 2"], "customers"); assert.equal(m.phone, 0); });

// ---------- Reading a sheet ----------
const csv = "First Name,Last Name,Mobile Number,Email,Street,City,State,Zip,Customer ID\r\nDana,Ruiz,(720) 555-0148,DANA@x.com,77 Aspen Ct,Englewood,CO,80110,h1\r\n,,,,,,,,\r\nMike,Turner,,mike@x.com,9 Elm St,Littleton,CO,80120,h2\r\n,,,,,,,,h3\r\n";
ok(() => { const sh = S.readSheet(csv); assert.equal(sh.rows.length, 3); const { staged, skipped } = S.stageSheet(sh, "customers", S.guessMapping(sh.headers, "customers"), "housecall");
  assert.equal(staged.customers.length, 2); assert.equal(skipped.length, 1); const d = staged.customers[0];
  assert.equal(d.ref, "housecall:h1"); assert.equal(d.phone, "+17205550148"); assert.equal(d.email, "dana@x.com"); assert.equal(d.properties[0].address, "77 Aspen Ct, Englewood, CO 80110"); assert.equal(staged.customers[1].phone, ""); });
ok(() => assert.ok("error" in S.readSheet("just a header\n")));
const inv = "Invoice #,Client name,Client phone,Status,Issued date,Total ($),Balance ($)\n2101,Dana Ruiz,7205550148,Awaiting payment,10/30/2026,\"1,480.00\",480\n2102,Ann Lee,7205550199,Paid,2026-09-01,900,0\n";
ok(() => { const sh = S.readSheet(inv); const { staged } = S.stageSheet(sh, "invoices", S.guessMapping(sh.headers, "invoices"), "jobber", undefined, today);
  const [a, b] = staged.invoices; assert.equal(a.total, 1480); assert.equal(a.paid, 1000); assert.equal(a.status, "open"); assert.equal(a.issued, "2026-10-30"); assert.equal(b.status, "paid"); assert.equal(b.paid, 900);
  assert.equal(staged.customers.length, 2); assert.equal(a.customerRef, "p:7205550148"); });
const jobs = "Job #,Client,Phone,Title,Status,Scheduled start,Total\n801,Dana Ruiz,7205550148,Cedar install,Upcoming,2026-12-01,6900\n802,Dana Ruiz,7205550148,Gate repair,Completed,2026-03-04,400\n";
ok(() => { const sh = S.readSheet(jobs); const { staged } = S.stageSheet(sh, "jobs", S.guessMapping(sh.headers, "jobs"), "jobber", undefined, today); assert.deepEqual(staged.jobs.map(j => j.status), ["scheduled", "done"]); assert.equal(staged.customers.length, 1); });
ok(() => { const sh = S.readSheet("Name,Unit Price,Unit,Cost\nWalk gate,$550,,240\n,3,,\n"); const { staged, skipped } = S.stageSheet(sh, "items", S.guessMapping(sh.headers, "items"), "csv"); assert.deepEqual(staged.items.map(i => [i.name, i.price, i.cost]), [["Walk gate", 550, 240]]); assert.equal(skipped.length, 1); });

// ---------- Contacts ----------
const vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Dana Ruiz\r\nTEL;TYPE=CELL:+1 720-555-0148\r\nEMAIL:dana@x.com\r\nADR;TYPE=HOME:;;77 Aspen Ct;Englewood;CO;80110;USA\r\nEND:VCARD\r\nBEGIN:VCARD\r\nFN:\r\nEND:VCARD\r\n";
ok(() => { const { staged, skipped } = S.stageVcards(vcf); assert.equal(staged.customers.length, 1); assert.equal(skipped, 1); assert.equal(staged.customers[0].phone, "+17205550148"); assert.equal(staged.customers[0].properties[0].address, "77 Aspen Ct, Englewood, CO 80110"); });

// ---------- Duplicates, and undoing a merge ----------
const people = [
  { ref: "a", name: "Dana Ruiz", phone: "+17205550148", email: "", notes: "first", properties: [{ ref: "a1", address: "77 Aspen Ct" }] },
  { ref: "b", name: "Dana R.", phone: "+17205550148", email: "dana@x.com", notes: "second", properties: [{ ref: "b1", address: "12 Hill Rd" }] },
  { ref: "c", name: "D Ruiz", phone: "", email: "dana@x.com", notes: "", properties: [] },
  { ref: "d", name: "Tom Becker", phone: "", email: "", notes: "", properties: [{ ref: "d1", address: "2210 Oak Drive" }] },
  { ref: "e", name: "tom becker", phone: "+17205550177", email: "", notes: "", properties: [{ ref: "e1", address: "2210 Oak Dr." }] },
  { ref: "f", name: "Ann Lee", phone: "+17205550199", email: "", notes: "", properties: [] },
];
ok(() => { const r = S.dedupe(people); assert.equal(r.customers.length, 3); const dana = r.customers.find(c => c.ref === "a");
  assert.equal(dana.name, "Dana Ruiz"); assert.equal(dana.email, "dana@x.com"); assert.equal(dana.properties.length, 2); assert.equal(dana.notes, "first\nsecond");
  assert.equal(r.remap.b, "a"); assert.equal(r.remap.c, "a"); assert.equal(r.remap.e, "d");
  const m = r.merges.find(x => x.keep === "a"); assert.deepEqual(m.merged.map(x => [x.ref, x.why]), [["b", "phone"], ["c", "email"]]);
  assert.equal(r.merges.find(x => x.keep === "d").merged[0].why, "name and address"); assert.equal(r.customers.find(c => c.ref === "d").phone, "+17205550177"); });
ok(() => { const r = S.dedupe(people, ["b", "c"]); assert.equal(r.customers.length, 5); assert.equal(r.remap.b, "b"); });
ok(() => { const r = S.dedupe([{ ref: "x", name: "", phone: "", email: "", notes: "", properties: [] }, { ref: "y", name: "", phone: "", email: "", notes: "", properties: [] }]); assert.equal(r.customers.length, 2); });

// ---------- Preview ----------
ok(() => { const s = { ...S.emptyStaged(), customers: people,
  quotes: [{ ref: "q1", customerRef: "b", status: "open", items: [], total: 4000 }, { ref: "q2", customerRef: "f", status: "approved", items: [], total: 900 }],
  jobs: [{ ref: "j1", customerRef: "a", title: "x", status: "scheduled", start: "2026-12-01" }, { ref: "j2", customerRef: "a", title: "y", status: "done", start: "2026-01-01" }],
  invoices: [{ ref: "i1", customerRef: "f", status: "open", items: [], total: 1480, paid: 1000 }, { ref: "i2", customerRef: "f", status: "paid", items: [], total: 500, paid: 500 }], items: [{ ref: "t", name: "Gate", unit: "", price: 550 }] };
  const p = S.previewOf(s, {}, today);
  assert.equal(p.sourceCustomers, 6); assert.equal(p.customers, 3); assert.equal(p.merged, 3); assert.equal(p.openQuotes, 1); assert.equal(p.openQuotesValue, 4000); assert.equal(p.scheduledJobs, 1); assert.equal(p.unpaidInvoices, 1); assert.equal(p.unpaidValue, 480); assert.equal(p.items, 1); assert.equal(p.missingPhone.length, 0);
  const p2 = S.previewOf({ ...s, customers: [...people, { ref: "g", name: "No Phone", phone: "", email: "np@x.com", notes: "", properties: [] }] }, {}, today); assert.deepEqual(p2.missingPhone.map(m => m.ref), ["g"]);
  const p3 = S.previewOf({ ...s, customers: [...people, { ref: "g", name: "No Phone", phone: "", email: "np@x.com", notes: "", properties: [] }] }, { phones: { g: "720-555-0111" } }, today); assert.equal(p3.missingPhone.length, 0); assert.equal(p3.customers, 4); });

// ---------- Status words from each tool ----------
ok(() => assert.deepEqual(["awaiting_response", "approved", "converted", "archived", "draft", "Changes requested"].map(S.quoteStatus), ["open", "approved", "approved", "declined", "draft", "open"]));
ok(() => assert.deepEqual([["paid"], ["awaiting_payment"], ["past_due"], ["bad_debt"], ["", 0, 100], ["Open", 0, 100]].map(a => S.invoiceStatus(...a)), ["paid", "open", "open", "void", "paid", "open"]));
ok(() => assert.deepEqual([["upcoming", "2026-12-01"], ["archived", "2026-01-01"], ["", "2026-01-01"], ["late", "2026-11-10"]].map(([s, d]) => S.jobStatus(s, d, today)), ["scheduled", "done", "done", "active"]));

// ---------- Jobber and QuickBooks records ----------
ok(() => { const c = S.jobberClient({ id: "Z1", name: "Dana Ruiz", phones: [{ number: "720 555 0100" }, { number: "(720) 555-0148", primary: true }], emails: [{ address: "D@X.com", primary: true }], createdAt: "2024-03-01T10:00:00Z",
  billingAddress: { street1: "1 Bill St", city: "Denver", province: "CO", postalCode: "80202" }, clientProperties: { nodes: [{ id: "P1", address: { street1: "77 Aspen Ct", city: "Englewood", province: "CO", postalCode: "80110" } }] },
  notes: { nodes: [{ message: "Gate code 4418", fileAttachments: { nodes: [{ fileName: "a.jpg", url: "https://x/a.jpg" }] } }] } });
  assert.equal(c.ref, "jobber:Z1"); assert.equal(c.phone, "+17205550148"); assert.equal(c.email, "d@x.com"); assert.equal(c.since, "2024-03-01"); assert.deepEqual(c.properties.map(p => p.ref), ["jobber:P1"]); assert.ok(c.notes.includes("a.jpg: https://x/a.jpg")); });
ok(() => { const c = S.jobberClient({ id: "Z2", name: "Ann", phones: [], emails: [], billingAddress: { street1: "5 A St", city: "Denver" } }); assert.equal(c.properties[0].address, "5 A St, Denver"); });
ok(() => { const q = S.jobberQuote({ id: "Q", quoteNumber: 1042, quoteStatus: "awaiting_response", client: { id: "Z1" }, amounts: { total: 7000 }, lineItems: { nodes: [{ name: "Fence", quantity: 150, unitPrice: 43 }] } });
  assert.equal(q.customerRef, "jobber:Z1"); assert.equal(q.status, "open"); assert.equal(q.items[0].qty, 150); assert.equal(q.total, 7000); });
ok(() => { const i = S.jobberInvoice({ id: "I", invoiceNumber: 2101, invoiceStatus: "awaiting_payment", client: { id: "Z1" }, amounts: { total: 1480, invoiceBalance: 480 } }); assert.equal(i.paid, 1000); assert.equal(i.status, "open"); assert.equal(i.items[0].price, 1480); });
ok(() => { assert.equal(S.jobberPlan({ id: "R", jobType: "ONE_OFF" }), null); const p = S.jobberPlan({ id: "R", jobType: "RECURRING", title: "Wash", total: 240, startAt: "2026-12-01T15:00:00Z", client: { id: "Z1" } }); assert.equal(p.next_on, "2026-12-01"); assert.equal(p.customerRef, "jobber:Z1"); });
ok(() => { const c = S.qboCustomer({ Id: "58", DisplayName: "Dana Ruiz", Mobile: { FreeFormNumber: "(720) 555-0148" }, PrimaryEmailAddr: { Address: "dana@x.com" }, ShipAddr: { Line1: "77 Aspen Ct", City: "Englewood", CountrySubDivisionCode: "CO", PostalCode: "80110" } });
  assert.equal(c.ref, "qbo:58"); assert.equal(c.phone, "+17205550148"); assert.equal(c.properties[0].address, "77 Aspen Ct, Englewood, CO 80110"); });
ok(() => { const i = S.qboInvoice({ Id: "201", DocNumber: "1044", TotalAmt: 1480, Balance: 480, TxnDate: "2026-10-30", CustomerRef: { value: "58" }, Line: [{ DetailType: "SalesItemLineDetail", Amount: 1480, Description: "Fence", SalesItemLineDetail: { Qty: 1, UnitPrice: 1480 } }, { DetailType: "SubTotalLineDetail", Amount: 1480 }] });
  assert.equal(i.customerRef, "qbo:58"); assert.equal(i.paid, 1000); assert.equal(i.items.length, 1); assert.equal(i.status, "open"); });

// ---------- What the browser sends is cleaned again ----------
ok(() => { const s = S.cleanStaged({ customers: [{ ref: "a", name: "<b>X</b>", phone: "bad", email: "nope", properties: [{ ref: "p", address: "1 A St" }, { ref: "", address: "no ref" }] }, { name: "no ref" }], invoices: [{ ref: "i", customerRef: "a", total: 100, paid: 500, status: "weird" }] });
  assert.equal(s.customers.length, 1); assert.equal(s.customers[0].phone, ""); assert.equal(s.customers[0].email, ""); assert.equal(s.customers[0].properties.length, 1); assert.equal(s.invoices[0].paid, 100); assert.equal(s.invoices[0].status, "open"); });
ok(() => { const a = { ...S.emptyStaged(), customers: [{ ref: "a", name: "A", phone: "", email: "", notes: "", properties: [] }] }; const b = { ...S.emptyStaged(), customers: [{ ref: "a", name: "A2", phone: "", email: "", notes: "", properties: [] }, { ref: "b", name: "B", phone: "", email: "", notes: "", properties: [] }] };
  const m = S.mergeStaged(a, b); assert.deepEqual(m.customers.map(c => c.name), ["A2", "B"]); });
ok(() => assert.equal(S.sourceFromSoftware("Housecall Pro"), "housecall"));

// ---------- Undoing a whole batch: customers it made are hidden, never deleted; the rest goes in reverse ----------
process.env.DATABASE_URL ??= "postgres://test";
const { undoImport } = await import("./lib/client-switch-run.ts");
ok(() => {});
const ran = [];
const fake = (strings, ...values) => { const q = strings.join("?").replace(/\s+/g, " "); ran.push({ q, values });
  if (q.includes("FROM public.client_imports WHERE id")) return Promise.resolve([{ id: "11111111-1111-1111-1111-111111111111", status: "done", finished_at: new Date().toISOString() }]);
  if (q.includes("FROM public.client_import_items")) return Promise.resolve([
    { target: "payments", target_id: "p1", action: "created", before: null }, { target: "invoices", target_id: "i1", action: "created", before: null },
    { target: "threads", target_id: "t2", action: "updated", before: { customer_name: "Old name", notes: "old" } }, { target: "threads", target_id: "t1", action: "created", before: null },
    { target: "catalog", target_id: "x", action: "updated", before: { catalog: "[]" } }]);
  return Promise.resolve([]); };
const res = await undoImport(fake, { projectId: "22222222-2222-2222-2222-222222222222", owner: "o", setup: {}, messages: [] }, "11111111-1111-1111-1111-111111111111");
ok(() => { assert.equal(res.ok, true);
  const writes = ran.map(r => r.q).filter(q => /UPDATE|DELETE/.test(q));
  assert.ok(!writes.some(q => /DELETE FROM public.client_threads/.test(q)), "customers are never deleted");
  assert.ok(writes.findIndex(q => q.includes("DELETE FROM public.client_payments")) < writes.findIndex(q => q.includes("DELETE FROM public.client_invoices")), "payments go before their invoice");
  assert.ok(writes.some(q => q.includes("SET hidden_at = now()")), "created customers are hidden");
  assert.ok(ran.some(r => r.q.includes("customer_name = CASE") && r.values.includes("Old name")), "changed customers get their old values back");
  assert.ok(writes.at(-1).includes("status = 'undone'")); });
ran.length = 0;
const old = (strings, ...values) => { const q = strings.join("?"); return Promise.resolve(q.includes("FROM public.client_imports WHERE id") ? [{ id: "1", status: "done", finished_at: new Date(Date.now() - 8 * 86400000).toISOString() }] : []); };
ok(async () => {});
const tooOld = await undoImport(old, { projectId: "2", owner: "o", setup: {}, messages: [] }, "11111111-1111-1111-1111-111111111111");
ok(() => { assert.equal(tooOld.ok, false); assert.match(tooOld.error, /7 days/); });

// ---------- The export zip ----------
ok(() => assert.equal(crc32(new TextEncoder().encode("hello")), 0x3610a686));
ok(() => { const z = zip([{ name: "a.csv", data: "x,y\r\n" }, { name: "photos/1.jpg", data: new Uint8Array([1, 2, 3]) }]); const v = new DataView(z.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50); assert.equal(v.getUint32(z.length - 22, true), 0x06054b50); assert.equal(v.getUint16(z.length - 12, true), 2); });

console.log(`switch: ${n} checks passed`);
