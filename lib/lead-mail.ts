// Leads by email. Each business forwards its lead emails (Angi, Thumbtack, Google, Yelp, its website form, a customer
// writing in) to <website key>@<inbound domain>. This file is the pure part: which business an email is for, what it
// says, and whether it is a lead. Nothing here sends, saves or reaches the network.
import { createHmac, timingSafeEqual } from "node:crypto";
import { leadFields, smsConsentFrom } from "@/lib/lead-sources";

export type MailIn = {
  from: string; to: string[]; subject: string; text?: string | null; html?: string | null;
  replyTo?: string[]; receivedFor?: string[]; headers?: Record<string, string>; messageId?: string;
};
export type MailLead = { name: string; phone: string; email: string; message: string; source: string; via: string; smsConsent: boolean | null };
export type MailResult =
  | { kind: "lead"; lead: MailLead }
  | { kind: "no_phone"; lead: MailLead }
  | { kind: "confirm"; code: string; link: string }
  | { kind: "ignored"; why: string };

/** Lead sites that write from their own domain, and how the app names them. */
const SITES: { key: string; via: string; re: RegExp }[] = [
  { key: "angi", via: "Angi", re: /angi\b|angieslist|homeadvisor/i },
  { key: "thumbtack", via: "Thumbtack", re: /thumbtack/i },
  { key: "google", via: "Google", re: /local ?services|google guaranteed|localservices|lsa\b/i },
  { key: "yelp", via: "Yelp", re: /yelp/i },
  { key: "houzz", via: "Houzz", re: /houzz/i },
  { key: "nextdoor", via: "Nextdoor", re: /nextdoor/i },
  { key: "bark", via: "Bark", re: /\bbark(\.com)?\b/i },
  { key: "porch", via: "Porch", re: /\bporch(\.com)?\b/i },
  { key: "networx", via: "Networx", re: /networx/i },
  { key: "facebook", via: "Facebook", re: /facebook|\bfb lead|\bmeta lead/i },
];
/** Website builders and form tools: their emails are a web form lead. */
const FORM_TOOLS = /wordpress|wpforms|gravity ?forms|elementor|contact ?form ?7|wix|squarespace|jotform|typeform|wufoo|formspree|formsubmit|godaddy|weebly|duda|hubspot|webflow|cognito ?forms|ninja ?forms|google forms|zapier|leadconnector|gohighlevel/i;
const FORM_SUBJECT = /form|submission|new (lead|inquiry|enquiry|message|request|contact)|contact us|quote request|estimate request|request a (quote|estimate)|website (lead|inquiry|message)/i;
const AUTOMATED = /^(no-?reply|do-?not-?reply|notifications?|notify|mailer(-daemon)?|wordpress|forms?|alerts?|postmaster|bounces?|leads?|support|hello|team|news(letter)?)([+._-].*)?$/i;
const TOLL_FREE = new Set(["800", "833", "844", "855", "866", "877", "888"]);

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
const digits10 = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").slice(-10);

/** "Jane Doe <jane@x.com>" → { name: "Jane Doe", addr: "jane@x.com" }. */
export function addrOf(raw: string): { name: string; addr: string } {
  const s = String(raw || "").trim();
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const addr = (m ? m[2] : s.match(/[^\s<>"]+@[^\s<>"]+/)?.[0] ?? "").trim().toLowerCase();
  const name = (m ? m[1] : "").replace(/\s+/g, " ").trim();
  return { name: name.includes("@") ? "" : name, addr };
}

/**
 * Which business an email is for: the local part of the first address at the inbound domain, without any +tag.
 * The website key is matched without regard to case (some mail systems lowercase the address).
 */
export function mailKey(addresses: string[], domain: string): string | null {
  const d = domain.trim().toLowerCase().replace(/^@/, "");
  if (!d) return null;
  for (const raw of addresses) {
    const { addr } = addrOf(raw);
    const at = addr.lastIndexOf("@");
    if (at < 1 || addr.slice(at + 1) !== d) continue;
    const local = addr.slice(0, at).split("+")[0].replace(/^leads[.-]/, "");
    if (/^[a-z0-9_-]{16,64}$/i.test(local)) return local;
  }
  return null;
}

/** The address a business forwards to. */
export const mailAddress = (key: string, domain: string) => (key && domain ? `${key.toLowerCase()}@${domain.trim().toLowerCase().replace(/^@/, "")}` : "");

