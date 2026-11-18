"use client";

// Service plans: repeat work on a schedule (pool service every week, a seal every spring, gutters twice a year).
// The app reminds the customer the day before, and "Visit done" logs it and texts the invoice for that visit.
import { useState } from "react";
import { dollars, totals, type Item } from "@/lib/billing";
import { everyLabel, monthlyValue, PLAN_PRESETS, visitDays, type Plan, type PlanUnit } from "@/lib/service";
import { Kpis, PageHead, Guide } from "./charts";
import { Avatar, Icon, Sheet, Spinner, dateLabel, first, fmtPhone, todayIso, usd, useArm, type Api, type Toast } from "./parts";
import { LineEditor } from "./money";
import { crewName, teamOf } from "./crew";
import type { Data, Go } from "./types";

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T12:00:00") + n * 86400000).toLocaleDateString("en-CA");
type Act = (key: string, body: Record<string, unknown>, done: string | ((r: { sent?: boolean; warn?: string; next?: string | null; invoice?: string | null }) => string)) => Promise<boolean>;
function useAct(project: string, api: Api, toast: Toast, reload: () => Promise<void>) {
  const [busy, setBusy] = useState("");
  const act: Act = async (key, body, done) => {
    setBusy(key);
    try { const r = await api<{ sent?: boolean; warn?: string; next?: string | null; invoice?: string | null }>("/api/app/act", { p: project, ...body }); toast(typeof done === "string" ? done : done(r), !!r.warn && !r.sent); await reload(); return true; }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); return false; }
    finally { setBusy(""); }
  };
  return { busy, act };
}
const visitDone = (p: Plan) => (r: { sent?: boolean; warn?: string; next?: string | null; invoice?: string | null }) =>
  `${first(p.customer)}'s visit is logged.${r.invoice ? r.sent ? ` Invoice for ${dollars(p.total)} texted.` : ` Invoice drafted${r.warn ? `: ${r.warn}` : "."}` : ""}${r.next ? ` Next visit ${dateLabel(r.next)}.` : " That was the last visit."}`;

