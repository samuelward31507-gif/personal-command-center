"use client";

// Jobs: New, Estimate booked, Quoted, Won, Done, Lost. A table and a board on a desk, a list on a phone, the record
// open beside the list. Every job shows its value, its next step and how long it has sat in its stage.
// Done is a won job that's been paid. Lost asks why. j/k move, Enter opens, Esc closes, c adds a lead.
import { Fragment, useEffect, useMemo, useState } from "react";
import { jobPrice } from "@/lib/service";
import { LOST_REASONS, STAGE_LABEL, jobProfit, type Card, type Stage } from "@/lib/crm";
import { crewName, crewTag, teamOf } from "./crew";
import { Avatar, Empty, Icon, Menu, Sheet, Spinner, ago, dateLabel, fmtPhone, short, todayIso, usd, when, type Api, type Toast } from "./parts";
import { Chip, FieldIcon, Stg } from "./sources";
import { Inspector } from "./record";
import { sourceLabel, type Biz, type Data, type Go } from "./types";
import { Guide, Kpis, PageHead } from "./charts";

type Tone = "blue" | "red" | "green" | "amber" | "";
export type JobsView = "open" | "won" | "all";
export type Lane = Stage | "done";
export const LANES: Lane[] = ["new", "booked", "quoted", "won", "done", "lost"];
export const LANE_LABEL: Record<Lane, string> = { ...STAGE_LABEL, done: "Done" };
/** Done is a won job that has been paid. */
export const laneOf = (c: Card): Lane => c.stage === "won" && c.invoice?.status === "paid" ? "done" : c.stage;
/** Whole days the job has sat in its stage. */
export const daysIn = (c: Card) => Math.max(0, Math.floor((Date.now() - Date.parse(c.stageAt ?? c.at)) / 86400000));
export const daysLabel = (n: number) => n === 0 ? "Today" : n === 1 ? "1 day" : `${n} days`;
/** Too long in a stage that should move: a new lead two days old, a quote two weeks out. */
const stale = (c: Card, n: number) => (c.stage === "new" && n >= 2) || (c.stage === "quoted" && n >= 14) || (c.stage === "booked" && n >= 7);

