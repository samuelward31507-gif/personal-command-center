"use client";

// The end of a job and the customer's side of it. SignoffSheet: a short walk-through checklist, a note, the customer's name
// and their signature drawn on the phone. SignoffBox: the sign-off on the record. PortalSheet: the customer's own page.
import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/crm";
import { Icon, Sheet, Spinner, dateLabel, first, type Api, type Toast } from "./parts";
import { crewName } from "./crew";
import type { Data } from "./types";

const CHECKS = (trade: string) => ["The work matches the quote", "Site cleaned up, debris hauled away", ...(/fenc/i.test(trade) ? ["Gates open, close and latch"] : []), "Walked the finished job together"];

/** A signature pad: finger or mouse, smooth enough to look like a signature, exported as a small PNG. */
function SignaturePad({ onChange }: { onChange: (png: string) => void }) {
  const cv = useRef<HTMLCanvasElement>(null), last = useRef<{ x: number; y: number } | null>(null), ink = useRef(false), [inked, setInked] = useState(false);
  useEffect(() => { const c = cv.current!; const r = c.getBoundingClientRect(); c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2);
    const g = c.getContext("2d")!; g.scale(2, 2); g.lineWidth = 2.2; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#121417"; }, []);
  const at = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const done = () => { last.current = null; if (!ink.current) return; const c = cv.current!, out = document.createElement("canvas"); out.width = 600; out.height = Math.round(600 * c.height / c.width);
    out.getContext("2d")!.drawImage(c, 0, 0, out.width, out.height); onChange(out.toDataURL("image/png")); };
  return <div className="sigpad">
    <canvas ref={cv} aria-label="Sign here" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); last.current = at(e); }}
      onPointerMove={e => { if (!last.current) return; const p = at(e), g = cv.current!.getContext("2d")!; g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke(); last.current = p; if (!ink.current) { ink.current = true; setInked(true); } }}
      onPointerUp={done} onPointerCancel={done} />
    <span className="sigline" aria-hidden="true">Sign here</span>
    {inked && <button type="button" className="link sigclear" onClick={() => { const c = cv.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); ink.current = false; setInked(false); onChange(""); }}>Clear</button>}
  </div>;
}

