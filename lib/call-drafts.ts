// Copy-and-send drafts for people Sam has just talked to. Nothing here sends anything. No I/O — unit tested.

export type DraftKind = "info_text" | "info_dm" | "info_email" | "stay_in_touch";
export type DraftInput = { firstName: string; company: string; pain?: string; me: string; bookingLink: string };

export const isPool = (company: string) => /\bpools?\b|\bspas?\b|swim|aquatic/i.test(company);

function sentence(pain?: string) {
  const p = (pain ?? "").trim().replace(/[.!?]+$/, "");
  return p ? ` Like you said, ${p.charAt(0).toLowerCase()}${p.slice(1)}.` : "";
}

export function buildDraft(kind: DraftKind, i: DraftInput): { subject?: string; body: string } {
  const hi = i.firstName ? `Hey ${i.firstName}` : "Hey";
  const co = i.company || "your business";
  const how = isPool(i.company)
    ? "every lead gets a text back within a minute, screened for budget and fit, and the design consult booked on your calendar."
    : "every lead, whether it's a missed call, a website form or a Facebook ad, gets a text back within a minute and the estimate booked on your calendar.";
  switch (kind) {
    case "info_text":
      return { body: `${hi}, ${i.me} with Cinder. Good talking just now.${sentence(i.pain)} Here's the short version: ${how} Grab 15 min and I'll show you how it'd work for ${co}: ${i.bookingLink}` };
    case "info_dm":
      return { body: `${hi}, ${i.me} from Cinder, we just talked on the phone.${sentence(i.pain)} Whoever texts back first usually gets the job, and that's what I set up: ${how} Grab 15 min and I'll show you how it'd work for ${co}: ${i.bookingLink}` };
    case "info_email":
      return { subject: `${co} + Cinder`, body: `${hi},\n\nGood talking just now.${sentence(i.pain)}\n\nHere's the short version: ${how}\n\nGrab 15 minutes and I'll show you exactly how it'd work for ${co}: ${i.bookingLink}\n\n${i.me}\nCinder Revenue Company` };
    case "stay_in_touch":
      return { body: `${hi}, ${i.me} with Cinder. Appreciate the time. Save my number: I build AI systems for contractors, like texting leads back, booking estimates, Google reviews and websites. If anything ever needs fixing, text me.` };
  }
}
