// Kickoff checklist checks: Schedule B fields, validation, no passwords, EIN masking, wiring.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KICKOFF_FIELDS, fieldsFor, validateKickoff, kickoffSummary, maskEin } from "./lib/kickoff.ts";
let n = 0; const ok = f => { f(); n++; };
const req1 = Object.fromEntries(fieldsFor("tier1").filter(f => f.required && f.kind !== "file").map(f => [f.key, f.options ? f.options[0] : "x " + f.key]));
ok(() => assert.equal(fieldsFor("tier1").some(f => f.tier2), false, "Tier 1 never sees Tier 2 items"));
ok(() => assert.ok(fieldsFor("tier2").length > fieldsFor("tier1").length));
ok(() => assert.equal(new Set(KICKOFF_FIELDS.map(f => f.key)).size, KICKOFF_FIELDS.length, "unique keys"));
ok(() => assert.ok(["legal_name", "ein_status", "ein_letter", "business_address", "website"].every(k => KICKOFF_FIELDS.find(f => f.key === k)?.required), "SMS registration details are required"));
ok(() => assert.ok(!KICKOFF_FIELDS.some(f => f.key === "ein"), "the EIN is never typed in: the CP 575 / 147C letter is uploaded"));
ok(() => { const v = validateKickoff(req1, "tier1"); assert.ok("error" in v && /Upload/.test(v.error), "the EIN letter must be uploaded when they have it"); });
ok(() => assert.ok("ok" in validateKickoff(req1, "tier1", ["ein_letter"])));
ok(() => assert.ok("ok" in validateKickoff({ ...req1, ein_status: "I’m a sole proprietor without an EIN" }, "tier1"), "no letter needed without an EIN"));
ok(() => { const v = validateKickoff({ ...req1, calendar: "Made up" }, "tier1", ["ein_letter"]); assert.ok("error" in v && /calendar/.test(v.error), "a pick must be one of the options"); });
ok(() => { const { website, ...rest } = req1; const v = validateKickoff(rest, "tier1", ["ein_letter"]); assert.ok("error" in v && /Website/.test(v.error)); });
ok(() => { const v = validateKickoff({ ...req1, lead_sources: "Facebook, password: hunter2" }, "tier1", ["ein_letter"]); assert.ok("error" in v && /passwords/.test(v.error), "passwords are refused"); });
ok(() => { const v = validateKickoff({ ...req1, review_link: "g.page/x" }, "tier1", ["ein_letter"]); assert.ok("ok" in v && !("review_link" in v.ok), "Tier 2 answers are dropped for Tier 1"); });
ok(() => { const v = validateKickoff({ ...req1, notes: "y".repeat(5000) }, "tier1", ["ein_letter"]); assert.ok("ok" in v && v.ok.notes.length === 2000, "long answers are capped"); });
ok(() => assert.equal(maskEin("12-3456789"), "••-•••6789"));
ok(() => assert.equal(maskEin("none"), "none"));
ok(() => { const s = kickoffSummary({ ...req1, ein: "12-3456789" }, "tier1"); assert.ok(!s.includes("3456789"), "summary never shows the full EIN"); });
const api = readFileSync("app/api/kickoff/route.ts", "utf8");
ok(() => assert.match(api, /status = 'submitted', submitted_at = now\(\)[\s\S]*status = 'open' RETURNING/, "a checklist submits once"));
ok(() => assert.doesNotMatch(api.slice(api.lastIndexOf("sendAlert")), /answers|\.ein/, "the alert email never includes answers or the EIN"));
ok(() => assert.match(api, /'send the kickoff checklist link', 'collect the kickoff checklist'/, "submission checks off the playbook steps"));
const link = readFileSync("lib/kickoff-link.ts", "utf8");
ok(() => assert.match(link, /SET status = 'void'[\s\S]*status = 'open'/, "new links void older open links"));
ok(() => assert.match(link, /hashToken\(token\)/, "only the token hash is stored"));
ok(() => assert.match(api, /function sniff\(/, "uploads are checked by their bytes, not their name"));
ok(() => assert.match(api, /kickoff_files WHERE kickoff_id = \$\{row\.id\}::uuid AND field/, "an upload replaces that item's earlier file"));
const owner = readFileSync("app/api/kickoff/link/route.ts", "utf8");
ok(() => assert.match(owner, /stage !== "won"/, "kickoff links are only for signed clients"));
ok(() => assert.match(owner, /kickoff_files WHERE kickoff_id = [\s\S]*AND owner_id = \$\{user\.id\}/, "only the signed-in owner can open uploads"));
ok(() => assert.match(owner, /reveal === "ein"|reveal = url\.searchParams\.get\("reveal"\) === "ein"/, "EIN is masked unless asked for"));
const sign = readFileSync("app/api/sign/route.ts", "utf8");
ok(() => assert.match(sign, /kickoffUrl = await createKickoffLink/, "signing hands the client straight to the checklist"));
const site = JSON.parse(readFileSync("site/vercel.json", "utf8"));
ok(() => assert.ok(site.rewrites.some(r => r.source === "/kickoff/:token") && site.rewrites.some(r => r.source === "/api/kickoff"), "the public site proxies the checklist"));
console.log(`Kickoff checks passed (${n} assertions).`);

// Website and chat assistant clients: their own checklist (tier "web").
{
  const k = await import("./lib/kickoff.ts");
  const web = k.fieldsFor("web");
  assert.ok(web.some(f => f.key === "hero_photo" && f.kind === "file" && f.required), "web form asks for the hero photo");
  assert.ok(!web.some(f => f.key === "ein_letter" || f.key === "ein_status"), "web form never asks for an EIN");
  for (const key of web.filter(f => f.kind === "file").map(f => f.key)) assert.ok(k.FILE_KEYS.includes(key), `upload allowed: ${key}`);
  const base = { business_name: "A2 Auto Care", business_phone: "07851 786280", lead_phone: "07851 786280", open_days: "Mon; Tue", open_hours: "8:00 AM to 5:00 PM", service_area: "Edinburgh",
    prices_ok: "Yes, all correct", photos_link: "https://drive.google.com/x", brand: "Keep the black, gold and white look", lead_dest: "WhatsApp", crm: "GoHighLevel", calendar: "Google Calendar",
    booking_rules: "2 a day", domain_host: "Jimdo", gbp_manager: "Yes" };
  assert.match(k.validateKickoff(base, "web", []).error ?? "", /best photo/, "hero photo required");
  assert.ok("ok" in k.validateKickoff(base, "web", ["hero_photo"]), "complete web checklist validates");
  assert.match(k.validateKickoff({ ...base, prices_ok: k.PRICES_CHANGED }, "web", ["hero_photo"]).error ?? "", /changed/, "changed prices must be listed");
  assert.equal(k.fieldsFor("tier1").some(f => f.key === "hero_photo"), false, "plan checklists unchanged");
  console.log("Website kickoff checks passed.");
}
