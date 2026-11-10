// Autopilot: the pure parts (personal first lines, where they go, who's eligible). Tested; no I/O.

export const PERSONAL_SYSTEM = `You write one opening line for a cold email from Sam, who sets up missed-call text-back and quote follow-up for home-service businesses.
For each business you get its name, trade, city and text from its own website. Write ONE short, specific, true sentence that shows Sam looked at them, like:
"Saw you do cedar and vinyl fencing around Spartanburg." or "Noticed you offer ceramic coating and paint correction in Mesa."
Rules: only facts stated in the website text; no compliments, no "I hope", no questions, no exclamation marks, no AI talk, under 18 words.
If the text doesn't give a clear specific fact, return "" for that business.
Answer with only a JSON array of strings, one per business, in the same order.`;

export function personalPrompt(items: { company: string; niche: string; city: string; site: string }[]): string {
  return items.map((x, i) => `#${i + 1} ${x.company} (${x.niche || "contractor"}${x.city ? ", " + x.city : ""})\nWebsite text: ${x.site || "(none)"}`).join("\n\n");
}

/** Parse the model's JSON array; anything unsafe or off-shape becomes "". */
export function parseLines(text: string, n: number): string[] {
  let arr: unknown = [];
  try { arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)); } catch { arr = []; }
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const v = Array.isArray(arr) && typeof arr[i] === "string" ? (arr[i] as string).trim() : "";
    const ok = v && v.length <= 140 && !/[!?]|\bAI\b|hope|amazing|impressive|love your/i.test(v) && /[.]$/.test(v);
    out.push(ok ? v : "");
  }
  return out;
}

/** Put the personal line right after the greeting ("Hi Mark,\n\n"). No line: the template as is. */
export function insertLine(body: string, line: string): string {
  if (!line) return body;
  const m = body.match(/^(Hi[^\n]*\n\n)/);
  return m ? m[1] + line + "\n\n" + body.slice(m[1].length) : line + "\n\n" + body;
}

/** How many intros this run may send: today's goal minus what already went out, never negative. */
export function runAllowance(perDay: number, sentLast24h: number): number {
  return Math.max(0, Math.min(200, perDay) - sentLast24h);
}
