// Copy-and-send drafts for people Sam has just talked to. Nothing here sends anything. No I/O — unit tested.

export type DraftKind = "info_text" | "info_dm" | "info_email" | "info_email_time" | "stay_in_touch";

/** The two info emails Sam picks between: more work (owners with room) or time back (owners who are slammed). */
export const INFO_EMAIL_STYLES = [{ kind: "info_email" as const, label: "More work" }, { kind: "info_email_time" as const, label: "Time back" }];
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
  const what = `anyone who calls while you're busy, or fills out your form, gets a text back in under 10 seconds and ${books} themselves`;
  const video = watchLink(i.firstName, i.company);
  switch (kind) {
    case "info_text":
      return { body: `Hey${name}, it's ${i.me}, we just talked.${pain} That's what I fix: ${what}. Here's a 40-sec video of what it looks like for ${co}: ${video}\n\nIf you want me to walk you through it, grab 15 min here: ${i.bookingLink}` };
    case "info_dm":
      return { body: `Hey${name}, ${i.me} from the call earlier, sending this so you have my info.${pain} Quick version: ${what}. 40-sec video of how it'd look for ${co}: ${video}\n\n15 min to see it live? ${i.bookingLink}` };
    case "info_email":
      return { subject: `More booked jobs for ${displayCompany(co) || co}`, body: `Hey${name},\n\nThanks for taking my call.${pain} Here's the short version of what I was talking about.\n\nMost owners I talk to aren't short on leads, they lose them: calls that come in while you're on a job, forms nobody answers until morning, quotes nobody follows up on.\n\nWhat we'd set up for ${displayCompany(co) || co}:\n- Every call you miss, plus every website form and Facebook lead, gets a text back in seconds, day or night.\n- It gives your price range and books the estimate on your calendar.\n- Every quote you send gets followed up until it's a yes or a no, without you chasing anyone.\n- You keep your number and your software.\n\nThe terms:\n- 5 booked appointments in your first 30 days, or your next month is free.\n- No contract, and you don't pay monthly until your first booked appointment lands.\n- Half-price setup for our first 3 clients.\n\nHere's a 40-second video of what your customers would see: ${video}\n\nIf it's worth 15 minutes, grab a time here: ${i.bookingLink}\n\n${i.me}\nCinder Revenue Company\ncinderrevenue.com` };
    case "info_email_time":
      return { subject: `Getting your evenings back at ${displayCompany(co) || co}`, body: `Hey${name},\n\nThanks for taking my call.${pain} Here's the short version of what I was talking about.\n\nWhen you're busy, the problem usually isn't finding work. It's everything around the work that eats your day:\n- Picking up calls on the job, or calling people back at night.\n- Texting back and forth to find a time for an estimate.\n- Driving out to estimates for people who were never going to pay your price.\n- Chasing quotes that went quiet.\n- Answering "when are you starting?" and "are you on the way?"\n\nFor most owners I talk to, that adds up to an hour or two a day, a lot of it after the crew goes home.\n\nHere's what we'd take off your plate:\n- Every call, form and Facebook message gets answered for you in seconds, in your business name.\n- People get your price range before anything is booked, so you only drive out to serious jobs.\n- Estimates land on your calendar with reminders, so you're not texting to set times.\n- Quotes get followed up until it's a yes or a no, without you chasing anyone.\n- Start dates, "crew on the way" and "job done" go out with one tap.\n\nYou still make the calls that matter: pricing and anything unusual come straight to you. Everything else is handled.\n\nSame crew, same number, same software. No contract, and you don't pay monthly until your first booked appointment lands.\n\n40-second demo: ${video}\n\nIf it's worth 15 minutes, grab a time here: ${i.bookingLink}\n\n${i.me}\nCinder Revenue Company\ncinderrevenue.com` };
    case "stay_in_touch":
      return { body: `Appreciate you taking the call${name ? "," + name : ""}. If you ever need help with anything tech, like your website, Google reviews or getting back to leads faster, just text me. ${i.me}, Cinder` };
  }
}
