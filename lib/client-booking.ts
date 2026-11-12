// Booking, reminders, language and the owner's Monday text for the client runtime. Pure: no I/O.
// The site promises: estimates booked on the owner's calendar, a reminder the day before, a rebooking text
// after a no-show, English or Spanish, and a Monday text report. This is the logic behind each.

export type Busy = { start: string; end: string };
export type Hours = { tz: string; days: number[]; start: number; end: number; slotMin: number; leadHours: number };
export type Slot = { start: string; end: string; label: string };

/** "Mon-Fri 8-5" style hours from the setup sheet, with safe defaults. Days: 0 = Sunday … 6 = Saturday. */
export function parseHours(text: string | undefined, tz = "America/Denver", slotMin = 60): Hours {
  const t = (text || "").toLowerCase();
  const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  let days = [1, 2, 3, 4, 5];
  const range = t.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*(?:-|–|to|through)\s*(sun|mon|tue|wed|thu|fri|sat)/);
  if (range) { const a = names.indexOf(range[1]), b = names.indexOf(range[2]); days = []; for (let i = a; ; i = (i + 1) % 7) { days.push(i); if (i === b) break; } }
  let start = 8, end = 17;
  const hrs = t.match(/(\d{1,2})(?::\d{2})?\s*(am|a\.m\.|pm|p\.m\.)?\s*(?:-|–|to)\s*(\d{1,2})(?::\d{2})?\s*(am|a\.m\.|pm|p\.m\.)?/);
  if (hrs) {
    const h = (n: string, ap?: string) => { let v = +n; if (ap?.startsWith("p") && v < 12) v += 12; else if (ap?.startsWith("a") && v === 12) v = 0; else if (!ap && v < 7) v += 12; return v; };
    const s = h(hrs[1], hrs[2]), e = h(hrs[3], hrs[4]);
    if (s >= 5 && e > s && e <= 22) { start = s; end = e; }
  }
  return { tz, days, start, end, slotMin, leadHours: 3 };
}

