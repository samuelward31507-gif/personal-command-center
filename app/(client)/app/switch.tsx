"use client";

// The switch-over center: bring the whole business in from the old tool in one sitting, run both for a week, then cancel.
// Five steps, saved on the server as they go, so the owner can stop and come back: where from, connect or add files,
// check what's coming (merges, missing phones), bring it in (a real progress bar), then verify and go live.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXPORT_STEPS, FIELDS, GOLIVE, KIND_LABEL, SOURCES, guessKind, guessMapping, readSheet, sourceFromSoftware, stageSheet, stageVcards, emptyStaged,
  type Kind, type Mapping, type Preview, type Sheet, type SourceKey, type Staged } from "@/lib/switch";
import { PageHead } from "./charts";
import { Icon, Spinner, dateLabel, usd, type Api, type Toast, inDemo } from "./parts";
import type { Data, Go } from "./types";

type View = { id: string; source: SourceKey; status: string; preview: Preview | null; pull: { kind?: number; done?: boolean; counts?: Record<string, number>; warnings?: string[] }; progress: number; total: number;
  result: Record<string, { created: number; updated: number; skipped: number }>; error: string; created_at: string; finished_at: string | null; undone_at: string | null; canUndo: boolean; existing: number };
type Got = { import: View | null; golive?: Record<string, string>; goliveStart?: string | null };
const NAME: Record<string, string> = Object.fromEntries(SOURCES.map(s => [s.key, s.name]));
const MARK: Record<string, string> = { jobber: "J", housecall: "H", servicetitan: "ST", quickbooks: "qb", contacts: "@", spreadsheet: "csv", none: "—" };

