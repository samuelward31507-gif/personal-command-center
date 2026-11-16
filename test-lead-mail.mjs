// Leads by email: which business an email is for, reading Angi, Thumbtack, Google, website-form and direct emails,
// forwarded copies, the Gmail forwarding confirmation, auto-replies, the business's own numbers, and the webhook signature.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { register } from "node:module";
register("./test-alias-hooks.mjs", import.meta.url);
const M = await import("./lib/lead-mail.ts");
const S = await import("./lib/lead-sources.ts");

let n = 0; const ok = fn => { fn(); n++; };
const D = "leads.cinder.test";
const KEY = "AbC123def456GHI789jk";

// ---------- Which business ----------
ok(() => assert.equal(M.mailKey([`${KEY.toLowerCase()}@${D}`], D), KEY.toLowerCase()));
ok(() => assert.equal(M.mailKey([`"Leads" <${KEY}+angi@LEADS.cinder.test>`], D), KEY.toLowerCase()));
ok(() => assert.equal(M.mailKey(["someone@gmail.com", `leads-${KEY}@${D}`], D), KEY.toLowerCase()));
ok(() => assert.equal(M.mailKey([`${KEY}@other.com`], D), null));
ok(() => assert.equal(M.mailKey([`short@${D}`], D), null));
ok(() => assert.equal(M.mailKey([`${KEY}@${D}`], ""), null));
ok(() => assert.equal(M.mailAddress(KEY, D), `${KEY.toLowerCase()}@${D}`));
ok(() => assert.deepEqual(M.addrOf('"Jane Doe" <Jane@Example.com>'), { name: "Jane Doe", addr: "jane@example.com" }));
ok(() => assert.deepEqual(M.addrOf("jane@example.com"), { name: "", addr: "jane@example.com" }));

// ---------- HTML ----------
ok(() => assert.equal(M.htmlToText("<style>x{}</style><table><tr><td>Phone</td><td>(720)&nbsp;555-0101</td></tr><tr><td>Name</td><td>Ana &amp; Luis</td></tr></table>").replace(/\n+/g, "\n"), "Phone\t(720) 555-0101\nName\tAna & Luis"));
ok(() => assert.equal(M.htmlToText("Hi<br>there<p>Second</p>&#39;ok&#x21;").replace(/\n+/g, "\n"), "Hi\nthere\nSecond\n'ok!"));

// ---------- Angi (HTML table) ----------
const angi = { from: "Angi Leads <leads@angi.com>", to: [`${KEY}@${D}`], subject: "New Lead: Fence Installation - Aurora, CO",
  html: `<html><head><title>x</title></head><body><h1>You have a new lead</h1><table>
    <tr><td>Customer Name</td><td>Maria Lopez</td></tr><tr><td>Phone</td><td>(720) 555-0142</td></tr>
    <tr><td>Email</td><td>maria.lopez@example.com</td></tr><tr><td>Task</td><td>Install a Wood Fence</td></tr>
    <tr><td>Address</td><td>1420 Elm St, Aurora, CO 80012</td></tr><tr><td>Comments</td><td>About 120 feet, backyard, cedar if possible.</td></tr>
    </table><p>Questions? Call Angi at 1-877-947-3639</p></body></html>` };
ok(() => { const r = M.readMail(angi, [], D); assert.equal(r.kind, "lead"); assert.equal(r.lead.source, "angi"); assert.equal(r.lead.via, "Angi");
  assert.equal(r.lead.phone, "+17205550142"); assert.equal(r.lead.name, "Maria Lopez"); assert.equal(r.lead.email, "maria.lopez@example.com");
  assert.match(r.lead.message, /Install a Wood Fence/); assert.match(r.lead.message, /120 feet/); assert.match(r.lead.message, /Address: 1420 Elm St/); });