const ENT: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", bull: "•" };
/** Email HTML → readable lines. Table cells become tabs so "Phone | (720) 555-0101" stays one labeled line. */
export function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<(head|style|script|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(p|div|tr|li|h[1-6]|table|section|blockquote)(\s[^>]*)?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|blockquote)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<a\s[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => (/https?:/.test(label) ? label : `${label} ${href}`))
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
      return ENT[e.toLowerCase()] ?? m;
    })
    .split("\n").map(l => l.replace(/[  ]+/g, " ").replace(/\t\s*\t+/g, "\t").replace(/^\s*\t|\t\s*$/g, "").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

const FWD = /^\s*(?:-{2,}\s*Forwarded message\s*-{2,}|Begin forwarded message:|-{2,}\s*Original Message\s*-{2,}|_{10,})\s*$/im;
/** A forwarded email: the original sender, subject and body, so the lead site is still recognized. */
export function unforward(text: string): { from: string; subject: string; body: string } | null {
  const m = FWD.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length).replace(/^\s*\n/, "");
  const lines = rest.split("\n");
  let from = "", subject = "", i = 0;
  for (; i < Math.min(lines.length, 12); i++) {
    const l = lines[i].replace(/^>\s?/, "").trim();
    if (!l) { if (from || subject) { i++; break; } continue; }
    const h = l.match(/^(From|Date|Sent|Subject|To|Cc|Reply-To)\s*:\s*(.*)$/i);
    if (!h) break;
    if (/^from$/i.test(h[1])) from = h[2].replace(/\*/g, "").trim();
    if (/^subject$/i.test(h[1])) subject = h[2].trim();
  }
  if (!from && !subject) return null;
  return { from, subject, body: lines.slice(i).map(l => l.replace(/^>\s?/, "")).join("\n").trim() };
}

