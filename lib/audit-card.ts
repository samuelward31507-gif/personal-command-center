/**
 * The 30-second read of a business audit, for the moment before a call: four grades, the Google rating,
 * and what to pitch. Parsed from the saved audit report (its "## Scorecard", "## Verdict" and "## Pitch" sections),
 * so older audits without a Pitch line still get one from the grades.
 */

export type Grade = "A" | "B" | "C" | "D" | "F" | "?";
export type CardArea = { key: "website" | "capture" | "reviews" | "presence"; label: string; grade: Grade; note: string };
export type Pitch = "Speed to lead" | "Website + speed to lead" | "Reviews + speed to lead" | "Walk away";
export type AuditCard = {
  areas: CardArea[];
  rating: number | null;
  reviewCount: number | null;
  noWebsite: boolean;
  pitch: Pitch;
  pitchWhy: string;
  opener: string;
};

const AREAS: { key: CardArea["key"]; label: string; match: RegExp }[] = [
  { key: "website", label: "Website", match: /^website/i },
  { key: "capture", label: "Lead capture", match: /^lead capture/i },
  { key: "reviews", label: "Reviews", match: /^reviews/i },
  { key: "presence", label: "Online presence", match: /^online presence|^presence|^google business/i },
];

function section(content: string, heading: string): string {
  // The heading's own line may carry text ("## Verdict — Fit, Book & Close …"), and lines may follow it.
  const re = new RegExp(`^##\\s*${heading}\\b([^\\n]*)\\n?([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "im");
  const m = content.match(re);
  if (!m) return "";
  const inline = m[1].replace(/^\s*[—–:-]\s*/, "").trim();
  return [inline, m[2].trim()].filter(Boolean).join("\n");
}

const strip = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
const noUrls = (s: string) => s.replace(/\(?https?:\/\/\S+\)?/g, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();

function gradeOf(raw: string): Grade {
  const g = raw.trim().toUpperCase().replace(/[+-]$/, "");
  return ["A", "B", "C", "D", "F"].includes(g) ? (g as Grade) : "?";
}

const weak = (g: Grade) => g === "D" || g === "F";

export function parseAuditCard(content: string): AuditCard | null {
  if (!content) return null;
  const score = section(content, "Scorecard");
  const areas: CardArea[] = AREAS.map(a => ({ key: a.key, label: a.label, grade: "?", note: "" }));
  for (const line of score.split("\n")) {
    const l = strip(line).replace(/^[-*•]\s*/, "");
    const m = l.match(/^([A-Za-z ]+?)\s*[:—–-]\s*(?:grade\s*)?([A-F][+-]?|UNKNOWN)\b\s*[—–:,.-]?\s*(.*)$/i);
    if (!m) continue;
    const area = AREAS.find(a => a.match.test(m[1].trim()));
    if (!area) continue;
    const slot = areas.find(x => x.key === area.key)!;
    slot.grade = gradeOf(m[2]);
    slot.note = noUrls(m[3]).slice(0, 160);
  }
  const verdict = strip(section(content, "Verdict"));
  if (areas.every(a => a.grade === "?") && !verdict) return null;

  const reviews = areas.find(a => a.key === "reviews")!;
  const website = areas.find(a => a.key === "website")!;
  const r = (reviews.note + " " + score).match(/(\d(?:\.\d)?)\s*(?:★|stars?|\/\s*5)?[^\d\n]{0,40}?(\d{1,5})\s*(?:Google\s+)?reviews?/i);
  const rating = r ? Number(r[1]) : null;
  const reviewCount = r ? Number(r[2]) : null;
  const noWebsite = /no (?:website|site)|website not found|not_found|doesn'?t have a website|no official website/i.test(website.note + " " + (score.split("\n").find(l => /website/i.test(l)) ?? ""));

  // The model's own Pitch line wins when the audit has one.
  const pitchLine = strip(section(content, "Pitch"));
  const PITCHES: Pitch[] = ["Website + speed to lead", "Reviews + speed to lead", "Walk away", "Speed to lead"];
  const said = PITCHES.find(p => pitchLine.toLowerCase().startsWith(p.toLowerCase()));
  let pitch: Pitch;
  let pitchWhy: string;
  if (said) {
    pitch = said;
    pitchWhy = noUrls(pitchLine.slice(said.length).replace(/^\s*[—–:-]\s*/, "")).slice(0, 180);
  } else if (/^\s*no fit/i.test(verdict)) {
    pitch = "Walk away"; pitchWhy = noUrls(verdict.replace(/^no fit\s*[—–:,.-]?\s*/i, "")).slice(0, 180);
  } else if (noWebsite || weak(website.grade)) {
    pitch = "Website + speed to lead"; pitchWhy = noWebsite ? "No website found, so leads have nowhere to land." : website.note;
  } else if (weak(reviews.grade) || (rating !== null && rating < 4.2) || (reviewCount !== null && reviewCount < 15)) {
    pitch = "Reviews + speed to lead";
    pitchWhy = rating !== null ? `${rating}★ from ${reviewCount ?? "few"} reviews. Review requests after every job fix that.` : reviews.note;
  } else {
    // Nothing solid stands out: lead with speed to lead, the core offer.
    pitch = "Speed to lead"; pitchWhy = "Nothing broken stands out publicly. Lead with how fast they answer new leads.";
  }

  const plan = section(content, "Call plan");
  const openerMatch = strip(plan).match(/opener\s*[:—–-]?\s*(.+?)(?:\s+(?:meeting objective|objective|discovery|questions?)\b|$)/i);
  const opener = noUrls(openerMatch ? openerMatch[1] : "").replace(/^["“]|["”]$/g, "").slice(0, 300);

  return { areas, rating, reviewCount, noWebsite, pitch, pitchWhy, opener };
}