// ---------- Thumbtack without a phone: kept for the owner ----------
const tt = { from: "Thumbtack <no-reply@thumbtack.com>", to: [`${KEY}@${D}`], subject: "Derek W. wants a quote for Fence Repair",
  text: "Derek W. is looking for a Fence Repair pro.\n\nProject details\nWhat needs repair?: Gate\nWhen: Within a week\n\nReply on Thumbtack to win the job.\nThumbtack, 1355 Market St, San Francisco. (415) 555-0100 is not monitored." };
ok(() => { const r = M.readMail(tt, ["4155550100"], D); assert.equal(r.kind, "no_phone"); assert.equal(r.lead.source, "thumbtack"); assert.equal(r.lead.phone, ""); assert.ok(r.lead.message.length > 0); });

// ---------- Website form, forwarded by the owner from Gmail ----------
const fwd = { from: "Mike Owner <mike@ownerfence.com>", to: [`${KEY}@${D}`], subject: "Fwd: New submission from Contact Us",
  text: `FYI\n\n---------- Forwarded message ---------\nFrom: WordPress <wordpress@ownerfence.com>\nDate: Sat, Nov 14, 2026 at 4:12 PM\nSubject: New submission from Contact Us\nTo: <mike@ownerfence.com>\n\nName: Tom Baker\nEmail: tom.baker@example.com\nPhone: 303.555.0177\nMessage: Need a quote for a 6ft privacy fence, about 80 feet.\n\n--\nMike Owner | Owner Fence Co | (303) 555-0199` };
ok(() => { const r = M.readMail(fwd, ["3035550199"], D); assert.equal(r.kind, "lead"); assert.equal(r.lead.source, "web form"); assert.equal(r.lead.phone, "+13035550177");
  assert.equal(r.lead.name, "Tom Baker"); assert.equal(r.lead.email, "tom.baker@example.com"); assert.match(r.lead.message, /privacy fence/); });

// ---------- A customer writes in directly: phone from the body, the business's own number skipped ----------
const direct = { from: "Sarah Kim <sarah.kim@example.com>", to: [`${KEY}@${D}`], subject: "Gate repair",
  text: "Hi, our gate is sagging and won't latch. Can someone come look this week? You can reach me at 720-555-0163.\n\nThanks,\nSarah\n\nOn Fri, Nov 13, 2026 at 9:00 AM Owner Fence <info@ownerfence.com> wrote:\n> Call us at (303) 555-0199" };
ok(() => { const r = M.readMail(direct, ["+13035550199"], D); assert.equal(r.kind, "lead"); assert.equal(r.lead.source, "email"); assert.equal(r.lead.via, "email");
  assert.equal(r.lead.phone, "+17205550163"); assert.equal(r.lead.email, "sarah.kim@example.com"); assert.equal(r.lead.name, "Sarah Kim");
  assert.match(r.lead.message, /gate is sagging/); assert.doesNotMatch(r.lead.message, /wrote:/); });
ok(() => { const r = M.readMail({ ...direct, text: "Hi, is this the fence company? My number is (303) 555-0199." }, ["3035550199"], D); assert.equal(r.kind, "no_phone"); assert.equal(r.lead.email, "sarah.kim@example.com"); });

// ---------- Google Local Services, reply-to carries the customer ----------
const lsa = { from: "Google Local Services <noreply-localservices@google.com>", replyTo: ["Pat Green <pat.green@example.com>"], to: [`${KEY}@${D}`], subject: "You have a new message lead",
  text: "Customer: Pat Green\nJob type: Fence repair\nLocation: Denver, CO 80205\nMessage: Two posts snapped in the wind." };
ok(() => { const r = M.readMail(lsa, [], D); assert.equal(r.kind, "no_phone"); assert.equal(r.lead.source, "google"); assert.equal(r.lead.email, "pat.green@example.com"); assert.equal(r.lead.name, "Pat Green"); assert.match(r.lead.message, /posts snapped/); });

// ---------- Toll-free numbers and fax lines are never the customer ----------
ok(() => assert.equal(M.firstPhone("Call 1-800-555-0100 or fax: 720-555-0111, or me at 720 555 0122"), "7205550122"));
ok(() => assert.equal(M.firstPhone("Order #12345678901 and 555-0100"), ""));

