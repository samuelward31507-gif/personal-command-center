"use client";

import { useState } from "react";
import { AFTER_CALL_TEMPLATES, fillTemplate, mergeFor, trackOf } from "@/lib/email-outreach";

type Who = { id: string; name: string; company: string; email: string; location?: string; niche?: string };
type Ws = { ownerFirstName: string; businessName: string; bookingLink: string; websiteUrl?: string; demoLink?: string; address?: string };

/** After a voicemail: one click sends "just tried calling" as their first cold email. */
export function CallEmail({ who, ws, gmail, onClose }: { who: Who; ws: Ws; gmail: { connected: boolean; email: string | null } | null; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const t = AFTER_CALL_TEMPLATES[trackOf(who.niche)], m = mergeFor(who, ws);
  const subject = fillTemplate(t.subject, m), body = fillTemplate(t.body, m);
  const name = who.company || who.name;

  async function send() {
    setState("sending"); setError("");
    try {
      const r = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: who.id, step: "intro", subject, body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send.");
      setState("sent");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't send."); setState("idle"); }
  }
  function openGmail() {
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(who.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
    void fetch("/api/email-outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: who.id, step: "intro", subject }) }).then(r => r.ok && setState("sent"));
  }

  return <div className="dl-callmail" role="status">
    <div className="dl-callmail-txt">
      {state === "sent" ? <><b>Emailed {name}.</b> The follow-up comes up on the Email page in 3 days.</>
        : <><b>Left a voicemail. Email {name} too?</b> <span>&ldquo;Just tried calling…&rdquo; to {who.email}. It becomes their first email, so the follow-ups run after it.</span></>}
      {error && <span className="dl-callmail-err">{error}</span>}
    </div>
    <div className="dl-callmail-acts">
      {state !== "sent" && (gmail?.connected
        ? <button type="button" className="u-btn u-btn-light" disabled={state === "sending" || !ws.address} title={!ws.address ? "Add your mailing address in Settings first" : undefined} onClick={() => void send()}>{state === "sending" ? "Sending…" : "Send email"}</button>
        : <button type="button" className="u-btn u-btn-light" onClick={openGmail}>Open in Gmail</button>)}
      <button type="button" className="u-btn u-btn-bare" onClick={onClose}>{state === "sent" ? "Close" : "Skip"}</button>
    </div>
  </div>;
}
