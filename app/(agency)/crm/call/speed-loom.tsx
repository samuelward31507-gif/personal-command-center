"use client";

// Speed test + Loom script, under the research card on the Call screen.
// Speed test: ask for a quote like a homeowner would, tap when they reply; the result becomes the opener.
// Loom: the 90-second script for this prospect, built from the research card and the test.

import { useEffect, useMemo, useState } from "react";
import { parseAuditCard } from "@/lib/audit-card";
import { cleanSpeedTest, loomScript, speedLine, summarize, type SpeedTest, type SpeedVia } from "@/lib/speed-test";
import { timeZoneFor, timeZoneForPhone } from "@/lib/local-time";
import "./speed-loom.css";

type Props = {
  contact: { id: string; company: string; phone?: string; website?: string; location?: string };
  firstName?: string | null;
  auditContent?: string | null;
  bookingLink?: string | null;
};

const TONE: Record<string, string> = { good: "green", warn: "amber", bad: "red", neutral: "grey" };
const VIA: { id: SpeedVia; label: string }[] = [{ id: "form", label: "Web form" }, { id: "call", label: "Call" }, { id: "text", label: "Text" }];

export default function SpeedLoom({ contact, firstName, auditContent, bookingLink }: Props) {
  const [test, setTest] = useState<SpeedTest | null | undefined>(undefined);
  const [via, setVia] = useState<SpeedVia>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loom, setLoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    setTest(undefined); setError(""); setLoom(false);
    fetch(`/api/contacts/speed-test?id=${contact.id}`, { cache: "no-store" })
      .then(r => r.json()).then(d => { if (live) setTest(cleanSpeedTest(d.test)); })
      .catch(() => { if (live) setTest(null); });
    return () => { live = false; };
  }, [contact.id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  const tz = timeZoneFor(contact.location ?? "") ?? timeZoneForPhone(contact.phone ?? "") ?? "America/Denver";
  const card = useMemo(() => (auditContent ? parseAuditCard(auditContent) : null), [auditContent]);
  const script = useMemo(() => loomScript({
    firstName, company: contact.company, website: contact.website?.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    rating: card?.rating, reviewCount: card?.reviewCount, noWebsite: card?.noWebsite,
    weakCapture: card?.areas.some(a => a.key === "capture" && (a.grade === "D" || a.grade === "F")),
    speed: test ?? null, bookingLink, timeZone: tz, now,
  }), [firstName, contact.company, contact.website, card, test, bookingLink, tz, now]);

  async function save(next: SpeedTest | null) {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/contacts/speed-test", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: contact.id, test: next }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save the speed test.");
      setTest(cleanSpeedTest(d.test)); setNow(Date.now());
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the speed test."); }
    finally { setBusy(false); }
  }

  const sum = test ? summarize(test, now) : null;
  const line = test ? speedLine(test, now, tz) : null;

  return <section className="sl" aria-label="Speed test and Loom">
    <div className="sl-row">
      <span className="sl-k">Speed test</span>
      {test === undefined ? <span className="u-note">Loading…</span>
        : !test ? <>
          <div className="u-seg" role="group" aria-label="How you asked">
            {VIA.map(v => <button key={v.id} type="button" aria-pressed={via === v.id} onClick={() => setVia(v.id)}>{v.label}</button>)}
          </div>
          <button type="button" className="u-btn u-btn-light" disabled={busy} onClick={() => void save({ via, at: new Date().toISOString(), repliedAt: null })}>I just asked for a quote</button>
          <span className="sl-hint">Ask like a homeowner, then tap when they get back to you.</span>
        </> : <>
          <span className="lg-pill" data-tone={TONE[sum!.tone]}>{sum!.label}</span>
          {sum!.state !== "replied" && <button type="button" className="u-btn u-btn-light" disabled={busy} onClick={() => void save({ ...test, repliedAt: new Date().toISOString() })}>They replied</button>}
          <button type="button" className="u-btn u-btn-bare" disabled={busy} onClick={() => void save(null)}>Reset</button>
        </>}
      <button type="button" className="u-btn sl-loom" aria-expanded={loom} onClick={() => setLoom(v => !v)}>Loom script</button>
    </div>
    {line && <p className="sl-line"><b>Open with:</b> “{line}”</p>}
    {error && <p className="u-flash is-bad" role="alert">{error}</p>}
    {loom && <div className="sl-loomp">
      <ol>{script.beats.map(b => <li key={b.at}><span className="sl-at u-num">{b.at}</span><div><p className="sl-screen">{b.screen}</p><p>{b.say}</p></div></li>)}</ol>
      <div className="sl-loomf">
        <span className="u-note">About 90 seconds. Their site on screen first, one finding, one ask.</span>
        <button type="button" className="u-btn" onClick={() => { void navigator.clipboard?.writeText(script.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}>{copied ? "Copied" : "Copy script"}</button>
      </div>
    </div>}
  </section>;
}
