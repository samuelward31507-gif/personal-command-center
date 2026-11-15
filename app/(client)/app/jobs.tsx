"use client";

// Jobs: every lead and job in one dense table with filters, a board as the second view, and on a phone a list
// grouped by what each one needs. A row opens the customer's record.
import { useMemo, useState } from "react";
import { STAGE_LABEL, STAGES, type Card, type Stage } from "@/lib/crm";
import { Avatar, Empty, Icon, Menu, StageChip, ago, dateLabel, fmtPhone, short, todayIso, usd, when, type Api, type Toast } from "./parts";
import { sourceLabel, type Biz, type Data, type Go } from "./types";

type Tone = "blue" | "red" | "green" | "amber" | "";
/** The one thing to know about this job right now: when the estimate is, how the quote is going, what the install needs. */
export function nextUp(c: Card, today = todayIso()): { text: string; tone: Tone; icon: string } {
  if (c.pastCustomer) return { text: "Came back", tone: "amber", icon: "star" };
  if (c.stage === "won") {
    if (c.invoice && c.invoice.status === "sent" && c.invoice.due_on && c.invoice.due_on < today) return { text: `Invoice ${Math.max(1, Math.round((Date.parse(today + "T12:00:00") - Date.parse(c.invoice.due_on + "T12:00:00")) / 86400000))} days late`, tone: "red", icon: "invoice" };
    if (c.invoice?.status === "paid") return { text: c.reviewSent ? "Paid · review asked" : "Paid", tone: "green", icon: "check" };
    if (c.invoice && c.invoice.status === "sent") return { text: `Invoice #${c.invoice.number} out`, tone: "", icon: "invoice" };
    if (c.install && c.install >= today) return { text: `Install ${dateLabel(c.install)}${c.installDays > 1 ? ` · ${c.installDays} days` : ""}`, tone: "blue", icon: "cal" };
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
  if (c.stage === "booked") return { text: "Estimate done · needs a quote", tone: "red", icon: "quote" };
  return { text: "Cinder is replying", tone: "", icon: "bolt" };
}
export const priceOf = (c: Card) => c.value ? usd(c.value) : c.ballpark ? `~${short(c.ballpark.low)}–${short(c.ballpark.high).replace("$", "")}` : "";
const city = (c: Card) => { const a = String(c.details.address ?? ""); const parts = a.split(",").map(s => s.trim()).filter(Boolean); return parts.length > 1 ? parts[parts.length - 1].replace(/\s+\d{5}(-\d{4})?$/, "") : ""; };
type StageFilter = "open" | "all" | Stage;

export function JobsScreen({ d, biz, project, api, toast, reload, go, wide, onWinback }: { d: Data; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; wide: boolean; onWinback: () => void }) {
  const cards = d.board ?? [];
  const [view, setView] = useState<"table" | "board">("table");
  const [q, setQ] = useState(""), [stage, setStage] = useState<StageFilter>("open"), [src, setSrc] = useState("any");
  const [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<Stage | null>(null);
  const today = todayIso();
  const sources = useMemo(() => { const m = new Map<string, number>(); for (const c of cards) m.set(c.source, (m.get(c.source) ?? 0) + 1); return [{ key: "any", label: "Any" }, ...[...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ key: k, label: sourceLabel(k), count: n }))]; }, [cards]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase(), digits = t.replace(/\D/g, "");
    return cards.filter(c => stage === "all" ? true : stage === "open" ? c.stage === "new" || c.stage === "booked" || c.stage === "quoted" : c.stage === stage)
      .filter(c => src === "any" || c.source === src)
      .filter(c => !t || c.name.toLowerCase().includes(t) || c.line.toLowerCase().includes(t) || String(c.details.address ?? "").toLowerCase().includes(t) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)));
  }, [cards, q, stage, src]);
  const open = cards.filter(c => c.stage === "new" || c.stage === "booked" || c.stage === "quoted");
  const pipeline = open.reduce((a, c) => a + (c.value ?? c.ballpark?.high ?? 0), 0);
  const quoted = cards.filter(c => c.stage === "quoted"), quotedValue = quoted.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0);
  const oldest = quoted.map(c => Math.round((Date.now() - Date.parse(c.at)) / 86400000)).sort((a, b) => b - a)[0];
  const won30 = cards.filter(c => c.stage === "won" && !c.pastCustomer && Date.parse(c.at) > Date.now() - 30 * 86400000);
  const won30Value = won30.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0);
  const decided = cards.filter(c => (c.stage === "won" && !c.pastCustomer) || c.stage === "lost");
  const close = decided.length >= 3 ? Math.round((decided.filter(c => c.stage === "won").length / decided.length) * 100) : null;

  async function move(id: string, to: Stage) {
    const c = cards.find(x => x.id === id);
    if (!c || c.stage === to) return;
    if (to === "quoted" || to === "won") { go.record(id, { ask: to }); return; }
    try { await api("/api/app/act", { p: project, action: "stage", thread: id, stage: to }); toast(`Moved to ${STAGE_LABEL[to]}.`); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); }
  }
  const stageOptions: { key: StageFilter; label: string; count?: number }[] = [{ key: "open", label: "Open", count: open.length }, { key: "all", label: "All", count: cards.length }, ...STAGES.map(s => ({ key: s as StageFilter, label: STAGE_LABEL[s], count: cards.filter(c => c.stage === s).length }))];

  return <>
    <header className="ph"><h1>Jobs</h1><span className="sub">{open.length} open{pipeline ? ` · ${short(pipeline)} in play` : ""}</span>
      <div className="acts">
        {wide && <div className="seg" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === "table"} className={view === "table" ? "on" : ""} onClick={() => setView("table")}><Icon name="table" size={14} />Table</button>
          <button type="button" role="tab" aria-selected={view === "board"} className={view === "board" ? "on" : ""} onClick={() => setView("board")}><Icon name="jobs" size={14} />Board</button></div>}
        {d.winback && d.winback.past > 0 && wide && <button type="button" className="btn" onClick={onWinback}><Icon name="users" size={15} />Past customers</button>}
        {wide && <button type="button" className="btn" onClick={go.importCustomers}><Icon name="upload" size={15} />Import</button>}
        <button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={15} />Add lead</button>
      </div></header>
    <div className="pad jobs">
      <div className="kpis">
        <div className="kpi"><span>Open pipeline</span><b>{usd(pipeline)}</b><small>{open.length} {open.length === 1 ? "job" : "jobs"} in play</small></div>
        <div className="kpi"><span>Quoted, waiting</span><b>{usd(quotedValue)}</b><small>{quoted.length ? `${quoted.length} ${quoted.length === 1 ? "quote" : "quotes"}${oldest != null ? ` · oldest ${oldest} ${oldest === 1 ? "day" : "days"}` : ""}` : "None out"}</small></div>
        <div className="kpi"><span>Won · 30 days</span><b>{usd(won30Value)}</b><small className={won30.length ? "up" : ""}>{won30.length ? `${won30.length} ${won30.length === 1 ? "job" : "jobs"}` : "No wins yet"}</small></div>
        {wide && <div className="kpi"><span>Close rate</span><b>{close == null ? "–" : `${close}%`}</b><small>{close == null ? "after 3 decided" : `${decided.length} decided`}</small></div>}
        {wide && <div className="kpi"><span>First reply</span><b>{d.live.replySec == null ? "–" : d.live.replySec < 60 ? `${d.live.replySec}s` : `${Math.round(d.live.replySec / 60)}m`}</b><small>Cinder, day or night</small></div>}
      </div>
      <div className="bar-tools">
        <label className="inwrap search"><Icon name="search" size={15} /><span className="sr">Search jobs</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, address, phone" /></label>
        <Menu label="Stage" value={stage} options={stageOptions} onPick={setStage} />
        <Menu label="Source" value={src} options={sources} onPick={setSrc} />
        {wide && <span className="sort">Sorted by <b>Last activity</b></span>}
      </div>

      {!cards.length ? <Empty icon="jobs" title="No jobs yet" text="New leads land here the moment Cinder answers them. You can also add one or import your customers." action={<div className="acts-row"><button type="button" className="btn ink" onClick={go.addLead}>Add lead</button><button type="button" className="btn" onClick={go.importCustomers}>Import customers</button></div>} />
      : wide && view === "board" ? <Board cards={cards.filter(c => src === "any" || c.source === src)} drag={drag} over={over} setDrag={setDrag} setOver={setOver} move={move} open={id => go.record(id)} />
      : wide ? <>
        <div className="tbl-wrap"><table className="tbl jobs-tbl">
          <thead><tr><th>Customer</th><th>Job</th><th>Stage</th><th className="right">Value</th><th>Next</th><th>Source</th><th className="right">Last activity</th></tr></thead>
          <tbody>{shown.map(c => { const n = nextUp(c, today), name = c.name || fmtPhone(c.phone); return <tr key={c.id} tabIndex={0} onClick={() => go.record(c.id)} onKeyDown={e => { if (e.key === "Enter") go.record(c.id); }}>
            <td><span className="name"><span><b>{name}</b><small>{[fmtPhone(c.phone), city(c)].filter(Boolean).join(" · ")}</small></span></span></td>
            <td className={c.line ? "" : "mut"}>{c.line || (c.notes ? c.notes.slice(0, 48) : "No details yet")}</td>
            <td><StageChip stage={c.stage} /></td>
            <td className={"num" + (c.value ? "" : " mut")}>{c.value ? usd(c.value) : c.ballpark ? <><span className="mut">~</span>{short(c.ballpark.low)}–{short(c.ballpark.high).replace("$", "")}</> : "–"}</td>
            <td><span className={"next " + n.tone}><Icon name={n.icon} size={14} />{n.text}</span></td>
            <td className="mut">{sourceLabel(c.source)}</td>
            <td className="num mut">{ago(c.at)}</td>
          </tr>; })}</tbody>
        </table></div>
        <div className="tbl-foot"><span>{shown.length} of {cards.length} jobs</span>{(stage !== "open" || src !== "any" || q) && <button type="button" className="link" onClick={() => { setStage("open"); setSrc("any"); setQ(""); }}>Clear filters</button>}</div>
        {shown.length === 0 && <Empty title="Nothing matches" text="Try another stage, source or spelling." />}
      </>
      : <PhoneList cards={shown} biz={biz} open={id => go.record(id)} />}
    </div>
  </>;
}

