// Texting rules: opt-out line on first texts, opt-outs in plain English and Spanish, the 3-a-day cap on
// automated texts, quiet hours on every scheduled send, form checkbox consent, and no link shorteners.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withOptOut, automatedRoom, isStop, isStopKeyword, isPlainOptOut, isShortener, inTextingHours, OPTOUT_TEXT, REHASH_TEXTS } from "./lib/client-runtime.ts";
import { parseLead, smsConsentFrom } from "./lib/lead-sources.ts";

let n = 0; const ok = fn => { fn(); n++; };

// Opt-out line
ok(() => assert.equal(withOptOut("Sorry we missed your call, this is Acme Fence. What can we help with?"), "Sorry we missed your call, this is Acme Fence. What can we help with? Reply STOP to opt out."));
ok(() => assert.equal(withOptOut("Hi there"), "Hi there. Reply STOP to opt out."));
ok(() => assert.equal(withOptOut("Hola, ¿qué proyecto tienes?", "es"), "Hola, ¿qué proyecto tienes?. Responde STOP para no recibir más mensajes.".replace("?.", "?")));
ok(() => assert.equal(withOptOut(REHASH_TEXTS[0]), REHASH_TEXTS[0]), "already has it");
ok(() => assert.equal(withOptOut(OPTOUT_TEXT), OPTOUT_TEXT.trim()), "opt-out confirmation is left alone");

// Opt-outs
for (const t of ["STOP", "stop.", "Unsubscribe", "cancel", "PARAR", "alto", "Basta"]) ok(() => assert.ok(isStopKeyword(t), t));
for (const t of ["please stop texting me", "wrong number", "take me off your list", "No me escribas más", "ya no me mandes mensajes", "número equivocado"]) ok(() => assert.ok(isStop(t), t));
for (const t of ["Can you stop by Tuesday?", "Para cuándo pueden venir?", "Is the gate going to stop the dog?", "don't stop the fence at the gate"]) ok(() => assert.ok(!isStop(t), t));
ok(() => assert.ok(!isPlainOptOut("")));

// 3 automated texts a day unless they're texting back
ok(() => assert.ok(automatedRoom({ outLast24h: 2, inLast24h: 0 })));
ok(() => assert.ok(!automatedRoom({ outLast24h: 3, inLast24h: 0 })));
ok(() => assert.ok(automatedRoom({ outLast24h: 6, inLast24h: 1 })));

// Quiet hours: 8 AM to 8 PM in the client's zone (Florida's window, the strictest)
ok(() => assert.ok(!inTextingHours("America/New_York", new Date("2026-11-13T12:30:00Z"))));  // 7:30 AM ET
ok(() => assert.ok(inTextingHours("America/New_York", new Date("2026-11-13T13:05:00Z"))));   // 8:05 AM ET
ok(() => assert.ok(!inTextingHours("America/New_York", new Date("2026-11-14T01:10:00Z"))));  // 8:10 PM ET

// Form checkbox
ok(() => assert.equal(smsConsentFrom({ smsconsentfield: "1", smsconsent: "yes" }), true));
ok(() => assert.equal(smsConsentFrom({ smsconsentfield: "1" }), false));
ok(() => assert.equal(smsConsentFrom({}), null));
ok(() => assert.equal(parseLead({ name: "Dana", phone: "720-555-0148", sms_consent_field: "1" }).smsConsent, false));
ok(() => assert.equal(parseLead({ name: "Dana", phone: "720-555-0148", sms_consent_field: "1", sms_consent: "on" }).smsConsent, true));
ok(() => assert.equal(parseLead({ name: "Dana", phone: "720-555-0148" }).smsConsent, null));

// Link shorteners
ok(() => assert.ok(isShortener("https://bit.ly/abc")));
ok(() => assert.ok(isShortener("tinyurl.com/x")));
ok(() => assert.ok(!isShortener("https://acmefence.com/book")));

// Every scheduled sender checks the hours and the daily cap; the first text gets the line; every form lead gets the reply.
const run = readFileSync("lib/client-runtime-run.ts", "utf8");
const fn = name => { const i = run.indexOf(`export async function ${name}(`); assert.ok(i >= 0, name); const j = run.indexOf("\nexport async function ", i + 10); return run.slice(i, j < 0 ? undefined : j); };
for (const f of ["runLeadNudges", "runQuoteFollowUps", "runDueTexts", "sendReminders", "sendReviewRequest"]) ok(() => assert.match(fn(f), /inTextingHours\(/, `${f} checks texting hours`));
for (const f of ["runLeadNudges", "runQuoteFollowUps", "runDueTexts", "runHandoffChecks"]) ok(() => assert.match(fn(f), /roomFor\(/, `${f} checks the daily cap`));
ok(() => assert.match(fn("sendToCustomer"), /withOptOut\(/));
ok(() => assert.doesNotMatch(fn("webLead"), /return \{ ok: false, threadId: t\.id \};\n  \}\n  const lang/), "every form lead gets the reply (only opted-out numbers are skipped)");
ok(() => assert.match(fn("webLead"), /opted in to promo texts/));
// Nothing else in the client runtime texts a customer without going through sendToCustomer.
ok(() => assert.equal((run.match(/sendSms\(/g) || []).length, (run.match(/sendSms\((cell|e164\(c\.setup\.owner_cell\)|e164\(phone\))/g) || []).length, "raw sendSms only to the owner or inside sendToCustomer"));

console.log(`Texting rules checks passed (${n} assertions).`);
