"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { BrandLogo } from "../../cinder-brand";
import "./sign.css";
import { DocFrame } from "../../doc-frame";
import { agreementDoc } from "@/lib/print-doc";
import { usePublicBrand } from "../../use-workspace";

type Doc = {
  status: "open" | "signed" | "expired" | "changed"; client: string; provider: string; providerSigner: string; sentAt: string | null;
  content: string; signerName: string | null; signerTitle: string | null; signedAt: string | null; consent: string; docNo?: string;
};

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "");

/** Public signing page: the client reads the agreement and signs by typing their name. */
export default function SignPage() {
  const brand = usePublicBrand();
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", title: "", email: "", consent: false });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [kickoffUrl, setKickoffUrl] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sign?token=" + encodeURIComponent(token), { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "This signing link isn't valid.");
      setDoc(d);
    } catch (e) { setError(e instanceof Error ? e.message : "This signing link isn't valid."); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function sign(e: FormEvent) {
    e.preventDefault(); setSending(true); setFormError("");
    try {
      const r = await fetch("/api/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...form }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't record your signature.");
      if (typeof d.kickoffUrl === "string") setKickoffUrl(d.kickoffUrl);
      if (typeof d.payUrl === "string") setPayUrl(d.payUrl);
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setFormError(err instanceof Error ? err.message : "Couldn't record your signature."); }
    finally { setSending(false); }
  }

  return <div className="sg-page">
    <header className="sg-top"><BrandLogo mono className="sg-logo" title={brand.businessName} /></header>
    <main className="sg-main">
      {error ? <div className="sg-msg"><h1>Link not available</h1><p>{error}</p></div>
        : !doc ? <p className="sg-muted">Loading the agreement…</p>
        : doc.status === "expired" || doc.status === "changed" ? <div className="sg-msg"><h1>{doc.status === "expired" ? "This link has expired" : "This agreement was updated"}</h1>
            <p>{doc.status === "expired" ? "Signing links last 30 days." : "It changed after this link was sent, so this link can't be used."} Reply to {doc.providerSigner || "us"} and we&apos;ll send a fresh one.</p></div>
        : <>
          {doc.status === "signed"
            ? <div className="sg-done" role="status"><b>Signed.</b> {doc.signerName} signed electronically on {fmt(doc.signedAt)}. Save a copy with the button below.
                {payUrl && <div className="sg-next"><p><b>Setup payment:</b> pay the setup fee to lock in your start date. We also emailed you this link.</p><a className="sg-btn" href={payUrl} target="_blank" rel="noopener noreferrer">Pay the setup fee</a></div>}
                {kickoffUrl && <div className="sg-next"><p><b>Next step:</b> a 10-minute kickoff checklist (your hours, service area, prices and the details carriers need to register your texting number). Most shops are live within 14 days of sending it, and never later than 21 business days.</p><a className="sg-btn" href={kickoffUrl}>Start the kickoff checklist</a></div>}</div>
            : <div className="sg-intro"><div className="sg-eyebrow">Service agreement · {doc.client}</div><p>Please read the agreement below. To sign, type your name at the bottom.</p></div>}
          <DocFrame title="Service agreement" className="sg-doc" html={agreementDoc(doc.content, { no: doc.docNo || "", business: brand.businessName || "Cinder Revenue Company",
            signed: { provider: doc.providerSigner ? { name: doc.providerSigner, title: "Owner", at: doc.sentAt } : null,
              client: doc.status === "signed" && doc.signerName ? { name: doc.signerName, title: doc.signerTitle ?? undefined, at: doc.signedAt } : null } })} />
          
          {doc.status === "signed"
            ? <button type="button" className="sg-btn" onClick={() => { const w = window.open("", "_blank"); if (!w) return; w.document.write(agreementDoc(doc.content, { no: doc.docNo || "", business: brand.businessName || "Cinder Revenue Company", autoPrint: true,
              signed: { provider: doc.providerSigner ? { name: doc.providerSigner, title: "Owner", at: doc.sentAt } : null, client: doc.signerName ? { name: doc.signerName, title: doc.signerTitle ?? undefined, at: doc.signedAt } : null } })); w.document.close(); }}>Print or save as PDF</button>
            : <form className="sg-form" onSubmit={sign}>
              <h2>Sign</h2>
              <div className="sg-grid">
                <label>Full name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
                <label>Title <i>(optional)</i><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Owner" autoComplete="organization-title" /></label>
                <label className="sg-wide">Email, for your copy<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
              </div>
              <label className="sg-consent"><input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} /> <span>{doc.consent}</span></label>
              {form.name.trim() && <div className="sg-preview" aria-hidden="true">{form.name}</div>}
              {formError && <p className="sg-err" role="alert">{formError}</p>}
              <button type="submit" className="sg-btn sg-primary" disabled={sending || !form.consent}>{sending ? "Signing…" : "Sign agreement"}</button>
              <p className="sg-fine">Your name, the time, your IP address and browser are recorded with the exact text you signed.</p>
            </form>}
        </>}
    </main>
  </div>;
}
