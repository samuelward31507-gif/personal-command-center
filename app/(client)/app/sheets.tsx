"use client";

// The sheets that add people: one lead by hand, a whole customer list from Jobber or a spreadsheet, and the
// win-back text to past customers who opted in.
import { useMemo, useState } from "react";
import { jobFields } from "@/lib/crm";
import { IMPORT_BATCH, importSummary, readImportCsv, type ImportAs, type ImportRead } from "@/lib/customer-import";
import { Avatar, Icon, Sheet, Spinner, fmtPhone, useArm, type Api, type Toast } from "./parts";
import type { Biz, Customer, Winback } from "./types";

export function AddLeadSheet({ trade, project, api, toast, reload, onClose }: { trade: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [d, setD] = useState<Record<string, string>>({}), [notes, setNotes] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10})/, "");
  const submit = async () => {
    setBusy(true); setErr("");
    try { await api("/api/app/act", { p: project, action: "lead", name, phone: digits, details: d, notes }); toast("Added to New."); await reload(); onClose(); }
    catch (er) { setErr(er instanceof Error ? er.message : "Couldn't add it."); } finally { setBusy(false); }
  };
  return <Sheet onClose={onClose} title="Add a lead" sub="Calls, referrals, walk-ins. Cinder won't text leads you add."
    foot={<button type="button" className="btn ink" disabled={busy || digits.length !== 10} onClick={() => void submit()}>{busy ? <Spinner /> : "Add lead"}</button>}>
    <form onSubmit={e => { e.preventDefault(); if (digits.length === 10) void submit(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="two">
        <label className="field"><span>Name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Dana Ruiz" autoFocus /></label>
        <label className="field"><span>Phone</span><input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(720) 555-0148" /></label>
      </div>
      <p className="sec" style={{ margin: 0 }}>The job</p>
      <div className="fields">{jobFields(trade).map(f => <label key={f.key} className={"field" + (f.key === "address" ? " full" : "")}><span>{f.label}</span>
        {f.kind === "choice" ? <select value={d[f.key] ?? ""} onChange={e => setD(x => ({ ...x, [f.key]: e.target.value }))}><option value="">–</option>{f.options!.map(o => <option key={o}>{o}</option>)}</select>
          : <span className="inwrap"><input inputMode={f.kind === "number" ? "decimal" : undefined} value={d[f.key] ?? ""} onChange={e => setD(x => ({ ...x, [f.key]: e.target.value }))} placeholder="Not set" />{f.unit && <em>{f.unit}</em>}</span>}</label>)}
        <label className="field full"><span>Notes</span><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </form>
  </Sheet>;
}

/**
 * The owner's existing customers, from a Jobber export or any spreadsheet saved as CSV. The file is read right here
 * in the browser so they see what's in it before anything is saved. Then it goes up in batches. Nobody gets a text.
 */
export function ImportSheet({ project, api, toast, reload, onClose, customers, business }: { project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void; customers: Customer[]; business: string }) {
  const [read, setRead] = useState<ImportRead | null>(null), [fileName, setFileName] = useState(""), [err, setErr] = useState("");
  const [as, setAs] = useState<ImportAs>("customers"), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(0);
  const [paste, setPaste] = useState(false), [text, setText] = useState("");
  const here = useMemo(() => new Set(customers.map(c => c.phone.replace(/\D/g, "").slice(-10))), [customers]);
  const load = (name: string, body: string) => { const r = readImportCsv(body); if ("error" in r) { setRead(null); setErr(r.error); } else { setRead(r); setErr(""); setFileName(name); } };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5_000_000) { setErr("That file is over 5 MB. Export a smaller list, or just the tags you need."); return; }
    f.text().then(t => load(f.name, t), () => setErr("Couldn't read that file."));
  };
  const already = read ? read.rows.filter(r => here.has(r.phone.slice(-10))).length : 0;
  async function go() {
    if (!read) return;
    setBusy(true); setErr(""); setDone(0);
    let added = 0, existing = 0;
    try {
      for (let i = 0; i < read.rows.length; i += IMPORT_BATCH) {
        const r = await api<{ added: number; existing: number }>("/api/app/act", { p: project, action: "import", rows: read.rows.slice(i, i + IMPORT_BATCH), as, consent: as === "customers" && consent, from: read.jobber ? "jobber" : "csv" });
        added += r.added; existing += r.existing; setDone(Math.min(read.rows.length, i + IMPORT_BATCH));
      }
      toast(importSummary({ added, existing, skipped: read.skipped.length, as }));
      await reload(); onClose();
    } catch (e) {
      setErr((e instanceof Error ? e.message : "That didn't work.") + (added ? ` ${added} went in before it stopped. Running the same file again is safe: nobody is added twice.` : ""));
    } finally { setBusy(false); }
  }
  return <Sheet onClose={onClose} title="Import customers" sub="From Jobber or any spreadsheet"
    foot={read ? <><button type="button" className="btn" onClick={() => { setRead(null); setErr(""); }}>Change file</button><span style={{ flex: 1 }} /><button type="button" className="btn ink" disabled={busy || !read.rows.length} onClick={() => void go()}>
      {busy ? `Importing ${done} of ${read.rows.length}…` : `Import ${read.rows.length} ${as === "leads" ? (read.rows.length === 1 ? "lead" : "leads") : (read.rows.length === 1 ? "customer" : "customers")}`}</button></> : undefined}>
    {!read ? <>
      <label className="drop">
        <input type="file" accept=".csv,text/csv,text/plain" onChange={e => onFile(e.target.files?.[0])} aria-label="Choose a CSV file" />
        <Icon name="upload" size={22} /><b>Choose a CSV file</b>
        <small>Any spreadsheet saved as CSV works. Each row needs a phone number.</small>
      </label>
      <div className="howto"><b>From Jobber, three steps</b><ol><li>In Jobber, open Clients and choose More actions, then Export.</li><li>Jobber emails you a CSV. Save it to this phone or computer.</li><li>Choose it above. Names, addresses, emails, tags and notes come along. Nobody gets a text.</li></ol></div>
      {paste ? <>
        <label className="field"><span>Rows</span><textarea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={"Name, Phone, Address\nDana Ruiz, (720) 555-0177, 2210 Oak Dr"} /></label>
        <div className="acts-row end"><button type="button" className="btn ink" disabled={!text.trim()} onClick={() => load("Pasted rows", text)}>Read rows</button></div>
      </> : <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => setPaste(true)}>Or paste rows from a spreadsheet</button>}
      {err && <p className="err" role="alert">{err}</p>}
    </> : <>
      <div><p className="sec"><span>{fileName}</span>{read.jobber && <span className="tag green">Jobber export</span>}</p>
        <dl className="counts">
          <div><dt>Ready</dt><dd>{read.rows.length - already}</dd></div>
          {already > 0 && <div><dt>Already here</dt><dd>{already}</dd></div>}
          {read.skipped.length > 0 && <div><dt>No phone</dt><dd>{read.skipped.length}</dd></div>}
          {read.duplicates > 0 && <div><dt>Repeats</dt><dd>{read.duplicates}</dd></div>}
        </dl></div>
      <ul className="rows" aria-label="First rows">{read.rows.slice(0, 6).map(r => <li key={r.phone}>
        <Avatar name={r.name || r.phone} /><span style={{ minWidth: 0 }}><b>{r.name || fmtPhone(r.phone)}</b><small>{[fmtPhone(r.phone), r.address].filter(Boolean).join(", ")}</small></span>
        {here.has(r.phone.slice(-10)) && <span className="tag">Already here</span>}</li>)}
        {read.rows.length > 6 && <li className="fine" style={{ minHeight: 32 }}>and {read.rows.length - 6} more</li>}</ul>
      {read.skipped.length > 0 && <details className="skipped"><summary>{read.skipped.length} skipped with no phone number</summary>
        <ul>{read.skipped.slice(0, 25).map(s => <li key={s.line}>Row {s.line}: {s.name}</li>)}{read.skipped.length > 25 && <li>and {read.skipped.length - 25} more</li>}</ul></details>}
      <div><p className="sec">They are</p>
        <div className="seg full" role="radiogroup" aria-label="Import as">
          <button type="button" role="radio" aria-checked={as === "customers"} className={as === "customers" ? "on" : ""} onClick={() => setAs("customers")}>Past customers</button>
          <button type="button" role="radio" aria-checked={as === "leads"} className={as === "leads" ? "on" : ""} onClick={() => setAs("leads")}>Open leads</button>
        </div>
        <p className="fine" style={{ marginTop: 8 }}>{as === "customers" ? "They go in Customers as past customers. They stay off Jobs until they text in or you move them." : "They land in New on Jobs as yours. Cinder won’t text them."}</p></div>
      {as === "customers" && <label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span><b>They agreed to get texts from {business || "you"}</b><small>Tick this only if they opted in. It goes on each number&rsquo;s consent record and lets your win-back texts reach them.</small></span></label>}
      {err && <p className="err" role="alert">{err}</p>}
    </>}
  </Sheet>;
}

