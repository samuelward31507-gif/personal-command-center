// Website email finder: picks the business's own address, skips page-code junk.
import assert from "node:assert/strict";
import { emailsIn, pickEmail, contactPages, siteDomain } from "./lib/email-finder.ts";
let n = 0; const ok = f => { f(); n++; };
const html = `<a href="mailto:Info@JCFence.com">Email us</a> <img src="logo@2x.png"> 1a2b3c4d5e6f7a8b9c@sentry.io user@domain.com mike&#64;jcfence.com <a href="/contact-us">Contact</a> <a href="https://other.com/contact">x</a>`;
ok(() => assert.equal(siteDomain("www.jcfence.com/"), "jcfence.com"));
ok(() => assert.deepEqual(emailsIn(html), ["info@jcfence.com", "mike@jcfence.com"]));
ok(() => assert.equal(pickEmail(emailsIn(html), "https://www.jcfence.com"), "info@jcfence.com", "own domain, info@ first"));
ok(() => assert.equal(pickEmail(["bob@gmail.com", "x@wixpress.com"], "https://bobsfence.com"), "bob@gmail.com", "free mailbox when no own-domain address"));
ok(() => assert.equal(pickEmail(["sales@someagency.com"], "https://bobsfence.com"), "", "someone else's domain is not trusted"));
ok(() => assert.deepEqual(contactPages(html, "https://www.jcfence.com"), ["https://www.jcfence.com/contact-us"], "same-site contact pages only"));
console.log(`Email finder checks passed (${n} assertions).`);
