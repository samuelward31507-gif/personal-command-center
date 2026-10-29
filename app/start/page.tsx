"use client";

import { useState, type FormEvent } from "react";
import { INBOUND_TRADES, INBOUND_VOLUMES } from "@/lib/inbound";
import { CinderLogo } from "../cinder-brand";
import "./start.css";

/** Public lead form. Submissions land in Cinder as a lead with a same-day follow-up and an urgent call task. */
export default function StartPage() {
  const [startedAt] = useState(() => Date.now());
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending"); setError("");
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
    try {
      const r = await fetch("/api/inbound-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, startedAt }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again.");
      setState("done");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); setState("idle"); }
  }

  return <div className="st-page">
    <header className="st-top"><CinderLogo className="st-logo" title="Cinder Revenue Company" /></header>
    <div className="st-main">
      {state === "done" ? <div className="st-done">
        <div className="st-check" aria-hidden="true">✓</div>
        <h1>Got it. You&apos;ll hear from Samuel shortly.</h1>
        <p>Usually the same day. If you&apos;d rather talk now, keep your phone close.</p>
      </div> : <>
        <div className="st-intro">
          <div className="st-eyebrow">Cinder Revenue Company</div>
          <h1>Stop losing jobs to slow replies.</h1>
          <p>We set up systems that answer every new lead in under a minute, follow up until they book, and put the good ones on your calendar. Tell us about your business and we&apos;ll show you what it would look like for you.</p>
        </div>
        <form className="st-form" onSubmit={submit}>
          <div className="st-grid">
            <label><span className="st-l">Your name <i>*</i></span><input name="name" required autoComplete="name" /></label>
            <label><span className="st-l">Business name <i>*</i></span><input name="company" required autoComplete="organization" /></label>
            <label>Phone<input name="phone" type="tel" autoComplete="tel" placeholder="(555) 555-5555" /></label>
            <label>Email<input name="email" type="email" autoComplete="email" /></label>
            <label>Trade<select name="trade" defaultValue=""><option value="" disabled>Choose one</option>{INBOUND_TRADES.map(t => <option key={t}>{t}</option>)}</select></label>
            <label>New leads per month<select name="leadVolume" defaultValue=""><option value="" disabled>Rough guess</option>{INBOUND_VOLUMES.map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="st-wide">Website<input name="website" inputMode="url" placeholder="yourcompany.com" /></label>
            <label className="st-wide">What&apos;s the biggest headache with leads right now?<textarea name="challenge" rows={3} placeholder="Missed calls, slow follow-up, quotes that go cold…" /></label>
            <label className="st-wide">How did you hear about us?<input name="heardFrom" placeholder="Instagram, a friend, Google…" /></label>
            <label className="st-hp" aria-hidden="true">Fax<input name="fax" tabIndex={-1} autoComplete="off" /></label>
          </div>
          {error && <p className="st-err" role="alert">{error}</p>}
          <button type="submit" data-variant="primary" className="st-submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send"}</button>
          <p className="st-fine">Phone or email is enough. We&apos;ll never sell your information. By submitting you agree we can contact you about your inquiry.</p>
        </form>
      </>}
    </div>
  </div>;
}
