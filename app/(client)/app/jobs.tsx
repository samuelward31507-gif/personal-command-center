"use client";

// Jobs: every lead and job in one table, the board as a second view, and the record open beside the list.
// Views: Open, Won, Everyone (so Customers lives here). j/k move, Enter opens, Esc closes, c adds a lead.
import { useEffect, useMemo, useState } from "react";
import { STAGE_LABEL, STAGES, type Card, type Stage } from "@/lib/crm";
import { Avatar, Empty, Icon, Menu, StageChip, ago, dateLabel, fmtPhone, short, todayIso, usd, when, type Api, type Toast } from "./parts";
import { Inspector } from "./record";
import { sourceLabel, type Biz, type Data, type Go } from "./types";

type Tone = "blue" | "red" | "green" | "amber" | "";
export type JobsView = "open" | "won" | "all";
/** The one thing to know about this job right now. */
export function nextUp(c: Card, today = todayIso()): { text: string; tone: Tone; icon: string } {
  if (c.pastCustomer) return { text: "Came back", tone: "amber", icon: "star" };
  if (c.stage === "won") {
    if (c.invoice && c.invoice.status === "sent" && c.invoice.due_on && c.invoice.due_on < today) return { text: `Invoice ${Math.max(1, Math.round((Date.parse(today + "T12:00:00") - Date.parse(c.invoice.due_on + "T12:00:00")) / 86400000))} days late`, tone: "red", icon: "invoice" };
    if (c.invoice?.status === "paid") return { text: c.reviewSent ? "Paid, review asked" : "Paid", tone: "green", icon: "check" };
    if (c.invoice && c.invoice.status === "sent") return { text: `Invoice #${c.invoice.number} out`, tone: "", icon: "invoice" };
    if (c.install && c.install >= today) return { text: `Install ${dateLabel(c.install)}${c.installDays > 1 ? `, ${c.installDays} days` : ""}`, tone: "blue", icon: "cal" };
    if (c.install && c.install < today) return { text: c.invoice ? "Invoice drafted" : "Needs an invoice", tone: c.invoice ? "" : "amber", icon: "invoice" };
    return { text: "Schedule the install", tone: "amber", icon: "cal" };
  }
  if (c.stage === "lost") return { text: c.status === "opted_out" ? "Opted out" : c.notes ? c.notes.slice(0, 40) : "Lost", tone: "", icon: "x" };
  if (c.stage === "quoted" && c.quote) {
    if (c.quote.status === "replied") return { text: "They replied", tone: "red", icon: "chat" };
    if (c.quote.viewed) return { text: `Opened the quote ${ago(c.quote.viewed)}`, tone: "", icon: "eye" };
    if (!c.quote.linked) return { text: "Quote not sent yet", tone: "amber", icon: "quote" };
    return { text: c.quote.steps ? `Follow-up ${c.quote.steps} of 4 sent` : "Follow-up in 2 days", tone: "", icon: "clock" };
  }
  if (c.status === "paused") return { text: "Needs a reply", tone: "red", icon: "chat" };
  if (c.next) return { text: when(c.next), tone: "blue", icon: "cal" };
  if (c.stage === "booked") return { text: "Estimate done, needs a quote", tone: "red", icon: "quote" };
  return { text: "Cinder is replying", tone: "", icon: "bolt" };
}
export const priceOf = (c: Card) => c.value ? usd(c.value) : c.ballpark ? `~${short(c.ballpark.low)}–${short(c.ballpark.high).replace("$", "")}` : "";
const city = (c: Card) => { const a = String(c.details.address ?? ""); const parts = a.split(",").map(s => s.trim()).filter(Boolean); return parts.length > 1 ? parts[parts.length - 1].replace(/\s+\d{5}(-\d{4})?$/, "") : ""; };
const isOpen = (c: Card) => c.stage === "new" || c.stage === "booked" || c.stage === "quoted";
/** The job in words, with commas where the texts use mid-dots. */
export const line = (c: Card) => c.line.replace(/\s·\s/g, ", ");
const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); };

