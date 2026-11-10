// Strategic partners: people who already sell to fence owners and detailers. One good partner is worth hundreds of dials.
// Pure: no I/O.

/** What a partner gets for every shop they send that signs. Change it here. */
export const PARTNER_FEE = 250;

export const PARTNER_STATUSES = [
  ["to_contact", "To contact"], ["contacted", "Contacted"], ["talking", "Talking"], ["active", "Sending referrals"], ["no", "Not a fit"],
] as const;
export type PartnerStatus = typeof PARTNER_STATUSES[number][0];

export type PartnerKind = { key: string; label: string; track: "trades" | "detailing" | "both"; why: string; search: string; pitch: string };

export const PARTNER_KINDS: PartnerKind[] = [
  { key: "supply", label: "Fence supply yard", track: "trades", search: "fence supply",
    why: "Every fence contractor in town buys from them, and the counter staff know who's busy and who's struggling.",
    pitch: "Hey, I'm Sam, I run Cinder Revenue here in town. I help fence contractors stop losing the calls they miss while they're on a job. Your customers are exactly who I work with. When one of them sells more jobs, they buy more material from you. Would you be open to me leaving a few cards at the counter, or mentioning me to the guys who complain about missing calls? Anyone you send who signs, I pay you $" },
  { key: "web", label: "Web designer / marketer", track: "both", search: "web design small business",
    why: "They build sites and run ads for contractors, then the leads die in the owner's voicemail. You fix the part they can't.",
    pitch: "Hey, I'm Sam with Cinder Revenue. I don't do websites or ads, so I'm not competing with you. I handle what happens after the lead comes in: instant text back, booking, quote follow-up. Your clients' results get better, which makes you look good. If you send me a client who signs, I pay you $" },
  { key: "software", label: "Jobber / Housecall Pro consultant", track: "both", search: "Jobber consultant",
    why: "They set up the software owners already use. Cinder works alongside it, so it's an easy add-on for their clients.",
    pitch: "Hey, I'm Sam with Cinder Revenue. We work alongside Jobber and Housecall: missed-call text back, booking, and quote follow-up that feeds into what you already set up. If any of your clients are losing leads before they reach the software, I'd love to help. Anyone you send who signs, I pay you $" },
  { key: "accountant", label: "Bookkeeper for contractors", track: "both", search: "bookkeeper for contractors",
    why: "They see exactly which owners need more jobs, and owners trust their advice about money.",
    pitch: "Hey, I'm Sam with Cinder Revenue. I help contractors book more of the leads they already get, with no contract and a 30-day guarantee. If you have clients who need more revenue, I'd be glad to help them. Anyone you send who signs, I pay you $" },
  { key: "detail_supply", label: "Detailing supply / chemical rep", track: "detailing", search: "car detailing supply",
    why: "Every detailer buys product from them. Busier shops buy more product.",
    pitch: "Hey, I'm Sam with Cinder Revenue. I help detailers get past customers to book again with automatic texts. More details means more product for your customers. Would you mention me to shops that say they're slow? Anyone you send who signs, I pay you $" },
  { key: "wrap", label: "Wrap / tint / PPF shop", track: "detailing", search: "vinyl wrap PPF shop",
    why: "They share customers with detailers and often send work back and forth.",
    pitch: "Hey, I'm Sam with Cinder Revenue. I help detailing and wrap shops rebook past customers and answer every call. If you know detailers you trade work with, I'd love an intro. Anyone you send who signs, I pay you $" },
];

export const kindOf = (key: string) => PARTNER_KINDS.find(k => k.key === key) ?? null;
export const pitchFor = (key: string) => { const k = kindOf(key); return k ? `${k.pitch}${PARTNER_FEE}.` : ""; };
export const mapsSearch = (kind: string, city: string) => `https://www.google.com/maps/search/${encodeURIComponent(`${kindOf(kind)?.search ?? kind} ${city}`.trim())}`;

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
export type PartnerInput = { kind: string; name: string; contact_name: string; phone: string; email: string; city: string; status: PartnerStatus; referrals: number; notes: string };

/** Cleans a partner from the form. Returns the first problem in plain words. */
export function validatePartner(b: unknown): PartnerInput | { error: string } {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  const name = s(o.name, 160);
  if (!name) return { error: "Add the business name." };
  const kind = kindOf(s(o.kind, 40)) ? s(o.kind, 40) : "other";
  const status = (PARTNER_STATUSES.some(([k]) => k === o.status) ? o.status : "to_contact") as PartnerStatus;
  const referrals = Math.max(0, Math.min(999, Math.floor(Number(o.referrals) || 0)));
  const email = s(o.email, 200);
  if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { error: "That email doesn't look right." };
  return { kind, name, contact_name: s(o.contact_name, 120), phone: s(o.phone, 40), email, city: s(o.city, 120), status, referrals, notes: s(o.notes, 2000) };
}