function zoned(ymd: string, hour: number, minute: number, tz: string): Date {
  const guess = new Date(`${ymd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess).map(x => [x.type, x.value]));
  return new Date(guess.getTime() - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - guess.getTime()));
}
const localYmd = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
const localDow = (ymd: string) => new Date(ymd + "T12:00:00Z").getUTCDay();

export function slotLabel(iso: string, tz: string, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/**
 * Open estimate times: inside working hours, not overlapping anything on the calendar, at least `leadHours`
 * from now, spread over days (at most 2 a day) so the customer gets real choice. Returns up to `max`.
 */
export function freeSlots(busy: Busy[], h: Hours, now: Date, opts: { days?: number; max?: number; lang?: Lang } = {}): Slot[] {
  const out: Slot[] = [];
  const b = busy.map(x => [Date.parse(x.start), Date.parse(x.end)] as const).filter(([s, e]) => e > s);
  const earliest = now.getTime() + h.leadHours * 3600000;
  for (let i = 0; i < (opts.days ?? 10) && out.length < (opts.max ?? 6); i++) {
    const ymd = localYmd(new Date(now.getTime() + i * 86400000), h.tz);
    if (!h.days.includes(localDow(ymd))) continue;
    let perDay = 0;
    for (let m = h.start * 60; m + h.slotMin <= h.end * 60 && perDay < 2 && out.length < (opts.max ?? 6); m += h.slotMin) {
      const s = zoned(ymd, Math.floor(m / 60), m % 60, h.tz).getTime(), e = s + h.slotMin * 60000;
      if (s < earliest || b.some(([bs, be]) => s < be && e > bs)) continue;
      out.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString(), label: slotLabel(new Date(s).toISOString(), h.tz, opts.lang) });
      perDay++; m += h.slotMin * 2; // space the two times in a day apart
    }
  }
  return out;
}

/** Instructions added to the reply engine when the owner's calendar is connected. */
export function bookingRules(slots: Slot[]): string {
  if (!slots.length) return "\nCalendar: no open estimate times in the next two weeks. Ask what days work and hand off to the owner to schedule.";
  return `\nCalendar: these estimate times are open. Offer two of them when it's time to book. When the customer clearly picks one, set "book" to its exact ISO start and confirm the time in your reply. Never book a time that isn't on this list.\n${slots.map(s => `- ${s.label} = ${s.start}`).join("\n")}\nAdd "book": null to the JSON when nothing was picked.`;
}

/** The time they picked, only if it's one we offered. */
export function pickedSlot(book: unknown, slots: Slot[]): Slot | null {
  if (typeof book !== "string") return null;
  const t = Date.parse(book);
  return slots.find(s => Date.parse(s.start) === t) ?? null;
}

// ---------- Language ----------
export type Lang = "en" | "es";
const ES_WORDS = /\b(hola|buen[oa]s|gracias|necesito|quiero|cu[aá]nto|cuesta|precio|cerca|cotizaci[oó]n|presupuesto|por favor|s[ií]|ma[nñ]ana|semana|casa|cerca|patio|techo|puedo|usted|ustedes|est[aá]|tengo|para|trabajo)\b/gi;
/** Spanish when at least two common Spanish words show up, or one in a very short message. */
export function detectLang(text: string): Lang {
  const hits = (text || "").match(ES_WORDS)?.length ?? 0;
  const words = (text || "").split(/\s+/).filter(Boolean).length;
  return hits >= 2 || (hits === 1 && words <= 4) ? "es" : "en";
}

export const ES: Record<string, string> = {
  missed_call: "Perdón que no contestamos, le escribe {business}. Seguramente estamos en un trabajo. ¿En qué le podemos ayudar?",
  handoff: "Buena pregunta. {owner} se va a comunicar con usted directamente hoy.",
  reminder: "Hola {first}, le recordamos que {business} va a ir {time} para su presupuesto. Si necesita cambiar la hora, responda aquí.",
  noshow: "Hola {first}, parece que no coincidimos hoy. ¿Quiere escoger otra hora para el presupuesto? Responda con el día que le quede mejor.",
  web_lead: "Hola {first}, le escribe {business}. Gracias por contactarnos. ¿Me cuenta un poco más del trabajo y la dirección para darle un precio aproximado?",
  paid_lead: "Hola {first}, le escribe {business}. Recibimos su solicitud en {via}. ¿Me cuenta un poco más del trabajo y la dirección para darle un precio aproximado?",
  quote_1: "Hola {first}, le escribe {owner} de {business}. ¿Le llegó bien la cotización? ¿Tiene alguna pregunta?",
  quote_2: "Hola {first}, {owner} aquí. Con gusto le explico la cotización o vemos una opción más económica.",
  quote_3: "Hola {first}, ¿todavía lo está pensando? Le puedo apartar un lugar en la agenda mientras decide.",
  quote_4: "Hola {first}, voy a cerrar su cotización para no molestarle. Si quiere seguir adelante después, solo responda aquí.",
  review: "Hola {first}, gracias por elegir a {business}. ¿Nos deja una reseña rápida en Google? Nos ayuda mucho: {review_link}",
  nudge_1: "Hola {first}, le escribe {business} otra vez. Solo para confirmar que vio nuestro mensaje. ¿Todavía quiere un precio para su proyecto? Puede responder aquí.",
  nudge_2: "Hola {first}, {owner} de {business}. Con gusto le damos un precio aproximado o le apartamos un presupuesto gratis. Responda con el día que le quede mejor.",
  nudge_3: "Último mensaje de {business}: ¿lo dejamos en la lista para un presupuesto? Puede responder cuando quiera, sin compromiso.",
};
export const EN: Record<string, string> = {
  reminder: "Hi {first}, a reminder that {business} is coming out {time} for your estimate. If you need to change it, just reply here.",
  noshow: "Hi {first}, looks like we missed each other today. Want to pick another time for the estimate? Reply with a day that works.",
  web_lead: "Hi {first}, this is {business}. Thanks for reaching out. Can you tell me a bit more about the job and the address so I can give you a price range?",
  paid_lead: "Hi {first}, this is {business}. Got your request on {via}. Can you tell me a bit more about the job and the address so I can give you a price range?",
  booked: "You're booked: {time}. {owner} will see you then. Reply here if anything changes.",
};

// ---------- Owner's Monday text ----------
export type WeekNumbers = { leads: number; answered: number; replySec: number | null; booked: number; quotesChased: number; openQuoteValue: number; won: number; wonValue: number; reviews: number };
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export function mondayText(business: string, w: WeekNumbers, link: string): string {
  const parts = [
    `${w.answered} of ${w.leads} lead${w.leads === 1 ? "" : "s"} answered${w.replySec != null ? `, typically in ${w.replySec < 60 ? w.replySec + " sec" : Math.round(w.replySec / 60) + " min"}` : ""}`,
    `${w.booked} estimate${w.booked === 1 ? "" : "s"} booked`,
    w.quotesChased ? `${w.quotesChased} quote${w.quotesChased === 1 ? "" : "s"} followed up${w.openQuoteValue ? ` (${usd(w.openQuoteValue)} open)` : ""}` : "",
    w.won ? `${w.won} won${w.wonValue ? `, ${usd(w.wonValue)}` : ""}` : "",
    w.reviews ? `${w.reviews} review request${w.reviews === 1 ? "" : "s"} sent` : "",
  ].filter(Boolean);
  return `Cinder for ${business}, last week: ${parts.join(" · ")}. Every conversation: ${link}`.slice(0, 600);
}

/** Inbound web lead: pull a usable name, phone and job out of whatever a form sends. */
export function parseIntake(body: Record<string, unknown>): { name: string; phone: string; email: string; message: string; source: string } | null {
  const get = (...keys: string[]) => { for (const k of Object.keys(body)) if (keys.includes(k.toLowerCase().replace(/[^a-z]/g, ""))) { const v = body[k]; if (typeof v === "string" && v.trim()) return v.trim(); } return ""; };
  const phone = get("phone", "phonenumber", "mobile", "cell", "tel", "telephone").replace(/[^\d+]/g, "");
  const d = phone.replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return null;
  const first = get("firstname", "first"), last = get("lastname", "last");
  return {
    name: (get("name", "fullname", "yourname") || [first, last].filter(Boolean).join(" ")).slice(0, 80),
    phone: "+1" + d,
    email: get("email", "emailaddress").slice(0, 120),
    message: get("message", "details", "project", "comments", "description", "job", "notes").slice(0, 1000),
    source: (get("source", "utmsource") || "web form").slice(0, 40),
  };
}
