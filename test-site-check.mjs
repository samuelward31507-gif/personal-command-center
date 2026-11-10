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