/** The one thing to know about this job right now. */
export function nextUp(c: Card, today = todayIso()): { text: string; tone: Tone; icon: string } {
  if (c.pastCustomer) return { text: "Came back", tone: "amber", icon: "star" };
  if (c.stage === "won") {
    if (c.invoice && c.invoice.status === "sent" && c.invoice.due_on && c.invoice.due_on < today) return { text: `Invoice ${Math.max(1, Math.round((Date.parse(today + "T12:00:00") - Date.parse(c.invoice.due_on + "T12:00:00")) / 86400000))} days late`, tone: "red", icon: "invoice" };
    if (c.invoice?.status === "paid") return { text: c.reviewSent ? "Paid, review asked" : "Paid, ask for a review", tone: "green", icon: "check" };
    if (c.invoice && c.invoice.status === "sent") return { text: `Invoice #${c.invoice.number} out`, tone: "", icon: "invoice" };
    if (c.install && c.install >= today) return { text: `Install ${dateLabel(c.install)}${c.installDays > 1 ? `, ${c.installDays} days` : ""}`, tone: "blue", icon: "cal" };
    if (c.install && c.install < today) return { text: c.invoice ? "Send the invoice" : "Needs an invoice", tone: "amber", icon: "invoice" };
    return { text: "Schedule the install", tone: "amber", icon: "cal" };
  }
  if (c.stage === "lost") return { text: c.status === "opted_out" ? "Opted out" : c.lostReason || (c.notes ? c.notes.slice(0, 40) : "Lost"), tone: "", icon: "x" };
  if (c.stage === "quoted" && c.quote) {
    if (c.quote.status === "replied") return { text: "They replied", tone: "red", icon: "chat" };
    if (!c.quote.linked) return { text: "Quote not sent yet", tone: "amber", icon: "quote" };
    if (c.quote.steps >= 4) return { text: "Went quiet, nudge them", tone: "amber", icon: "chat" };
    if (c.quote.viewed) return { text: `Opened the quote ${ago(c.quote.viewed)}`, tone: "", icon: "eye" };
    return { text: c.quote.views ? `Viewed ${c.quote.views}x, ${c.quote.steps ? `${c.quote.steps} follow-ups sent` : "first follow-up soon"}` : c.quote.chasePaused ? "Follow-ups off" : c.quote.steps ? `${c.quote.steps} follow-ups sent` : "Follow-up in 2 days", tone: "", icon: "clock" };
  }
  if (c.status === "paused") return { text: "Needs a reply", tone: "red", icon: "chat" };
  if (c.next) return { text: `Estimate ${when(c.next)}`, tone: "blue", icon: "cal" };
  if (c.stage === "booked") return { text: "Estimate done, write the quote", tone: "red", icon: "quote" };
  return { text: "Replying for you", tone: "", icon: "bolt" };
}
export type Who = "you" | "customer" | "scheduled" | "cinder" | "closed";
export const WHO_LABEL: Record<Who, string> = { you: "Your move", customer: "Waiting on the customer", scheduled: "Scheduled", cinder: "Being handled", closed: "Done or lost" };
const WHO_ORDER: Who[] = ["you", "customer", "scheduled", "cinder", "closed"];
/** Who owes the next move on a job, and the verb that makes it when it's the owner's. */
export function moveOf(c: Card, today = todayIso()): { who: Who; verb: string; run: (go: Go) => void } {
  const rec = (go: Go) => go.record(c.id), job = (go: Go) => go.record(c.id, { view: "job" }), none = { verb: "", run: rec };
  if (c.status === "paused") return { who: "you", verb: "Reply", run: go => go.thread(c.id) };
  if (c.remind && !c.remind.sent && Date.parse(c.remind.at) <= Date.now()) return { who: "you", verb: "Open", run: rec };
  if (c.stage === "lost") return { who: "closed", ...none };
  if (c.stage === "won") {
    const inv = c.invoice;
    if (inv?.status === "paid") return { who: "closed", ...none };
    if (inv?.status === "sent") return inv.due_on && inv.due_on < today ? { who: "you", verb: "Follow up", run: go => go.invoice(inv.id) } : { who: "customer", ...none };
    if (inv?.status === "draft") return { who: "you", verb: "Send invoice", run: go => go.invoice(inv.id) };
    if (c.install && c.install >= today) return { who: "scheduled", ...none };
    if (c.install) return { who: "you", verb: "Invoice", run: job };
    return { who: "you", verb: "Schedule", run: job };
  }
  if (c.stage === "quoted" && c.quote) {
    if (c.quote.status === "replied") return { who: "you", verb: "Reply", run: go => go.thread(c.id) };
    if (!c.quote.linked) return { who: "you", verb: "Send quote", run: go => go.quote(c.id) };
    if (c.quote.steps >= 4) return { who: "you", verb: "Nudge", run: go => go.record(c.id, { view: "activity" }) };
    return { who: "customer", ...none };
  }
  if (c.next && Date.parse(c.next) > Date.now() - 3600000) return { who: "scheduled", ...none };
  if (c.next && (c.stage === "new" || c.stage === "booked")) return { who: "you", verb: "Write quote", run: go => go.quote(c.id) };
  if (c.stage === "booked") return { who: "you", verb: "Write quote", run: go => go.quote(c.id) };
  return { who: "cinder", ...none };
}
export const priceOf = (c: Card) => c.value ? usd(c.value) : c.ballpark ? `~${short(c.ballpark.low)}–${short(c.ballpark.high).replace("$", "")}` : "";
const city = (c: Card) => { const a = String(c.details.address ?? ""); const parts = a.split(",").map(s => s.trim()).filter(Boolean); return parts.length > 1 ? parts[parts.length - 1].replace(/\s+\d{5}(-\d{4})?$/, "") : ""; };
const isOpen = (c: Card) => c.stage === "new" || c.stage === "booked" || c.stage === "quoted";
/** The job in words, with commas where the texts use mid-dots. */
export const line = (c: Card) => c.line.replace(/\s·\s/g, ", ");
const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); };

