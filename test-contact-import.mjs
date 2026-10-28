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

// Regression guard: the Meeting booked quick action must go through the
// shared outcome form, which persists the outcome and corresponding activity
// via the existing outreach PATCH handler. Direct status-only updates skip the
// contact activity timeline.
test("outreach API rejects malformed UUIDs before database casts", () => {
  const api = readFileSync("app/api/outreach/route.ts", "utf8");
  assert.ok(api.includes("const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i"));
  assert.ok(api.includes('if (!uuid.test(contactId)) return jsonError("Contact id must be a valid UUID.", 400)'));
  assert.ok(api.includes('if (!uuid.test(id)) return jsonError("Outreach id must be a valid UUID.", 400)'));
});

test("Meeting booked quick action uses the outcome/activity workflow", () => {
  const page = readFileSync("app/crm/outreach/page.tsx", "utf8");
  assert.ok(page.includes('setOutcomeFor(p);setOutcome("meeting_booked")'));
  assert.ok(page.includes('setOutcomeFor(p);setOutcome("do_not_contact")'));
  assert.ok(page.includes('body:JSON.stringify({id:outcomeFor.id,outcome,notes:outcomeNotes})'));
  const api = readFileSync("app/api/outreach/route.ts", "utf8");
  assert.ok(api.includes("INSERT INTO public.contact_activities"));
  assert.ok(api.includes('outcome === "meeting_booked"'));
  assert.ok(api.includes('body.status === "do_not_contact" && before[0].status !== "do_not_contact"'));
  assert.ok(api.includes("Marked do-not-contact from outreach status action."));
});


// --- Agency workflow regression guards ---
// These source-level checks protect the key founder workflow from accidental
// regressions. End-to-end authenticated browser testing is still required.
test("My Day shows the unified server-built queue", () => {
  const home = readFileSync("app/page.tsx", "utf8");
  assert.ok(home.includes("<MyDayQueue />"));
  const queue = readFileSync("app/my-day-queue.tsx", "utf8");
  assert.ok(queue.includes('fetch("/api/my-day?"'));
});

test("My Day avoids duplicating contact follow-ups already handled by active outreach", () => {
  const lib = readFileSync("lib/my-day.ts", "utf8");
  assert.ok(lib.includes("active.has(f.contact.id) || seenContacts.has(f.contact.id)"));
});

test("Unconsented prospects cannot receive a copied SMS draft", () => {
  const outreach = readFileSync("app/crm/outreach/page.tsx", "utf8");
  assert.ok(outreach.includes('if(!p.smsConsent){setMessage("No SMS draft available: record explicit SMS consent first.'));
  assert.ok(outreach.includes("SMS unavailable · no consent"));
  assert.ok(outreach.includes("Only check this if consent was actually given."));
});

test("Meeting booked and interested outcomes stop routine outreach", () => {
  const api = readFileSync("app/api/outreach/route.ts", "utf8");
  assert.ok(api.includes('const stopForResponse = outcome === "meeting_booked" || outcome === "reply_received" || outcome === "interested"'));
  assert.ok(api.includes("status = ${nextStatus}"));
});


test("Cal.ai webhook requires server-side secret and verifies the provider signature", () => {
  const route = readFileSync("app/api/webhooks/cal-ai/route.ts", "utf8");
  const helper = readFileSync("lib/cal-ai-webhook.ts", "utf8");
  assert.ok(route.includes("process.env.CAL_AI_WEBHOOK_SECRET"));
  assert.ok(route.includes('request.headers.get("x-cal-signature-256")'));
  assert.ok(route.includes("verifyCalAiSignature(raw, signature, secret)"));
  assert.ok(helper.includes("createHmac(\"sha256\", secret)"));
  assert.ok(helper.includes("timingSafeEqual"));
  assert.ok(route.includes("Invalid Cal.com webhook signature."));
});

test("Cal.ai booking sync handles nested payloads and reschedules without leaving stale meetings", () => {
  const route = readFileSync("app/api/webhooks/cal-ai/route.ts", "utf8");
  const helper = readFileSync("lib/cal-ai-webhook.ts", "utf8");
  const migration = readFileSync("db/migrations/0013_cal_ai_booking_sync.sql", "utf8");
  assert.ok(route.includes("unwrapCalAiPayload(parsed)"));
  assert.ok(helper.includes("const nested = envelope.payload"));
  assert.ok(route.includes("const rescheduleUid = text(payload.rescheduleUid, 300)"));
  assert.ok(route.includes("provider_event_id = ${uid}"));
  assert.ok(route.includes("WHERE owner_id = ${ownerId} AND provider = 'cal_ai' AND provider_event_id = ${rescheduleUid}"));
  assert.ok(route.includes("ON CONFLICT (owner_id, provider, provider_event_id)"));
  assert.ok(route.includes("BOOKING_RESCHEDULED"));
  assert.ok(route.includes("BOOKING_CANCELLED"));
  assert.ok(migration.includes("calendar_events_provider_event_unique"));
  assert.ok(migration.includes("cal_ai_webhook_events"));
});

