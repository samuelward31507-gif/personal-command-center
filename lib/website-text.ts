// Fetch a contractor's own website and turn it into plain text (for the email finder and Autopilot's first line).

export async function fetchPage(url: string, timeoutMs = 7000): Promise<string> {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", Accept: "text/html" } });
    if (!r.ok || !/text\/html/i.test(r.headers.get("content-type") ?? "text/html")) return "";
    return (await r.text()).slice(0, 600_000);
  } catch { return ""; }
}

export function htmlToText(html: string, max = 1800): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? "";
  const body = html.replace(/<title[\s\S]*?<\/title>|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  return [title, desc, body].filter(Boolean).join(" | ").slice(0, max);
}