/** Why it was lost: one tap on a reason, or a few words. Follow-ups stop either way. */
export function LostPicker({ name, onPick, onClose, busy }: { name: string; onPick: (reason: string) => void; onClose: () => void; busy?: boolean }) {
  const [other, setOther] = useState("");
  return <Sheet onClose={onClose} title={`Mark ${name} lost`} sub="Follow-ups stop. The reason shows on the job and in Reports.">
    <div className="reasons">{LOST_REASONS.filter(r => r !== "Other").map(r => <button key={r} type="button" className="btn" disabled={busy} onClick={() => onPick(r)}>{r}</button>)}</div>
    <form className="acts-row" onSubmit={e => { e.preventDefault(); if (other.trim()) onPick(other.trim()); }}>
      <label className="inwrap" style={{ flex: 1 }}><input value={other} onChange={e => setOther(e.target.value)} placeholder="Something else" maxLength={80} aria-label="Other reason" /></label>
      <button type="submit" className="btn ink" disabled={busy || !other.trim()}>{busy ? <Spinner /> : "Mark lost"}</button>
    </form>
  </Sheet>;
}

export function JobsScreen({ d, biz, project, api, toast, reload, go, wide, view, setView, onWinback }: { d: Data; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; wide: boolean; view: JobsView; setView: (v: JobsView) => void; onWinback: () => void }) {
  const cards = useMemo(() => d.board ?? [], [d.board]);
  const everyone = useMemo(() => {
    // Everyone: the board plus the people who are only in Customers (quiet imports), as thin cards.
    const seen = new Set(cards.map(c => c.id));
    const extra: Card[] = (d.customers ?? []).filter(c => !seen.has(c.id)).map(c => ({ id: c.id, name: c.name, phone: c.phone, source: c.source, status: c.status, stage: (c.stage as Stage) || "won", details: (c.address ? { address: c.address } : {}) as Card["details"], line: c.line, value: c.spent || null, ballpark: null, notes: "", next: null, at: c.last, quote: null, install: null, installTime: null, installDays: 1, onCalendar: false, reviewAuto: false, reviewSent: null, pastCustomer: true, invoice: null, job: {}, costs: { materials: 0, labor: 0, other: 0 } }));
    return [...cards, ...extra];
  }, [cards, d.customers]);
  const [mode, setMode] = useState<"table" | "board">("table");
  const [q, setQ] = useState(""), [src, setSrc] = useState("any"), [lane, setLane] = useState<"all" | Lane>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [who, setWho] = useState<"all" | Who>("all");
  const [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<Lane | null>(null);
  const [cols, setColsRaw] = useState<"auto" | "more" | "core">(() => { try { const v = localStorage.getItem("cinder-job-cols"); return v === "more" || v === "core" ? v : "auto"; } catch { return "auto"; } });
  const [vw, setVw] = useState(1440);
  const extraCols = (open: boolean) => cols === "more" || (cols === "auto" && vw >= 1600 && !open);
  const extra = extraCols(!!sel);
  const slim = !!sel && vw >= 1280;
  useEffect(() => { const h = () => setVw(innerWidth); h(); addEventListener("resize", h); return () => removeEventListener("resize", h); }, []);
  const setCols = (v: "auto" | "more" | "core") => { setColsRaw(v); try { localStorage.setItem("cinder-job-cols", v); } catch { /* private mode */ } };
  const [losing, setLosing] = useState<Card | null>(null), [busy, setBusy] = useState(false), [ticked, setTicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const crewList = teamOf(d);
  const bulk = async (done: string, run: (c: Card) => Promise<unknown>) => {
    const list = (d.board ?? []).filter(c => ticked.has(c.id));
    if (!list.length || !confirm(`${done.split(" ")[0]} ${list.length} ${list.length === 1 ? "job" : "jobs"}?`)) return;
    setBulkBusy(true); let ok = 0;
    for (const c of list) { try { await run(c); ok++; } catch { /* the rest still go */ } }
    await reload(); setBulkBusy(false); setTicked(new Set());
    toast(`${done}: ${ok} of ${list.length}.`, ok < list.length);
  };
  const tick = (id: string) => setTicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const today = todayIso();
  // Open: every job still in motion, won jobs too until they are paid.
  const active = (c: Card) => isOpen(c) || (c.stage === "won" && !c.pastCustomer && moveOf(c, today).who !== "closed");
  // Small lists: worked out on every render, no memo to keep in sync.
  const base = view === "open" ? cards.filter(active) : view === "won" ? everyone.filter(c => c.stage === "won") : everyone;
  const sources = (() => { const m = new Map<string, number>(); for (const c of base) m.set(c.source, (m.get(c.source) ?? 0) + 1); return [{ key: "any", label: "All" }, ...[...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ key: k, label: sourceLabel(k), count: n }))]; })();
  const qt = q.trim().toLowerCase(), digits = qt.replace(/\D/g, "");
  const shown = base.filter(c => lane === "all" || laneOf(c) === lane).filter(c => src === "any" || c.source === src).filter(c => who === "all" || moveOf(c, today).who === who)
    .filter(c => !qt || c.name.toLowerCase().includes(qt) || c.line.toLowerCase().includes(qt) || String(c.details.address ?? "").toLowerCase().includes(qt) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)));
  // Grouped by who owes the next move when nothing narrows the list; the owner's move first, longest waiting first.
  const grouped = lane === "all" && !q.trim();
  const groups = (() => {
    if (!grouped) return [{ who: "you" as Who, cards: shown, value: 0 }];
    const m = new Map<Who, Card[]>();
    for (const c of shown) { const w = moveOf(c, today).who; m.set(w, [...(m.get(w) ?? []), c]); }
    return WHO_ORDER.filter(w => m.has(w)).map(w => { const list = m.get(w)!.sort((a, b) => daysIn(b) - daysIn(a)); return { who: w, cards: list, value: list.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0) }; });
  })();
  const counts = { open: cards.filter(isOpen).length, won: everyone.filter(c => c.stage === "won").length, all: everyone.length };
  const pipeline = cards.filter(isOpen).reduce((a, c) => a + (c.value ?? c.ballpark?.high ?? 0), 0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || losing) return;
      if (e.key === "j" || e.key === "k" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!shown.length) return; e.preventDefault();
        const idx = shown.findIndex(c => c.id === sel), dir = e.key === "j" || e.key === "ArrowDown" ? 1 : -1;
        const next = shown[Math.max(0, Math.min(shown.length - 1, idx < 0 ? 0 : idx + dir))];
        setSel(next.id); document.querySelector(`[data-row="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && sel) { e.preventDefault(); go.record(sel); }
      else if (e.key === "Escape") setSel(null);
      else if (e.key === "c") { e.preventDefault(); go.addLead(); }
      else if (e.key === "b") setMode("board"); else if (e.key === "t") setMode("table");
    };
    addEventListener("keydown", h); return () => removeEventListener("keydown", h);
  }, [shown, sel, go, losing]);
  useEffect(() => { if (sel && !everyone.some(c => c.id === sel)) setSel(null); }, [everyone, sel]);

  async function setStage(id: string, to: Stage, reason?: string) {
    setBusy(true);
    try { await api("/api/app/act", { p: project, action: "stage", thread: id, stage: to, reason }); toast(to === "lost" ? `Marked lost${reason ? `, ${reason.toLowerCase()}` : ""}. Follow-ups stopped.` : `Moved to ${STAGE_LABEL[to]}.`); setLosing(null); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); }
    finally { setBusy(false); }
  }
  function move(id: string, to: Lane) {
    const c = cards.find(x => x.id === id);
    if (!c || laneOf(c) === to) return;
    if (to === "done") { if (c.invoice) go.invoice(c.invoice.id); else go.record(id, { view: "job" }); toast("A job is done once it's paid. Mark the invoice paid."); return; }
    if (to === "quoted" || to === "won") { go.record(id, { ask: to }); return; }
    if (to === "lost") { setLosing(c); return; }
    void setStage(id, to);
  }
  const open = (id: string) => { if (wide) setSel(s => s === id ? null : id); else go.record(id); };
  const laneOptions: { key: "all" | Lane; label: string; count?: number }[] = [{ key: "all", label: "All", count: base.length }, ...LANES.map(l => ({ key: l as "all" | Lane, label: LANE_LABEL[l], count: base.filter(c => laneOf(c) === l).length })).filter(o => o.count)];

  return <>
    <PageHead title={view === "all" ? "Customers" : "Jobs"} sub={view === "open" ? `${counts.open} open, ${usd(pipeline)} in play.` : view === "won" ? `${counts.won} won.` : `${counts.all} people.`}
      actions={<>
        {!wide && <div className="views" role="tablist" aria-label="View">
          {([["open", "Open", counts.open], ["won", "Won", counts.won], ["all", "Everyone", counts.all]] as const).map(([k, l, n]) =>
            <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => { setView(k); setSel(null); }}>{l}<em>{n}</em></button>)}
          {!biz.crew && <button type="button" role="tab" aria-selected={false} onClick={() => go.tab("plans")}>Plans<em>{(d.plans ?? []).filter(p => p.status === "active").length}</em></button>}
        </div>}
        {wide && <div className="seg" role="tablist" aria-label="Layout">
          <button type="button" role="tab" aria-selected={mode === "table"} className={mode === "table" ? "on" : ""} onClick={() => setMode("table")} title="Table (t)"><Icon name="table" size={13} />Table</button>
          <button type="button" role="tab" aria-selected={mode === "board"} className={mode === "board" ? "on" : ""} onClick={() => setMode("board")} title="Board (b)"><Icon name="jobs" size={13} />Board</button></div>}
        {wide && d.winback && d.winback.past > 0 && <button type="button" className="btn" onClick={onWinback}>Text past customers</button>}
        {wide && <button type="button" className="btn" onClick={go.importCustomers}>Import</button>}
        <button type="button" className="btn ink" onClick={go.addLead} title="Add lead (c)"><Icon name="plus" size={14} />{wide ? "New lead" : "New"}{wide && <kbd>c</kbd>}</button>
      </>} />
    <div className={"split" + (sel && wide ? " has-insp" : "") + (slim ? " docked" : "")}>
      <div className="pane list"><div className="dash jobs-dash">
        <section className="panel jobs-panel">
        <div className="jobs-tools" hidden={!everyone.length}>
          <label className="inwrap search"><Icon name="search" size={14} /><span className="sr">Search jobs</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, address, phone" /></label>
          {(wide || mode === "table") && <Menu label="Stage" value={lane} options={laneOptions} onPick={setLane} />}
          <Menu label="Source" value={src} options={sources} onPick={setSrc} />
          {wide && mode === "table" && <Menu label="Columns" value={cols} options={[{ key: "auto", label: "Fit to width" }, { key: "more", label: "Show profit and source" }, { key: "core", label: "Core columns only" }] as const} onPick={setCols} />}
          {wide && <span className="sort">Sorted by <b>last activity</b></span>}
        </div>
        {!everyone.length ? <Guide title="Your jobs land here" sub="Every lead becomes a job the moment it's answered, and moves from New to Booked to Quoted to Won on its own as the conversation goes."
          steps={[
            { title: "Your texting number is live", text: "Missed calls and texts to it start a job with a reply in seconds.", done: !!d.number, action: <button type="button" className="btn sm" onClick={() => go.tab("system")}>Settings</button> },
            { title: "Point your website here", text: "The chat bubble, your contact form or your booking page. Each one starts a job.", done: (d.wires?.sources ?? []).some(x => x.source !== "missed_call" && x.source !== "text"), action: <button type="button" className="btn sm" onClick={() => go.tab("system")}>Connections</button> },
            { title: "Bring in past customers", text: "From Jobber or any spreadsheet. Nobody gets a text.", done: (d.customers ?? []).length > 0, action: <button type="button" className="btn sm" onClick={go.importCustomers}>Import</button> },
            { title: "Add a lead by hand", text: "Someone who called your own cell or stopped you on a job.", action: <button type="button" className="btn sm ink" onClick={go.addLead}>New lead</button> },
          ]} />
        : !shown.length ? <Empty title="Nothing matches" text="Try another view, source or spelling." action={<button type="button" className="btn" onClick={() => { setQ(""); setSrc("any"); setLane("all"); }}>Clear filters</button>} />
        : wide && mode === "board" ? <Board cards={view === "open" ? everyone.filter(c => src === "any" || c.source === src) : shown} sel={sel} drag={drag} over={over} setDrag={setDrag} setOver={setOver} move={move} open={open} who={cell => crewName(d, cell)} />
        : wide ? <>
          <div className="tbl-wrap"><table className={"tbl jobs-tbl v5 cols-" + cols + (sel ? " compact" : "") + (slim ? " slim" : "")}>
            <colgroup><col style={{ width: 40 }} /><col style={{ width: 210 }} /><col style={{ width: 220 }} /><col /><col style={{ width: 112 }} />{extra && <col style={{ width: 104 }} />}<col style={{ width: 120 }} /><col style={{ width: 76 }} />{extra && <col style={{ width: 116 }} />}<col style={{ width: 120 }} /></colgroup>
            <thead><tr><th className="ck-col"><input type="checkbox" aria-label="Select all" checked={!!shown.length && shown.every(c => ticked.has(c.id))} onChange={e => setTicked(e.target.checked ? new Set(shown.map(c => c.id)) : new Set())} /></th><th>Customer</th><th>Next step</th><th>Job</th><th className="right">Value</th>{extra && <th className="right" title="Price minus the costs you logged on the job">Profit</th>}<th>Stage</th><th className="right" title="Days since the last change">Age</th>{extra && <th>Came from</th>}<th><span className="sr">Action</span></th></tr></thead>
            <tbody>{groups.map(g => <Fragment key={g.who}>
              {grouped && <tr className="grp-row"><td colSpan={extra ? 10 : 8}><b>{WHO_LABEL[g.who]}</b><span>{g.cards.length} {g.cards.length === 1 ? "job" : "jobs"}{g.value ? `, ${usd(g.value)}` : ""}</span></td></tr>}
              {g.cards.map(c => { const n = nextUp(c, today), m = moveOf(c, today), name = c.name || fmtPhone(c.phone), town = city(c), l = laneOf(c), days = daysIn(c); return <tr key={c.id} data-row={c.id} tabIndex={0} className={(sel === c.id ? "sel" : "") + (m.who === "you" ? " mine" : "")} aria-selected={sel === c.id} onClick={() => open(c.id)} onDoubleClick={() => go.record(c.id)} onKeyDown={e => { if (e.key === "Enter") go.record(c.id); }}>
                <td className="ck-col" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${name}`} checked={ticked.has(c.id)} onChange={() => tick(c.id)} /></td>
                <td title={town ? `${name}, ${town}` : name}><span className="name">{m.who === "you" ? <i className="turn" aria-label="Your turn" /> : <i className="turn off" aria-hidden="true" />}<Avatar name={name} size="sm" /><b>{name}</b>{c.crewMember && <span className="ctag" title={`${crewName(d, c.crewMember)} is on this job`}>{crewTag(d, c.crewMember)}</span>}</span></td>
                <td><span className={"next " + n.tone}>{n.text}</span></td>
                <td className={c.line ? "mut" : "faint"}>{line(c) || (c.notes ? c.notes.slice(0, 48) : "No details yet")}</td>
                <td className={"num" + (c.value ? "" : " mut")}>{c.value ? usd(c.value) : c.ballpark ? `~${short(c.ballpark.low)}–${short(c.ballpark.high).replace("$", "")}` : "–"}</td>
                {(() => { const pf = c.stage === "won" ? jobProfit(jobPrice(c), c.costs) : null; return !extra ? null : <td className={"num" + (pf ? "" : " faint")} title={pf ? `${usd(pf.cost)} in costs` : c.stage === "won" ? "Log costs on the job to see profit" : undefined}>{pf ? <><span style={pf.profit < 0 ? { color: "var(--bad)" } : undefined}>{usd(pf.profit)}</span> <small className="mut">{pf.margin}%</small></> : "–"}</td>; })()}
                <td><Stg stage={l === "done" ? "won" : l}>{l === "booked" ? "Booked" : LANE_LABEL[l]}</Stg></td>
                <td className={"num" + (stale(c, days) ? " late" : " mut")}>{l === "done" || l === "lost" ? "–" : daysLabel(days)}</td>
                {extra && <td className="mut">{sourceLabel(c.source)}</td>}
                <td className="act">{m.verb && <button type="button" className={"btn sm" + (m.who === "you" ? "" : " ghost")} onClick={e => { e.stopPropagation(); m.run(go); }}>{m.verb}</button>}</td>
              </tr>; })}
            </Fragment>)}</tbody>
            {ticked.size > 0 && (() => { const list = shown.filter(c => ticked.has(c.id)), sum = list.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0);
              const prof = list.reduce((a, c) => { const p = c.stage === "won" ? jobProfit(jobPrice(c), c.costs) : null; return a + (p?.profit ?? 0); }, 0);
              return <tfoot><tr><td /><td><b>{list.length}</b>selected</td><td /><td /><td className="num"><b>{usd(sum)}</b>sum</td>{extra && <td className="num">{prof ? <><b>{usd(prof)}</b>sum</> : null}</td>}<td /><td />{extra && <td />}<td /></tr></tfoot>; })()}
          </table></div>
          {ticked.size > 0 ? <div className="pane-foot bulk-bar" role="toolbar" aria-label="With the selected jobs">
            <b>{ticked.size} selected</b>
            <Menu label="Move to" value={"" as string} options={[{ key: "", label: "Pick a stage" }, { key: "new", label: "New" }, { key: "booked", label: "Estimate booked" }, { key: "quoted", label: "Quoted" }, { key: "lost", label: "Lost" }]} onPick={k => { if (k) void bulk(`Moved to ${k === "booked" ? "Booked" : k}`, c => api("/api/app/act", { p: project, thread: c.id, action: "stage", stage: k, ...(k === "lost" ? { reason: "Closed in bulk" } : {}) })); }} />
            {crewList.length > 1 && <Menu label="Assign" value={"" as string} options={[{ key: "", label: "Pick someone" }, ...crewList.map(m => ({ key: m.cell || "me", label: m.name }))]} onPick={k => { if (k) void bulk("Assigned", c => api("/api/app/act", { p: project, thread: c.id, action: "assign", member: k === "me" ? "" : k })); }} />}
            <button type="button" className="btn sm" disabled={bulkBusy} onClick={() => { const t = prompt("Tag to add to the selected customers"); if (t && t.trim()) void bulk(`Tagged "${t.trim().toLowerCase()}"`, c => api("/api/app/act", { p: project, thread: c.id, action: "card", tags: [...(c.tags ?? []), t.trim()] })); }}>Add tag</button>
            <span style={{ flex: 1 }} />{bulkBusy && <Spinner />}
            <button type="button" className="btn ghost sm" onClick={() => setTicked(new Set())}>Clear</button>
          </div>
          : <div className="pane-foot"><span>{shown.length} of {base.length}</span><span className="hint"><span><kbd>j</kbd><kbd>k</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>c</kbd> new lead</span></span></div>}
        </>
        : <PhoneList cards={shown} open={id => go.record(id)} />}
        </section></div>
      </div>
      {wide && sel && <aside className="pane insp" aria-label="Record">
        <Inspector key={sel} id={sel} d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} onClose={() => setSel(null)} onExpand={() => go.record(sel)} />
      </aside>}
    </div>
    {losing && <LostPicker name={losing.name || fmtPhone(losing.phone)} busy={busy} onClose={() => setLosing(null)} onPick={r => void setStage(losing.id, "lost", r)} />}
  </>;
}

