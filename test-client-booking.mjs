import assert from "node:assert/strict";
const B = await import("./lib/client-booking.ts");
let h = B.parseHours("Mon-Fri 8-5");
assert.deepEqual([h.days, h.start, h.end], [[1, 2, 3, 4, 5], 8, 17]);
h = B.parseHours("Monday through Saturday, 7am to 6pm");
assert.deepEqual([h.days, h.start, h.end], [[1, 2, 3, 4, 5, 6], 7, 18]);
h = B.parseHours("");
assert.deepEqual([h.days, h.start, h.end], [[1, 2, 3, 4, 5], 8, 17]);

// Tuesday Nov 10 2026, 9:00 Denver = 16:00Z. Lead time 3h → first slot at 12:00 local or later.
const now = new Date("2026-11-10T16:00:00Z");
h = B.parseHours("Mon-Fri 8-5");
const busy = [{ start: "2026-11-10T19:00:00Z", end: "2026-11-10T20:00:00Z" }]; // 12-1 local busy
const slots = B.freeSlots(busy, h, now, { max: 6 });
assert.equal(slots.length, 6);
assert.ok(Date.parse(slots[0].start) >= now.getTime() + 3 * 3600000);
assert.ok(!slots.some(s => s.start === "2026-11-10T19:00:00.000Z"), "busy slot offered");
const perDay = {}; for (const s of slots) { const d = s.start.slice(0, 10); perDay[d] = (perDay[d] ?? 0) + 1; }
assert.ok(Object.values(perDay).every(n => n <= 2));
assert.ok(slots.every(s => { const hr = +new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", hourCycle: "h23" }).format(new Date(s.start)); return hr >= 8 && hr < 17; }));
assert.ok(!slots.some(s => [0, 6].includes(new Date(new Date(s.start).toLocaleString("en-US", { timeZone: "America/Denver" })).getDay())), "weekend offered");
assert.match(slots[0].label, /Tue|Wed/);
assert.equal(B.pickedSlot(slots[1].start, slots)?.start, slots[1].start);
assert.equal(B.pickedSlot("2026-11-10T03:00:00Z", slots), null);
assert.equal(B.pickedSlot(null, slots), null);
assert.match(B.bookingRules(slots), /"book"/);
assert.match(B.bookingRules([]), /no open estimate times/);

assert.equal(B.detectLang("Hola, necesito un presupuesto para una cerca"), "es");
assert.equal(B.detectLang("Hola"), "es");
assert.equal(B.detectLang("Hi, I need a quote for a cedar fence"), "en");
assert.equal(B.detectLang("Para when can you come"), "en");
assert.ok(B.ES.quote_1.includes("{first}") && B.ES.missed_call.includes("{business}"));

const t = B.mondayText("Ridgeline Fence", { leads: 12, answered: 12, replySec: 9, booked: 4, quotesChased: 6, openQuoteValue: 31200, won: 1, wonValue: 6840, reviews: 3 }, "https://x/portal/abc");
assert.match(t, /12 of 12 leads answered, typically in 9 sec · 4 estimates booked · 6 quotes followed up \(\$31,200 open\) · 1 won, \$6,840 · 3 review requests sent/);
assert.match(B.mondayText("X", { leads: 1, answered: 1, replySec: null, booked: 1, quotesChased: 0, openQuoteValue: 0, won: 0, wonValue: 0, reviews: 0 }, "l"), /1 of 1 lead answered · 1 estimate booked\./);

assert.deepEqual(B.parseIntake({ "First Name": "Dana", "Last Name": "Ruiz", Phone: "(720) 555-0148", Email: "d@x.com", Message: "120 ft cedar" }), { name: "Dana Ruiz", phone: "+17205550148", email: "d@x.com", message: "120 ft cedar", source: "web form" });
assert.equal(B.parseIntake({ name: "No phone" }), null);
assert.equal(B.parseIntake({ phone: "555-01" }), null);
console.log("client booking ok");
