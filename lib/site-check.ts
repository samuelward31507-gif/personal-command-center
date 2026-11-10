// A direct look at a business's own homepage before the audit: speed, mobile, how a homeowner can reach them,
// and what's missing. These are VERIFIED observations (we fetched the page), handed to the audit model.

export type SiteCheck = {
  reached: boolean; https: boolean; ms: number | null; title: string; description: string;
  mobile: boolean; tapToCall: boolean; phoneShown: boolean; form: boolean; booking: string; chat: string; textUs: boolean;
  financing: boolean; pricing: boolean; reviewsShown: boolean; serviceArea: boolean; copyrightYear: number | null; socials: string[]; words: number;
};

const BOOKING = [["calendly", "Calendly"], ["cal.com", "Cal.com"], ["housecallpro", "Housecall Pro"], ["getjobber|jobber.com", "Jobber"], ["servicetitan", "ServiceTitan"], ["acuityscheduling", "Acuity"], ["square.site|squareup.com/appointments", "Square"], ["schedulicity|vagaro|booksy|urable", "booking app"]] as const;
const CHAT = [["podium", "Podium"], ["birdeye", "Birdeye"], ["intercom", "Intercom"], ["tawk.to", "Tawk"], ["drift", "Drift"], ["livechat", "LiveChat"], ["hubspot", "HubSpot chat"], ["leadconnector|msgsndr|gohighlevel", "GoHighLevel"], ["tidio", "Tidio"]] as const;

/** Pure: read what the homepage HTML shows. */
export function readSite(html: string, url: string, ms: number | null): SiteCheck {
  const h = html.toLowerCase(), text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&copy;/g, "©").replace(/\s+/g, " ").trim();
  const find = (list: readonly (readonly [string, string])[]) => list.find(([re]) => new RegExp(re).test(h))?.[1] ?? "";
  const years = [...text.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map(m => Number(m[1]));
  const socials = ["facebook.com", "instagram.com", "youtube.com", "tiktok.com", "linkedin.com", "nextdoor.com", "yelp.com", "angi.com", "homeadvisor.com", "thumbtack.com", "bbb.org"].filter(s => h.includes(s)).map(s => s.replace(".com", "").replace(".org", ""));
  return {
    reached: html.length > 200, https: /^https:/i.test(url), ms,
    title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    description: (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? "").slice(0, 200),
    mobile: /<meta[^>]+name=["']viewport["']/i.test(html), tapToCall: /href=["']tel:/i.test(html),
    phoneShown: /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(text), form: /<form[\s>]/i.test(html) || /jotform|typeform|wufoo|gravityforms|wpforms|formspree/.test(h),
    booking: find(BOOKING), chat: find(CHAT), textUs: /href=["']sms:|text us|text (?:us )?now/i.test(html),
    financing: /financing|finance options|payment plans?|hearth|greensky|wisetack/i.test(text), pricing: /\$\s?\d{2,}|per (?:foot|linear foot|sq\.? ?ft)|starting at/i.test(text),
    reviewsShown: /reviews?|testimonials?|stars?/i.test(text), serviceArea: /service area|areas we serve|serving|proudly serv/i.test(text),
    copyrightYear: years.length ? Math.max(...years) : null, socials, words: text.split(/\s+/).length,
  };
}

/** The check as plain lines for the audit prompt. */
export function siteCheckLines(c: SiteCheck | null, nowYear = new Date().getFullYear()): string {
  if (!c) return "";
  if (!c.reached) return "Automated website check: the homepage could not be loaded (down, blocking bots, or wrong URL). Verify it yourself.";
  const yes = (b: boolean) => (b ? "yes" : "no");
  return [
    "Automated website check (we fetched the homepage; treat these as VERIFIED observations of that page only):",
    `- Loads over https: ${yes(c.https)}; time to load the HTML: ${c.ms !== null ? (c.ms / 1000).toFixed(1) + "s" : "unknown"}`,
    `- Title: "${c.title}"${c.description ? `; description: "${c.description}"` : "; no meta description"}`,
    `- Mobile viewport tag: ${yes(c.mobile)}; tap-to-call link: ${yes(c.tapToCall)}; phone number shown: ${yes(c.phoneShown)}`,
    `- Quote/contact form: ${yes(c.form)}; online booking: ${c.booking || "none found"}; chat or text widget: ${c.chat || (c.textUs ? "text-us link" : "none found")}`,
    `- Mentions pricing: ${yes(c.pricing)}; financing: ${yes(c.financing)}; reviews/testimonials: ${yes(c.reviewsShown)}; service area: ${yes(c.serviceArea)}`,
    `- Copyright year: ${c.copyrightYear ?? "none"}${c.copyrightYear && c.copyrightYear < nowYear - 1 ? " (site may be stale)" : ""}; links to: ${c.socials.join(", ") || "no social or review profiles"}; about ${c.words} words of text`,
  ].join("\n");
}

/**
 * Findings for a free audit, written to the owner, only from what the homepage actually shows.
 * Nothing here guesses at things we can't see from outside (like whether missed calls get a text back).
 * Most important first, at most 4. An empty list means the site is in good shape: send no audit.
 */
export function autoFindings(c: SiteCheck, year: number): string[] {
  if (!c.reached) return [];
  const out: string[] = [];
  if (!c.booking) out.push("There's no way to book an estimate on your website, so every inquiry has to wait for a call back.");
  if (!c.chat && !c.textUs) out.push("Your site has no way to text or chat, so someone looking at 9pm has to call or fill out a form and wait.");
  if (!c.mobile) out.push("Your website isn't set up for phones, and most homeowners will open it on one.");
  else if (!c.tapToCall) out.push("On a phone, your number isn't tap-to-call, so people have to copy it by hand to reach you.");
  if (c.ms !== null && c.ms > 4000) out.push(`Your homepage took about ${Math.round(c.ms / 1000)} seconds to load. People start leaving after about 3.`);
  if (!c.https) out.push("Your website isn't secure (no https), so some browsers warn visitors before they reach it.");
  if (!c.reviewsShown) out.push("Your homepage doesn't show any reviews, so a first-time visitor has nothing to go on.");
  if (c.copyrightYear !== null && c.copyrightYear < year - 1) out.push(`Your website footer still says ${c.copyrightYear}, which makes the site look unattended.`);
  return out.slice(0, 4);
}

/** Puts the audit line just above the sign-off. */
export function withAuditLine(body: string, company: string, link: string): string {
  const line = `I also put together a quick free audit of ${company}'s website, from a customer's side: ${link}`;
  const m = body.match(/\n\n([^\n]+)\s*$/);
  return m ? body.slice(0, m.index) + "\n\n" + line + "\n\n" + m[1] : body + "\n\n" + line;
}
