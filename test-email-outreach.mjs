import assert from "node:assert/strict";
import { DEFAULT_LINKEDIN, CONNECT_NOTE_LIMIT } from "./lib/linkedin-outreach.ts";
import { greetName, mergeFor, fillTemplate, DEFAULT_TEMPLATES, DETAILING_TEMPLATES, trackOf, cityOf, dueFollowUps, dueContacts } from "./lib/email-outreach.ts";
let n = 0; const ok = f => { f(); n++; };
ok(() => assert.equal(greetName("Mark Delgado", "Ridgeline Fence"), "Mark"));
ok(() => assert.equal(greetName("Foster Fence", "Foster Fence"), "there", "company as name greets 'there'"));
ok(() => assert.equal(greetName("All Star Fence LLC", ""), "there"));
ok(() => assert.equal(greetName("", "X"), "there"));
ok(() => assert.equal(greetName("wenzfenceohio", "wenzfenceohio"), "there"));
ok(() => assert.equal(cityOf("Houston, TX"), "Houston"));
const ws = { ownerFirstName: "Sam", businessName: "Cinder Revenue Company", bookingLink: "https://cal.com/x", websiteUrl: "https://cinderrevenue.com/", demoLink: "https://cinderrevenue.com/demo" };
const m = mergeFor({ name: "Foster Fence", company: "Foster Fence", location: "Houston, TX" }, ws);
const s = fillTemplate(DEFAULT_TEMPLATES.intro.subject, m), b = fillTemplate(DEFAULT_TEMPLATES.intro.body, m);
ok(() => assert.equal(s, "missed calls at Foster Fence"));
ok(() => assert.match(b, /^Hi there,/));
ok(() => assert.doesNotMatch(b, /https?:\/\//, "no clickable http link in the first email"));
ok(() => assert.match(b, /\ncinderrevenue\.com$/, "first email signs with the bare domain"));
ok(() => assert.match(fillTemplate(DEFAULT_TEMPLATES.follow_up.body, m), /cinderrevenue\.com\/demo/));
ok(() => assert.match(fillTemplate(DEFAULT_TEMPLATES.follow_up.body, m), /https:\/\/cal\.com\/x/));
ok(() => assert.equal(fillTemplate(DEFAULT_TEMPLATES.breakup.subject, m), fillTemplate(DEFAULT_TEMPLATES.follow_up.subject, m), "every step stays in one thread"));
ok(() => assert.doesNotMatch(b, /\{\w+\}/, "every fill-in is filled"));
ok(() => assert.equal(fillTemplate("Hi {nope}", m), "Hi {nope}", "typos stay visible"));
for (const k of Object.keys(DEFAULT_TEMPLATES)) ok(() => assert.doesNotMatch(fillTemplate(DEFAULT_TEMPLATES[k].body, m), /\{\w+\}/, k));
ok(() => assert.ok(fillTemplate(DEFAULT_LINKEDIN.connect, mergeFor({ name: "Christopher Montgomery", company: "Montgomery Premium Fence & Deck Builders of North Texas", location: "Dallas, TX" }, ws)).length <= CONNECT_NOTE_LIMIT, "connection note fits LinkedIn's limit"));
for (const k of Object.keys(DEFAULT_LINKEDIN)) ok(() => assert.doesNotMatch(fillTemplate(DEFAULT_LINKEDIN[k], m), /\{\w+\}/, k));
ok(() => assert.equal(trackOf("Auto detailing"), "detailing"));
ok(() => assert.equal(trackOf("Fence"), "trades"));
ok(() => assert.equal(trackOf(undefined), "trades"));
for (const k of Object.keys(DETAILING_TEMPLATES)) ok(() => assert.doesNotMatch(fillTemplate(DETAILING_TEMPLATES[k].body, m) + fillTemplate(DETAILING_TEMPLATES[k].subject, m), /\{\w+\}|crew|quote/i, "detailing " + k));
ok(() => assert.doesNotMatch(fillTemplate(DETAILING_TEMPLATES.intro.body, m), /https?:\/\//, "no link in the detailer first email"));
const D = 86400000, T0 = Date.parse("2026-11-09T12:00:00Z");
const log = [
  { contactId: "a", step: "intro", at: new Date(T0 - 4 * D).toISOString() },
  { contactId: "b", step: "intro", at: new Date(T0 - 1 * D).toISOString() },
  { contactId: "c", step: "intro", at: new Date(T0 - 9 * D).toISOString() }, { contactId: "c", step: "follow_up", at: new Date(T0 - 5 * D).toISOString() },
  { contactId: "d", step: "intro", at: new Date(T0 - 6 * D).toISOString() },
];
ok(() => assert.deepEqual(dueFollowUps(log, [{ contactId: "d" }], T0), { follow_up: 1, breakup: 1 }, "a due, b too soon, c last try, d replied"));
ok(() => assert.deepEqual(dueContacts(log, [{ contactId: "d" }], T0).map(x => x.contactId + ":" + x.step), ["c:breakup", "a:follow_up"], "oldest waiting first"));
console.log(`Email outreach checks passed (${n} assertions).`);
