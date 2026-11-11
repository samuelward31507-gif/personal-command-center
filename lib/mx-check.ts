// Before a new cold thread: does the address's domain take mail at all? A domain with no mail server is a
// guaranteed bounce, and bounces are what rest an inbox. Free mailboxes (gmail.com etc.) always have one, so skip them.
import { resolveMx, resolve4 } from "node:dns/promises";

const FREE = /^(gmail|googlemail|yahoo|outlook|hotmail|icloud|me|aol|live|msn|comcast|att|sbcglobal|verizon|protonmail)\.(com|net)$/i;
const cache = new Map<string, boolean>();
// If DNS itself is down, every domain looks dead. Only trust a "doesn't exist" when a known domain resolves.
let dnsWorks: Promise<boolean> | null = null;
const dnsOk = () => (dnsWorks ??= resolveMx("gmail.com").then(r => r.length > 0, () => false));

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

/** false only when DNS answers clearly that the domain doesn't exist or has no mail server. Timeouts and odd errors count as fine. */
export async function domainTakesMail(email: string): Promise<boolean> {
  const domain = (email.split("@")[1] || "").trim().toLowerCase();
  if (!domain || FREE.test(domain)) return true;
  const hit = cache.get(domain); if (hit !== undefined) return hit;
  let ok = true;
  try { const mx = await withTimeout(resolveMx(domain), 3000); ok = mx.some(r => r.exchange && r.exchange !== "."); }
  catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENOTFOUND") ok = false;
    else if (code === "ENODATA") {
      // No MX record: mail falls back to the domain's own address, if it has one.
      try { ok = (await withTimeout(resolve4(domain), 3000)).length > 0; } catch (e2) { ok = (e2 as { code?: string }).code !== "ENOTFOUND" && (e2 as { code?: string }).code !== "ENODATA"; }
    }
  }
  if (!ok && !(await dnsOk())) return true;
  cache.set(domain, ok);
  return ok;
}