export function WinbackSheet({ w, biz, project, api, toast, reload, onClose }: { w: Winback; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const [body, setBody] = useState(w.draft), [busy, setBusy] = useState(false), [arm, setArm] = useArm(), [err, setErr] = useState("");
  const sample = w.names[0] || "Dana";
  const preview = body.replace(/\s*\{first\}(?=[,!.?])/g, " " + sample).replace(/\{first\}/g, sample).replace(/\{business\}/g, biz.business).replace(/\{owner\}/g, biz.owner);
  const many = w.eligible === 1 ? "1 customer" : `${w.eligible} customers`;
  const send = async () => {
    if (arm !== "go") { setArm("go"); return; }
    setBusy(true); setErr("");
    try { const r = await api<{ sent: number; left: number }>("/api/app/act", { p: project, action: "winback", body }); toast(`Sent to ${r.sent} ${r.sent === 1 ? "customer" : "customers"}.${r.left ? ` ${r.left} more tomorrow.` : ""}`); await reload(); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Didn't send."); } finally { setBusy(false); setArm(""); }
  };
  return <Sheet onClose={onClose} title="Text past customers" sub="Won jobs, 30+ days old, who opted in to offers"
    foot={w.eligible > 0 ? <button type="button" className="btn ink" disabled={busy || body.trim().length < 20} onClick={() => void send()}>{busy ? <Spinner /> : arm === "go" ? `Tap again to text ${many}` : `Send to ${many}`}</button> : undefined}>
    <div className="wb-count">
      <div><b>{w.past}</b><span>past {w.past === 1 ? "customer" : "customers"}</span></div>
      <div className="on"><b>{w.eligible}</b><span>can get this text</span></div>
    </div>
    <p className="fine">Only customers who opted in to offers on your form or on import. Max one text every 90 days.</p>
    {w.eligible > 0 ? <>
      <label className="field"><span>Your text <em>{body.length}/320, {"{first}"} is their first name</em></span><textarea rows={4} value={body} maxLength={320} onChange={e => { setBody(e.target.value); setErr(""); setArm(""); }} /></label>
      <div><p className="sec">{sample}&rsquo;s phone</p><span className="bubble out" style={{ fontSize: 13.5 }}>{preview}{"\n\n"}Reply STOP to opt out.</span></div>
      {err && <p className="err" role="alert">{err}</p>}
    </> : <p className="fine">No one to text yet. Customers who opt in on your website form, or whose consent you confirm on import, show up here.</p>}
  </Sheet>;
}
