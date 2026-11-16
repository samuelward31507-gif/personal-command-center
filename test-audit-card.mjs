import assert from "node:assert/strict";
import { parseAuditCard } from "./lib/audit-card.ts";

const report = `## Verdict — Conditional fit, Book & Close: they pay for leads and quotes sit for days.
## Pitch — Reviews + speed to lead — 3.9★ from 11 Google reviews, none answered.
## Scorecard
- **Website:** C — loads slowly on mobile, no quote form (https://example.com)
- **Lead capture:** D — phone only, no form or booking
- **Reviews:** D — 3.9 ★ from 11 Google reviews, owner never replies
- **Online presence:** B — GBP complete, last Facebook post in March
- Competitors: Acme Fence 4.8 (220 reviews)
- Overall: C
## Call plan
- Opener: "Hey Travis, Sam with Cinder. I noticed your reviews mention slow callbacks." Meeting objective: book 15 minutes.
`;
const c = parseAuditCard(report);
assert.ok(c);
assert.deepEqual(c.areas.map(a => a.grade), ["C", "D", "D", "B"]);
assert.equal(c.rating, 3.9);
assert.equal(c.reviewCount, 11);
assert.equal(c.pitch, "Reviews + speed to lead");
assert.match(c.pitchWhy, /3\.9/);
assert.match(c.opener, /^Hey Travis/);
assert.doesNotMatch(c.areas[0].note, /https?:/);

// No Pitch line (older audits): derived from the grades. No website wins first.
const noSite = parseAuditCard(`## Verdict — Fit, Book & Close.\n## Scorecard\n- Website: F — no website found\n- Lead capture: D — phone only\n- Reviews: B — 4.7 stars, 64 reviews\n- Online presence: C — thin profile\n`);
assert.equal(noSite.pitch, "Website + speed to lead");
assert.equal(noSite.noWebsite, true);

// Nothing solid stands out: speed to lead.
const solid = parseAuditCard(`## Verdict — Fit, Book & Close.\n## Scorecard\n- Website: B — clear, has a form\n- Lead capture: B — form and phone\n- Reviews: A — 4.9 stars from 180 reviews\n- Online presence: B — active\n`);
assert.equal(solid.pitch, "Speed to lead");

// No fit: walk away.
assert.equal(parseAuditCard(`## Verdict — No fit: one-person repair shop, mostly word of mouth.\n## Scorecard\n- Website: C — ok\n`).pitch, "Walk away");
assert.equal(parseAuditCard(""), null);
console.log("audit card: passed");
