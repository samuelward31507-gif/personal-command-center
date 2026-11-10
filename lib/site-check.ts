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