/** Hand the phone to the customer: they check the work, sign, and the job's install and walk-through steps tick. */
export function SignoffSheet({ card, trade, onClose, save }: { card: Card; trade: string; onClose: () => void; save: (input: Record<string, unknown>) => Promise<boolean> }) {
  const [checks, setChecks] = useState(() => CHECKS(trade).map(label => ({ label, done: false })));
  const [name, setName] = useState(card.name), [note, setNote] = useState(""), [sig, setSig] = useState(""), [busy, setBusy] = useState(false), [extra, setExtra] = useState("");
  const ready = name.trim().length >= 2 && !!sig;
  return <Sheet onClose={onClose} title="Finish the job" sub={`${card.name}, signed on this phone`}
    foot={<><span className="fine" style={{ marginRight: "auto" }}>{checks.filter(c => c.done).length} of {checks.length} checked</span><button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn ink" disabled={busy || !ready} onClick={async () => { setBusy(true); if (await save({ signedBy: name, signature: sig, note, checklist: checks })) onClose(); setBusy(false); }}>{busy ? <Spinner /> : "Sign off the job"}</button></>}>
    <p className="sec">Walk it together</p>
    <div className="checks">{checks.map((c, k) => <label key={k} className="check"><input type="checkbox" checked={c.done} onChange={e => setChecks(xs => xs.map((x, j) => j === k ? { ...x, done: e.target.checked } : x))} /><span>{c.label}</span></label>)}
      <form className="acts-row" onSubmit={e => { e.preventDefault(); if (extra.trim()) { setChecks(xs => [...xs, { label: extra.trim().slice(0, 80), done: true }]); setExtra(""); } }}>
        <input className="input" style={{ flex: 1 }} value={extra} maxLength={80} onChange={e => setExtra(e.target.value)} placeholder="Add a check, like Sprinkler heads back in place" /><button type="submit" className="btn sm">Add</button></form></div>
    <label className="field"><span>Anything to note <em>optional, it goes on their record</em></span><textarea rows={2} value={note} maxLength={600} onChange={e => setNote(e.target.value)} placeholder="Touch-up on the gate post next week. Left the extra pickets in the garage." /></label>
    <label className="field"><span>Customer name</span><input value={name} maxLength={80} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
    <SignaturePad onChange={setSig} />
    <p className="fine">By signing, {first(name || card.name)} confirms the job is done as described. The signature is kept with the job and shows on their customer page.</p>
  </Sheet>;
}

/** On the record: who signed and when, their signature, the checks and the note. Or the button that starts it. */
export function SignoffBox({ d, card, trade, save }: { d: Data; card: Card; trade: string; save: (input: Record<string, unknown>) => Promise<boolean> }) {
  const [open, setOpen] = useState(false), s = card.signoff;
  return <section className="card"><div className="hd"><h2>Sign-off</h2>{s && <small style={{ marginLeft: "auto" }} className="dot good">Signed {dateLabel(s.at)}</small>}</div>
    {s ? <>
      <div className="money"><span>Signed by</span><b>{s.signed_by}</b></div>
      {s.member && <div className="money"><span>On the phone of</span><b>{crewName(d, s.member)}</b></div>}
      <img className="sigimg" src={s.id.startsWith("data:") ? s.id : `/api/app/signature?id=${s.id}`} alt={`${s.signed_by}'s signature`} />
      {s.checklist.length > 0 && <ul className="sigchecks">{s.checklist.map((c, k) => <li key={k} className={c.done ? "ok" : ""}><Icon name={c.done ? "check" : "x"} size={11} />{c.label}</li>)}</ul>}
      {s.note && <p className="fine" style={{ marginTop: 6 }}>{s.note}</p>}
    </> : <><p className="fine">When the work&rsquo;s done, hand {first(card.name)} the phone: a quick walk-through checklist and their signature. Proof it was done right, and the job moves to invoice.</p>
      <div className="acts-row" style={{ marginTop: 8 }}><button type="button" className="btn sm ink" onClick={() => setOpen(true)}><Icon name="check" size={13} />Finish the job</button></div></>}
    {open && <SignoffSheet card={card} trade={trade} onClose={() => setOpen(false)} save={save} />}
  </section>;
}

/** The customer's own page: one private link with their quotes, invoices, change orders, visits and after photos. */
export function PortalSheet({ name, thread, project, api, toast, canText, onClose }: { name: string; thread: string; project: string; api: Api; toast: Toast; canText: boolean; onClose: () => void }) {
  const [link, setLink] = useState(""), [busy, setBusy] = useState("");
  useEffect(() => { void api<{ link: string }>("/api/app/act", { p: project, action: "portallink", thread }).then(r => setLink(r.link)).catch(e => toast(e instanceof Error ? e.message : "Couldn't make the link.", true)); }, [api, project, thread, toast]);
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast("Link copied."); } catch { prompt("Copy the link:", link); } };
  const text = async () => { setBusy("text"); try { const r = await api<{ sent?: boolean; warn?: string }>("/api/app/act", { p: project, action: "portallink", thread, send: true }); toast(r.sent ? `Texted ${first(name)} their page.` : r.warn || "Ready.", !r.sent); if (r.sent) onClose(); } catch (e) { toast(e instanceof Error ? e.message : "Didn't send.", true); } finally { setBusy(""); } };
  return <Sheet onClose={onClose} title={`${first(name)}'s page`} sub="Private to them, always up to date"
    foot={<><a className={"btn" + (link ? "" : " disabled")} href={link || undefined} target="_blank" rel="noreferrer"><Icon name="expand" size={13} />Open it</a><span style={{ flex: 1 }} />
      <button type="button" className="btn" disabled={!link} onClick={() => void copy()}>Copy link</button>
      <button type="button" className="btn ink" disabled={!link || !canText || !!busy} onClick={() => void text()}>{busy ? <Spinner /> : `Text it to ${first(name)}`}</button></>}>
    <p>One link where {first(name)} sees everything with you, any time, no account or password:</p>
    <ul className="plain-list"><li>Quotes to look over and approve</li><li>Invoices with what&rsquo;s still owed and your Pay button</li><li>Change orders to approve</li><li>Their next estimate, install day or service visit</li><li>After photos and the job sign-off</li></ul>
    <label className="field"><span>Their link</span><input readOnly value={link || "Making the link…"} onFocus={e => e.target.select()} /></label>
    <p className="fine">Anyone with the link can see this page, so send it only to {first(name)}. It never shows your costs, notes or other customers.</p>
  </Sheet>;
}