/** On a phone: grouped by what each job needs, then by stage. Value, next step and days in stage on every row. */
function PhoneList({ cards, open }: { cards: Card[]; open: (id: string) => void }) {
  const today = todayIso();
  const groups: { title: string; items: Card[]; sum?: number }[] = [];
  const need = cards.filter(c => ["red", "amber"].includes(nextUp(c, today).tone));
  const rest = cards.filter(c => !need.includes(c));
  if (need.length) groups.push({ title: "Needs you", items: need });
  for (const l of LANES) { const items = rest.filter(c => laneOf(c) === l); if (items.length) groups.push({ title: LANE_LABEL[l], items, sum: items.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0) }); }
  return <div>{groups.map(g => <section key={g.title}>
    <div className="grp"><b>{g.title}</b><span>{g.items.length}{g.sum ? `, ${short(g.sum)}` : ""}</span></div>
    {g.items.map(c => { const n = nextUp(c, today), name = c.name || fmtPhone(c.phone), l = laneOf(c), days = daysIn(c); return <button key={c.id} type="button" className="jrow" onClick={() => open(c.id)}>
      <span style={{ minWidth: 0 }}><b>{name}</b><small>{line(c) || sourceLabel(c.source)}</small><small className={"jr-next " + n.tone}>{n.text}</small></span>
      <span className="r"><b>{priceOf(c) || "–"}</b><em>{LANE_LABEL[l]}{l !== "done" && l !== "lost" ? `, ${daysLabel(days).toLowerCase()}` : ""}</em></span></button>; })}
  </section>)}</div>;
}

