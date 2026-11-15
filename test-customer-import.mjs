// Customer import checks: a Jobber export and a plain spreadsheet become customers with a phone, nothing else;
// the server re-checks every row; imported people never show up as leads Cinder answered.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readImportCsv, cleanImportRows, importPhone, importDate, importSummary, importAs, IMPORT_BATCH, MAX_IMPORT_ROWS } from "./lib/customer-import.ts";

let n = 0; const ok = fn => { fn(); n++; };
const TODAY = "2026-11-14";

// Phones: the first real ten-digit number in the cell, however it's written.
ok(() => assert.equal(importPhone("+1 (720) 555-0177"), "+17205550177"));
ok(() => assert.equal(importPhone("720.555.0177 ext 2"), "+17205550177"));
ok(() => assert.equal(importPhone("17205550177"), "+17205550177"));
ok(() => assert.equal(importPhone("(720) 555-0177; (303) 555-0100"), "+17205550177", "first of several"));
ok(() => assert.equal(importPhone("555-0177"), null, "too short"));
ok(() => assert.equal(importPhone("0205550177"), null, "not a North American number"));
ok(() => assert.equal(importPhone(""), null));
ok(() => assert.equal(importPhone("n/a"), null));

// Dates: every common spreadsheet shape, nothing in the future, nothing made up.
ok(() => assert.equal(importDate("2024-06-03", TODAY), "2024-06-03"));
ok(() => assert.equal(importDate("6/3/2024", TODAY), "2024-06-03"));
ok(() => assert.equal(importDate("06/03/24", TODAY), "2024-06-03"));
ok(() => assert.equal(importDate("Jun 3, 2024", TODAY), "2024-06-03"));
ok(() => assert.equal(importDate("3 June 2024", TODAY), "2024-06-03"));
ok(() => assert.equal(importDate("2024-06-03T15:04:05Z", TODAY), "2024-06-03"));
ok(() => assert.equal(importDate("2027-01-01", TODAY), null, "future"));
ok(() => assert.equal(importDate("2024-02-30", TODAY), null, "not a real day"));
ok(() => assert.equal(importDate("1987-05-05", TODAY), null, "before 1990"));
ok(() => assert.equal(importDate("yesterday", TODAY), null));

// A Jobber-style export: first and last names, company, two phone columns, a split address, tags, since and last job.
const jobber = [
  "First Name,Last Name,Company Name,Email,Phone,Mobile,Street 1,Street 2,City,State,Zip,Tags,Lead Source,Client Since,Last Job Date,Notes,J-ID",
  'Dana,Ruiz,,dana@example.com,,(720) 555-0177,2210 Oak Dr,,Littleton,CO,80120,"VIP, Referral",Google,2023-04-12,6/1/2025,"Gate sticks, check in spring",101',
  "Marcus,Hill,Hill Properties LLC,,720-555-0101,,88 Pine St,Unit B,Denver,CO,80203,,,03/15/2022,,,102",
  "Carla,Mendez,,carla@example.com,,,14 Elm Ave,,Aurora,CO,80010,,,2024-01-05,,,103",
  "Dana,Ruiz,,,7205550177,,2210 Oak Dr,,Littleton,CO,80120,,,2023-04-12,,,104",
  ",,,,,,,,,,,,,,,,",
].join("\r\n");
const r = readImportCsv(jobber, TODAY);
ok(() => assert.equal(r.error, undefined));
ok(() => assert.equal(r.jobber, true, "recognised as a Jobber export"));
ok(() => assert.equal(r.total, 4, "the blank line doesn't count"));
ok(() => assert.equal(r.rows.length, 2));
ok(() => assert.equal(r.duplicates, 1, "the same phone twice keeps the first row"));
ok(() => assert.deepEqual(r.skipped, [{ line: 4, name: "Carla Mendez", reason: "No phone number" }]));
const dana = r.rows[0];
ok(() => assert.equal(dana.name, "Dana Ruiz"));
ok(() => assert.equal(dana.phone, "+17205550177", "the mobile column fills in when Phone is blank"));
ok(() => assert.equal(dana.address, "2210 Oak Dr, Littleton, CO 80120"));
ok(() => assert.equal(dana.since, "2023-04-12"));
ok(() => assert.equal(dana.notes, "Gate sticks, check in spring\ndana@example.com · Tags: VIP, Referral · Found you through: Google · Last job 2025-06-01"));
const marcus = r.rows[1];
ok(() => assert.equal(marcus.name, "Marcus Hill"));
ok(() => assert.equal(marcus.address, "88 Pine St Unit B, Denver, CO 80203"));
ok(() => assert.equal(marcus.notes, "Hill Properties LLC", "the company rides along in the notes"));
ok(() => assert.equal(marcus.since, "2022-03-15"));