/** On a phone: grouped by what each job needs, the way the owner thinks about the day. */
function PhoneList({ cards, open }: { cards: Card[]; biz: Biz; open: (id: string) => void }) {
  const today = todayIso();
  const groups: { title: string; items: Card[]; sum?: number }[] = [];
  const need = cards.filter(c => ["red", "amber"].includes(nextUp(c, today).tone));
  const rest = cards.filter(c => !need.includes(c));
  if (need.length) groups.push({ title: "Needs you", items: need });
  for (const s of STAGES) { const items = rest.filter(c => c.stage === s); if (items.length) groups.push({ title: STAGE_LABEL[s], items, sum: items.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0) }); }
  if (!groups.length) return <Empty title="Nothing matches" text="Try another stage, source or spelling." />;
  return <div>{groups.map(g => <section key={g.title}>
    <div className="grp"><b>{g.title}</b><span>{g.items.length}{g.sum ? ` · ${short(g.sum)}` : ""}</span></div>
    {g.items.map(c => { const n = nextUp(c, today), name = c.name || fmtPhone(c.phone); return <button key={c.id} type="button" className="jrow" onClick={() => open(c.id)}>
      <Avatar name={name} size="lg" /><span style={{ minWidth: 0 }}><b>{name}</b><small>{c.line || sourceLabel(c.source)}</small></span>
      <span className="r"><b>{priceOf(c) || "–"}</b><em className={n.tone}>{n.text}</em></span></button>; })}
  </section>)}</div>;
}