function Board({ cards, sel, drag, over, setDrag, setOver, move, open, who }: { who: (cell: string) => string; cards: Card[]; sel: string | null; drag: string | null; over: Lane | null; setDrag: (v: string | null) => void; setOver: (f: Lane | null | ((o: Lane | null) => Lane | null)) => void; move: (id: string, s: Lane) => void; open: (id: string) => void }) {
  const today = todayIso();
  return <div className="board">{LANES.map(l => { const list = cards.filter(c => laneOf(c) === l); const total = list.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0);
    return <section key={l} className={"col-b" + (over === l ? " over" : "")} aria-label={LANE_LABEL[l]}
      onDragOver={e => { if (drag) { e.preventDefault(); setOver(l); } }} onDragLeave={() => setOver(o => o === l ? null : o)}
      onDrop={e => { e.preventDefault(); setOver(null); if (drag) move(drag, l); setDrag(null); }}>
      <h2><Stg stage={l === "done" ? "won" : l}>{l === "booked" ? "Booked" : LANE_LABEL[l]}</Stg><em>{list.length}</em><b>{total ? short(total) : ""}</b></h2>
      <div className="cards">{list.length ? list.map(c => { const n = nextUp(c, today), name = c.name || fmtPhone(c.phone), days = daysIn(c); return <button key={c.id} type="button" className={"jcard" + (sel === c.id ? " sel" : "")} draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => open(c.id)}>
        <span className="n"><Avatar name={name} size="sm" /><span>{name}</span></span>
        <span className="kv-r"><Icon name="dollar" size={12} /><b>{priceOf(c) || "–"}</b></span>
        <span className="kv-r"><Icon name="ruler" size={12} /><span>{line(c) || (c.notes ? c.notes.slice(0, 60) : "No job details yet")}</span></span>
        {(c.crewMember || c.invoice?.status === "paid") && <span className="kv-r"><Icon name={c.invoice?.status === "paid" ? "check" : "user"} size={12} /><span>{c.invoice?.status === "paid" ? "Paid" : `Crew: ${who(c.crewMember!)}`}</span></span>}
        <span className="f"><span className={"next " + n.tone}><Icon name={n.icon} size={12} />{n.text}</span>{l !== "done" && l !== "lost" && <span className={stale(c, days) ? "stale" : "faint"}>{days}d</span>}</span>
      </button>; }) : <p className="none">{l === "new" ? "New leads land here." : l === "booked" ? "Estimates on the calendar." : l === "quoted" ? "Quotes being chased." : l === "won" ? "Won, not paid yet." : l === "done" ? "Paid. Mark the invoice paid to land here." : "Lost, with the reason."}</p>}</div>
    </section>; })}</div>;
}