export function JobsScreen({ d, biz, project, api, toast, reload, go, wide, view, setView, onWinback }: { d: Data; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; wide: boolean; view: JobsView; setView: (v: JobsView) => void; onWinback: () => void }) {
  const cards = useMemo(() => d.board ?? [], [d.board]);
  const everyone = useMemo(() => {
    // Everyone: the board plus the people who are only in Customers (quiet imports), as thin cards.
    const seen = new Set(cards.map(c => c.id));
    const extra: Card[] = (d.customers ?? []).filter(c => !seen.has(c.id)).map(c => ({ id: c.id, name: c.name, phone: c.phone, source: c.source, status: c.status, stage: (c.stage as Stage) || "won", details: (c.address ? { address: c.address } : {}) as Card["details"], line: c.line, value: c.spent || null, ballpark: null, notes: "", next: null, at: c.last, quote: null, install: null, installTime: null, installDays: 1, onCalendar: false, reviewAuto: false, reviewSent: null, pastCustomer: true, invoice: null, job: {}, costs: { materials: 0, labor: 0, other: 0 } }));
    return [...cards, ...extra];
  }, [cards, d.customers]);
  const [mode, setMode] = useState<"table" | "board">("table");
  const [q, setQ] = useState(""), [src, setSrc] = useState("any"), [stage, setStage] = useState<"all" | Stage>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<Stage | null>(null);
  const today = todayIso();
  const base = view === "open" ? cards.filter(isOpen) : view === "won" ? everyone.filter(c => c.stage === "won") : everyone;
  const sources = useMemo(() => { const m = new Map<string, number>(); for (const c of base) m.set(c.source, (m.get(c.source) ?? 0) + 1); return [{ key: "any", label: "All" }, ...[...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ key: k, label: sourceLabel(k), count: n }))]; }, [base]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase(), digits = t.replace(/\D/g, "");
    return base.filter(c => stage === "all" || c.stage === stage).filter(c => src === "any" || c.source === src)
      .filter(c => !t || c.name.toLowerCase().includes(t) || c.line.toLowerCase().includes(t) || String(c.details.address ?? "").toLowerCase().includes(t) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)));
  }, [base, q, stage, src]);
  const counts = { open: cards.filter(isOpen).length, won: everyone.filter(c => c.stage === "won").length, all: everyone.length };
  const pipeline = cards.filter(isOpen).reduce((a, c) => a + (c.value ?? c.ballpark?.high ?? 0), 0);

  // Keyboard: j/k move the selection, Enter opens the record full width, Esc closes, c adds a lead.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
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
  }, [shown, sel, go]);
  useEffect(() => { if (sel && !everyone.some(c => c.id === sel)) setSel(null); }, [everyone, sel]);

  async function move(id: string, to: Stage) {
    const c = cards.find(x => x.id === id);
    if (!c || c.stage === to) return;
    if (to === "quoted" || to === "won") { go.record(id, { ask: to }); return; }
    try { await api("/api/app/act", { p: project, action: "stage", thread: id, stage: to }); toast(`Moved to ${STAGE_LABEL[to]}.`); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); }
  }
  const open = (id: string) => { if (wide) setSel(s => s === id ? null : id); else go.record(id); };
  const stageOptions: { key: "all" | Stage; label: string; count?: number }[] = [{ key: "all", label: "All", count: base.length }, ...STAGES.map(s => ({ key: s as "all" | Stage, label: STAGE_LABEL[s], count: base.filter(c => c.stage === s).length }))];

  return <>
    <header className="tb">
      <h1 className="h1">Jobs</h1>
      {wide && <span className="sub">{view === "open" ? `${counts.open} open` : view === "won" ? `${counts.won} won` : `${counts.all} people`}</span>}
      {!wide && <div className="views" role="tablist" aria-label="View">
        {([["open", "Open", counts.open], ["won", "Won", counts.won], ["all", "Everyone", counts.all]] as const).map(([k, l, n]) =>
          <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => { setView(k); setSel(null); }}>{l}<em>{n}</em></button>)}
      </div>}
      {wide && pipeline > 0 && view === "open" && <span className="fig" style={{ marginLeft: 8 }}><b>{usd(pipeline)}</b><span>in play</span></span>}
      <div className="acts">
        {wide && <div className="seg" role="tablist" aria-label="Layout">
          <button type="button" role="tab" aria-selected={mode === "table"} className={mode === "table" ? "on" : ""} onClick={() => setMode("table")} title="Table (t)"><Icon name="table" size={13} />Table</button>
          <button type="button" role="tab" aria-selected={mode === "board"} className={mode === "board" ? "on" : ""} onClick={() => setMode("board")} title="Board (b)"><Icon name="jobs" size={13} />Board</button></div>}
        {wide && d.winback && d.winback.past > 0 && <button type="button" className="btn ghost" onClick={onWinback}>Text past customers</button>}
        {wide && <button type="button" className="btn ghost" onClick={go.importCustomers}>Import</button>}
        <button type="button" className="btn ink" onClick={go.addLead} title="Add lead (c)"><Icon name="plus" size={14} />{wide ? "New lead" : "New"}{wide && <kbd>c</kbd>}</button>
      </div>
    </header>
    <div className={"split" + (sel && wide ? " has-insp" : "")}>
      <div className="pane list">
        <div className="jobs-tools">
          <label className="inwrap search"><Icon name="search" size={14} /><span className="sr">Search jobs</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, address, phone" /></label>
          {wide && <Menu label="Stage" value={stage} options={stageOptions} onPick={setStage} />}
          <Menu label="Source" value={src} options={sources} onPick={setSrc} />
          {wide && <span className="sort">Sorted by <b>last activity</b></span>}
        </div>
        {!everyone.length ? <Empty title="No jobs yet" text="New leads land here the moment Cinder answers them. You can add one, or import your customers." action={<div className="acts-row"><button type="button" className="btn ink" onClick={go.addLead}>Add lead</button><button type="button" className="btn" onClick={go.importCustomers}>Import customers</button></div>} />
        : !shown.length ? <Empty title="Nothing matches" text="Try another view, source or spelling." action={<button type="button" className="btn" onClick={() => { setQ(""); setSrc("any"); setStage("all"); }}>Clear filters</button>} />
        : wide && mode === "board" ? <Board cards={shown} sel={sel} drag={drag} over={over} setDrag={setDrag} setOver={setOver} move={move} open={open} />
        : wide ? <>
          <div className="tbl-wrap"><table className={"tbl jobs-tbl" + (sel ? " compact" : "")}>
            <colgroup><col style={{ width: 190 }} /><col className="c2" style={{ width: 130 }} /><col /><col style={{ width: 140 }} /><col style={{ width: 104 }} /><col style={{ width: 200 }} /><col className="c2" style={{ width: 110 }} /><col className="c2" style={{ width: 100 }} /></colgroup>
            <thead><tr><th>Customer</th><th className="c2">Phone</th><th>Job</th><th>Stage</th><th className="right">Value</th><th>Next step</th><th className="c2">Came from</th><th className="c2 right">Last activity</th></tr></thead>
            <tbody>{shown.map(c => { const n = nextUp(c, today), name = c.name || fmtPhone(c.phone), town = city(c); return <tr key={c.id} data-row={c.id} tabIndex={0} className={sel === c.id ? "sel" : ""} aria-selected={sel === c.id} onClick={() => open(c.id)} onDoubleClick={() => go.record(c.id)} onKeyDown={e => { if (e.key === "Enter") go.record(c.id); }}>
              <td><span className="name"><Avatar name={name} size="sm" /><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}><b>{name}</b>{town && <span className="faint">, {town}</span>}</span></span></td>
              <td className="mut c2">{fmtPhone(c.phone)}</td>
              <td className={c.line ? "" : "faint"}>{line(c) || (c.notes ? c.notes.slice(0, 48) : "No details yet")}</td>
              <td><StageChip stage={c.stage} /></td>
              <td className={"num" + (c.value ? "" : " mut")}>{c.value ? usd(c.value) : c.ballpark ? `~${short(c.ballpark.low)}–${short(c.ballpark.high).replace("$", "")}` : "–"}</td>
              <td><span className={"next " + n.tone}><Icon name={n.icon} size={13} />{n.text}</span></td>
              <td className="mut c2">{sourceLabel(c.source)}</td>
              <td className="num mut c2">{ago(c.at)}</td>
            </tr>; })}</tbody>
          </table></div>
          <div className="pane-foot"><span>{shown.length} of {base.length}</span><span className="hint"><span><kbd>j</kbd><kbd>k</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>c</kbd> new lead</span></span></div>
        </>
        : <PhoneList cards={shown} open={id => go.record(id)} />}
      </div>
      {wide && sel && <aside className="pane insp" aria-label="Record">
        <Inspector key={sel} id={sel} d={d} biz={biz} project={project} api={api} toast={toast} reload={reload} go={go} onClose={() => setSel(null)} onExpand={() => go.record(sel)} />
      </aside>}
    </div>
  </>;
}

