// Website check used by business audits: reads what a homeowner can actually do on the homepage.
import assert from "node:assert/strict";
import { readSite, siteCheckLines } from "./lib/site-check.ts";
let n = 0; const ok = f => { f(); n++; };
const html = `<html><head><title>JC Fence | Austin Fence Company</title><meta name="viewport" content="width=device-width"></head><body>
<a href="tel:5125550100">(512) 555-0100</a><form action="/quote"></form><p>Serving Austin and Round Rock. Cedar fences starting at $28 per foot. Financing available.</p>
<script src="https://widgets.podium.com/x.js"></script><a href="https://facebook.com/jcfence">fb</a><p>© 2021 JC Fence</p></body></html>`;
const c = readSite(html, "https://jcfence.com", 800);
ok(() => assert.equal(c.mobile, true)); ok(() => assert.equal(c.tapToCall, true)); ok(() => assert.equal(c.form, true));
ok(() => assert.equal(c.chat, "Podium")); ok(() => assert.equal(c.booking, "")); ok(() => assert.equal(c.pricing, true)); ok(() => assert.equal(c.financing, true));
ok(() => assert.equal(c.copyrightYear, 2021)); ok(() => assert.deepEqual(c.socials, ["facebook"]));
const lines = siteCheckLines(c, 2026);
ok(() => assert.match(lines, /site may be stale/)); ok(() => assert.match(lines, /online booking: none found/)); ok(() => assert.match(lines, /0\.8s/));
ok(() => assert.match(siteCheckLines(readSite("", "https://x.com", null)), /could not be loaded/));
console.log(`Site check passed (${n} assertions).`);

{
  const { autoFindings, withAuditLine, readSite } = await import("./lib/site-check.ts");
  const assert = (await import("node:assert/strict")).default;
  const bare = readSite("<html><head><title>Acme Fence</title></head><body>" + "Fences built right. ".repeat(20) + " © 2020 Acme</body></html>", "http://acme.com", 5200);
  const f = autoFindings(bare, 2026);
  assert.equal(f.length, 4, "capped at 4");
  assert.match(f[0], /book an estimate/);
  assert.ok(f.some(x => /text or chat/.test(x)));
  const good = readSite('<html><head><meta name="viewport" content="x"></head><body><a href="tel:1">call</a><a href="sms:1">Text us</a> calendly reviews ★★★★★ © 2026' + " word".repeat(200) + "</body></html>", "https://good.com", 900);
  assert.deepEqual(autoFindings(good, 2026), [], "a good site gets no audit");
  assert.deepEqual(autoFindings(readSite("", "https://x.com", null), 2026), [], "unreachable site gets no audit");
  const body = withAuditLine("Hi Joe,\n\nFollowing up.\n\nSam", "Acme", "https://x/report/t");
  assert.equal(body, "Hi Joe,\n\nFollowing up.\n\nI also put together a quick free audit of Acme's website, from a customer's side: https://x/report/t\n\nSam");
  console.log("Free audit checks passed (6 assertions).");
}
