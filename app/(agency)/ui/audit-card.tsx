"use client";

import Link from "next/link";
import { parseAuditCard, type Grade } from "@/lib/audit-card";

const tone = (g: Grade) => (g === "A" || g === "B" ? "green" : g === "C" ? "amber" : g === "D" || g === "F" ? "red" : "grey");
const pitchTone: Record<string, string> = { "Speed to lead": "blue", "Website + speed to lead": "violet", "Reviews + speed to lead": "orange", "Walk away": "grey" };

/**
 * The 30-second read before a call: four grades, the Google rating, and what to pitch.
 * Built from the business audit; with no audit yet it offers to run one.
 */
export default function AuditCard({ content, auditId, contactId, compact }: { content?: string | null; auditId?: string; contactId: string; compact?: boolean }) {
  const card = content ? parseAuditCard(content) : null;
  if (!card) {
    return <div className="ac ac-empty">
      <span className="ac-k">Before you call</span>
      <span className="ac-none">No research on this business yet. A one-minute audit grades their website, reviews and lead capture, and picks what to pitch.</span>
      <Link className="u-btn" href={`/crm/audit?contact=${contactId}`}>Audit now</Link>
    </div>;
  }
  return <div className={"ac" + (compact ? " is-compact" : "")}>
    <div className="ac-top">
      <span className="ac-k">Pitch</span>
      <span className="lg-pill ac-pitch" data-tone={pitchTone[card.pitch] ?? "blue"}>{card.pitch}</span>
      {card.rating !== null && <span className="ac-rating" title="Google rating">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" /></svg>
        <b>{card.rating.toFixed(1)}</b>{card.reviewCount !== null && <span>{card.reviewCount} reviews</span>}
      </span>}
      {auditId && <Link className="ac-link" href={`/crm/audits/${auditId}`}>Full audit</Link>}
    </div>
    {card.pitchWhy && <p className="ac-why">{card.pitchWhy}</p>}
    <div className="ac-grades">
      {card.areas.map(a => <div key={a.key} className="ac-g" title={a.note || undefined}>
        <span className="ac-grade" data-tone={tone(a.grade)}>{a.grade === "?" ? "–" : a.grade}</span>
        <span className="ac-gl"><b>{compact ? ({ website: "Site", capture: "Capture", reviews: "Reviews", presence: "Presence" } as const)[a.key] : a.label}</b>{!compact && <span>{a.key === "website" && card.noWebsite ? "No website found" : a.note || "Not checked"}</span>}</span>
      </div>)}
    </div>
    {!compact && card.opener && <p className="ac-open"><span>Opener</span>{card.opener}</p>}
  </div>;
}