/** On a phone: grouped by what each job needs, the way the owner thinks about the day. */
function PhoneList({ cards, open }: { cards: Card[]; open: (id: string) => void }) {
  const today = todayIso();
  const groups: { title: string; items: Card[]; sum?: number }[] = [];
  const need = cards.filter(c => ["red", "amber"].includes(nextUp(c, today).tone));
  const rest = cards.filter(c => !need.includes(c));
  if (need.length) groups.push({ title: "Needs you", items: need });
  for (const s of STAGES) { const items = rest.filter(c => c.stage === s); if (items.length) groups.push({ title: STAGE_LABEL[s], items, sum: items.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0) }); }
  return <div>{groups.map(g => <section key={g.title}>
    <div className="grp"><b>{g.title}</b><span>{g.items.length}{g.sum ? `, ${short(g.sum)}` : ""}</span></div>
    {g.items.map(c => { const n = nextUp(c, today), name = c.name || fmtPhone(c.phone); return <button key={c.id} type="button" className="jrow" onClick={() => open(c.id)}>
      <span style={{ minWidth: 0 }}><b>{name}</b><small>{line(c) || sourceLabel(c.source)}</small></span>
      <span className="r"><b>{priceOf(c) || "–"}</b><em className={n.tone}>{n.text}</em></span></button>; })}
  </section>)}</div>;
}

