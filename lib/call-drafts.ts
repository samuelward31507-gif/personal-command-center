// Copy-and-send drafts for people Sam has just talked to. Nothing here sends anything. No I/O — unit tested.

export type DraftKind = "info_text" | "info_dm" | "info_email" | "stay_in_touch";
export type DraftInput = { firstName: string; company: string; pain?: string; me: string; bookingLink: string };

export const isPool = (company: string) => /\bpools?\b|\bspas?\b|swim|aquatic/i.test(company);

// First name for greetings; skips it when the "name" is really the company (e.g. "Tripp Fence").
export const contactFirstName = (name: string, company: string) => { const f = (name || "").trim().split(/\s+/)[0] ?? ""; return f && f.toLowerCase() !== (company || "").trim().split(/\s+/)[0]?.toLowerCase() ? f : ""; };

// Personal video page: cinderrevenue.com/watch opens with their name and shows the demo texting as their business.
export function displayCompany(company: string) {
  return (company || "").replace(/[,\s]+(llc|l\.l\.c\.|inc\.?|incorporated|co\.|corp\.?|ltd\.?)$/i, "").trim();
}
export function watchLink(firstName: string, company: string) {
  const q = new URLSearchParams();
  const n = (firstName || "").trim().slice(0, 40), b = displayCompany(company).slice(0, 40);
  if (n) q.set("n", n);
  if (b) q.set("b", b);
  const qs = q.toString();
  return "https://cinderrevenue.com/watch" + (qs ? "?" + qs : "");
}

function sentence(pain?: string) {
  const p = (pain ?? "").trim().replace(/[.!?]+$/, "");
  return p ? ` Like you said, ${p.charAt(0).toLowerCase()}${p.slice(1)}.` : "";
}

export function buildDraft(kind: DraftKind, i: DraftInput): { subject?: string; body: string } {
  const name = i.firstName ? ` ${i.firstName}` : "";
  const co = i.company || "your business";
  const pain = sentence(i.pain);
  const books = isPool(i.company) ? "books a design consult" : "books the estimate";
  const what = `anyone who calls while you're busy, or fills out your form, gets a text back within a minute and ${books} themselves`;
  const video = watchLink(i.firstName, i.company);
  switch (kind) {
    case "info_text":
      return { body: `Hey${name}, it's ${i.me}, we just talked.${pain} That's what I fix: ${what}. Here's a 40-sec video of what it looks like for ${co}: ${video}\n\nIf you want me to walk you through it, grab 15 min here: ${i.bookingLink}` };
    case "info_dm":
      return { body: `Hey${name}, ${i.me} from the call earlier, sending this so you have my info.${pain} Quick version: ${what}. 40-sec video of how it'd look for ${co}: ${video}\n\n15 min to see it live? ${i.bookingLink}` };
    case "info_email":
      return { subject: "What we talked about", body: `Hey${name},\n\nThanks for taking my call.${pain}\n\nQuick version of what I do: ${what}.\n\nI put together a 40-second video showing what your customers would see: ${video}\n\nIf you want to see how it'd work for ${co}, grab 15 minutes here: ${i.bookingLink}\n\n${i.me}\nCinder` };
    case "stay_in_touch":
      return { body: `Appreciate you taking the call${name ? "," + name : ""}. If you ever need help with anything tech, like your website, Google reviews or getting back to leads faster, just text me. ${i.me}, Cinder` };
  }
}