// ---------- Gmail forwarding confirmation: its code goes on screen ----------
const gconf = { from: "Gmail Team <forwarding-noreply@google.com>", to: [`${KEY}@${D}`], subject: "(#123456789) Gmail Forwarding Confirmation - Receive Mail from mike@ownerfence.com",
  text: "mike@ownerfence.com has requested to automatically forward mail to your email address.\nConfirmation code: 123456789\n\nTo allow, click the link below:\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ%5D-abc\n" };
ok(() => { const r = M.readMail(gconf, [], D); assert.equal(r.kind, "confirm"); assert.equal(r.code, "123456789"); assert.match(r.link, /^https:\/\/mail-settings\.google\.com\/mail\/vf-/); });

// ---------- Auto-replies, receipts, empty mail ----------
ok(() => assert.equal(M.readMail({ from: "x@example.com", to: [], subject: "Automatic reply: Fence", text: "I'm out" }).kind, "ignored"));
ok(() => assert.equal(M.readMail({ from: "x@example.com", to: [], subject: "Hi", text: "x", headers: { "Auto-Submitted": "auto-replied" } }).kind, "ignored"));
ok(() => assert.equal(M.readMail({ from: "MAILER-DAEMON@mx.example.com", to: [], subject: "Failure", text: "550" }).kind, "ignored"));
ok(() => assert.equal(M.readMail({ from: "billing@supplier.com", to: [], subject: "Your receipt from Home Depot", text: "Total $40.12" }).kind, "ignored"));
ok(() => assert.equal(M.readMail({ from: "no-reply@somewhere.com", to: [], subject: "", text: "" }).kind, "ignored"));

// ---------- Labeled fields ----------
ok(() => assert.deepEqual(M.labeledFields("Name\nJo Ray\nPhone:\n(720) 555-0101\n**Email:** jo@example.com"), { name: "Jo Ray", phone: "(720) 555-0101", email: "jo@example.com" }));
ok(() => assert.equal(M.labeledFields("Visit https://example.com/x").https, undefined));

// ---------- parseLead is unchanged by the split ----------
ok(() => { const l = S.parseLead({ name: "A B", phone: "7205550100", message: "hi" }, "angi"); assert.equal(l.phone, "+17205550100"); assert.equal(l.source, "angi"); assert.equal(l.message, "hi"); assert.equal(l.via, "Angi"); });
ok(() => assert.equal(S.parseLead({ name: "A B" }), null));
ok(() => assert.deepEqual(S.leadFields({ firstname: "Ann", lastname: "Lee", email: "a@b.co" }), { name: "Ann Lee", email: "a@b.co", message: "" }));

// ---------- The webhook signature ----------
const secret = "whsec_" + Buffer.from("super-secret-key-bytes").toString("base64");
const body = JSON.stringify({ type: "email.received", data: { email_id: "e1" } });
const now = 1794800000000, ts = String(now / 1000);
const sig = createHmac("sha256", Buffer.from("super-secret-key-bytes")).update(`msg_1.${ts}.${body}`).digest("base64");
ok(() => assert.equal(M.verifySvix(secret, "msg_1", ts, `v1,${sig}`, body, now), true));
ok(() => assert.equal(M.verifySvix(secret, "msg_1", ts, `v1,bad v1,${sig}`, body, now), true));
ok(() => assert.equal(M.verifySvix(secret, "msg_1", ts, `v1,${sig}`, body + " ", now), false));
ok(() => assert.equal(M.verifySvix(secret, "msg_2", ts, `v1,${sig}`, body, now), false));
ok(() => assert.equal(M.verifySvix(secret, "msg_1", ts, `v1,${sig}`, body, now + 10 * 60_000), false));
ok(() => assert.equal(M.verifySvix("", "msg_1", ts, `v1,${sig}`, body, now), false));

console.log(`lead mail: ${n} checks passed`);