function Board({ cards, sel, drag, over, setDrag, setOver, move, open }: { cards: Card[]; sel: string | null; drag: string | null; over: Stage | null; setDrag: (v: string | null) => void; setOver: (f: Stage | null | ((o: Stage | null) => Stage | null)) => void; move: (id: string, s: Stage) => void; open: (id: string) => void }) {
  const today = todayIso();
  return <div className="board">{STAGES.map(stage => { const list = cards.filter(c => c.stage === stage); const total = list.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0);
    return <section key={stage} className={"col-b" + (over === stage ? " over" : "")} aria-label={STAGE_LABEL[stage]}
      onDragOver={e => { if (drag) { e.preventDefault(); setOver(stage); } }} onDragLeave={() => setOver(o => o === stage ? null : o)}
      onDrop={e => { e.preventDefault(); setOver(null); if (drag) move(drag, stage); setDrag(null); }}>
      <h2>{STAGE_LABEL[stage]}<em>{list.length}</em><b>{total ? short(total) : ""}</b></h2>
      <div className="cards">{list.length ? list.map(c => { const n = nextUp(c, today), name = c.name || fmtPhone(c.phone); return <button key={c.id} type="button" className={"jcard" + (sel === c.id ? " sel" : "")} draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => open(c.id)}>
        <span className="n"><span>{name}</span><b>{priceOf(c)}</b></span>
        <span className="l">{line(c) || (c.notes ? c.notes.slice(0, 60) : "No job details yet")}</span>
        <span className={"f next " + n.tone}><Icon name={n.icon} size={12} />{n.text}</span>
      </button>; }) : <p className="none">{stage === "new" ? "New leads land here." : stage === "booked" ? "Booked estimates." : stage === "quoted" ? "Quotes being chased." : stage === "won" ? "Jobs you won." : "Lost or not a fit."}</p>}</div>
    </section>; })}</div>;
}