/** Jobs, Service plans: every plan, what it brings in a month, and the visits coming up. */
export function PlansScreen({ d, project, api, toast, reload, go }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go }) {
  const plans = d.plans ?? [], today = todayIso(), weekEnd = addDays(today, 6);
  const active = plans.filter(p => p.status === "active");
  const mrr = active.reduce((a, p) => a + monthlyValue(p), 0);
  const due = active.filter(p => p.next_on && p.next_on <= today);
  const week = active.reduce((a, p) => a + visitDays(p, today, weekEnd).length, 0);
  const [sheet, setSheet] = useState<{ thread?: string; plan?: Plan } | null>(null);
  const [arm, setArm] = useArm();
  const { busy, act } = useAct(project, api, toast, reload);
  const crew = d.role === "crew";
  return <>
    <PageHead title="Service plans" sub={active.length ? `${active.length} active, ${usd(mrr)} a month coming back.` : "Repeat work on a schedule, reminded and invoiced for you."}
      actions={!crew ? <button type="button" className="btn ink" onClick={() => setSheet({})}><Icon name="plus" size={14} />New plan</button> : undefined} />
    <div className="dash">
      {plans.length ? <>
        <Kpis quiet items={[
          { label: "Visits this week", value: String(week), sub: week ? "reminded the day before" : "none booked" },
          { label: "Due now", value: String(due.length), sub: due.length ? "mark done or skip" : "nothing waiting", tone: due.length ? "warn" : "" },
        ]} />
        <section className="panel flat">
          <div className="panel-h"><h2>Every plan</h2><small>next visit first</small></div>
          <div className="panel-b flush">
            <table className="tbl plans-tbl"><colgroup><col style={{ width: 200 }} /><col /><col style={{ width: 132 }} /><col style={{ width: 140 }} /><col style={{ width: 92 }} /><col style={{ width: 84 }} /><col style={{ width: 236 }} /></colgroup><thead><tr><th>Customer</th><th>Plan</th><th>How often</th><th>Next visit</th><th className="right">Per visit</th><th className="right">A month</th><th /></tr></thead>
              <tbody>{plans.map(p => { const late = p.status === "active" && !!p.next_on && p.next_on < today, now = p.status === "active" && !!p.next_on && p.next_on <= weekEnd;
                return <tr key={p.id} onClick={() => go.record(p.thread_id)}>
                  <td><span className="name"><Avatar name={p.customer || fmtPhone(p.phone)} size="sm" /><b>{p.customer || fmtPhone(p.phone)}</b></span></td>
                  <td><span className="t2"><b>{p.name}</b><small>{[p.crew_member ? crewName(d, p.crew_member) : "", p.remind ? "reminder text" : "", p.invoice ? "invoice each visit" : ""].filter(Boolean).join(", ")}</small></span></td>
                  <td className="mut">{everyLabel(p.every, p.unit)}</td>
                  <td>{p.status !== "active" ? <span className="mut">{p.status === "paused" ? "Paused" : "Ended"}</span> : <span className={late ? "bad" : ""}>{p.next_on ? `${dateLabel(p.next_on)}${p.time ? ", " + clock12(p.time) : ""}` : "–"}{late ? <small className="bad"> late</small> : null}</span>}</td>
                  <td className="num">{crew ? "–" : dollars(p.total)}</td>
                  <td className="num mut">{crew ? "–" : usd(monthlyValue(p))}</td>
                  <td className="acts" onClick={e => e.stopPropagation()}>{now && <span className="acts-row" style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
                    <button type="button" className="btn sm ghost" disabled={!!busy} onClick={() => void act("skip" + p.id, { action: "visit", plan: p.id, skip: true }, `Skipped. Next visit moves on.`)}>Skip</button>
                    <button type="button" className={"btn sm" + (arm === p.id ? " ink" : "")} disabled={!!busy} onClick={() => { if (arm === p.id) void act("v" + p.id, { action: "visit", plan: p.id }, visitDone(p)); else setArm(p.id); }}>{busy === "v" + p.id ? <Spinner /> : arm === p.id ? (p.invoice ? "Tap: done, invoice it" : "Tap again") : "Visit done"}</button>
                  </span>}{!crew && !now && <button type="button" className="btn sm ghost" onClick={() => setSheet({ thread: p.thread_id, plan: p })}>Edit</button>}</td>
                </tr>; })}</tbody></table>
          </div>
        </section>
      </> : <Guide title="Turn one-off jobs into repeat work" sub="Pool service every week, a fence seal every spring, gutters twice a year. Set it once and the customer gets a text the day before each visit, and when you tap Visit done it texts the invoice for that visit."
        steps={[
          { title: "Pick a customer and how often", text: "Weekly, monthly, every 3 months, once a year, or your own schedule." },
          { title: "Set what a visit costs", text: "One line or a few. Tax comes from your settings." },
          { title: "The rest runs itself", text: "Reminder the day before, the visit on your calendar, an invoice after.", action: !crew ? <button type="button" className="btn sm ink" onClick={() => setSheet({})}>New plan</button> : undefined },
        ]} />}
    </div>
    {sheet && <PlanSheet d={d} thread={sheet.thread} plan={sheet.plan} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} />}
  </>;
}
const clock12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`; };

/** New plan, or changes to one: the customer, what a visit costs, how often, the first visit, who goes, and what Cinder does. */
export function PlanSheet({ d, thread: thread0, plan, project, api, toast, reload, onClose }: { d: Data; thread?: string; plan?: Plan; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const people = (() => { const m = new Map<string, string>(); for (const c of d.board ?? []) m.set(c.id, c.name || fmtPhone(c.phone)); for (const c of d.customers ?? []) if (!m.has(c.id)) m.set(c.id, c.name || fmtPhone(c.phone)); return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])); })();
  const [thread, setThread] = useState(thread0 ?? "");
  const [name, setName] = useState(plan?.name ?? ""), [items, setItemsRaw] = useState<Item[]>(plan?.items.length ? plan.items : [{ name: "Service visit", qty: 1, unit: "", price: 0 }]);
  const [tax, setTax] = useState<number>(plan ? plan.tax_rate : Number(d.setup?.tax_rate) || 0);
  const [every, setEvery] = useState(String(plan?.every ?? 1)), [unit, setUnit] = useState<PlanUnit>(plan?.unit ?? "month");
  const [next, setNext] = useState(plan?.next_on ?? addDays(todayIso(), 7)), [time, setTime] = useState(plan?.time ?? ""), [ends, setEnds] = useState(plan?.ends_on ?? "");
  const [remind, setRemind] = useState(plan?.remind ?? true), [invoice, setInvoice] = useState(plan?.invoice ?? true), [member, setMember] = useState(plan?.crew_member ?? "");
  const [busy, setBusy] = useState(""), [arm, setArm] = useArm();
  const setItems = (f: (x: Item[]) => Item[]) => setItemsRaw(f);
  const total = totals(items.filter(i => i.name.trim() && i.qty > 0), tax).total;
  const team = teamOf(d), n = Math.max(1, Math.min(52, Math.round(Number(every) || 1)));
  const preview = visitDays({ next_on: next || null, every: n, unit, ends_on: ends || null, status: "active" }, "0000-00-00", "9999-12-31", 4);
  async function run(key: string, body: Record<string, unknown>, done: string) {
    setBusy(key);
    try { await api("/api/app/act", { p: project, ...body }); toast(done); await reload(); onClose(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); }
    finally { setBusy(""); }
  }
  const save = () => { if (!thread) return toast("Pick the customer first.", true); void run("save", { action: "plan", thread, plan: plan?.id, input: { name, items, tax_rate: tax, every: n, unit, next_on: next, time: time || null, ends_on: ends || null, remind, invoice, crew_member: member } }, plan ? "Plan saved." : `Plan started. First visit ${dateLabel(next)}.`); };
  const who = people.find(p => p[0] === thread)?.[1] ?? "";
  return <Sheet onClose={onClose} title={plan ? `${plan.name}` : "New service plan"} sub={who ? `For ${who}` : "Repeat work on a schedule"} wide
    foot={<>
      {plan && plan.status !== "ended" && <>
        <button type="button" className="btn ghost" disabled={!!busy} onClick={() => void run("pause", { action: "planset", plan: plan.id, what: plan.status === "paused" ? "resume" : "pause" }, plan.status === "paused" ? "Plan resumed." : "Plan paused. No reminders or visits until you resume it.")}>{plan.status === "paused" ? "Resume" : "Pause"}</button>
        <button type="button" className={"btn ghost" + (arm === "end" ? " bad" : "")} disabled={!!busy} onClick={() => arm === "end" ? void run("end", { action: "planset", plan: plan.id, what: "end" }, "Plan ended.") : setArm("end")}>{arm === "end" ? "Tap to end it" : "End plan"}</button>
      </>}
      <span style={{ flex: 1 }} />
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn ink" disabled={!!busy || total <= 0 || !name.trim() || !next} onClick={save}>{busy === "save" ? <Spinner /> : plan ? "Save plan" : `Start plan, ${dollars(total)} a visit`}</button>
    </>}>
    {!thread0 && <label className="field"><span>Customer</span><select value={thread} onChange={e => setThread(e.target.value)}><option value="">Pick a customer</option>{people.map(([id, nm]) => <option key={id} value={id}>{nm}</option>)}</select></label>}
    <label className="field"><span>Plan name <em>they see it in the reminder</em></span><input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="Weekly pool service, Spring fence seal, Gutter cleaning" autoFocus={!!thread0} /></label>
    <p className="sec" style={{ marginTop: 6 }}>Each visit</p>
    <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} />
    <p className="sec" style={{ marginTop: 10 }}>How often</p>
    <div className="chips">{PLAN_PRESETS.map(([l, e, u]) => <button key={l} type="button" className={n === e && unit === u ? "on" : ""} onClick={() => { setEvery(String(e)); setUnit(u); }}>{l}</button>)}</div>
    <div className="three">
      <label className="field"><span>Every</span><span className="inwrap"><input inputMode="numeric" value={every} onChange={e => setEvery(e.target.value.replace(/\D/g, "").slice(0, 2))} /><em>{unit === "week" ? (n === 1 ? "week" : "weeks") : (n === 1 ? "month" : "months")}</em></span></label>
      <label className="field"><span>Weeks or months</span><select value={unit} onChange={e => setUnit(e.target.value as PlanUnit)}><option value="week">Weeks</option><option value="month">Months</option></select></label>
      <label className="field"><span>Who goes</span><select value={member} onChange={e => setMember(e.target.value)}>{team.map(t => <option key={t.cell} value={t.cell}>{t.name}</option>)}</select></label>
    </div>
    <div className="three">
      <label className="field"><span>{plan ? "Next visit" : "First visit"}</span><input type="date" value={next} onChange={e => setNext(e.target.value)} /></label>
      <label className="field"><span>Time <em>optional</em></span><input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
      <label className="field"><span>Ends <em>optional</em></span><input type="date" value={ends} min={next} onChange={e => setEnds(e.target.value)} /></label>
    </div>
    {preview.length > 0 && <p className="fine">Visits: {preview.map(x => dateLabel(x)).join(", ")}{preview.length === 4 ? ", and on." : "."} {usd(monthlyValue({ total, every: n, unit, status: "active" }))} a month on average.</p>}
    <label className="toggle"><input type="checkbox" checked={remind} onChange={e => setRemind(e.target.checked)} /><i /><span><b>Text a reminder the day before</b><small>From your business number, inside texting hours.</small></span></label>
    <label className="toggle"><input type="checkbox" checked={invoice} onChange={e => setInvoice(e.target.checked)} /><i /><span><b>Text the invoice after each visit</b><small>When you or your crew tap Visit done. It uses your pay link.</small></span></label>
  </Sheet>;
}

/** On the customer's record: their plans, the next visit, and one tap to mark it done. */
export function PlanBox({ d, thread, project, api, toast, reload }: { d: Data; thread: string; project: string; api: Api; toast: Toast; reload: () => Promise<void> }) {
  const plans = (d.plans ?? []).filter(p => p.thread_id === thread && p.status !== "ended");
  const [sheet, setSheet] = useState<{ plan?: Plan } | null>(null), [arm, setArm] = useArm();
  const { busy, act } = useAct(project, api, toast, reload);
  const today = todayIso();
  return <section className="card"><div className="hd"><h2>Service plan</h2>{plans.length > 0 && <button type="button" className="link" style={{ marginLeft: "auto" }} onClick={() => setSheet({})}>Add</button>}</div>
    {plans.length ? plans.map(p => <div key={p.id} className="plan-row">
      <div className="money"><span><b className="t-em">{p.name}</b><small> {everyLabel(p.every, p.unit).toLowerCase()}</small></span><b>{dollars(p.total)}</b></div>
      <div className="money"><span>{p.status === "paused" ? "Paused" : "Next visit"}</span><b className={p.next_on && p.next_on < today ? "bad" : ""}>{p.status === "paused" ? "–" : p.next_on ? `${dateLabel(p.next_on)}${p.time ? ", " + clock12(p.time) : ""}` : "–"}</b></div>
      <div className="acts-row end" style={{ marginTop: 4 }}>
        <button type="button" className="btn sm ghost" onClick={() => setSheet({ plan: p })}>Edit</button>
        {p.status === "active" && p.next_on && p.next_on <= addDays(today, 6) && <button type="button" className={"btn sm" + (arm === p.id ? " ink" : "")} disabled={!!busy} onClick={() => { if (arm === p.id) void act("v" + p.id, { action: "visit", plan: p.id }, visitDone(p)); else setArm(p.id); }}>{busy === "v" + p.id ? <Spinner /> : arm === p.id ? "Tap again" : "Visit done"}</button>}
      </div>
    </div>) : <>
      <p className="fine">Repeat work for {first(d.board?.find(c => c.id === thread)?.name || d.customers?.find(c => c.id === thread)?.name || "")}: reminded the day before, invoiced after each visit.</p>
      <div className="acts-row" style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={() => setSheet({})}><Icon name="plus" size={13} />Set up a plan</button></div>
    </>}
    {sheet && <PlanSheet d={d} thread={thread} plan={sheet.plan} project={project} api={api} toast={toast} reload={reload} onClose={() => setSheet(null)} />}
  </section>;
}