// A plain spreadsheet: one name column, one address column, odd header spelling, placeholders.
const plain = "Customer Name;Phone Number;Address;Notes\n".replace(/;/g, ",") + "Henderson family,303 555 0110,\"19 Birch Ct, Golden CO\",NOT FOUND\nNo Phone Person,n/a,,\nCompany Only Inc,3035550199,,Paid cash\n";
const p = readImportCsv(plain, TODAY);
ok(() => assert.equal(p.jobber, false));
ok(() => assert.equal(p.rows.length, 2));
ok(() => assert.deepEqual(p.rows[0], { name: "Henderson family", phone: "+13035550110", address: "19 Birch Ct, Golden CO", notes: "", since: null }));
ok(() => assert.equal(p.rows[1].name, "Company Only Inc", "a company name is a name"));
ok(() => assert.equal(p.rows[1].notes, "Paid cash"));
ok(() => assert.equal(p.skipped.length, 1));

// Files we can't use say why.
ok(() => assert.match(readImportCsv("Name,Email\nDana,d@x.com\n", TODAY).error, /phone column/));
ok(() => assert.match(readImportCsv("Name,Phone\n", TODAY).error, /no rows/));
ok(() => assert.equal(readImportCsv("﻿Name,Phone\nDana,7205550177\n", TODAY).rows.length, 1, "a BOM doesn't hide the header"));
// A big file stops at the cap instead of hanging the phone.
const big = "Name,Phone\n" + Array.from({ length: MAX_IMPORT_ROWS + 50 }, (_, i) => `P${i},720555${String(1000 + i).slice(-4)}`).join("\n");
ok(() => assert.equal(readImportCsv(big, TODAY).rows.length, MAX_IMPORT_ROWS));

// The server's second look: bad phones out, duplicates folded, everything trimmed, one batch at a time.
const batch = cleanImportRows([
  { name: " Dana Ruiz ", phone: "(720) 555-0177", address: "2210 Oak Dr", notes: "x\u0000y", since: "2023-04-12" },
  { name: "Dup", phone: "7205550177" },
  { name: "Bad", phone: "123" },
  "junk", null,
  { name: "Long".repeat(40), phone: "3035550101", address: "A".repeat(200), since: "someday" },
], TODAY);
ok(() => assert.equal(batch.length, 2));
ok(() => assert.deepEqual(batch[0], { name: "Dana Ruiz", phone: "+17205550177", address: "2210 Oak Dr", notes: "x y", since: "2023-04-12" }));
ok(() => assert.equal(batch[1].name.length, 80));
ok(() => assert.equal(batch[1].address.length, 120));
ok(() => assert.equal(batch[1].since, null));
ok(() => assert.equal(cleanImportRows(Array.from({ length: IMPORT_BATCH + 10 }, (_, i) => ({ phone: `720555${String(1000 + i).slice(-4)}` })), TODAY).length, IMPORT_BATCH));
ok(() => assert.equal(cleanImportRows("nope").length, 0));
ok(() => assert.equal(importAs("leads"), "leads")); ok(() => assert.equal(importAs("anything"), "customers"));
ok(() => assert.equal(importSummary({ added: 198, existing: 9, skipped: 5, as: "customers" }), "Imported 198 customers. 9 were already here. 5 skipped with no phone."));
ok(() => assert.equal(importSummary({ added: 1, existing: 0, skipped: 0, as: "leads" }), "Imported 1 lead."));

// On the server: one upsert per batch keyed on the phone, never a delete; imported people stay off the lead numbers.
const run = readFileSync("lib/client-crm-run.ts", "utf8");
ok(() => assert.match(run, /export async function importCustomers/));
ok(() => assert.match(run, /ON CONFLICT \(project_id, customer_phone\) DO UPDATE/, "a second import of the same file changes nothing"));
ok(() => assert.doesNotMatch(run, /DELETE FROM public\.client_threads/, "never delete leads"));
ok(() => assert.match(run, /source = 'import'/, "the board leaves quiet imported customers out"));
const live = readFileSync("lib/client-live.ts", "utf8");
ok(() => assert.match(live, /source <> 'import'/, "imported customers aren't leads Cinder answered"));
const act = readFileSync("app/api/app/act/route.ts", "utf8");
ok(() => assert.match(act, /b\.action === "import"/));
const close = readFileSync("lib/client-close-run.ts", "utf8");
ok(() => assert.match(close, /opted in to promo texts/, "win-back still needs the opt-in on file"));
ok(() => assert.match(run, /opted in to promo texts/, "the owner's confirmation on import is that opt-in"));
console.log(`Customer import checks passed (${n} assertions).`);