test("Needs You queue avoids duplicate contact follow-ups while outreach is active", () => {
  const src = readFileSync("app/crm/needs-you/page.tsx", "utf8");
  assert.ok(
    src.includes("const activeOutreachContactIds = new Set((od.outreach||[])"),
    "Needs You must derive active outreach contact IDs before building generic contact follow-ups"
  );
  assert.ok(
    src.includes("if(activeOutreachContactIds.has(c.id))continue;"),
    "A contact with an active sequence must not also appear as a generic follow-up"
  );
  assert.ok(
    src.includes('o.status==="active"&&o.contactId&&o.nextActionAt'),
    "Only active outreach with a scheduled next action may suppress the generic follow-up"
  );
});

test("Needs You queue includes upcoming scheduled meetings that still need a brief", () => {
  const src = readFileSync("app/crm/needs-you/page.tsx", "utf8");
  assert.ok(src.includes('fetch(calendarUrl,{cache:"no-store"})'), "Needs You must load upcoming calendar events");
  assert.ok(src.includes('e.status!=="scheduled"||!(e.type==="meeting"||e.type==="call")'), "Only scheduled meetings and calls should become preparation actions");
  assert.ok(src.includes('a.calendarEventId===e.id&&a.type==="meeting_brief"&&(a.status==="draft"||a.status==="reviewed")'), "Meetings with an existing brief should not create a duplicate preparation action");
  assert.ok(src.includes('href:"/crm/preparation?event="+encodeURIComponent(e.id)+"&type=meeting_brief",action:"Prepare meeting"'), "Meeting preparation actions must link to a brief for the selected event");
  assert.ok(src.includes('["meeting","Meeting prep"]'), "Meeting preparation must be available as a queue filter");
  assert.ok(src.includes('meeting:items.filter(x=>x.kind==="meeting").length'), "Meeting preparation must be included in queue counts");
});

test("Needs You has a dedicated sales focus and prioritizes severely overdue outreach", () => {
  const src = readFileSync("app/crm/needs-you/page.tsx", "utf8");
  assert.ok(src.includes('const salesKinds=new Set(["outreach","followup","deal","preparation","meeting"])'), "Sales focus should group prospect follow-ups, deals, briefs, and meetings");
  assert.ok(src.includes('filter==="sales"?items.filter(x=>salesKinds.has(x.kind))'), "Sales focus should filter the queue to sales actions");
  assert.ok(src.includes('["sales","Sales focus"]'), "Sales focus should be visible as a queue filter");
  assert.ok(src.includes('priority:due<=now-86400000?1:2'), "Outreach overdue by at least a day should rise above routine actions");
  assert.ok(src.includes('SALES ACTIONS'), "Queue summary should show the number of sales actions");
});

test("Signed-deal handoff seeds an idempotent client onboarding checklist", () => {
  const lib = readFileSync("lib/deal-handoff.ts", "utf8");
  const route = readFileSync("app/api/deals/convert/route.ts", "utf8");
  assert.ok(lib.includes('deal.stage !== "won" || deal.agreement_status !== "active" || !deal.signed_at'), "Only a signed, active won deal can be handed off");
  assert.ok(lib.includes("export const ONBOARDING_TEMPLATE"), "Signed-deal handoff must create a usable onboarding checklist");
  for (const title of [
    "Confirm scope and success criteria", "Collect access and baseline metrics", "Hold client kickoff",
    "Configure the agreed implementation", "Test the end-to-end lead journey", "Review results and approve launch",
    "Monitor launch and report outcomes", "7-day post-launch review", "30-day results review",
  ]) assert.ok(lib.includes(title), "Missing onboarding milestone: " + title);
  assert.ok(lib.includes("lower(trim(title)) = lower(trim("), "Milestone seeding must be idempotent on retry");
  assert.ok(lib.includes("'todo'"), "New onboarding milestones must start incomplete");
  assert.ok(route.includes("runDealHandoff(") && route.includes("No payment was recorded."), "Deal handoff must not represent expected revenue as collected cash");
});

console.log(`${passed} passed`);
if (process.exitCode) process.exit(process.exitCode);
