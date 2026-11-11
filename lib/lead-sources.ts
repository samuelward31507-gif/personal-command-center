// Leads from the places contractors pay for them: Angi (HomeAdvisor), Thumbtack, Facebook Lead Ads,
// plus anything sent through Zapier or Make. Each one posts to the client's intake link with &source=…
// The payloads differ, so they're flattened first and then matched by field name.

export type LeadSource = "web form" | "angi" | "thumbtack" | "facebook" | "zapier";
export type Lead = { name: string; phone: string; email: string; message: string; source: LeadSource; via: string };
export const SOURCE_LABEL: Record<LeadSource, string> = { "web form": "your website", angi: "Angi", thumbtack: "Thumbtack", facebook: "Facebook", zapier: "your form" };
export const PAID: LeadSource[] = ["angi", "thumbtack", "facebook"];

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
/** {customer: {phone: "…"}} → {customerphone: "…", phone: "…"}; Facebook's field_data [{name, values}] → name: value. */
export function flatten(v: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (v == null) return out;
  if (Array.isArray(v)) {
    if (v.every(x => x && typeof x === "object" && "name" in (x as object) && ("values" in (x as object) || "value" in (x as object)))) {
      for (const f of v as { name: string; values?: unknown[]; value?: unknown }[]) {
        const val = Array.isArray(f.values) ? f.values.join(", ") : String(f.value ?? "");
        const k = norm(String(f.name)); if (k && val && !(k in out)) out[k] = val;
      }
    } else v.forEach((x, i) => flatten(x, prefix + i, out));
    return out;
  }
  if (typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (x && typeof x === "object") flatten(x, prefix + norm(k), out);
      else if (x != null && String(x).trim()) {
        const full = prefix + norm(k), leaf = norm(k);
        if (!(full in out)) out[full] = String(x).trim();
        if (!(leaf in out)) out[leaf] = String(x).trim();
      }
    }
    return out;
  }
  if (prefix && String(v).trim()) out[prefix] = String(v).trim();
  return out;
}

const pick = (f: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (f[k]) return f[k]; return ""; };

export function sourceOf(v: string | null | undefined): LeadSource {
  const s = norm(v || "");
  if (/angi|homeadvisor/.test(s)) return "angi";
  if (/thumbtack/.test(s)) return "thumbtack";
  if (/facebook|fb|meta|instagram/.test(s)) return "facebook";
  if (/zapier|make|integromat/.test(s)) return "zapier";
  return "web form";
}

/** Any of the supported payloads → one lead, or null when there's no 10-digit phone to text. */
export function parseLead(body: unknown, sourceHint?: string | null): Lead | null {
  const f = flatten(body);
  const source = sourceOf(sourceHint || f.source || f.leadsource || f.platform || "");
  const raw = pick(f, "phone", "phonenumber", "phoneprimary", "primaryphone", "mobile", "mobilephone", "cell", "cellphone", "tel", "telephone",
    "customerphone", "customerphonenumber", "contactphone", "homephone", "workphone");
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").slice(-10);
  if (d.length !== 10) return null;
  const first = pick(f, "firstname", "first", "customerfirstname", "givenname"), last = pick(f, "lastname", "last", "customerlastname", "familyname");
  const name = (pick(f, "fullname", "name", "customername", "contactname", "yourname") || [first, last].filter(Boolean).join(" ")).replace(/\s+/g, " ").slice(0, 80);
  const job = pick(f, "taskname", "task", "service", "servicename", "category", "categoryname", "requesttitle", "title", "jobtype", "projecttype", "whatservicedoyouneed");
  const details = pick(f, "message", "details", "description", "requestdescription", "comments", "projectdescription", "notes", "job", "project", "whatdoyouneed", "tellusaboutyourproject");
  const addr = [pick(f, "address", "streetaddress", "address1", "street"), pick(f, "city"), pick(f, "state", "statecode"), pick(f, "zip", "zipcode", "postalcode", "postcode")].filter(Boolean).join(", ");
  const when = pick(f, "timeframe", "timeline", "when", "requestedtimeframe", "whendoyouneedit");
  const message = [job, details && details !== job ? details : "", addr ? `Address: ${addr}` : "", when ? `Timing: ${when}` : ""].filter(Boolean).join(" · ").slice(0, 1000);
  return { name, phone: "+1" + d, email: pick(f, "email", "emailaddress", "customeremail", "contactemail").slice(0, 120), message, source, via: SOURCE_LABEL[source] };
}
