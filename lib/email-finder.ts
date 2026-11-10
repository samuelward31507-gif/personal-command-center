// Pulls a business email out of a contractor's own website HTML. Pure: no I/O, so it can be tested.
// Prefers an address on the site's own domain, then a common mailbox (Gmail, Yahoo, Outlook...). Skips
// junk that shows up in page code (image names, tracking, website builders, placeholders).

const JUNK_DOMAINS = /(^|\.)(sentry\.io|wixpress\.com|wix\.com|squarespace\.com|godaddy\.com|example\.com|domain\.com|email\.com|yourdomain\.com|sentry-next\.wixpress\.com|googleusercontent\.com|cloudflare\.com|w3\.org|schema\.org|jquery\.com|wordpress\.org|gravatar\.com|weebly\.com|duda\.co|mysite\.com|test\.com)$/i;
const JUNK_LOCAL = /^(noreply|no-reply|donotreply|privacy|abuse|webmaster|postmaster|user|name|your|you|email|test|example|filler)$/i;
const FREE = /(^|\.)(gmail|yahoo|outlook|hotmail|icloud|aol|live|msn|comcast|att|sbcglobal|verizon|protonmail)\.(com|net)$/i;

export function siteDomain(website: string): string {
  try { return new URL(/^https?:\/\//i.test(website) ? website : "https://" + website).hostname.replace(/^www\./i, "").toLowerCase(); } catch { return ""; }
}

export function emailsIn(html: string): string[] {
  const text = html
    .replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, "@").replace(/&#46;|\[dot\]|\(dot\)/gi, ".")
    .replace(/%40/g, "@");
  const found = text.match(/[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}/gi) ?? [];
  const out: string[] = [];
  for (const raw of found) {
    const e = raw.toLowerCase().replace(/^mailto:/, "").replace(/[.)]+$/, "");
    const [local, domain] = e.split("@");
    if (!local || !domain || JUNK_DOMAINS.test(domain) || JUNK_LOCAL.test(local)) continue;
    if (/\.(png|jpe?g|gif|webp|svg|css|js|ico)$/i.test(domain) || /^[0-9a-f]{16,}$/.test(local)) continue;
    if (!out.includes(e)) out.push(e);
  }
  return out;
}

/** Best email for this business, or "" if none is trustworthy. */
export function pickEmail(found: string[], website: string): string {
  const dom = siteDomain(website);
  const own = found.filter(e => dom && (e.endsWith("@" + dom) || e.split("@")[1].endsWith("." + dom)));
  const rank = (e: string) => (/^(info|office|contact|hello|sales|estimates?|quotes?|admin)@/.test(e) ? 1 : 0);
  if (own.length) return own.sort((a, b) => rank(b) - rank(a))[0];
  const free = found.filter(e => FREE.test(e.split("@")[1]));
  return free[0] ?? "";
}

/** Contact-page links on the homepage, same site only, at most 2. */
export function contactPages(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const href = m[1];
    if (!/contact|about|quote|estimate/i.test(href)) continue;
    try { const u = new URL(href, base); if (siteDomain(u.href) === siteDomain(base) && !out.includes(u.href)) out.push(u.href); } catch { /* bad link */ }
    if (out.length >= 2) break;
  }
  return out;
}
