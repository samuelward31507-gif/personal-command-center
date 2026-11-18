"use client";

// One customer, everything about them. Inspector: the record beside the list (header, Activity | Job, composer).
// RecordPage: the same record taking the whole page, with details on the left and money on the right.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReplyKit, SnippetEditor, suggestReply, tabTakes, useSnippets } from "./replies";
import { draftItems, jobFields, jobProfit, jobProgress, jobSteps, rangeText, STAGE_LABEL, STAGES, type Card, type CardInvoice, type Costs, type Details, type Stage } from "@/lib/crm";
import { chosen, dollars, totals, type Item } from "@/lib/billing";
import { Avatar, Empty, Icon, Sheet, Spinner, StageChip, ago, clock, dateLabel, dayKey, dayName, first, fmtPhone, short, useArm, type Api, type Toast, noPhone, typePhone } from "./parts";
import { JobExpenses } from "./expenses";
import { CustomFieldsBox, EquipmentBox, FilesBox, OrdersBox, TagsRow } from "./records";
import { MeasureBox, PaperworkBox } from "./measure";
import { cleanPaperwork, digBlockers } from "@/lib/paperwork";
import { quoteText } from "@/lib/crm";
import { CrewPick, crewName, emailDoc } from "./crew";
import { PlanBox } from "./plans";
import { jobPrice } from "@/lib/service";
import { ChangeOrders, HoursBox } from "./jobwork";
import { PortalSheet, SignoffBox } from "./finish";
import { ChecklistBox, PropertiesBox } from "./parity";
import { FieldIcon, fieldIconFor, Stg } from "./sources";

