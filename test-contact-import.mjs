// Synthetic, DB-free regression tests for lib/contact-import.ts (CSV
// normalization, validation, header-aliasing, and dedup-key logic used by
// both the import preview UI and the server-side import route).
// Run with: node --experimental-strip-types test-contact-import.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_IMPORT_ROWS,
  normalizeHeader,
  parseCsv,
  cleanText,
  normalizeStatus,
  normalizePhoneDigits,
  isValidEmailShape,
  normalizeFollowUpDate,
  buildHeaderIndex,
  normalizeImportRow,
} from "./lib/contact-import.ts";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error("FAIL:", name);
    console.error(e);
    process.exitCode = 1;
  }
}

// --- normalizeHeader ---
test("normalizeHeader strips spaces/underscores/hyphens and lowercases", () => {
  assert.equal(normalizeHeader("Business Name"), "businessname");
  assert.equal(normalizeHeader("business_name"), "businessname");
  assert.equal(normalizeHeader("Business-Name"), "businessname");
  assert.equal(normalizeHeader("  Email  "), "email");
});

// --- parseCsv ---
test("parseCsv handles quoted cells, commas inside quotes, and escaped quotes", () => {
  const rows = parseCsv('name,notes\n"Smith, John","He said ""hello"""\n');
  assert.deepEqual(rows, [["name", "notes"], ["Smith, John", 'He said "hello"']]);
});
test("parseCsv handles CRLF and bare LF line endings and skips blank lines", () => {
  const rows = parseCsv("a,b\r\n1,2\n\n3,4\r\n");
  assert.deepEqual(rows, [["a", "b"], ["1", "2"], ["3", "4"]]);
});

// --- cleanText ---
test("cleanText trims and caps length, non-strings become empty", () => {
  assert.equal(cleanText("  hi  ", 10), "hi");
  assert.equal(cleanText("x".repeat(20), 5), "xxxxx");
  assert.equal(cleanText(undefined, 10), "");
  assert.equal(cleanText(42, 10), "");
});

// --- normalizeStatus ---
test("normalizeStatus maps known values case-insensitively, defaults to Lead", () => {
  assert.equal(normalizeStatus("customer"), "Customer");
  assert.equal(normalizeStatus("CONTACT"), "Contact");
  assert.equal(normalizeStatus("Partner"), "Partner");
  assert.equal(normalizeStatus("prospect"), "Lead");
  assert.equal(normalizeStatus(undefined), "Lead");
});

// --- normalizePhoneDigits ---
test("normalizePhoneDigits strips all non-digit characters", () => {
  assert.equal(normalizePhoneDigits("+1 (555) 123-4567"), "15551234567");
  assert.equal(normalizePhoneDigits(""), "");
});

// --- isValidEmailShape ---
test("isValidEmailShape accepts empty and real-looking emails, rejects junk", () => {
  assert.equal(isValidEmailShape(""), true);
  assert.equal(isValidEmailShape("a@b.com"), true);
  assert.equal(isValidEmailShape("not-an-email"), false);
  assert.equal(isValidEmailShape("555-123-4567"), false);
  assert.equal(isValidEmailShape("a@b"), false);
});

// --- normalizeFollowUpDate ---
test("normalizeFollowUpDate accepts empty as valid/null", () => {
  assert.deepEqual(normalizeFollowUpDate(""), { value: null, valid: true });
  assert.deepEqual(normalizeFollowUpDate("   "), { value: null, valid: true });
});
test("normalizeFollowUpDate accepts ISO dates", () => {
  assert.deepEqual(normalizeFollowUpDate("2026-03-15"), { value: "2026-03-15", valid: true });
});
test("normalizeFollowUpDate accepts M/D/YYYY and converts to ISO", () => {
  assert.deepEqual(normalizeFollowUpDate("3/5/2026"), { value: "2026-03-05", valid: true });
  assert.deepEqual(normalizeFollowUpDate("12/31/2026"), { value: "2026-12-31", valid: true });
});
test("normalizeFollowUpDate rejects impossible calendar dates", () => {
  assert.equal(normalizeFollowUpDate("2026-02-30").valid, false);
  assert.equal(normalizeFollowUpDate("2026-13-01").valid, false);
});
test("normalizeFollowUpDate rejects garbage", () => {
  assert.equal(normalizeFollowUpDate("next tuesday").valid, false);
  assert.equal(normalizeFollowUpDate("2026/03/05").valid, false);
});

// --- buildHeaderIndex + normalizeImportRow ---
test("buildHeaderIndex maps common business-lead CSV headers via aliases", () => {
  const idx = buildHeaderIndex(["Business Name", "Contact Name", "Phone Number", "Email Address", "Website", "City", "Job Title", "Source", "Notes"]);
  assert.equal(idx.get("company"), 0);
  assert.equal(idx.get("name"), 1);
  assert.equal(idx.get("phone"), 2);
  assert.equal(idx.get("email"), 3);
  assert.equal(idx.get("website"), 4);
  assert.equal(idx.get("location"), 5);
  assert.equal(idx.get("role"), 6);
  assert.equal(idx.get("source"), 7);
  assert.equal(idx.get("notes"), 8);
});

