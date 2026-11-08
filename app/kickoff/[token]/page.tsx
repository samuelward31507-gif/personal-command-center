"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { BrandLogo } from "../../cinder-brand";
import "./kickoff.css";
import { usePublicBrand } from "../../use-workspace";

type Field = { key: string; label: string; help?: string; long?: boolean; required?: boolean; group: string };
type Doc = { status: "open" | "submitted"; client: string; tier: "tier1" | "tier2"; fields: Field[]; submittedAt: string | null };

/** Public kickoff checklist (agreement Schedule B). The client fills it in after signing. */
export default function KickoffPage() {
  const brand = usePublicBrand();
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/kickoff?token=" + encodeURIComponent(token), { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "This kickoff link isn't valid.");
      setDoc(d);
    } catch (e) { setError(e instanceof Error ? e.message : "This kickoff link isn't valid."); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSending(true); setFormError("");
    try {
      const r = await fetch("/api/kickoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, answers }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't send the checklist.");
      setDone(true); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setFormError(err instanceof Error ? err.message : "Couldn't send the checklist."); }
    finally { setSending(false); }
  }

  const groups = doc ? [...new Set(doc.fields.map(f => f.group))] : [];
  return <div className="ko-page">
    <header className="ko-top"><BrandLogo mono className="ko-logo" title={brand.businessName} /></header>
    <main className="ko-main">
      {error ? <div className="ko-msg"><h1>Link not available</h1><p>{error}</p></div>
        : !doc ? <p className="ko-muted">Loading your checklist…</p>
        : done || doc.status === "submitted" ? <div className="ko-msg"><h1>Got it. Thank you.</h1>
            <p>Your kickoff checklist is in, so the 21-business-day go-live clock has started. {brand.ownerFirstName} will reach out to book a 30-minute kickoff call and send access invites for anything we need to connect.</p></div>
        : <>
          <div className="ko-intro">
            <h1>Kickoff checklist{doc.client ? ` for ${doc.client}` : ""}</h1>
            <p>About 10 minutes. This is everything we need to build your system. The 21-business-day go-live clock starts when it&apos;s in.</p>
            <p className="ko-note">Please don&apos;t put passwords here. We&apos;ll send you access invites instead.</p>
          </div>
          <form className="ko-form" onSubmit={submit}>
            {groups.map(g => <fieldset key={g}>
              <legend>{g}</legend>
              {doc.fields.filter(f => f.group === g).map(f => <label key={f.key}>
                <span className="ko-l">{f.label}{f.required && <i> *</i>}</span>
                {f.help && <span className="ko-help">{f.help}</span>}
                {f.long
                  ? <textarea rows={3} required={f.required} value={answers[f.key] ?? ""} onChange={e => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} />
                  : <input required={f.required} value={answers[f.key] ?? ""} onChange={e => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} />}
              </label>)}
            </fieldset>)}
            {formError && <p className="ko-err" role="alert">{formError}</p>}
            <button type="submit" className="ko-submit" disabled={sending}>{sending ? "Sending…" : "Send checklist"}</button>
            <p className="ko-fine">Only {brand.businessName} sees this. It&apos;s used to build and register your system.</p>
          </form>
        </>}
    </main>
  </div>;
}
