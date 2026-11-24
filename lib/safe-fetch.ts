// Fetch a page a stranger typed into a public form, without letting them point us at private networks.
// Every hop (including redirects) must resolve only to public addresses. Returns "" on any problem. Never throws.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Pure: true for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
  }
  return true;
}

async function publicHost(url: URL): Promise<boolean> {
  if (!["http:", "https:"].includes(url.protocol)) return false;
  if (url.port && !["80", "443"].includes(url.port)) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return false; // a bare IP is never a business website
  try {
    const all = await lookup(host, { all: true });
    return all.length > 0 && all.every(a => !isPrivateAddress(a.address));
  } catch { return false; }
}

export async function fetchPublicPage(raw: string, timeoutMs = 8000): Promise<{ html: string; ms: number | null; finalUrl: string }> {
  const started = Date.now(), deadline = started + timeoutMs;
  let url: URL;
  try { url = new URL(raw); } catch { return { html: "", ms: null, finalUrl: raw }; }
  for (let hop = 0; hop < 5; hop++) {
    if (!(await publicHost(url))) return { html: "", ms: null, finalUrl: url.toString() };
    try {
      const r = await fetch(url, {
        redirect: "manual", signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CinderAudit/1.0; +https://cinderrevenue.com/audit)", Accept: "text/html" },
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) return { html: "", ms: null, finalUrl: url.toString() };
        url = new URL(loc, url);
        continue;
      }
      if (!r.ok || !/text\/html/i.test(r.headers.get("content-type") ?? "text/html")) return { html: "", ms: null, finalUrl: url.toString() };
      const html = (await r.text()).slice(0, 600_000);
      return { html, ms: Date.now() - started, finalUrl: url.toString() };
    } catch { return { html: "", ms: null, finalUrl: url.toString() }; }
  }
  return { html: "", ms: null, finalUrl: url.toString() };
}
