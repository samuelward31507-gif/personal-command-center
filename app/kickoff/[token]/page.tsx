"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BrandLogo } from "../../cinder-brand";
import "./kickoff.css";
import { usePublicBrand } from "../../use-workspace";

type Kind = "text" | "long" | "phone" | "url" | "choices" | "select" | "days" | "hours" | "file";
type Field = { key: string; label: string; help?: string; kind?: Kind; long?: boolean; required?: boolean; group: string; options?: string[]; placeholder?: string; showIf?: { key: string; is: string[] }; accept?: string; notes?: Record<string, string> };
type Upload = { field: string; name: string; size: number };
type Doc = { status: "open" | "submitted"; client: string; tier: "tier1" | "tier2"; fields: Field[]; files?: Upload[]; submittedAt: string | null };

const SEP = "; ";
const kindOf = (f: Field): Kind => f.kind ?? (f.long ? "long" : "text");
const asked = (f: Field, a: Record<string, string>) => !f.showIf || f.showIf.is.includes(a[f.showIf.key] ?? "");
const list = (v: string | undefined) => (v ? v.split(SEP).map(x => x.trim()).filter(Boolean) : []);
const TIMES = Array.from({ length: 31 }, (_, i) => { const m = 6 * 60 + i * 30, h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${mm ? "30" : "00"} ${h < 12 ? "AM" : "PM"}`; });
const kb = (n: number) => (n > 900_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/** Big phone photos are shrunk before upload (a letter stays readable at 2400 px). PDFs and spreadsheets go as they are. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 1_500_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>(r => c.toBlob(r, "image/jpeg", 0.85));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}

/** Public kickoff checklist (agreement Schedule B): one short step at a time, choices over typing, uploads over copying numbers. */
export default function KickoffPage() {
  const brand = usePublicBrand();
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, Upload>>({});
  const [busyFile, setBusyFile] = useState("");
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const draftKey = "cinder-kickoff-" + token;

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/kickoff?token=" + encodeURIComponent(token), { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "This kickoff link isn't valid.");
      setDoc(d);
      setFiles(Object.fromEntries(((d.files ?? []) as Upload[]).map(f => [f.field, f])));
      try { const saved = JSON.parse(localStorage.getItem(draftKey) || "null"); if (saved?.answers) { setAnswers(saved.answers); setStep(Number(saved.step) || 0); } } catch { /* no draft */ }
    } catch (e) { setError(e instanceof Error ? e.message : "This kickoff link isn't valid."); }
  }, [token, draftKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (doc?.status === "open") { try { localStorage.setItem(draftKey, JSON.stringify({ answers, step })); } catch { /* private mode */ } } }, [answers, step, doc, draftKey]);

  const steps = useMemo(() => (doc ? [...new Set(doc.fields.map(f => f.group))] : []), [doc]);
  const review = step >= steps.length;
  const set = (k: string, v: string) => setAnswers(a => ({ ...a, [k]: v }));
  const go = (n: number) => { setStepError(""); setStep(n); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  function missing(group: string): string {
    for (const f of doc!.fields.filter(x => x.group === group && asked(x, answers))) {
      if (!f.required) continue;
      if (kindOf(f) === "file" ? !files[f.key] : !(answers[f.key] ?? "").trim()) return kindOf(f) === "file" ? `Upload “${f.label}”.` : `Answer “${f.label}”.`;
      if (kindOf(f) === "hours" && !/ to /.test(answers[f.key] ?? "")) return `Pick both times for “${f.label}”.`;
    }
    return "";
  }
  function next() {
    const m = missing(steps[step]);
    if (m) { setStepError(m); return; }
    go(step + 1);
  }

  async function pick(f: Field, file: File | undefined) {
    if (!file) return;
    setBusyFile(f.key); setStepError("");
    try {
      const body = await shrink(file);
      if (body.size > 4_000_000) throw new Error("That file is over 4 MB. Try a PDF, or a photo of just the page.");
      const r = await fetch("/api/kickoff?upload=" + f.key, { method: "POST", headers: { "x-kickoff-token": token, "x-file-name": encodeURIComponent(file.name), "Content-Type": "application/octet-stream" }, body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't upload that file.");
      setFiles(x => ({ ...x, [f.key]: d.file }));
    } catch (e) { setStepError(e instanceof Error ? e.message : "Couldn't upload that file."); }
    finally { setBusyFile(""); }
  }
  async function unpick(key: string) {
    setBusyFile(key);
    await fetch("/api/kickoff?file=" + key, { method: "DELETE", headers: { "x-kickoff-token": token } }).catch(() => null);
    setFiles(x => { const y = { ...x }; delete y[key]; return y; }); setBusyFile("");
  }

  async function submit() {
    for (let i = 0; i < steps.length; i++) { const m = missing(steps[i]); if (m) { go(i); setStepError(m); return; } }
    setSending(true); setStepError("");
    try {
      const clean = Object.fromEntries(Object.entries(answers).filter(([k]) => { const f = doc!.fields.find(x => x.key === k); return f && asked(f, answers); }));
      const r = await fetch("/api/kickoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, answers: clean }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't send the checklist.");
      try { localStorage.removeItem(draftKey); } catch { /* fine */ }
      setDone(true); top.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) { setStepError(err instanceof Error ? err.message : "Couldn't send the checklist."); }
    finally { setSending(false); }
  }

  function input(f: Field) {
    const v = answers[f.key] ?? "", k = kindOf(f), id = "ko-" + f.key;
    if (k === "long") return <textarea id={id} rows={4} placeholder={f.placeholder} value={v} onChange={e => set(f.key, e.target.value)} />;
    if (k === "select") return <div className="ko-opts" role="radiogroup" aria-labelledby={id + "-l"}>
      {f.options!.map(o => <button type="button" key={o} role="radio" aria-checked={v === o} className={"ko-opt" + (v === o ? " on" : "")} onClick={() => set(f.key, o)}><span className="ko-dot" aria-hidden="true" />{o}</button>)}
      {f.notes?.[v] && <p className="ko-note" role="status">{f.notes[v]}</p>}
    </div>;
    if (k === "choices" || k === "days") {
      const sel = list(v), custom = sel.filter(x => !f.options!.includes(x));
      const toggle = (o: string) => set(f.key, (sel.includes(o) ? sel.filter(x => x !== o) : [...sel, o]).join(SEP));
      return <div>
        <div className={"ko-chips" + (k === "days" ? " days" : "")} role="group" aria-labelledby={id + "-l"}>
          {[...f.options!, ...custom].map(o => <button type="button" key={o} aria-pressed={sel.includes(o)} className={"ko-chip" + (sel.includes(o) ? " on" : "")} onClick={() => toggle(o)}>{o}</button>)}
        </div>
        {k === "choices" && <AddOwn onAdd={o => { if (!sel.includes(o)) set(f.key, [...sel, o].join(SEP)); }} />}
      </div>;
    }
    if (k === "hours") {
      const [from = "", to = ""] = v.split(" to ");
      const put = (a: string, b: string) => set(f.key, a || b ? `${a} to ${b}` : "");
      return <div className="ko-hours">
        <select aria-label="From" value={from} onChange={e => put(e.target.value, to)}><option value="">From</option>{TIMES.map(t => <option key={t}>{t}</option>)}</select>
        <span>to</span>
        <select aria-label="To" value={to} onChange={e => put(from, e.target.value)}><option value="">To</option>{TIMES.map(t => <option key={t}>{t}</option>)}</select>
      </div>;
    }
    if (k === "file") {
      const up = files[f.key];
      return up ? <div className="ko-file has"><span className="ko-file-name">{up.name}</span><span className="ko-file-size">{kb(up.size)}</span>
          <button type="button" className="ko-link" disabled={busyFile === f.key} onClick={() => void unpick(f.key)}>Remove</button></div>
        : <label className={"ko-file" + (busyFile === f.key ? " busy" : "")}>
          <input id={id} type="file" accept={f.accept} disabled={!!busyFile} onChange={e => { void pick(f, e.target.files?.[0]); e.target.value = ""; }} />
          <span className="ko-file-btn">{busyFile === f.key ? "Uploading…" : "Choose a file or photo"}</span>
          <span className="ko-file-hint">{f.accept?.includes("csv") ? "Spreadsheet, PDF or photo" : "PDF or photo"}, up to 4 MB</span>
        </label>;
    }
    return <input id={id} value={v} placeholder={f.placeholder}
      type={k === "phone" ? "tel" : "text"} inputMode={k === "phone" ? "tel" : k === "url" ? "url" : undefined}
      autoComplete={k === "phone" ? "tel" : k === "url" ? "url" : f.key === "business_address" ? "street-address" : f.key === "legal_name" ? "organization" : undefined}
      onChange={e => set(f.key, e.target.value)} />;
  }

  const shown = (g: string) => doc!.fields.filter(f => f.group === g && asked(f, answers));
  const answerText = (f: Field) => kindOf(f) === "file" ? (files[f.key]?.name ?? "") : (answers[f.key] ?? "").trim();
  const pct = doc ? Math.round((Math.min(step, steps.length) / steps.length) * 100) : 0;

  return <div className="ko-page" ref={top}>
    <header className="ko-top"><BrandLogo mono className="ko-logo" title={brand.businessName} /></header>
    <main className="ko-main">
      {error ? <div className="ko-msg"><h1>Link not available</h1><p>{error}</p></div>
        : !doc ? <p className="ko-muted">Loading your checklist…</p>
        : done || doc.status === "submitted" ? <div className="ko-msg">
            <h1>Got it. Thank you.</h1>
            <p>{brand.ownerFirstName} will text you within one business day to book a short setup call. On that call we forward your missed calls and connect your forms together.</p>
            <p>Most shops are live within 14 days. You read and approve every message before anything goes out.</p>
          </div>
        : <>
          <div className="ko-progress" aria-hidden="true"><span style={{ width: pct + "%" }} /></div>
          <p className="ko-step">{review ? "Last step" : `Step ${step + 1} of ${steps.length}`}</p>
          {step === 0 && <div className="ko-intro"><h1>Let’s set up {doc.client || "your shop"}</h1>
            <p>About 10 minutes. Your answers save on this device as you go, so you can stop and come back.</p></div>}
          {!review ? <section className="ko-card" aria-labelledby="ko-group">
            <h2 id="ko-group">{steps[step]}</h2>
            {shown(steps[step]).map(f => <div className="ko-field" key={f.key}>
              <label className="ko-l" id={"ko-" + f.key + "-l"} htmlFor={["select", "choices", "days", "hours"].includes(kindOf(f)) ? undefined : "ko-" + f.key}>{f.label}{!f.required && <i> (optional)</i>}</label>
              {f.help && <p className="ko-help">{f.help}</p>}
              {input(f)}
            </div>)}
            {stepError && <p className="ko-err" role="alert">{stepError}</p>}
            <div className="ko-nav">
              {step > 0 ? <button type="button" className="ko-back" onClick={() => go(step - 1)}>Back</button> : <span />}
              <button type="button" className="ko-next" disabled={!!busyFile} onClick={next}>{step === steps.length - 1 ? "Review" : "Continue"}</button>
            </div>
          </section>
          : <section className="ko-card" aria-labelledby="ko-review">
            <h2 id="ko-review">Check your answers</h2>
            {steps.map((g, i) => <div className="ko-rev" key={g}>
              <div className="ko-rev-head"><h3>{g}</h3><button type="button" className="ko-link" onClick={() => go(i)}>Edit</button></div>
              <dl>{shown(g).map(f => <div key={f.key}><dt>{f.label}</dt><dd>{answerText(f) || <span className="ko-muted">Skipped</span>}</dd></div>)}</dl>
            </div>)}
            {stepError && <p className="ko-err" role="alert">{stepError}</p>}
            <div className="ko-nav">
              <button type="button" className="ko-back" onClick={() => go(steps.length - 1)}>Back</button>
              <button type="button" className="ko-next" disabled={sending} onClick={() => void submit()}>{sending ? "Sending…" : "Send to " + (brand.ownerFirstName || "Cinder")}</button>
            </div>
          </section>}
          <p className="ko-fine">Only {brand.businessName} sees this. Please don’t type passwords here; we send access invites instead.</p>
        </>}
    </main>
  </div>;
}

function AddOwn({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  const add = () => { const t = v.trim().slice(0, 60); if (t) { onAdd(t); setV(""); } };
  return <div className="ko-own">
    <input value={v} placeholder="Add your own" aria-label="Add your own" onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
    <button type="button" className="ko-back" onClick={add} disabled={!v.trim()}>Add</button>
  </div>;
}