function Board({ cards, drag, over, setDrag, setOver, move, open }: { cards: Card[]; drag: string | null; over: Stage | null; setDrag: (v: string | null) => void; setOver: (f: Stage | null | ((o: Stage | null) => Stage | null)) => void; move: (id: string, s: Stage) => void; open: (id: string) => void }) {
  const today = todayIso();
  return <div className="board">{STAGES.map(stage => { const list = cards.filter(c => c.stage === stage); const total = list.reduce((a, c) => a + (c.value ?? c.quote?.amount ?? 0), 0);
    return <section key={stage} className={"col-b" + (over === stage ? " over" : "")} aria-label={STAGE_LABEL[stage]}
      onDragOver={e => { if (drag) { e.preventDefault(); setOver(stage); } }} onDragLeave={() => setOver(o => o === stage ? null : o)}
      onDrop={e => { e.preventDefault(); setOver(null); if (drag) move(drag, stage); setDrag(null); }}>
      <h2><span>{STAGE_LABEL[stage]}<em>{list.length}</em></span><b>{total ? short(total) : "–"}</b></h2>
      {list.length ? list.map(c => { const n = nextUp(c, today), name = c.name || fmtPhone(c.phone); return <button key={c.id} type="button" className="jcard" draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => open(c.id)}>
        <span className="n"><Avatar name={name} /><span>{name}</span></span>
        <span className="l">{c.line || (c.notes ? c.notes.slice(0, 60) : "No job details yet")}</span>
        <span className="f"><span className={"next " + n.tone}><Icon name={n.icon} size={13} />{n.text}</span><b>{priceOf(c)}</b></span>
      </button>; }) : <p className="none">{stage === "new" ? "New leads land here." : stage === "booked" ? "Booked estimates." : stage === "quoted" ? "Quotes Cinder is chasing." : stage === "won" ? "Jobs you won." : "Lost or not a fit."}</p>}
    </section>; })}</div>;
}