test("normalizeImportRow builds a full row from aliased headers", () => {
  const idx = buildHeaderIndex(["Business Name", "Contact Name", "Phone", "Email", "Website", "Location", "Title", "Notes", "Next Follow Up"]);
  const outcome = normalizeImportRow(
    ["Acme HVAC", "Jordan Smith", "555-123-4567", "jordan@acme.com", "acme.com", "Denver, CO", "Owner", "Called before, interested", "3/5/2026"],
    idx
  );
  assert.equal(outcome.kind, "valid");
  assert.equal(outcome.row.name, "Jordan Smith");
  assert.equal(outcome.row.firstName, "Jordan");
  assert.equal(outcome.row.lastName, "Smith");
  assert.equal(outcome.row.company, "Acme HVAC");
  assert.equal(outcome.row.phone, "555-123-4567");
  assert.equal(outcome.row.email, "jordan@acme.com");
  assert.equal(outcome.row.website, "acme.com");
  assert.equal(outcome.row.location, "Denver, CO");
  assert.equal(outcome.row.role, "Owner");
  assert.equal(outcome.row.notes, "Called before, interested");
  assert.equal(outcome.row.nextFollowUp, "2026-03-05");
  assert.equal(outcome.row.status, "Lead");
});

test("normalizeImportRow falls back to first+last name columns when no combined name column", () => {
  const idx = buildHeaderIndex(["First Name", "Last Name", "Company"]);
  const outcome = normalizeImportRow(["Jordan", "Smith", "Acme"], idx);
  assert.equal(outcome.kind, "valid");
  assert.equal(outcome.row.name, "Jordan Smith");
});

test("normalizeImportRow rejects a row with no name at all", () => {
  const idx = buildHeaderIndex(["Company", "Phone"]);
  const outcome = normalizeImportRow(["Acme HVAC", "555-123-4567"], idx);
  assert.equal(outcome.kind, "invalid");
  assert.match(outcome.reason, /name/i);
});

test("normalizeImportRow rejects malformed email", () => {
  const idx = buildHeaderIndex(["Name", "Email"]);
  const outcome = normalizeImportRow(["Jordan Smith", "not-an-email"], idx);
  assert.equal(outcome.kind, "invalid");
  assert.match(outcome.reason, /email/i);
});

test("normalizeImportRow rejects an impossible follow-up date", () => {
  const idx = buildHeaderIndex(["Name", "Next Follow Up"]);
  const outcome = normalizeImportRow(["Jordan Smith", "2026-02-30"], idx);
  assert.equal(outcome.kind, "invalid");
  assert.match(outcome.reason, /date/i);
});

test("normalizeImportRow defaults source to 'CSV import' when not provided", () => {
  const idx = buildHeaderIndex(["Name"]);
  const outcome = normalizeImportRow(["Jordan Smith"], idx);
  assert.equal(outcome.kind, "valid");
  assert.equal(outcome.row.source, "CSV import");
});

test("normalizeImportRow maps a provided status case-insensitively", () => {
  const idx = buildHeaderIndex(["Name", "Status"]);
  const outcome = normalizeImportRow(["Jordan Smith", "customer"], idx);
  assert.equal(outcome.kind, "valid");
  assert.equal(outcome.row.status, "Customer");
});

// --- MAX_IMPORT_ROWS sanity (unchanged batch limit) ---
test("MAX_IMPORT_ROWS is still 500", () => {
  assert.equal(MAX_IMPORT_ROWS, 500);
});

// --- Regression guard: the manual "Add contact" form's Website field must
// never regress to type="url". A live browser test found that type="url"
// rejects bare domains like "acme.com" (native HTML5 validation requires a
// scheme) with no visible error, silently blocking the whole form submit --
// while the CSV import path (plain text, no browser validation) accepted
// the exact same bare-domain value. This static check can't run a browser,
// but it catches the regression at the source level. ---
test("contact form's Website input is not type=url (blocks bare domains)", () => {
  const src = readFileSync("app/crm/page.tsx", "utf8");
  const idx = src.indexOf("Website<input");
  assert.ok(idx >= 0, "Could not find the Website input in app/crm/page.tsx");
  const fieldSrc = src.slice(idx, idx + 300);
  assert.ok(
    !/type="url"/.test(fieldSrc),
    'Website input must not be type="url" -- it silently rejects bare domains (e.g. "acme.com") with no visible error, blocking contact creation. Use a plain text input (see lib/contact-import.ts, which already treats website as free text).'
  );
});

console.log(`${passed} passed`);
if (process.exitCode) process.exit(process.exitCode);