/** "Remind me": a time and a note on this customer. The owner gets a text and a push when it's due. */
export function RemindSheet({ name, current, busy, onClose, onSave, onClear }: { name: string; current: { at: string; note: string } | null; busy: boolean; onClose: () => void; onSave: (at: string, note: string) => void; onClear: () => void }) {
  const local = (t: number) => { const x = new Date(t); const p = (n: number) => String(n).padStart(2, "0"); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`; };
  const tomorrow9 = () => { const x = new Date(); x.setDate(x.getDate() + 1); x.setHours(9, 0, 0, 0); return x.getTime(); };
  const [at, setAt] = useState(current ? local(Date.parse(current.at)) : local(tomorrow9())), [note, setNote] = useState(current?.note ?? "");
  const quick: [string, () => number][] = [["Tomorrow 9 AM", tomorrow9], ["In 3 days", () => { const x = new Date(tomorrow9()); x.setDate(x.getDate() + 2); return x.getTime(); }], ["Next week", () => { const x = new Date(tomorrow9()); x.setDate(x.getDate() + 6); return x.getTime(); }]];
  return <Sheet title={`Remind me about ${first(name)}`} sub="A text and a notification when it's due" onClose={onClose}
    foot={<>{current && <button type="button" className="btn ghost" disabled={busy} onClick={onClear}>Clear</button>}<span style={{ flex: 1 }} /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn ink" disabled={busy || !at} onClick={() => onSave(new Date(at).toISOString(), note)}>{busy ? <Spinner /> : "Set reminder"}</button></>}>
    <div className="chips">{quick.map(([l, f]) => <button key={l} type="button" onClick={() => setAt(local(f()))}>{l}</button>)}</div>
    <label className="field"><span>When</span><input type="datetime-local" value={at} step={900} onChange={e => setAt(e.target.value)} /></label>
    <label className="field"><span>What about <em>optional</em></span><input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="Call back about the gate, check if the permit came" /></label>
  </Sheet>;
}
import { LineEditor, invoiceState } from "./money";
import { Photos, shrink } from "./photos";
import { nextUp, LostPicker } from "./jobs";
import { sourceLabel, type Biz, type Data, type Go, type Text, type Thread } from "./types";

type R = { sent?: boolean; warn?: string; link?: string; calendar?: string; invoice?: CardInvoice; review?: string };
type Act = (k: string, b: Record<string, unknown>, done: string | ((r: R) => string)) => Promise<R | null>;
const asStrings = (d: Details) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)]));

/** Everything both views need: the card, the person, the texts (polled), and one way to act on the thread. */
function useRecord(id: string, d: Data, project: string, api: Api, toast: Toast, reload: () => Promise<void>) {
  const card = (d.board ?? []).find(c => c.id === id) ?? null;
  const cust = (d.customers ?? []).find(c => c.id === id) ?? null;
  const invoices = (d.invoices ?? []).filter(i => i.thread_id === id);
  const [thread, setThread] = useState<Thread | null>(null), [texts, setTexts] = useState<Text[] | null>(null);
  const [busy, setBusy] = useState(""), [arm, setArm] = useArm();
  const load = useCallback(() => api<{ thread: Thread; texts: Text[] }>(`/api/app/data?p=${project}&thread=${id}`).then(j => { setThread(j.thread); setTexts(j.texts); }).catch(() => {}), [api, id, project]);
  useEffect(() => { void load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);
  const act: Act = async (key, body, done) => {
    setBusy(key);
    try {
      const r = await api<R>("/api/app/act", { p: project, thread: id, ...body });
      toast(typeof done === "string" ? done : done(r), (!!r.warn && !r.sent) || r.calendar === "failed");
      await Promise.all([reload(), load()]); return r;
    } catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); return null; }
    finally { setBusy(""); setArm(""); }
  };
  const name = card?.name || cust?.name || thread?.customer_name || fmtPhone(card?.phone || cust?.phone || thread?.customer_phone || "");
  const phone = card?.phone || cust?.phone || thread?.customer_phone || "";
  const address = String(card?.details.address ?? cust?.address ?? "");
  const source = card?.source || cust?.source || thread?.source || "";
  const status = card?.status || thread?.status || cust?.status || "auto";
  const since = cust?.since ? new Date(cust.since).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
  const price = card ? jobPrice(card) : null;
  const inv = card?.invoice ?? invoices.find(i => i.status !== "void") ?? null;
  const paid = invoices.filter(i => i.status === "paid").reduce((a, i) => a + i.total, 0);
  const owed = invoices.filter(i => i.status === "sent").reduce((a, i) => a + i.total, 0);
  return { card, cust, invoices, texts, busy, arm, setArm, act, name, phone, address, source, status, since, price, inv, paid, owed, project, owner: d.owner, emailReady: d.emailReady, api, toast, reload };
}
type Rec = ReturnType<typeof useRecord>;

/** The record beside the list: 420px, header, two tabs, composer under the activity. */
export function Inspector({ id, d, biz, project, api, toast, reload, go, onClose, onExpand, ask: ask0 }: { id: string; d: Data; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; onClose: () => void; onExpand: () => void; ask?: "quoted" | "won" }) {
  const r = useRecord(id, d, project, api, toast, reload);
  const [tab, setTab] = useState<"activity" | "job">(ask0 ? "job" : "activity");
  const [ask, setAsk] = useState<Stage | null>(ask0 ?? null);
  const [losing, setLosing] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const canText = biz.number && r.status !== "opted_out" && !noPhone(r.phone);
  const next = r.card ? nextUp(r.card) : null;
  const pick = (s: Stage) => {
    if (r.card && s === r.card.stage) return;
    if (s === "quoted") { go.quote(id); return; }
    if (s === "won") { setAsk(s); setTab("job"); return; }
    if (s === "lost") { setLosing(true); return; }
    void r.act("stage", { action: "stage", stage: s }, `Moved to ${STAGE_LABEL[s]}.`);
  };
  const lostSheet = losing && <LostPicker name={r.name} busy={!!r.busy} onClose={() => setLosing(false)} onPick={why => { void r.act("stage", { action: "stage", stage: "lost", reason: why }, `Marked lost, ${why.toLowerCase()}. Follow-ups stopped.`); setLosing(false); }} />;
  return <>
    <div className="insp-h">
      <Avatar name={r.name} size="xl" />
      <div className="t"><b>{r.name}</b><span>{[fmtPhone(r.phone), r.address].filter(Boolean).join(", ")}</span></div>
      <div className="acts">
        {noPhone(r.phone) ? null : biz.canCall ? <button type="button" className="btn sm" title="Call (rings your cell first)" disabled={!!r.busy} onClick={() => void r.act("call", { action: "call" }, "Calling your cell now.")}><Icon name="phone" size={13} />Call</button> : <a className="btn sm" href={`tel:${r.phone}`}><Icon name="phone" size={13} />Call</a>}
        {!noPhone(r.phone) && <button type="button" className="btn sm" onClick={() => (document.querySelector(".insp textarea, .rec textarea") as HTMLTextAreaElement | null)?.focus()}>Text</button>}
        {!biz.crew && r.card && !r.card.pastCustomer && <button type="button" className="btn sm" onClick={() => go.quote(id)}>Quote</button>}
        <button type="button" className="btn ghost ic" title="Open full record (↵)" aria-label="Open full record" onClick={onExpand}><Icon name="expand" size={14} /></button>
        <button type="button" className="btn ghost ic" title="Close (esc)" aria-label="Close" onClick={onClose}><Icon name="x" size={14} /></button>
      </div>
    </div>
    <div className="insp-sub path-row">
      {r.card && !r.card.pastCustomer ? <div className="path" role="radiogroup" aria-label="Stage">{(["new", "booked", "quoted", "won"] as Stage[]).map(s => { const at = STAGES.indexOf(r.card!.stage), me = STAGES.indexOf(s);
        return <button key={s} type="button" role="radio" aria-checked={r.card!.stage === s} className={(r.card!.stage === s ? "on" : me < at && r.card!.stage !== "lost" ? "past" : "")} disabled={!!r.busy} onClick={() => pick(s)}>{s === "booked" ? "Booked" : STAGE_LABEL[s]}</button>; })}</div>
        : <span>{r.card?.pastCustomer ? "Past customer" : sourceLabel(r.source)}</span>}
      {r.price ? <b className="amt">{dollars(r.price)}</b> : null}
    </div>
    {next && (next.tone === "red" || next.tone === "amber") && <div className="insp-sub" style={{ color: next.tone === "red" ? "var(--bad)" : "var(--ink)" }}><Icon name={next.icon} size={13} /><span>{next.text}</span></div>}
    {noPhone(r.phone) && <AddPhone r={r} />}
    <div className="insp-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity{r.texts ? <em>{r.texts.length}</em> : null}</button>
      <button type="button" role="tab" aria-selected={tab === "job"} className={tab === "job" ? "on" : ""} onClick={() => setTab("job")}>Job</button>
    </div>
    <div className="insp-bd">
      {tab === "activity" ? <Activity r={r} canText={!!canText} ta={ta} compact />
        : <div className="job">
          <div className="strip">
            <div><span>Quote</span><b className={r.card?.quote?.amount || r.card?.value ? "" : "mut"}>{r.card?.quote?.amount ? dollars(r.card.quote.amount) : r.card?.value ? dollars(r.card.value) : r.card?.ballpark ? `~${short(r.card.ballpark.low)}–${short(r.card.ballpark.high).replace("$", "")}` : "–"}</b></div>
            <div><span>Invoice</span><b className={r.inv ? "" : "mut"}>{r.inv ? dollars(r.inv.total) : "–"}</b></div>
            <div><span>Paid</span><b className={r.paid ? "" : "mut"}>{dollars(r.paid)}</b></div>
            <div><span>Owed</span><b className={r.owed ? "bad" : "mut"}>{dollars(r.owed)}</b></div>
          </div>
          {r.card && <section className="card"><div className="hd"><h2>Stage</h2></div>
            <div className="stages" role="radiogroup" aria-label="Stage">{STAGES.map(s => <button key={s} type="button" role="radio" aria-checked={r.card!.stage === s} className={r.card!.stage === s ? "on" : ""} disabled={!!r.busy} onClick={() => pick(s)}>{STAGE_LABEL[s]}</button>)}</div></section>}
          <JobPanel r={r} biz={biz} ask={ask} setAsk={setAsk} go={go} canText={!!canText} />
          {r.card && r.card.stage === "won" && !r.card.pastCustomer && <Steps card={r.card} trade={biz.trade} busy={r.busy} tick={(step, done) => void r.act("step:" + step, { action: "jobstep", step, done }, done ? "Done." : "Unticked.")} />}
          {r.card && r.card.stage === "won" && !r.card.pastCustomer && <CostBox card={r.card} busy={r.busy} save={c => void r.act("costs", { action: "jobcosts", costs: c }, "Costs saved.")} />}
          {r.card && <CustomFieldsBox ctx={{ d, project, api, toast, reload }} card={r.card} act={r.act} />}
          {r.card && !biz.crew && <TagsRow ctx={{ d, project, api, toast, reload }} card={r.card} act={r.act} />}
          {r.card && (/fence/i.test(biz.trade) || !!d.setup?.fence_types) && !r.card.pastCustomer && <MeasureBox ctx={{ d, project, api, toast, reload }} card={r.card} canEdit={!biz.crew} />}
          {r.card && /fence/i.test(biz.trade) && (r.card.stage === "won" || r.card.stage === "quoted") && !r.card.pastCustomer && <PaperworkBox ctx={{ d, project, api, toast, reload }} card={r.card} canEdit={!biz.crew} />}
          {r.card && <EquipmentBox ctx={{ d, project, api, toast, reload }} thread={r.card.id} />}
          {r.card && <FilesBox ctx={{ d, project, api, toast, reload }} thread={r.card.id} />}
          {r.card && (r.card.stage === "won" || r.card.stage === "quoted") && !r.card.pastCustomer && <JobExpenses d={d} thread={r.card.id} project={project} api={api} toast={toast} reload={reload} materials={r.card.costs.materials}
            onUse={amt => void r.act("costs", { action: "jobcosts", costs: { ...r.card!.costs, materials: amt } }, "Materials cost updated.")} />}
          {r.card && !biz.crew && (r.card.stage === "won" || r.card.stage === "quoted") && !r.card.pastCustomer && <OrdersBox ctx={{ d, project, api, toast, reload }} card={r.card} />}
          {r.card && r.card.stage === "won" && !r.card.pastCustomer && <ChecklistBox d={d} card={r.card} trade={biz.trade} act={r.act} busy={r.busy} canPick={!biz.crew} onPhoto={async (label, f) => { try { await r.act("photo", { action: "photo", kind: "during", caption: label, data: await shrink(f) }, "Photo added."); } catch { r.toast("That photo didn't work.", true); } }} />}
          {r.card && r.card.stage === "won" && !r.card.pastCustomer && <SignoffBox owner={!biz.crew} d={d} card={r.card} trade={biz.trade} save={async input => !!(await r.act("signoff", { action: "signoff", input }, "Signed off. Install and walk-through ticked."))} />}
          {r.card && r.card.stage === "won" && !r.card.pastCustomer && !biz.crew && <HoursBox d={d} card={r.card} act={r.act} busy={r.busy} />}
        </div>}
    </div>
    {lostSheet}
  </>;
}

/** The record as the whole page: details left, activity centre, money right. */
export function RecordPage({ id, ask: ask0, view: view0, draft: draft0, d, biz, project, api, toast, reload, go, onBack }: { id: string; ask?: "quoted" | "won"; view?: "activity" | "job"; draft?: string; d: Data; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; onBack: () => void }) {
  const r = useRecord(id, d, project, api, toast, reload);
  const [tab, setTab] = useState<"activity" | "job">(view0 ?? (ask0 ? "job" : "activity"));
  const [ask, setAsk] = useState<Stage | null>(ask0 ?? null);
  const [losing, setLosing] = useState(false), [reminding, setReminding] = useState(false), [portal, setPortal] = useState(false);
  const [wide, setWide] = useState(false);
  useEffect(() => { const m = matchMedia("(min-width: 900px)"); const h = () => setWide(m.matches); h(); m.addEventListener("change", h); return () => m.removeEventListener("change", h); }, []);
  const ta = useRef<HTMLTextAreaElement>(null);
  const canText = biz.number && r.status !== "opted_out" && !noPhone(r.phone);
  const next = r.card ? nextUp(r.card) : null;
  const { card, cust, name, phone, address, source, since, price, inv, invoices, paid, owed, status } = r;
  const pick = (s: Stage) => {
    if (card && s === card.stage) return;
    if (s === "quoted") { go.quote(id); return; }
    if (s === "won") { setAsk(s); setTab("job"); return; }
    if (s === "lost") { setLosing(true); return; }
    void r.act("stage", { action: "stage", stage: s }, `Moved to ${STAGE_LABEL[s]}.`);
  };
  const remindSheet = reminding && <RemindSheet name={r.name} current={card?.remind && !card.remind.sent ? card.remind : null} busy={!!r.busy} onClose={() => setReminding(false)}
    onSave={(at, note) => { void r.act("remind", { action: "remind", at, note }, `Reminder set for ${new Date(at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`); setReminding(false); }}
    onClear={() => { void r.act("remind", { action: "remind", at: null }, "Reminder cleared."); setReminding(false); }} />;
  const lostSheet = losing && <LostPicker name={r.name} busy={!!r.busy} onClose={() => setLosing(false)} onPick={why => { void r.act("stage", { action: "stage", stage: "lost", reason: why }, `Marked lost, ${why.toLowerCase()}. Follow-ups stopped.`); setLosing(false); }} />;
  const primary = (() => {
    if (!card) return null;
    if (card.stage === "won" && inv) return <button type="button" className="btn ink" onClick={() => go.invoice(inv.id)}>Open invoice</button>;
    if (card.stage === "won") return <button type="button" className="btn ink" onClick={() => setTab("job")}>Create invoice</button>;
    if (card.stage === "quoted" && card.quote && !card.quote.linked) return <button type="button" className="btn ink" onClick={() => go.quote(card.id)}>Send the quote</button>;
    if (card.stage === "quoted") return <button type="button" className="btn ink" onClick={() => pick("won")}>Mark won</button>;
    return <button type="button" className="btn ink" onClick={() => pick("quoted")}>Write quote</button>;
  })();
  const money = <section className="card"><div className="hd"><h2>Money</h2></div>
    <div className="money"><span>Quote</span><b className={card?.quote?.amount || card?.value ? "" : "mut"}>{card?.quote?.amount ? dollars(card.quote.amount) : card?.value ? dollars(card.value) : card?.ballpark ? `~${rangeText(card.ballpark)}` : "–"}</b></div>
    {invoices.map(i => { const st = invoiceState(i); return <div key={i.id} className="money"><span>Invoice #{i.number} <small>{st.text}</small></span><b>{dollars(i.total)}</b></div>; })}
    <div className="money"><span>Paid</span><b className={paid ? "" : "mut"}>{dollars(paid)}</b></div>
    <div className="money sum"><span className="t-em">Owed</span><b style={owed ? { color: "var(--bad)" } : undefined}>{dollars(owed)}</b></div>
  </section>;
  const needs = next && (next.tone === "red" || next.tone === "amber") && card ? <section className="card warn"><div className="hd"><h2>Needs you</h2></div>
    <p style={{ fontWeight: 500 }}>{next.text}</p>
    <div className="acts-row" style={{ marginTop: 8 }}>
      {next.icon === "chat" && <button type="button" className="btn ink sm" onClick={() => { setTab("activity"); ta.current?.focus(); }}>Reply</button>}
      {next.icon === "quote" && <button type="button" className="btn ink sm" onClick={() => go.quote(card.id)}>{card.quote && !card.quote.linked ? "Send the quote" : "Write the quote"}</button>}
      {next.icon === "invoice" && inv && <button type="button" className="btn ink sm" onClick={() => go.invoice(inv.id)}>Open invoice</button>}
      {next.icon === "invoice" && !inv && <button type="button" className="btn ink sm" onClick={() => setTab("job")}>Create invoice</button>}
      {next.icon === "cal" && <button type="button" className="btn ink sm" onClick={() => setTab("job")}>Open the job</button>}
      {noPhone(phone) ? null : biz.canCall ? <button type="button" className="btn sm" disabled={!!r.busy} onClick={() => void r.act("call", { action: "call" }, "Calling your cell now.")}>Call {first(name)}</button> : <a className="btn sm" href={`tel:${phone}`}>Call {first(name)}</a>}
    </div></section> : null;
  const rail = <>{!biz.crew && needs}{!biz.crew && money}{!biz.crew && card && card.stage === "won" && !card.pastCustomer && <CostBox card={card} busy={r.busy} save={c => void r.act("costs", { action: "jobcosts", costs: c }, "Costs saved.")} />}{card && (/fence/i.test(biz.trade) || !!d.setup?.fence_types) && !card.pastCustomer && <MeasureBox ctx={{ d, project, api, toast, reload }} card={card} canEdit={!biz.crew} />}{card && /fence/i.test(biz.trade) && (card.stage === "won" || card.stage === "quoted") && !card.pastCustomer && <PaperworkBox ctx={{ d, project, api, toast, reload }} card={card} canEdit={!biz.crew} />}{card && <EquipmentBox ctx={{ d, project, api, toast, reload }} thread={card.id} />}{card && <FilesBox ctx={{ d, project, api, toast, reload }} thread={card.id} />}{card && (card.stage === "won" || card.stage === "quoted") && !card.pastCustomer && <JobExpensesSlot d={d} thread={card.id} project={project} api={api} toast={toast} reload={reload} materials={card.costs.materials} onUse={biz.crew ? undefined : amt => void r.act("costs", { action: "jobcosts", costs: { ...card.costs, materials: amt } }, "Materials cost updated.")} />}{card && !biz.crew && (card.stage === "won" || card.stage === "quoted") && !card.pastCustomer && <OrdersBox ctx={{ d, project, api, toast, reload }} card={card} />}
    {card && card.stage === "won" && !card.pastCustomer && <ChecklistBox d={d} card={card} trade={biz.trade} act={r.act} busy={r.busy} canPick={!biz.crew} onPhoto={async (label, f) => { try { await r.act("photo", { action: "photo", kind: "during", caption: label, data: await shrink(f) }, "Photo added."); } catch { r.toast("That photo didn't work.", true); } }} />}
    {card && card.stage === "won" && !card.pastCustomer && <SignoffBox owner={!biz.crew} d={d} card={card} trade={biz.trade} save={async input => !!(await r.act("signoff", { action: "signoff", input }, "Signed off. Install and walk-through ticked."))} />}
    {!biz.crew && card && card.stage === "won" && !card.pastCustomer && <HoursBox d={d} card={card} act={r.act} busy={r.busy} />}
    {!biz.crew && (card ? card.stage === "won" || card.pastCustomer : !!cust) && <PlanBox d={d} thread={id} project={project} api={api} toast={toast} reload={reload} />}
    {card && <PropertiesBox card={card} act={r.act} busy={r.busy} canEdit={!biz.crew} />}
    <section className="card"><div className="hd"><h2>On file</h2></div>
      {card && !biz.crew && card.stage !== "lost" && !card.pastCustomer && <CrewPick d={d} card={card} project={project} api={api} toast={toast} reload={reload} />}
      {card && biz.crew && card.crewMember && <div className="money"><span>On the job</span><b>{crewName(d, card.crewMember)}</b></div>}
      <div className="money"><span>Source</span><b>{sourceLabel(source)}</b></div>
      {since && <div className="money"><span>Since</span><b>{since}</b></div>}
      <div className="money"><span>Texting</span>{status === "opted_out" ? <span className="dot bad">Opted out</span> : status === "paused" ? <span className="dot ember">You&rsquo;re replying</span> : <span className="dot">Replying for you</span>}</div>
      {card?.email && <div className="money"><span>Email</span><b><a className="link" href={`mailto:${card.email}`} style={{ fontWeight: 500 }}>{card.email}</a></b></div>}
      {card?.remind && !card.remind.sent && <div className="money"><span>Reminder</span><b>{new Date(card.remind.at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{card.remind.note ? `, ${card.remind.note}` : ""}</b></div>}
      {card?.reviewSent && <div className="money"><span>Review</span><b>Asked {dateLabel(card.reviewSent)}</b></div>}
      {card?.install && <div className="money"><span>Install</span><b>{dateLabel(card.install)}{card.installDays > 1 ? `, ${card.installDays} days` : ""}{card.onCalendar ? ", on calendar" : ""}</b></div>}
    </section></>;

  return <div className="rec">
    {noPhone(phone) && <AddPhone r={r} />}
    <header className="rec-h">
      <button type="button" className="btn ghost ic" onClick={onBack} aria-label="Back" title="Back (esc)"><Icon name="back" size={16} /></button>
      <Avatar name={name} size="xl" /><div className="t"><h1>{name}</h1><span>{[fmtPhone(phone), address, since ? `Customer since ${since}` : sourceLabel(source)].filter(Boolean).join(", ")}</span></div>
      {card && <Stg stage={card.pastCustomer ? "won" : card.stage}>{`${card.pastCustomer ? "Past customer" : STAGE_LABEL[card.stage]}${price && !biz.crew ? `, ${dollars(price)}` : ""}`}</Stg>}
      <div className="acts">
        {noPhone(phone) ? null : biz.canCall ? <button type="button" className="btn" disabled={!!r.busy} onClick={() => void r.act("call", { action: "call" }, "Calling your cell now.")}><Icon name="phone" size={14} />Call</button> : <a className="btn" href={`tel:${phone}`}><Icon name="phone" size={14} />Call</a>}
        <button type="button" className="btn" onClick={() => { setTab("activity"); setTimeout(() => ta.current?.focus(), 50); }}><Icon name="chat" size={14} />Text</button>
        {address && <a className="btn ic" href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" aria-label="Directions" title="Directions"><Icon name="pin" size={14} /></a>}
        {card?.email && <a className="btn ic" href={`mailto:${card.email}`} aria-label="Email" title={card.email}><Icon name="send" size={14} /></a>}
        {!biz.crew && (card || cust) && <button type="button" className="btn ic" onClick={() => setPortal(true)} aria-label="Customer page" title={`${first(name)}'s page: quotes, invoices, visits`}><Icon name="user" size={14} /></button>}
        {card && !biz.crew && <button type="button" className={"btn ic" + (card.remind && !card.remind.sent ? " on" : "")} onClick={() => setReminding(true)} aria-label="Remind me" title={card.remind && !card.remind.sent ? `Reminder ${dateLabel(card.remind.at)}` : "Remind me"}><Icon name="clock" size={14} /></button>}
        {!biz.crew && primary}
      </div>
    </header>
    {/* On a phone: the three things you do with a customer, under your thumb. */}
    <div className="rec-bar" role="toolbar" aria-label={`With ${first(name)}`}>
      {noPhone(phone) ? null : biz.canCall ? <button type="button" className="btn" disabled={!!r.busy} onClick={() => void r.act("call", { action: "call" }, "Calling your cell now.")}><Icon name="phone" size={16} />Call</button> : <a className="btn" href={`tel:${phone}`}><Icon name="phone" size={16} />Call</a>}
      {!noPhone(phone) && <button type="button" className="btn" onClick={() => { setTab("activity"); setTimeout(() => ta.current?.focus(), 50); }}><Icon name="chat" size={16} />Text</button>}
      {!biz.crew && primary}
    </div>
    {card?.stage === "quoted" && card.quote?.linked && (card.quote.views ?? 0) > 0 && !biz.crew && <div className="chase-banner"><Icon name="eye" size={14} /><span>Quote viewed {card.quote.views} {card.quote.views === 1 ? "time" : "times"}, not approved.</span>
      <button type="button" className="btn sm" disabled={!!r.busy || !canText} onClick={() => void r.act("nudge", { action: "quotenudge" }, `Texted ${first(name)} about the quote.`)}>{r.busy === "nudge" ? <Spinner /> : "Nudge"}</button></div>}
    <div className="rec-body">
      <aside className="rec-side" aria-label="Details">
        <section>
          <p className="sec">The job{card && <button type="button" className="link" onClick={() => setTab("job")}>Edit</button>}</p>
          {card ? <dl>
            {jobFields(biz.trade).filter(f => f.key !== "address" && card.details[f.key] != null && card.details[f.key] !== "").map(f => <div key={f.key} className="kv"><dt><FieldIcon name={fieldIconFor(f.label)} />{f.label}</dt><dd>{String(card.details[f.key])}{f.unit ? ` ${f.unit}` : ""}</dd></div>)}
            {address && <div className="kv"><dt><FieldIcon name="pin" />Address</dt><dd title={address}>{address}</dd></div>}
            <div className="kv"><dt><FieldIcon name="link" />Source</dt><dd>{sourceLabel(source)}</dd></div>
            <div className="kv"><dt><FieldIcon name="dollar" />Job value</dt><dd className={card.value ? "" : "mut"}>{card.value ? dollars(card.value) : card.ballpark ? `~${rangeText(card.ballpark)}` : "Not set"}</dd></div>
            {card.next && <div className="kv"><dt><FieldIcon name="cal" />Estimate</dt><dd>{new Date(card.next).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</dd></div>}
            {card.install && <div className="kv"><dt><FieldIcon name="cal" />Install</dt><dd>{dateLabel(card.install)}{card.installDays > 1 ? `, ${card.installDays} days` : ""}</dd></div>}
            {!card.line && !address && <p className="fine">Nothing yet. These fill in as the customer answers.</p>}
          </dl> : <>
            <dl>{address && <div className="kv"><dt>Address</dt><dd title={address}>{address}</dd></div>}<div className="kv"><dt>Source</dt><dd>{sourceLabel(source)}</dd></div>{cust && cust.spent > 0 && <div className="kv"><dt>Billed</dt><dd>{dollars(cust.spent)}, {cust.jobs} {cust.jobs === 1 ? "job" : "jobs"}</dd></div>}</dl>
            <p className="fine" style={{ marginTop: 8 }}>No job on the board for {first(name)} right now.</p>
            <button type="button" className="btn sm" style={{ marginTop: 8 }} disabled={!!r.busy} onClick={() => void r.act("stage", { action: "stage", stage: "new" }, "Added to New.")}><Icon name="plus" size={13} />Start a job</button>
          </>}
        </section>
        {card && <section><p className="sec">Stage</p>
          <div className="stages" role="radiogroup" aria-label="Stage">{STAGES.map(s => <button key={s} type="button" role="radio" aria-checked={card.stage === s} className={card.stage === s ? "on" : ""} disabled={!!r.busy} onClick={() => pick(s)}>{STAGE_LABEL[s]}</button>)}</div>
          {card.ballpark && (card.stage === "new" || card.stage === "booked") && <p className="fine" style={{ marginTop: 6 }}>Ballpark from your prices: <b className="t-em">{rangeText(card.ballpark)}</b></p>}
        </section>}
        {card && card.stage === "won" && !card.pastCustomer && <Steps card={card} trade={biz.trade} busy={r.busy} tick={(step, done) => void r.act("step:" + step, { action: "jobstep", step, done }, done ? "Done." : "Unticked.")} />}
        {card && (card.stage === "new" || card.stage === "booked") && <Brief card={card} name={name} phone={phone} address={address} texts={r.texts} trade={biz.trade} toast={toast} />}
        {card && <Photos thread={card.id} photos={card.photos ?? []} stage={card.stage} project={project} api={api} toast={toast} reload={reload} />}
        {card?.crew && <section><p className="sec">Crew notes</p><p style={{ lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{card.crew}</p></section>}
        {(card?.notes || cust?.line) && <section><p className="sec">Notes</p><p style={{ lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{card?.notes || cust?.line}</p></section>}
        {!wide && <div className="rail-mobile">{rail}</div>}
      </aside>
      <section className="rec-act" aria-label="Activity">
        <div className="insp-tabs" role="tablist" style={{ padding: "0" }}>
          <button type="button" role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity</button>
          <button type="button" role="tab" aria-selected={tab === "job"} className={tab === "job" ? "on" : ""} onClick={() => setTab("job")}>{card ? (card.stage === "won" ? "Job, invoice, review" : card.stage === "quoted" ? "The quote" : "Job details") : "Details"}</button>
        </div>
        {tab === "activity" ? <Activity r={r} canText={!!canText} ta={ta} draft0={draft0} /> : <div className="job" style={{ display: "flex", flexDirection: "column", paddingTop: 8 }}><JobPanel r={r} biz={biz} ask={ask} setAsk={setAsk} go={go} canText={!!canText} /></div>}
      </section>
      {wide && <aside className="rec-rail" aria-label="Money and next steps">{rail}</aside>}
    </div>
    {lostSheet}
    {remindSheet}
    {portal && <PortalSheet name={name} thread={id} project={project} api={api} toast={toast} canText={!!canText} onClose={() => setPortal(false)} />}
  </div>;
}

/** What the owner reads in the truck: who, where, the job as the customer described it, and what they said. One tap copies it. */
function Brief({ card, name, phone, address, texts, trade, toast }: { card: Card; name: string; phone: string; address: string; texts: Text[] | null; trade: string; toast: Toast }) {
  const said = (texts ?? []).filter(t => t.direction === "in" && t.author !== "system").map(t => t.body.trim()).filter(Boolean);
  const facts = jobFields(trade).filter(f => f.key !== "address" && card.details[f.key] != null && card.details[f.key] !== "").map(f => `${f.label}: ${String(card.details[f.key])}${f.unit ? " " + f.unit : ""}`);
  const lines = [name, fmtPhone(phone), address, ...facts, card.ballpark ? `Ballpark ${rangeText(card.ballpark)}` : "", card.next ? `Estimate ${new Date(card.next).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "", said.length ? `They said: "${said.slice(0, 3).join(" / ").slice(0, 300)}"` : "", card.crew ? `Crew: ${card.crew}` : ""].filter(Boolean);
  const copy = async () => { try { await navigator.clipboard.writeText(lines.join("\n")); toast("Brief copied."); } catch { prompt("Copy:", lines.join("\n")); } };
  return <section className="brief"><p className="sec">Estimate brief<button type="button" className="link" onClick={() => void copy()}>Copy</button></p>
    {said.length ? <p className="said">&ldquo;{said.slice(0, 2).join(" / ").slice(0, 220)}&rdquo;</p> : <p className="fine">Nothing from {first(name)} in their own words yet.</p>}
    {address && <a className="btn sm" href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer"><Icon name="pin" size={13} />Directions</a>}
  </section>;
}

// ---------- Activity: texts and events in one timeline, composer under it ----------
type Ev = { at: string; kind: "text" | "event"; text?: Text; title?: string; sub?: string; icon?: string; tone?: string };
/** A customer who came in without a phone: add the number here and texting, calls and reminders work. */
function AddPhone({ r }: { r: Rec }) {
  const [v, setV] = useState("");
  return <form className="addph" onSubmit={async e => { e.preventDefault(); if (await r.act("setphone", { action: "setphone", phone: v }, "Number added. Texts and calls work now.")) setV(""); }}>
    <span><b>No phone on file.</b> Came in without one. Add it to text or call them; until then, email works.</span>
    <input className="input sm" inputMode="tel" placeholder="(720) 555-0100" aria-label="Phone number" value={v} onChange={e => setV(typePhone(e.target.value))} />
    <button type="submit" className="btn sm" disabled={!!r.busy || v.replace(/\D/g, "").length !== 10}>Add</button>
  </form>;
}

function Activity({ r, canText, ta, compact, draft0 }: { r: Rec; canText: boolean; ta: React.RefObject<HTMLTextAreaElement | null>; compact?: boolean; draft0?: string }) {
  // The inspector scrolls inside its own pane, so it may start at the newest text; the page must not pull the window down.
  const autoscroll = !!compact;
  const { card, texts, name, status, busy, act } = r;
  const [draft, setDraft] = useState(draft0 ?? "");
  // Help in the reply box: a reply that fits where the conversation stands, and the owner's saved replies.
  const snips = useSnippets(r.project), [editSnips, setEditSnips] = useState(false);
  const sug = useMemo(() => suggestReply(name, texts, { stage: card?.stage, owner: r.owner, quoteAmount: card?.quote?.amount }), [name, texts, card?.stage, r.owner, card?.quote?.amount]);
  const end = useRef<HTMLDivElement>(null);
  const items = useMemo<Ev[]>(() => {
    const out: Ev[] = (texts ?? []).map(t => ({ at: t.at, kind: "text", text: t }));
    const inv = card?.invoice;
    if (inv?.sent_at) out.push({ at: inv.sent_at, kind: "event", title: `Invoice #${inv.number} sent`, sub: `${dollars(inv.total)}${inv.due_on ? `, due ${dateLabel(inv.due_on)}` : ""}`, icon: "invoice" });
    if (inv?.viewed_at) out.push({ at: inv.viewed_at, kind: "event", title: `${first(name)} opened the invoice`, icon: "eye" });
    if (inv?.paid_at) out.push({ at: inv.paid_at, kind: "event", title: `Invoice #${inv.number} paid`, sub: dollars(inv.total), icon: "check", tone: "ok" });
    if (card?.reviewSent) out.push({ at: card.reviewSent, kind: "event", title: "Review request sent", icon: "star", tone: "ok" });
    if (card?.quote?.viewed) out.push({ at: card.quote.viewed, kind: "event", title: `${first(name)} opened the quote`, sub: card.quote.amount ? dollars(card.quote.amount) : "", icon: "eye" });
    if (card) for (const [k, day] of Object.entries(card.job)) out.push({ at: day + "T12:00:00", kind: "event", title: k === "installed" ? "Installed" : k === "walk" ? "Walk-through done" : k.charAt(0).toUpperCase() + k.slice(1) + " done", icon: "check", tone: "ok" });
    return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }, [texts, card, name]);
  const seen = useRef<number | null>(null);
  useEffect(() => { if (texts === null) return; if ((seen.current === null && autoscroll) || (seen.current !== null && items.length > seen.current)) end.current?.scrollIntoView({ block: "nearest" }); seen.current = items.length; }, [items.length, texts, autoscroll]);
  useEffect(() => { const el = ta.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(160, el.scrollHeight) + "px"; } }, [draft, ta]);
  const mine = status === "paused";
  const [snipOpen, setSnipOpen] = useState(false);
  let lastDay = "", lastWho = "", lastAt = 0;
  return <>
    <div style={{ padding: "4px 0 8px", flex: 1 }}>
      {texts === null ? <div className="skel-rows" style={{ padding: "12px 0" }}><i className="skel" /><i className="skel" /><i className="skel" /></div>
        : items.length === 0 ? <Empty title="Nothing here yet" text={canText ? "Anything you send goes from your business number." : "No texts on this customer yet."} />
        : items.map((x, i) => {
          const newDay = dayKey(x.at) !== lastDay;
          const sep = newDay ? <p className="day" key={"d" + i}><span>{dayName(x.at)}</span></p> : null; lastDay = dayKey(x.at);
          if (x.kind === "event" || x.text?.author === "system") lastWho = "";
          if (x.kind === "event") return <div key={"e" + i}>{sep}<article className="ev"><span className={"ic " + (x.tone ?? "")}><Icon name={x.icon ?? "check"} size={13} /></span><div><header><b>{x.title}</b>{x.sub && <span>{x.sub}</span>}<time>{clock(x.at)}</time></header></div></article></div>;
          const t = x.text!;
          if (t.author === "system") return <div key={t.id}>{sep}<article className="ev"><span className="ic"><Icon name="bolt" size={13} /></span><div><header><b>{t.body}</b><time>{clock(t.at)}</time></header></div></article></div>;
          const who = t.direction === "in" ? "them" : t.author === "owner" ? "you" : "cinder";
          const cont = !newDay && who === lastWho && Date.parse(t.at) - lastAt < 10 * 60000; lastWho = who; lastAt = Date.parse(t.at);
          const photos = (t.media ?? []).map((_, k) => `/api/app/media?id=${t.id}&i=${k}`);
          const words = photos.length && /^\(sent (a photo|\d+ photos)\)$/.test(t.body) ? "" : t.body;
          return <div key={t.id}>{sep}<article className={"lgx " + who + (cont ? " cont" : "")}>
            {!cont && <header><b>{who === "them" ? (compact ? first(name) : name) : who === "you" ? "You" : "Cinder"}</b><time>{clock(t.at)}</time></header>}
            {photos.length > 0 && <div className="photos">{photos.map(src => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="Photo from the customer" loading="lazy" /></a>)}</div>}
            {words && <p title={cont ? clock(t.at) : undefined}>{words}</p>}
          </article></div>;
        })}
      <div ref={end} />
    </div>
    {canText && <div className="compose">
      {editSnips && <SnippetEditor list={snips.list} onSave={snips.save} onClose={() => setEditSnips(false)} />}
      <form className="box" onSubmit={async e => { e.preventDefault(); if (draft.trim() && await act("reply", { action: "reply", body: draft }, "Sent from your business number.")) setDraft(""); }}>
        <ReplyKit hidden={!!draft.trim()} showSnips={snipOpen} suggestion={sug} snippets={snips.list} onUse={x => { setDraft(x); setSnipOpen(false); ta.current?.focus(); }} onEdit={() => setEditSnips(true)} />
        <textarea ref={ta} rows={1} value={draft} onChange={e => { if (e.target.value === "/" && !draft) { setSnipOpen(true); return; } setDraft(e.target.value); }} onKeyDown={e => { if (tabTakes(e, draft, sug, setDraft)) return; if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement)?.requestSubmit(); }} placeholder={`Text ${first(name)}, / for saved replies`} aria-label="Reply" />
        <div className="tools">
          <button type="button" className={"who" + (mine ? " on" : "")} disabled={!!busy || (!mine && status === "booked")} title={mine ? "Turn auto-reply back on" : "Take over this conversation"} onClick={() => void (mine ? act("status", { action: "status", status: "auto" }, "Auto-reply is back on.") : act("status", { action: "status", status: "paused" }, "Auto-reply is off for this one. You've got it."))}>
            <i aria-hidden="true" />{mine ? "You're replying" : "Cinder is replying"}</button>
          <button type="button" className={"btn ghost sm snipb" + (snipOpen ? " on" : "")} aria-expanded={snipOpen} onClick={() => setSnipOpen(o => !o)}>Saved replies</button>
          <button type="submit" className="btn ink sm send" disabled={!!busy || !draft.trim()} title="Send (⌘↵)">{busy === "reply" ? <Spinner /> : "Send"}</button>
        </div>
      </form>
    </div>}
    {!canText && status === "opted_out" && <p className="fine" style={{ padding: "8px 0" }}>{first(name)} opted out of texts. Call instead.</p>}
  </>;
}

// ---------- The job: quote, won, install, invoice, review, details ----------
function JobPanel({ r, biz, ask, setAsk, go, canText }: { r: Rec; biz: Biz; ask: Stage | null; setAsk: (s: Stage | null) => void; go: Go; canText: boolean }) {
  const { card, busy, act, name, arm, setArm } = r;
  const [d, setD] = useState<Record<string, string>>(() => asStrings(card?.details ?? {}));
  const [value, setValue] = useState(card?.value ? String(card.value) : ""), [notes, setNotes] = useState(card?.notes ?? ""), [crew, setCrew] = useState(card?.crew ?? ""), [email, setEmail] = useState(card?.email ?? "");
  const [deposit, setDeposit] = useState(card?.quote?.deposit ? String(card.quote.deposit) : "");
  const [amt, setAmt] = useState(card?.value ? String(card.value) : card?.quote?.amount ? String(card.quote.amount) : "");
  const q = card?.quote ?? null;
  const [items, setItems] = useState<Item[]>(() => q?.items?.length ? q.items : draftItems(biz.trade, card?.details ?? {}, biz.priceBook));
  const [tax, setTax] = useState<number>(() => q?.items?.length ? q.tax : Number(biz.taxRate) || 0);
  const [editLines, setEditLines] = useState(false), [incl, setIncl] = useState(q?.note ?? "");
  const [install, setInstall] = useState(card?.install ?? ""), [itime, setItime] = useState(card?.installTime ?? ""), [idays, setIdays] = useState(String(card?.installDays || 1));
  const [review, setReview] = useState(card ? (card.stage === "won" ? card.reviewAuto : biz.reviewLink) : false);
  if (!card) return <Empty title="No job on the board" text={`Start a job to track ${first(name)} from estimate to paid.`} />;
  const firstName = first(card.name);
  const installDirty = install !== (card.install ?? "") || itime !== (card.installTime ?? "") || idays !== String(card.installDays || 1);
  const dirty = JSON.stringify(d) !== JSON.stringify(asStrings(card.details)) || value !== (card.value ? String(card.value) : "") || notes !== card.notes || crew !== (card.crew ?? "") || email !== (card.email ?? "") || (card.stage === "won" && review !== card.reviewAuto);
  const depN = Math.round(Number(deposit.replace(/[^\d.]/g, "")) || 0);
  const quoteTotal = totals(chosen(items.filter(i => i.name.trim() && i.qty > 0), null), tax).total;
  const calMsg = (c?: string) => c === "added" ? " On your Google Calendar." : c === "removed" ? " Taken off your calendar." : c === "not_connected" ? " Connect Google Calendar to put it there." : c === "failed" ? " It didn't save to your calendar; try again." : "";
  async function copy() {
    const res = q?.url ? { link: q.url } : await act("copy", { action: "quotelink", send: false, note: incl }, "Link ready.");
    if (!res?.link) return;
    try { await navigator.clipboard.writeText(res.link); } catch { prompt("Copy the quote link:", res.link); }
  }
  const installFields = <div className="three">
    <label className="field"><span>Install day</span><input type="date" value={install} onChange={e => setInstall(e.target.value)} /></label>
    <label className="field"><span>Start</span><input type="time" value={itime} onChange={e => setItime(e.target.value)} disabled={!install || idays !== "1"} /></label>
    <label className="field"><span>Days</span><select value={idays} onChange={e => setIdays(e.target.value)} disabled={!install}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
  </div>;
  const sec = (title: string, right: React.ReactNode, body: React.ReactNode) => <section className="card"><div className="hd"><h2>{title}</h2>{right}</div><div className="bd" style={{ display: "flex", flexDirection: "column", gap: 10 }}>{body}</div></section>;

  return <>
    {ask === "quoted" && sec("The quote", <button type="button" className="link" onClick={() => setAsk(null)}>Cancel</button>, <>
      <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} options />
      <label className="field"><span>What&rsquo;s included <em>optional, they&rsquo;ll see it</em></span><textarea rows={2} value={incl} maxLength={600} onChange={e => setIncl(e.target.value)} placeholder="Tear-out and haul-away, steel posts in concrete, 2-year warranty" /></label>
      <label className="field" style={{ maxWidth: 240 }}><span>Deposit to hold the date <em>optional</em></span><span className="inwrap"><i>$</i><input inputMode="decimal" value={deposit} onChange={e => setDeposit(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="None" /></span></label>
      {depN > 0 && <p className="fine">{biz.payLink ? "After they approve, the quote page shows the deposit with your pay link. The money never passes through this app." : "Add your pay link in Money so they can pay the deposit from the quote page."}</p>}
      <p className="fine">Follow-ups go out on day 2, 5 and 10, then once a month until they answer, and stop the moment they reply.</p>
      <div className="acts-row end">
        <button type="button" className="btn" disabled={!!busy || quoteTotal <= 0} onClick={() => void act("save", { action: "stage", stage: "quoted", amount: String(quoteTotal), items, tax, note: incl, deposit: depN || null }, `Quote saved: ${dollars(quoteTotal)}. Not sent yet.`)}>Save, don&rsquo;t send</button>
        <button type="button" className="btn ink" disabled={!!busy || !canText || quoteTotal <= 0} onClick={() => void act("stage", { action: "stage", stage: "quoted", amount: String(quoteTotal), items, tax, note: incl, deposit: depN || null, link: true }, res => res.sent ? `Quote texted to ${firstName}: ${dollars(quoteTotal)}.` : res.warn || "Saved.")}>{busy === "stage" ? <Spinner /> : `Text ${firstName} ${dollars(quoteTotal)}`}</button>
      </div>
    </>)}
    {ask === "won" && sec("Mark won", <button type="button" className="link" onClick={() => setAsk(null)}>Cancel</button>, <form style={{ display: "flex", flexDirection: "column", gap: 10 }} onSubmit={e => { e.preventDefault(); void act("stage", { action: "stage", stage: "won", amount: amt, install: install || null, time: itime || null, days: Number(idays), review: review && biz.reviewLink }, res => `Marked won.${calMsg(res.calendar)}${review && biz.reviewLink && install ? " Review ask goes out the morning after." : ""}`); }}>
      <label className="field"><span>Job amount</span><span className="inwrap"><i>$</i><input inputMode="decimal" autoFocus placeholder="7,400" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.,kK]/g, ""))} /></span></label>
      {installFields}
      {!biz.calendar && <p className="fine">Connect Google Calendar to add installs to it.</p>}
      <label className={"toggle" + (biz.reviewLink ? "" : " off")}><input type="checkbox" checked={review && biz.reviewLink} disabled={!biz.reviewLink} onChange={e => setReview(e.target.checked)} /><i /><span><b>Ask for a Google review</b><small>{!biz.reviewLink ? "Needs your Google review link (Settings, Account)." : install ? "The morning after the install." : "Set an install day first."}</small></span></label>
      <div className="acts-row end"><button type="submit" className="btn ink" disabled={!!busy}>{busy ? <Spinner /> : "Mark won"}</button></div>
    </form>)}

    {!ask && card.stage === "quoted" && q && sec(`The quote${q.amount ? `, ${dollars(q.amount)}` : ""}`, <span className={"dot" + (q.status === "replied" ? " bad" : q.viewed ? " ink" : "")} style={{ marginLeft: "auto" }}>{q.status === "replied" ? "They replied" : q.viewed ? `Opened ${ago(q.viewed)}` : q.linked ? "Texted, not opened yet" : "Not sent yet"}</span>, <>
      {editLines ? <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} options />
        : q.items.length > 0 ? <ul className="lines">{q.items.map((i, k) => <li key={k}><span>{i.name}{i.tier ? `, ${i.tier}` : i.opt ? ", add-on" : ""}<small>{i.qty !== 1 || i.unit ? `${i.qty}${i.unit ? " " + i.unit : ""} × ${dollars(i.price)}` : ""}</small></span><b>{dollars(i.qty * i.price)}</b></li>)}</ul> : null}
      {editLines && <label className="field" style={{ maxWidth: 240 }}><span>Deposit to hold the date <em>optional</em></span><span className="inwrap"><i>$</i><input inputMode="decimal" value={deposit} onChange={e => setDeposit(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="None" /></span></label>}
      {q.note && !editLines && <p className="fine">{q.note}</p>}
      {q.deposit && !editLines ? <p className="fine">Deposit {dollars(q.deposit)} to hold the date{biz.payLink ? ", paid through your pay link once they approve." : ". Add your pay link in Money so they can pay it from the quote page."}</p> : null}
      <div className="chase">
        {q.views ? <p className="chase-v"><b>Viewed {q.views} {q.views === 1 ? "time" : "times"}</b>{q.lastViewed ? `, last ${ago(q.lastViewed)}` : ""}, not approved.</p> : null}
        <p className="fine">{!q.linked ? "Not sent yet." : q.status === "stopped" ? "Follow-ups stopped." : q.chasePaused ? "Follow-ups are off: this quote came in from your old app." : q.nextChase ? `Next follow-up ${dateLabel(q.nextChase)}${q.steps ? `, ${q.steps} sent so far` : ""}.` : "Every follow-up has gone out."}
          {q.validUntil && (q.status === "open" || q.status === "replied") && <>{" "}{q.validUntil < new Date().toLocaleDateString("en-CA") ? <span className="bad-t">Expired {dateLabel(q.validUntil)}: they can&rsquo;t approve it.</span> : `Good through ${dateLabel(q.validUntil)}.`}{" "}
            {!biz.crew && <button type="button" className="link" disabled={r.busy === "extend"} onClick={() => void r.act("extend", { action: "quoteextend" }, "Quote extended.")}>Extend</button>}</>}</p>
        <div className="acts-row">
          {q.linked && q.status !== "won" && q.status !== "lost" && <button type="button" className="btn sm" disabled={!!busy || !canText} onClick={() => void act("nudge", { action: "quotenudge" }, `Texted ${firstName} about the quote.`)}>{busy === "nudge" ? <Spinner /> : "Nudge now"}</button>}
          {q.status === "stopped" || q.chasePaused ? <button type="button" className="btn sm" disabled={!!busy} onClick={() => void act("chase", { action: "quotechase", on: true }, "Following up again.")}>Start following up</button>
            : q.linked && (q.status === "open" || q.status === "replied") ? <button type="button" className="btn sm ghost" disabled={!!busy} onClick={() => void act("chase", { action: "quotechase", on: false }, "Follow-ups stopped.")}>Stop following up</button> : null}
        </div>
      </div>
      <div className="acts-row end">
        {editLines ? <>
          <button type="button" className="btn" disabled={!!busy} onClick={() => setEditLines(false)}>Cancel</button>
          <button type="button" className="btn ink" disabled={!!busy || quoteTotal <= 0} onClick={async () => { if (await act("lines", { action: "quotelines", items, tax, note: incl, deposit: depN || null }, `Quote updated: ${dollars(quoteTotal)}.`)) setEditLines(false); }}>Save lines</button>
        </> : <>
          <button type="button" className="btn" disabled={!!busy} onClick={() => void copy()}>Copy link</button>
          {q.url && <button type="button" className="btn" disabled={!!busy} title={card.email ? `Email it to ${card.email}` : "Add their email below first"} onClick={() => void emailDoc({ ready: r.emailReady, api: r.api, project: r.project, toast: r.toast, reload: r.reload, kind: "quote", thread: card.id, to: card.email, name: card.name, mailto: `mailto:${card.email ?? ""}?subject=${encodeURIComponent(`Your quote from ${biz.business}`)}&body=${encodeURIComponent(quoteText({ first: firstName, business: biz.business, amount: q.amount, line: card.line.replace(/ · /g, ", "), url: q.url! }))}` })}>Email it</button>}
          <button type="button" className="btn ink" onClick={() => go.quote(card.id)}>Open the quote</button>
        </>}
      </div>
    </>)}

    {!ask && card.stage === "won" && !card.pastCustomer && <>
      {sec("Install", card.install ? <span className={"dot" + (card.onCalendar ? " good" : "")} style={{ marginLeft: "auto" }}>{card.onCalendar ? "On Google Calendar" : "Not on a calendar"}</span> : null, <>
        {installFields}
        {installDirty && <div className="acts-row end"><button type="button" className="btn ink" disabled={!!busy} onClick={() => { const why = /fence/i.test(biz.trade) ? digBlockers(cleanPaperwork(card.paperwork ?? {}), install || null) : []; if (why.length && !confirm(`Not clear to dig that day. ${why.join(" ")} Set the install anyway?`)) return; void act("install", { action: "install", install: install || null, time: itime || null, days: Number(idays) }, res => (install ? `Install set for ${dateLabel(install)}.` : "Install date cleared.") + calMsg(res.calendar)); }}>{busy === "install" ? <Spinner /> : install ? "Save install" : "Clear install"}</button></div>}
      </>)}
      {!biz.crew && <ChangeOrders card={card} act={act} busy={busy} canText={canText} taxRate={Number(biz.taxRate) || 0} />}
      {sec("Invoice", card.invoice ? <span className={"dot " + (invoiceState(card.invoice).tone === "green" ? "good" : invoiceState(card.invoice).tone === "red" ? "bad" : "")} style={{ marginLeft: "auto" }}>{invoiceState(card.invoice).text}</span> : null, card.invoice ? <>
        <div className="money"><span>#{card.invoice.number}{card.invoice.status === "sent" && card.invoice.due_on ? `, due ${dateLabel(card.invoice.due_on)}` : ""}</span><b>{dollars(card.invoice.total)}</b></div>
        <div className="acts-row end">{card.invoice.status === "sent" && canText && <button type="button" className="btn ghost" disabled={!!busy} title="One text with everything they owe and where to pay" onClick={() => void act("statement", { action: "portallink", send: true, statement: true }, "Statement sent.")}>Send statement</button>}<button type="button" className="btn" disabled={!!busy} onClick={async () => { const res = await act("invoice", { action: "invoice", rest: true }, "Invoice for the rest drafted."); if (res?.invoice) go.invoice(res.invoice.id); }}>Bill the rest</button><button type="button" className="btn ink" onClick={() => go.invoice(card.invoice!.id)}>Open invoice</button></div>
      </> : <>
        <p className="fine">Pulls the lines from the quote. You check it before it goes.</p>
        <div className="acts-row end">{[25, 50].map(p => <button key={p} type="button" className="btn" disabled={!!busy} title={`A progress invoice for ${p}% of the job`} onClick={async () => { const res = await act("invoice", { action: "invoice", percent: p }, `Invoice for ${p}% drafted.`); if (res?.invoice) go.invoice(res.invoice.id); }}>Bill {p}%</button>)}<button type="button" className="btn ink" disabled={!!busy} onClick={async () => { const res = await act("invoice", { action: "invoice" }, "Invoice drafted."); if (res?.invoice) go.invoice(res.invoice.id); }}>{busy === "invoice" ? <Spinner /> : "Create invoice"}</button></div>
      </>)}
      {sec("Review", card.reviewSent ? <span className="dot good" style={{ marginLeft: "auto" }}>Asked {ago(card.reviewSent)}</span> : card.reviewAfter ? <span className="dot ink" style={{ marginLeft: "auto" }}>Queued</span> : null, <>
        {card.reviewAfter && !card.reviewSent && <div className="money"><span>Paid in full, so the ask goes out {Date.parse(card.reviewAfter) - Date.now() > 3600000 * 20 ? dateLabel(card.reviewAfter) : `about ${clock(card.reviewAfter)}`}</span><button type="button" className="link" disabled={!!busy} onClick={() => void act("rvc", { action: "reviewcancel" }, "Review ask cancelled.")}>Don&rsquo;t ask</button></div>}
        {!card.reviewSent && <label className={"toggle" + (biz.reviewLink ? "" : " off")}><input type="checkbox" checked={review && biz.reviewLink} disabled={!biz.reviewLink} onChange={e => setReview(e.target.checked)} /><i /><span><b>Ask for a Google review</b><small>{!biz.reviewLink ? "Needs your Google review link (Settings, Account)." : card.install ? `Goes out ${dateLabel(new Date(Date.parse(card.install + "T12:00:00") + 86400000).toLocaleDateString("en-CA"))}.` : "Set an install day."}</small></span></label>}
        {card.reviewSent ? <p className="fine">Sent by text with your Google review link.</p> : biz.reviewLink && <div className="acts-row end">
          <button type="button" className="btn" disabled={!!busy || !canText} onClick={() => arm === "rv" ? void act("review", { action: "reviewnow" }, `Review request sent to ${firstName}.`) : setArm("rv")}>{busy === "review" ? <Spinner /> : arm === "rv" ? "Tap again to send it now" : "Job done, ask now"}</button></div>}
      </>)}
    </>}

    {sec("Details", null, <>
      <div className="fields">{jobFields(biz.trade).map(f => <label key={f.key} className={"field" + (f.key === "address" ? " full" : "")}><span>{f.label}</span>
        {f.kind === "choice" ? <select value={d[f.key] ?? ""} onChange={e => setD(x => ({ ...x, [f.key]: e.target.value }))}><option value="">–</option>{f.options!.map(o => <option key={o}>{o}</option>)}</select>
          : <span className="inwrap"><input inputMode={f.kind === "number" ? "decimal" : undefined} value={d[f.key] ?? ""} onChange={e => setD(x => ({ ...x, [f.key]: e.target.value }))} placeholder="Not set" />{f.unit && <em>{f.unit}</em>}</span>}</label>)}
        <label className="field"><span>Email <em>for quotes and invoices</em></span><input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></label>
        <label className="field"><span>Job value</span><span className="inwrap"><i>$</i><input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(/[^\d.,kK]/g, ""))} placeholder="What it's worth to you" /></span></label>
        <label className="field full"><span>Notes <em>for you</em></span><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="HOA needs drawings, wants it done before the party on the 20th" /></label>
        <label className="field full"><span>Crew notes <em>what they need on site</em></span><textarea rows={2} value={crew} onChange={e => setCrew(e.target.value)} placeholder="Gate on the left side, dog in the yard, park on the street" /></label>
      </div>
      <div className="acts-row end"><button type="button" className="btn ink" disabled={!dirty || !!busy} onClick={() => void act("save", { action: "card", details: d, value: value || null, notes, crew, email, ...(card.stage === "won" ? { review } : {}) }, "Saved.")}>{busy === "save" ? <Spinner /> : "Save"}</button></div>
    </>)}
  </>;
}

/** Won to paid, one step at a time. The owner ticks steps; the invoice steps tick themselves. */
export function Steps({ card, trade, busy, tick }: { card: Card; trade: string; busy: string; tick: (step: string, done: boolean) => void }) {
  const steps = jobSteps(trade, card.details), p = jobProgress(trade, card);
  const inv = card.invoice, sent = !!inv && inv.status !== "draft" && inv.status !== "void", paid = inv?.status === "paid";
  const nextKey = steps.find(s => !card.job[s.key])?.key;
  return <section className="card">
    <div className="hd"><h2>From won to paid</h2><small>{p.next ? `${p.done} of ${p.total}` : "Paid in full"}</small></div>
    <div className="prog" style={{ margin: "4px 0 6px" }}><b style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
    {steps.map(s => { const on = card.job[s.key]; return <button key={s.key} type="button" role="checkbox" aria-checked={!!on} disabled={!!busy} className={"step" + (on ? " done" : s.key === nextKey ? " next" : "")} onClick={() => tick(s.key, !on)} title={s.hint || undefined}>
      <i>{busy === "step:" + s.key ? <Spinner /> : on ? <Icon name="check" size={9} /> : null}</i>{s.label}<small>{on ? dateLabel(on) : s.key === nextKey && s.hint ? "next" : ""}</small></button>; })}
    <div className={"step auto" + (sent ? " done" : steps.every(s => card.job[s.key]) ? " next" : "")}><i>{sent ? <Icon name="check" size={9} /> : null}</i>Invoice sent<small>{sent && inv?.sent_at ? dateLabel(inv.sent_at) : "ticks itself"}</small></div>
    <div className={"step auto" + (paid ? " done" : sent ? " next" : "")}><i>{paid ? <Icon name="check" size={9} /> : null}</i>Paid<small>{paid && inv?.paid_at ? dateLabel(inv.paid_at) : inv?.due_on && sent ? `due ${dateLabel(inv.due_on)}` : "ticks itself"}</small></div>
  </section>;
}

/** What the job cost, and what it made. Three numbers, no spreadsheet. */
function JobExpensesSlot(p: React.ComponentProps<typeof JobExpenses>) { return <JobExpenses {...p} />; }
function CostBox({ card, busy, save }: { card: Card; busy: string; save: (c: Costs) => void }) {
  const [c, setC] = useState({ materials: card.costs.materials ? String(card.costs.materials) : "", labor: card.costs.labor ? String(card.costs.labor) : "", other: card.costs.other ? String(card.costs.other) : "" });
  const num = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;
  const now = { materials: num(c.materials), labor: num(c.labor), other: num(c.other) };
  const dirty = now.materials !== card.costs.materials || now.labor !== card.costs.labor || now.other !== card.costs.other;
  const price = jobPrice(card);
  const pr = jobProfit(price, now);
  const f = (k: keyof typeof c, label: string) => <div className="money"><span>{label}</span><span className="inwrap" style={{ width: 104, height: 26 }}><i>$</i><input inputMode="decimal" placeholder="0" aria-label={label} value={c[k]} onChange={e => setC(x => ({ ...x, [k]: e.target.value.replace(/[^\d.,]/g, "") }))} style={{ textAlign: "right" }} /></span></div>;
  return <section className="card"><div className="hd"><h2>Costs and profit</h2>{pr && <small style={{ marginLeft: "auto", color: pr.profit >= 0 ? "var(--good)" : "var(--bad)" }}>{pr.margin}% margin</small>}</div>
    {f("materials", "Materials")}{f("labor", "Labor")}{f("other", "Other")}
    {pr ? <div className="money sum"><span className="t-em">Profit <small>on {dollars(price!)}</small></span><b style={{ color: pr.profit >= 0 ? "var(--good)" : "var(--bad)" }}>{dollars(pr.profit)}</b></div>
      : <p className="fine" style={{ marginTop: 4 }}>Add what you spent and you&rsquo;ll see what this job made.</p>}
    {dirty && <div className="acts-row end" style={{ marginTop: 6 }}><button type="button" className="btn ink sm" disabled={!!busy} onClick={() => save(now)}>{busy === "costs" ? <Spinner /> : "Save costs"}</button></div>}
  </section>;
}
