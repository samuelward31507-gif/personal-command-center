"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { CinderLogo } from "../../cinder-brand";
import "./sign.css";

type Doc = {
  status: "open" | "signed" | "expired" | "changed"; client: string; provider: string; providerSigner: string; sentAt: string | null;
  content: string; signerName: string | null; signerTitle: string | null; signedAt: string | null; consent: string;
};

/** Minimal, safe Markdown → React for the agreement text (headings, bold, bullets, paragraphs). No HTML is injected. */
function inline(s: string, key: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={key + i}>{part.slice(2, -2)}</strong> : <span key={key + i}>{part}</span>);
}
function DocBody({ text }: { text: string }) {
  const out: ReactNode[] = []; let list: string[] = []; let para: string[] = [];
  const flush = (k: string) => {
    if (para.length) { out.push(<p key={"p" + k}>{inline(para.join(" "), "p" + k)}</p>); para = []; }
    if (list.length) { out.push(<ul key={"u" + k}>{list.map((l, i) => <li key={i}>{inline(l, "l" + k + i)}</li>)}</ul>); list = []; }
  };
  text.replace(/\r/g, "").split("\n").forEach((line, i) => {
    const t = line.trim(); const k = String(i);
    if (!t) { flush(k); return; }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flush(k); out.push(h[1].length === 1 ? <h1 key={k}>{inline(h[2], k)}</h1> : h[1].length === 2 ? <h2 key={k}>{inline(h[2], k)}</h2> : <h3 key={k}>{inline(h[2], k)}</h3>); return; }
    const b = t.match(/^[-*•]\s+(.*)$/) || t.match(/^\d+[.)]\s+(.*)$/);
    if (b) { if (para.length) flush(k); list.push(b[1]); return; }
    if (list.length) flush(k);
    para.push(t);
  });
  flush("end");
  return <div className="sg-doc">{out}</div>;
}

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "");

/** Public signing page: the client reads the agreement and signs by typing their name. */
export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", title: "", email: "", consent: false });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

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
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setFormError(err instanceof Error ? err.message : "Couldn't record your signature."); }
    finally { setSending(false); }
  }

  return <div className="sg-page">
    <header className="sg-top"><CinderLogo className="sg-logo" title="Cinder Revenue Company" /></header>
    <main className="sg-main">
      {error ? <div className="sg-msg"><h1>Link not available</h1><p>{error}</p></div>
        : !doc ? <p className="sg-muted">Loading the agreement…</p>
        : doc.status === "expired" || doc.status === "changed" ? <div className="sg-msg"><h1>{doc.status === "expired" ? "This link has expired" : "This agreement was updated"}</h1>
            <p>{doc.status === "expired" ? "Signing links last 30 days." : "It changed after this link was sent, so this link can't be used."} Reply to {doc.providerSigner || "us"} and we&apos;ll send a fresh one.</p></div>
        : <>
          {doc.status === "signed"
            ? <div className="sg-done" role="status"><b>Signed.</b> {doc.signerName} signed electronically on {fmt(doc.signedAt)}. Save a copy with the button below.</div>
            : <div className="sg-intro"><div className="sg-eyebrow">Service agreement · {doc.client}</div><p>Please read the agreement below. To sign, type your name at the bottom.</p></div>}
          <DocBody text={doc.content} />
          <section className="sg-sigs" aria-label="Signatures">
            <div><div className="sg-k">Provider</div><div className="sg-sig">{doc.providerSigner}</div><div className="sg-sm">{doc.provider}{doc.sentAt ? ` · signed when sent, ${fmt(doc.sentAt)}` : ""}</div></div>
            <div><div className="sg-k">Client</div>{doc.status === "signed"
              ? <><div className="sg-sig">{doc.signerName}</div><div className="sg-sm">{[doc.signerTitle, doc.client].filter(Boolean).join(", ")} · signed electronically, {fmt(doc.signedAt)}</div></>
              : <div className="sg-sm">Not signed yet</div>}</div>
          </section>
          {doc.status === "signed"
            ? <button type="button" className="sg-btn" onClick={() => window.print()}>Print or save as PDF</button>
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