/** "Label: value", "Label<tab>value", and a known label on its own line with the value on the next. */
export function labeledFields(body: string): Record<string, string> {
  const KNOWN = new Set(["name", "fullname", "firstname", "lastname", "customername", "contactname", "yourname", "customer", "phone", "phonenumber", "mobile", "mobilephone", "cell", "cellphone",
    "telephone", "tel", "primaryphone", "customerphone", "contactphone", "email", "emailaddress", "customeremail", "address", "streetaddress", "street", "city", "state", "zip", "zipcode", "postalcode",
    "service", "servicename", "servicetype", "category", "task", "taskname", "job", "jobtype", "projecttype", "project", "message", "details", "description", "comments", "projectdetails",
    "projectdescription", "notes", "timeframe", "timeline", "when", "requesteddate", "request", "howcanwehelp", "whatdoyouneed", "location"]);
  const out: Record<string, string> = {};
  const set = (label: string, value: string) => {
    let k = norm(label);
    if (k === "customer") k = "customername";
    if (k === "location") k = "address";
    if (k === "request" || k === "howcanwehelp" || k === "projectdetails") k = "details";
    if (k === "servicetype") k = "service";
    const v = value.replace(/\s+/g, " ").trim();
    if (k && v && !(k in out) && v.length <= 2000) out[k] = v;
  };
  const lines = body.split("\n").map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^\*{0,2}([A-Za-z][A-Za-z0-9 #/()'?&.-]{0,40}?)\*{0,2}\s*(?::|\t|\s[–—-]\s)\s*\*{0,2}\s*(.+)$/);
    if (m && !/^https?$/i.test(m[1].trim()) && (KNOWN.has(norm(m[1])) || norm(m[1]).length <= 24)) { set(m[1], m[2]); continue; }
    const only = l.match(/^\*{0,2}([A-Za-z][A-Za-z0-9 #/()'?&.-]{0,40}?)\*{0,2}\s*:?$/);
    if (only && KNOWN.has(norm(only[1])) && lines[i + 1] && !KNOWN.has(norm(lines[i + 1].replace(/:$/, "")))) { set(only[1], lines[i + 1]); i++; }
  }
  return out;
}

/** The first phone number in the text that isn't toll-free (lead sites' own lines) or one of the business's own. */
export function firstPhone(text: string, exclude: string[] = []): string {
  const skip = new Set(exclude.map(digits10).filter(d => d.length === 10));
  const re = /(?<![\d#])(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})(?!\d)/g;
  for (let m; (m = re.exec(text));) {
    const before = text.slice(Math.max(0, m.index - 8), m.index).toLowerCase();
    if (/fax/.test(before)) continue;
    const d = m[1] + m[2] + m[3];
    if (TOLL_FREE.has(m[1]) || skip.has(d)) continue;
    return d;
  }
  return "";
}

const isAutomated = (addr: string) => { const local = addr.split("@")[0] || ""; return !addr || AUTOMATED.test(local) || SITES.some(s => s.re.test(addr.split("@")[1] || "")); };

/** The body a person wrote, without the signature, quoted reply or "Sent from my iPhone". */
function ownWords(body: string): string {
  const out: string[] = [];
  for (const l of body.split("\n")) {
    if (/^--\s*$/.test(l) || /^On .{4,80}wrote:\s*$/.test(l) || /^Sent from my /i.test(l) || /^>/.test(l)) break;
    out.push(l);
  }
  return out.join("\n").replace(/\s+/g, " ").trim().slice(0, 600);
}

/**
 * One email → a lead (it has a phone), a lead without a phone (the owner adds it), a forwarding confirmation (its code
 * goes on screen so the owner can finish setting up forwarding), or nothing.
 * `exclude` holds the business's own numbers so its signature or the Cinder number is never read as the customer.
 */
export function readMail(mail: MailIn, exclude: string[] = [], inboundDomain = ""): MailResult {
  const subject0 = String(mail.subject || "").trim();
  const text = (mail.text && mail.text.trim()) ? mail.text.replace(/\r\n?/g, "\n") : htmlToText(mail.html || "");
  const sender = addrOf(mail.from);
  const h = Object.fromEntries(Object.entries(mail.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));

  // Gmail (and others) send a confirmation to a new forwarding address. Show its code instead of dropping it.
  if (/forwarding-noreply@google\.com/.test(sender.addr) || /forwarding confirmation/i.test(subject0) || (/forward/i.test(subject0) && /(confirm|verif)/i.test(subject0))) {
    const code = text.match(/confirmation code:?\s*(\d{6,12})/i)?.[1] ?? text.match(/\b(\d{9})\b/)?.[1] ?? "";
    const link = text.match(/https:\/\/(?:mail(?:-settings)?\.google\.com|isolated\.mail\.google\.com)\/[^\s<>")\]]+/)?.[0] ?? text.match(/https:\/\/[^\s<>")\]]*(?:confirm|verif)[^\s<>")\]]*/i)?.[0] ?? "";
    return { kind: "confirm", code, link };
  }
  if (/^(auto|out of office|automatic reply|autoreply|undeliverable|delivery status|mail delivery|returned mail)/i.test(subject0.replace(/^(re|fw|fwd):\s*/i, ""))
    || (h["auto-submitted"] && h["auto-submitted"] !== "no") || /mailer-daemon|postmaster/i.test(sender.addr)) return { kind: "ignored", why: "An automatic reply" };

  // Forwarded by the owner: read the original.
  const fwd = unforward(text);
  const orig = fwd ? addrOf(fwd.from) : sender;
  const subject = (fwd?.subject || subject0).replace(/^((re|fw|fwd):\s*)+/i, "").trim();
  const body = fwd ? fwd.body : text;
  const who = `${orig.name} ${orig.addr} ${subject}`;
  const site = SITES.find(s => s.re.test(orig.addr.split("@")[1] || "") || s.re.test(orig.name) || s.re.test(subject));
  const source = site?.key ?? (FORM_TOOLS.test(who) || FORM_SUBJECT.test(subject) ? "web form" : "email");
  const via = site?.via ?? (source === "web form" ? "your website" : "email");
  if (!site && /^(newsletter|unsubscribe|your (receipt|invoice|order|statement)|invoice|receipt|order confirmation|payment)/i.test(subject)) return { kind: "ignored", why: "Not a lead" };

  const f = labeledFields(body);
  const base = leadFields(f);
  const phoneRaw = f.phone || f.phonenumber || f.mobile || f.mobilephone || f.cell || f.cellphone || f.telephone || f.tel || f.primaryphone || f.customerphone || f.contactphone || "";
  let phone = digits10(phoneRaw);
  if (phone.length !== 10 || exclude.map(digits10).includes(phone)) phone = firstPhone(body, exclude);
  // Lead sites often put the number only in a tap-to-call link or the subject line ("New lead from Dana, 720-555-0148").
  if (!phone && mail.html) { const tel = [...mail.html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => digits10(m[1])).find(d => d.length === 10 && !exclude.map(digits10).includes(d)); if (tel) phone = tel; }
  if (!phone) phone = firstPhone(subject, exclude);

  const domain = inboundDomain.trim().toLowerCase();
  const usable = (a: string) => !!a && !isAutomated(a) && !(domain && a.endsWith("@" + domain));
  const replyTo = (mail.replyTo ?? []).map(r => addrOf(r)).find(r => usable(r.addr));
  const direct = source === "email" && usable(orig.addr) ? orig : null;
  const email = (base.email && /@/.test(base.email) ? base.email.toLowerCase() : "") || replyTo?.addr || direct?.addr || "";
  const name = base.name || (replyTo && replyTo.addr === email ? replyTo.name : "") || (direct && direct.addr === email ? direct.name : "");
  const message = base.message || (source === "email" || source === "web form" ? ownWords(body) : "") || subject.slice(0, 200);

  const lead: MailLead = { name: name.slice(0, 80), phone: phone ? "+1" + phone : "", email: email.slice(0, 120), message: message.slice(0, 1000), source, via, smsConsent: smsConsentFrom(f) };
  if (lead.phone) return { kind: "lead", lead };
  if (lead.name || lead.email || (site && lead.message)) return { kind: "no_phone", lead };
  return { kind: "ignored", why: "No name, phone or email in it" };
}

/** Resend signs its webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body", base64, with the whsec_ secret. */
export function verifySvix(secret: string, id: string, timestamp: string, signature: string, body: string, now = Date.now()): boolean {
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  let key: Buffer;
  try { key = Buffer.from(secret.replace(/^whsec_/, ""), "base64"); } catch { return false; }
  const want = Buffer.from(createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64"));
  return signature.split(" ").some(part => {
    const [v, sig] = part.split(",");
    if (v !== "v1" || !sig) return false;
    const got = Buffer.from(sig);
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

// ---------- Two-way email: replies to a customer email land on that customer's record ----------
const replySig = (threadHex: string, secret: string) => createHmac("sha256", secret).update("reply:" + threadHex).digest("hex").slice(0, 12);
/** The reply-to for an email to one customer: r-<thread>-<signature>@<inbound domain>. Signed, so it can't be guessed or forged. */
export function replyAddress(threadId: string, secret: string, domain: string): string {
  const hex = String(threadId).toLowerCase().replace(/-/g, "");
  const d = domain.trim().toLowerCase().replace(/^@/, "");
  if (!/^[0-9a-f]{32}$/.test(hex) || !secret || !d) return "";
  return `r-${hex}-${replySig(hex, secret)}@${d}`;
}
/** The customer record a reply is for, or null when no address is a valid signed reply address at this domain. */
export function replyThread(addresses: string[], secret: string, domain: string): string | null {
  const d = domain.trim().toLowerCase().replace(/^@/, "");
  if (!secret || !d) return null;
  for (const raw of addresses) {
    const { addr } = addrOf(raw);
    const m = addr.match(/^r-([0-9a-f]{32})-([0-9a-f]{12})(?:\+[^@]*)?@(.+)$/);
    if (!m || m[3] !== d) continue;
    const want = Buffer.from(replySig(m[1], secret)), got = Buffer.from(m[2]);
    if (want.length === got.length && timingSafeEqual(want, got)) return `${m[1].slice(0, 8)}-${m[1].slice(8, 12)}-${m[1].slice(12, 16)}-${m[1].slice(16, 20)}-${m[1].slice(20)}`;
  }
  return null;
}
/** What the customer wrote, without the quoted email under it, the signature or "Sent from my iPhone". */
export function replyText(text: string): string {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n"), out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], t = l.trim();
    if (/^>/.test(t) || /^--\s*$/.test(l) || /^_{8,}$/.test(t) || /^-{2,}\s*(Original|Forwarded) Message/i.test(t) || /^Sent from my /i.test(t) || /^Get Outlook for /i.test(t)) break;
    if (/^On .{4,200}wrote:\s*$/i.test(t)) break;
    if (/^On .{4,200}$/i.test(t) && /wrote:\s*$/i.test((lines[i + 1] ?? "").trim())) break;
    if (/^From:\s.+/i.test(t) && /^(Sent|Date):\s/i.test((lines[i + 1] ?? "").trim())) break;
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2000);
}