export function SwitchScreen({ d, project, api, toast, reload, go }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go }) {
  const appName = `${(d.business || "Your").replace(/\s*\(example\)$/, "").replace(/\.+$/, "")} app`;
  const [got, setGot] = useState<Got | null>(null), [busy, setBusy] = useState(""), [pick, setPick] = useState<SourceKey>(sourceFromSoftware(d.setup?.software));
  const [step, setStep] = useState<number | null>(null);
  const load = useCallback(async () => { try { const g = await api<Got>(`/api/app/switch?p=${project}`); setGot(g); if (g.import?.source) setPick(g.import.source); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't load.", true); } }, [api, project, toast]);
  useEffect(() => { void load(); }, [load]);
  const imp = got?.import && got.import.status !== "undone" ? got.import : null;
  const auto = !imp ? 1 : imp.status === "done" ? 5 : imp.status === "running" ? 4 : imp.preview ? 3 : 2;
  const at = imp?.status === "done" || imp?.status === "running" ? auto : step ?? auto;
  const post = async (body: Record<string, unknown>) => { const r = await api<{ import: View | null; done?: boolean }>("/api/app/switch", { p: project, ...body }); setGot(g => ({ ...(g ?? { import: null }), import: r.import })); return r; };
  const act = async (key: string, body: Record<string, unknown>, done?: string) => { setBusy(key); try { const r = await post(body); if (done) toast(done); return r; } catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); return null; } finally { setBusy(""); } };

  const steps = ["Where from", "Connect or add files", "Check it", "Bring it in", "Go live"];
  return <>
    <PageHead title={`Move to ${appName}`} sub={`Step ${at} of 5. ${steps[at - 1]}.`} actions={at > 1 && at < 4 ? <button type="button" className="btn ghost" onClick={() => setStep(at - 1)}><Icon name="back" size={14} />Back</button> : undefined} />
    <div className="dash sw">
      <ol className="sw-steps" aria-label="Steps">{steps.map((s, i) => <li key={s} className={i + 1 < at ? "done" : i + 1 === at ? "on" : ""}><i>{i + 1 < at ? <Icon name="check" size={10} /> : i + 1}</i><span>{s}</span></li>)}</ol>
      {!got ? <section className="panel"><div className="panel-b skel-rows" style={{ padding: 18 }}><i className="skel" /><i className="skel" /></div></section>
        : at === 1 ? <PickSource pick={pick} setPick={setPick} busy={busy} onNext={async () => { if (pick === "none") { setStep(5); return; } const r = await act("start", { action: "start", source: pick }); if (r) setStep(2); }} />
        : at === 2 ? <Connect d={d} imp={imp} source={imp?.source ?? pick} busy={busy} act={act} toast={toast} onNext={() => setStep(3)} />
        : at === 3 && imp?.preview ? <Check imp={imp} busy={busy} act={act} onRun={async () => { setStep(4); await runAll(); }} />
        : at === 3 ? <section className="panel"><div className="panel-b"><p className="fine" style={{ padding: "12px 0" }}>Nothing read yet. Go back and connect or add a file.</p></div></section>
        : at === 4 ? <Running imp={imp} busy={busy} onContinue={() => void runAll()} />
        : <GoLive d={d} imp={got.import} golive={got.golive ?? {}} start={got.goliveStart ?? null} appName={appName} busy={busy} project={project} api={api} toast={toast}
            onTick={async (k, v) => { await api("/api/app/switch", { p: project, action: "golive", key: k, done: v }); setGot(g => g && ({ ...g, golive: { ...(g.golive ?? {}), ...(v ? { [k]: new Date().toISOString().slice(0, 10) } : {}) }, ...(v ? {} : { golive: Object.fromEntries(Object.entries(g.golive ?? {}).filter(([x]) => x !== k)) }) })); }}
            onUndo={async () => { const r = await act("undo", { action: "undo", id: got.import!.id }, "Move undone. The customers it added are hidden, and everything it changed is back."); if (r) { await reload(); await load(); } }}
            onAgain={() => { setStep(1); setGot(g => g && ({ ...g, import: g.import && g.import.status === "done" ? { ...g.import, status: "undone" } : g.import })); }} go={go} />}
    </div>
  </>;

  async function runAll() {
    if (!imp) return;
    setBusy("run");
    try {
      for (let k = 0; k < 400; k++) { const r = await post({ action: "run", id: imp.id }); if (r.done) { toast("Everything's in."); await reload(); break; } }
    } catch (e) { toast(e instanceof Error ? e.message : "The move stopped. Tap Continue.", true); await load(); }
    finally { setBusy(""); }
  }
}

function PickSource({ pick, setPick, busy, onNext }: { pick: SourceKey; setPick: (s: SourceKey) => void; busy: string; onNext: () => void }) {
  return <section className="panel"><div className="panel-h"><h2>Where are you coming from?</h2><small>you can add more later</small></div>
    <div className="panel-b">
      <div className="sw-sources" role="radiogroup" aria-label="Where you're coming from">{SOURCES.map(s => <button key={s.key} type="button" role="radio" aria-checked={pick === s.key} className={"sw-src" + (pick === s.key ? " on" : "")} onClick={() => setPick(s.key)}>
        <span className={"sw-mark m-" + s.key} aria-hidden="true">{MARK[s.key]}</span><span className="t"><b>{s.name}</b><small>{s.how === "connect" ? "Connect, or add its export files" : s.how === "none" ? "Skip to going live" : s.key === "contacts" ? "A contacts file from your phone" : "Add its export files"}</small></span></button>)}</div>
      <div className="acts-row end" style={{ marginTop: 14 }}><button type="button" className="btn ink" disabled={!!busy} onClick={onNext}>{busy ? <Spinner /> : "Continue"}</button></div>
    </div></section>;
}

type Act = (key: string, body: Record<string, unknown>, done?: string) => Promise<{ import: View | null; done?: boolean } | null>;
function Connect({ d, imp, source, busy, act, toast, onNext }: { d: Data; imp: View | null; source: SourceKey; busy: string; act: Act; toast: Toast; onNext: () => void }) {
  const conn = source === "jobber" ? d.jobber : source === "quickbooks" ? (d.quickbooks ? { ...d.quickbooks, account: d.quickbooks.company } : undefined) : undefined;
  const pulling = busy === "pull", p = imp?.pull ?? {};
  const pullAll = async () => { if (!imp) return; for (let k = 0; k < 600; k++) { const r = await act("pull", { action: "pull", id: imp.id }); if (!r || r.import?.pull?.done) break; } };
  const stepsFor = EXPORT_STEPS[source === "quickbooks" ? "spreadsheet" : source] ?? EXPORT_STEPS.spreadsheet;
  const counts = imp?.preview;
  return <>
    {(source === "jobber" || source === "quickbooks") && <section className="panel"><div className="panel-h"><h2>Connect {NAME[source]}</h2>{conn?.connected && <small className="dot good">Connected{conn.account ? `, ${conn.account}` : ""}</small>}</div>
      <div className="panel-b">
        {conn?.connected ? <>
          <p className="fine">{source === "jobber" ? "Pulls clients and their properties, requests, quotes with their lines and status, jobs and visits, invoices with what's paid and owed, notes, attachment links and your products." : "Pulls customers, your products and services (into the price list), and every invoice that still has a balance, with what's been paid."} Nothing changes in {NAME[source]}.</p>
          {p.counts && <ul className="sw-pull">{Object.entries(p.counts).map(([k, n]) => <li key={k}><span>{k === "productOrServices" ? "products" : k}</span><b>{n}</b></li>)}</ul>}
          {(p.warnings ?? []).map((w, i) => <p key={i} className="fine warn">{w}</p>)}
          <div className="acts-row end" style={{ marginTop: 10 }}>{p.done ? <span className="dot good" style={{ marginRight: "auto" }}>Everything {NAME[source]} shared is read</span> : null}
            <button type="button" className={"btn" + (p.done ? "" : " ink")} disabled={!!busy || !imp} onClick={() => void pullAll()}>{pulling ? <><Spinner />Reading {NAME[source]}…</> : p.done ? "Read again" : `Read everything from ${NAME[source]}`}</button></div>
        </> : <>
          <p className="fine">One tap: sign in to {NAME[source]} and allow it. You come back here.</p>
          <div className="acts-row" style={{ marginTop: 10 }}>{conn?.connectUrl ? <a className="btn ink" href={conn.connectUrl} target="_blank" rel="noreferrer">Connect {NAME[source]}</a> : <span className="fine">The {NAME[source]} connection isn&rsquo;t switched on for this account yet. Use the export files below.</span>}</div>
        </>}
      </div></section>}
    <section className="panel"><div className="panel-h"><h2>{source === "jobber" || source === "quickbooks" ? `Or add ${NAME[source]}'s export files` : `Add ${NAME[source] ?? "your"} files`}</h2><small>{stepsFor.files}</small></div>
      <div className="panel-b">
        <ol className="sw-how">{stepsFor.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <FileAdder source={source} imp={imp} busy={busy} act={act} toast={toast} />
      </div></section>
    {counts && <section className="panel"><div className="panel-b sw-sofar"><span>Read so far: <b>{counts.sourceCustomers}</b> customers, <b>{counts.openQuotes}</b> open quotes, <b>{counts.unpaidInvoices}</b> unpaid invoices, <b>{counts.items}</b> price list items.</span>
      <button type="button" className="btn ink" disabled={!!busy} onClick={onNext}>Check it</button></div></section>}
  </>;
}

/** A file in: a spreadsheet (match its columns, see 5 rows) or a contacts file. Read here; cleaned again on the server. */
function FileAdder({ source, imp, busy, act, toast }: { source: SourceKey; imp: View | null; busy: string; act: Act; toast: Toast }) {
  const [file, setFile] = useState<{ name: string; sheet: Sheet; kind: Kind; map: Mapping } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function read(f: File) {
    const text = await f.text();
    if (/\.vcf$/i.test(f.name) || /^BEGIN:VCARD/i.test(text.trimStart())) {
      const { staged, skipped } = stageVcards(text);
      await send(staged, `${staged.customers.length} contacts read${skipped ? `, ${skipped} with no name or phone left out` : ""}.`);
      return;
    }
    const sheet = readSheet(text);
    if ("error" in sheet) { toast(sheet.error, true); return; }
    const kind = guessKind(sheet.headers);
    setFile({ name: f.name, sheet, kind, map: guessMapping(sheet.headers, kind) });
  }
  async function send(s: Staged, done: string) { if (!imp) return; await act("stage", { action: "stage", id: imp.id, rows: s }, done); }
  const fields = file ? FIELDS[file.kind] : [];
  const sample = useMemo(() => file ? stageSheet({ headers: file.sheet.headers, rows: file.sheet.rows.slice(0, 5) }, file.kind, file.map, source).staged : emptyStaged(), [file, source]);
  return <div className="sw-file">
    <input ref={input} type="file" accept=".csv,.txt,.vcf,text/csv,text/vcard" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
    {!file ? <button type="button" className="btn" disabled={!imp || !!busy} onClick={() => input.current?.click()}><Icon name="upload" size={14} />Add a file</button>
      : <div className="sw-map">
        <div className="sw-map-h"><b>{file.name}</b><span className="fine">{file.sheet.rows.length} rows</span>
          <label className="field inline"><span>This file is</span><select value={file.kind} onChange={e => { const k = e.target.value as Kind; setFile({ ...file, kind: k, map: guessMapping(file.sheet.headers, k) }); }}>{(Object.keys(KIND_LABEL) as Kind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label></div>
        <div className="sw-cols">{fields.map(f => <label key={f.key} className="field"><span>{f.label}</span>
          <select value={file.map[f.key] ?? -1} onChange={e => setFile({ ...file, map: { ...file.map, [f.key]: Number(e.target.value) } })}><option value={-1}>Not in this file</option>{file.sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}</select></label>)}</div>
        <p className="sec" style={{ marginTop: 10 }}>The first 5 rows, as they&rsquo;ll come in</p>
        <SamplePreview kind={file.kind} s={sample} />
        <div className="acts-row end" style={{ marginTop: 10 }}>
          <button type="button" className="btn ghost" onClick={() => setFile(null)}>Cancel</button>
          <button type="button" className="btn ink" disabled={!!busy} onClick={async () => { const { staged, skipped } = stageSheet(file.sheet, file.kind, file.map, source); await send(staged, `${file.sheet.rows.length - skipped.length} rows read${skipped.length ? `, ${skipped.length} left out (${skipped[0].why.toLowerCase()} on line ${skipped[0].line}${skipped.length > 1 ? " and others" : ""})` : ""}.`); setFile(null); }}>{busy === "stage" ? <Spinner /> : `Add these ${file.sheet.rows.length} rows`}</button>
        </div>
      </div>}
  </div>;
}
function SamplePreview({ kind, s }: { kind: Kind; s: Staged }) {
  const rows: string[][] = kind === "customers" ? s.customers.map(c => [c.name || "–", c.phone ? c.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "No phone", c.email || "–", c.properties[0]?.address || "–"])
    : kind === "items" ? s.items.map(i => [i.name, i.unit || "–", usd(i.price), i.cost ? usd(i.cost) : "–"])
    : kind === "quotes" ? s.quotes.map(q => [q.customerRef.replace(/^[pen]:/, ""), q.number || "–", q.status, usd(q.total)])
    : kind === "jobs" ? s.jobs.map(j => [j.customerRef.replace(/^[pen]:/, ""), j.title, j.status, j.start ? dateLabel(j.start) : "–"])
    : kind === "payments" ? (s.payments ?? []).map(x => [x.customerRef.replace(/^[pen]:/, ""), x.invoiceNumber || "–", x.method, `${usd(x.amount)}${x.date ? `, ${dateLabel(x.date)}` : ""}`])
    : kind === "team" ? (s.team ?? []).map(x => [x.name || "–", x.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3"), x.role === "office" ? "Office" : "Crew", x.rate ? usd(x.rate) + "/hr" : "–"])
    : kind === "plans" ? s.plans.map(x => [x.customerRef.replace(/^[pen]:/, ""), x.name, `Every ${x.every === 1 ? "" : x.every + " "}${x.unit}${x.every === 1 ? "" : "s"}`, `${usd(x.total)}${x.next_on ? `, next ${dateLabel(x.next_on)}` : ""}`])
    : s.invoices.map(i => [i.customerRef.replace(/^[pen]:/, ""), i.number || "–", i.status, `${usd(i.total)}${i.paid ? `, ${usd(i.paid)} paid` : ""}`]);
  const head = kind === "customers" ? ["Name", "Phone", "Email", "Address"] : kind === "items" ? ["Name", "Unit", "Price", "Your cost"] : kind === "quotes" ? ["Customer", "Number", "Status", "Total"] : kind === "jobs" ? ["Customer", "Job", "Status", "Date"] : kind === "payments" ? ["Customer", "Invoice", "Paid by", "Amount"] : kind === "plans" ? ["Customer", "Plan", "How often", "Per visit"] : kind === "team" ? ["Name", "Cell", "Role", "Rate"] : ["Customer", "Number", "Status", "Total"];
  return <div className="sw-sample"><table className="tbl flush"><thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((v, k) => <td key={k} className={v === "No phone" ? "warn" : ""}>{v}</td>)}</tr>) : <tr><td colSpan={4} className="mut">Nothing readable in the first rows. Check the columns above.</td></tr>}</tbody></table></div>;
}

function Check({ imp, busy, act, onRun }: { imp: View; busy: string; act: Act; onRun: () => void }) {
  const p = imp.preview!, [open, setOpen] = useState<"" | "merges" | "phones">(""), [phones, setPhones] = useState<Record<string, string>>({});
  const splits = useRef<string[]>([]);
  const row = (k: string, n: number, sub: React.ReactNode = null, action: React.ReactNode = null) => <div className="sw-row"><span>{k}</span><b>{n.toLocaleString("en-US")}</b><small>{sub}</small>{action}</div>;
  return <section className="panel"><div className="panel-h"><h2>Coming from {NAME[imp.source]}</h2><small>nothing is written until you say so</small></div>
    <div className="panel-b">
      {row("Customers", p.customers, <>{p.merged ? `${p.merged} duplicates merged` : "no duplicates"}{imp.existing ? `, ${imp.existing} already here (they're updated, not doubled)` : ""}</>, p.merged ? <button type="button" className="link" onClick={() => setOpen(open === "merges" ? "" : "merges")}>Review</button> : null)}
      {open === "merges" && <ul className="sw-merges">{p.merges.map(m => <li key={m.keep}><b>{m.keepName || "Unnamed"}</b><span>{m.merged.map(x => `${x.name || "unnamed"} (same ${x.why})`).join(", ")}</span>
        <button type="button" className="btn sm ghost" disabled={!!busy} onClick={() => { splits.current = [...splits.current, ...m.merged.map(x => x.ref)]; void act("decide", { action: "decide", id: imp.id, decisions: { splits: splits.current, phones } }, "Merge undone. They come in separately."); }}>Undo merge</button></li>)}</ul>}
      {row("Properties", p.properties)}
      {row("Open quotes", p.openQuotes, p.openQuotesValue ? usd(p.openQuotesValue) : null)}
      {row("Scheduled jobs", p.scheduledJobs)}
      {row("Unpaid invoices", p.unpaidInvoices, p.unpaidValue ? usd(p.unpaidValue) : null)}
      {row("Service plans", p.plans)}
      {(p.payments > 0 || p.paymentsUnmatched > 0) && row("Payments", p.payments, p.paymentsUnmatched ? `${p.paymentsUnmatched} don't match an invoice in this move and stay out` : "on their invoices")}
      {row("Price list", p.items, "items")}
      {p.team > 0 && row("Team", p.team, "added to Settings, Account; they sign in with their cell, nobody gets a text")}
      {p.missingPhone.length > 0 && <>
        {row("Missing phone", p.missingPhone.length, "they come in as No phone; add numbers now or later on each record", <button type="button" className="link" onClick={() => setOpen(open === "phones" ? "" : "phones")}>Fix</button>)}
        {open === "phones" && <form className="sw-phones" onSubmit={e => { e.preventDefault(); void act("decide", { action: "decide", id: imp.id, decisions: { splits: splits.current, phones } }, "Phones saved."); }}>
          {p.missingPhone.slice(0, 50).map(m => <label key={m.ref} className="field inline"><span>{m.name || m.email || "Unnamed"}</span><input inputMode="tel" placeholder="Phone" value={phones[m.ref] ?? ""} onChange={e => setPhones(x => ({ ...x, [m.ref]: e.target.value }))} /></label>)}
          {p.missingPhone.length > 50 && <p className="fine">And {p.missingPhone.length - 50} more. Fix them in the file and add it again, or bring them in later.</p>}
          <div className="acts-row end"><button type="submit" className="btn sm ink" disabled={!!busy}>Save phones</button></div></form>}
      </>}
      <p className="fine" style={{ marginTop: 12 }}>Nobody gets a text from this. Open quotes come in with follow-ups off, unpaid invoices with reminders off, and plans paused. You turn each on when you&rsquo;re ready.</p>
      <div className="acts-row end" style={{ marginTop: 12 }}><button type="button" className="btn ink lg" disabled={!!busy || p.customers + p.items + p.team === 0} onClick={onRun}>Import everything</button></div>
    </div></section>;
}

function Running({ imp, busy, onContinue }: { imp: View | null; busy: string; onContinue: () => void }) {
  const pct = imp && imp.total ? Math.min(100, Math.round((imp.progress / imp.total) * 100)) : 0;
  return <section className="panel"><div className="panel-h"><h2>Bringing it in</h2><small>{imp ? `${imp.progress.toLocaleString("en-US")} of ${imp.total.toLocaleString("en-US")}` : ""}</small></div>
    <div className="panel-b">
      <div className="sw-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
      <p className="fine" style={{ marginTop: 8 }}>{busy === "run" ? "Keep this page open. It takes about a minute for every thousand records." : imp?.error ? "It stopped partway. Nothing is lost: tap Continue to pick up where it stopped." : "Paused."}</p>
      {busy !== "run" && <div className="acts-row end"><button type="button" className="btn ink" onClick={onContinue}>Continue</button></div>}
    </div></section>;
}

function GoLive({ d, imp, golive, start, appName, busy, project, api, toast, onTick, onUndo, onAgain, go }: { d: Data; imp: View | null; golive: Record<string, string>; start: string | null; appName: string; busy: string; project: string; api: Api; toast: Toast;
  onTick: (k: string, v: boolean) => void; onUndo: () => void; onAgain: () => void; go: Go }) {
  void api; void project;
  const done = imp?.status === "done" ? imp : null, res = done?.result ?? {}, src = done ? NAME[done.source] : "";
  const origin = d.origin || (typeof location !== "undefined" ? location.origin : ""), booking = d.key ? `${origin}/b/${d.key}` : "";
  const day7 = start ? Math.floor((Date.now() - Date.parse(start + "T12:00:00")) / 86400000) : -1;
  const week = useMemo(() => { if (!start) return null; const since = Date.parse(start + "T00:00:00"); const cards = (d.board ?? []).filter(c => c.source !== "import" && Date.parse(c.stageAt || c.at) >= since);
    return { leads: cards.length, booked: cards.filter(c => c.stage === "booked" || c.stage === "quoted" || c.stage === "won").length, won: cards.filter(c => c.stage === "won").reduce((a, c) => a + (c.value ?? 0), 0) }; }, [d.board, start]);
  const line = (k: string, label: string) => { const r = res[k]; if (!r) return null; const had = r.created + r.updated + r.skipped + (k === "customers" ? (res.merged?.skipped ?? 0) : 0);
    return <div className="sw-row" key={k}><span>{label}</span><b>{(r.created + r.updated).toLocaleString("en-US")}</b><small>{src} had {had.toLocaleString("en-US")}{r.updated ? k === "jobs" ? `, ${r.updated} past jobs kept in each customer's history` : `, ${r.updated} matched what was already here` : ""}{k === "customers" && res.merged?.skipped ? `, ${res.merged.skipped} merged` : ""}{r.skipped ? `, ${r.skipped} left out${k === "customers" ? " (no phone)" : ""}` : ""}</small></div>; };
  return <>
    {done && <section className="panel"><div className="panel-h"><h2>Everything from {src} is here</h2><small>{done.finished_at ? `moved ${dateLabel(done.finished_at)}` : ""}</small></div>
      <div className="panel-b">
        {res.customers && <p className="sw-big">{src} had {(res.customers.created + res.customers.updated + res.customers.skipped + (res.merged?.skipped ?? 0)).toLocaleString("en-US")} customers; you now have {(res.customers.created + res.customers.updated).toLocaleString("en-US")}{res.merged?.skipped ? ` plus ${res.merged.skipped} merged` : ""}{res.customers.skipped ? `, and ${res.customers.skipped} left out (no name, phone or email)` : ""}.</p>}
        {line("customers", "Customers")}{line("quotes", "Quotes")}{line("jobs", "Jobs")}{line("invoices", "Invoices")}{line("payments", "Payments")}{line("plans", "Service plans")}{line("team", "Team")}{line("items", "Price list")}
        <div className="acts-row" style={{ marginTop: 12 }}>
          <a className="btn" onClick={e => { if (inDemo()) { e.preventDefault(); toast("The example business has nothing to export. Your own export downloads a real file."); } }} href={`/api/app/export?p=${project}&what=all`}><Icon name="out" size={14} />Export everything</a>
          <button type="button" className="btn ghost" onClick={onAgain}>Add more from another app</button>
          {done.canUndo && <button type="button" className="btn ghost bad" disabled={!!busy} onClick={onUndo} title="For 7 days after the move">{busy === "undo" ? <Spinner /> : "Undo this move"}</button>}
        </div>
      </div></section>}
    {start && day7 >= 7 && week && <section className="panel sw-week"><div className="panel-h"><h2>Your first week on {appName}</h2><small>since {dateLabel(start)}</small></div>
      <div className="panel-b"><p className="sw-big">{week.leads} new leads came in here, {week.booked} booked, {usd(week.won)} won.</p><p className="fine">If that&rsquo;s everything you needed, it&rsquo;s safe to cancel the old app. Export from it once more before you do, to keep a copy.</p></div></section>}
    <section className="panel"><div className="panel-h"><h2>Go live</h2><small>{Object.keys(golive).length} of {GOLIVE.length} done</small></div>
      <div className="panel-b"><ul className="sw-live">{GOLIVE.map(g => <li key={g.key} className={golive[g.key] ? "done" : ""}>
        <button type="button" role="checkbox" aria-checked={!!golive[g.key]} className="sw-tick" onClick={() => onTick(g.key, !golive[g.key])}>{golive[g.key] ? <Icon name="check" size={11} /> : null}</button>
        <div><b>{g.title}</b><small>{g.how}</small>
          {g.key === "website" || g.key === "google" ? booking && <div className="acts-row" style={{ marginTop: 6 }}><code className="sw-link">{booking}</code><button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(booking); toast("Booking link copied."); } catch { prompt("Copy:", booking); } }}>Copy</button></div>
            : g.key === "leads" || g.key === "calls" || g.key === "books" ? <div className="acts-row" style={{ marginTop: 6 }}><button type="button" className="btn sm" onClick={() => go.tab("system")}>Open Connections</button></div>
            : g.key === "pay" ? <div className="acts-row" style={{ marginTop: 6 }}><button type="button" className="btn sm" onClick={go.billing}>Pay link</button></div>
            : g.key === "week" && start ? <small style={{ display: "block", marginTop: 4 }}>Started {dateLabel(start)}. {day7 >= 7 ? "Your week is up." : `Day ${Math.max(1, day7 + 1)} of 7.`}</small> : null}
        </div></li>)}</ul></div></section>
  </>;
}
