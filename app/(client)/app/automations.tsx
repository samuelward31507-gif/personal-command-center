"use client";
// Settings: the owner's own follow-ups. A trigger, a wait, a text; on or off. Each customer gets each one once, inside
// texting hours, and only after the rule was turned on.
import { useState } from "react";
import { Icon, Sheet, Spinner, dateLabel, type Api, type Toast } from "./parts";
import { MAX_RULES, TRIGGERS, readRules, ruleWhen, type Rule } from "@/lib/automations";
import { fill } from "@/lib/client-runtime";
import type { Data } from "./types";

type Ctx = { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void> };
type Draft = { id?: string; name: string; trigger: string; days: string; message: string; on: boolean };
const STARTERS: Draft[] = [
  { name: "Quote check-in", trigger: "quoted", days: "3", message: "Hi {first}, it's {owner} with {business}. Any questions on the quote? Happy to walk through it or adjust anything.", on: true },
  { name: "Referral ask", trigger: "paid", days: "7", message: "Hi {first}, thanks again for choosing {business}. If a friend or neighbor needs the same, we'd be glad to help them too.", on: true },
  { name: "One-year check-in", trigger: "won", days: "365", message: "Hi {first}, it's been a year since we finished your job. Everything holding up well? Reply here if anything needs a look.", on: true },
];

export function FollowUps({ ctx }: { ctx: Ctx }) {
  const rules = readRules(ctx.d.setup?.automations);
  const [edit, setEdit] = useState<Draft | null>(null), [busy, setBusy] = useState("");
  const toDraft = (r: Rule): Draft => ({ id: r.id, name: r.name, trigger: r.trigger, days: String(r.days), message: r.message, on: r.on });
  const save = async (list: Draft[], done: string) => {
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "automations", input: list.map(x => ({ ...x, days: Number(x.days) })) }); ctx.toast(done); await ctx.reload(); return true; }
    catch (e) { ctx.toast(e instanceof Error ? e.message : "Didn't save.", true); return false; }
  };
  const toggle = async (r: Rule) => { setBusy(r.id); await save(rules.map(x => toDraft(x.id === r.id ? { ...x, on: !x.on } : x)), r.on ? "Turned off." : "Turned on. It counts from now."); setBusy(""); };
  return <li style={{ height: "auto", padding: "8px 0", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
    <span>Your own follow-ups<small className="mut" style={{ display: "block" }}>Texts that go out on their own: a few days after a quote, a week after they pay, a year after the job. Each customer gets each one once, 8 AM to 8 PM.</small></span>
    {rules.length > 0 && <table className="tbl flush"><tbody>{rules.map(r => { const s = ctx.d.autoSent?.[r.id];
      return <tr key={r.id}><td><b>{r.name}</b><small className="mut" style={{ display: "block" }}>{ruleWhen(r)}</small></td>
        <td className="mut nowrap">{s?.n ? `${s.n} sent, last ${dateLabel(s.last)}` : r.on ? "None yet" : ""}</td>
        <td className="nowrap right"><button type="button" className={"btn sm" + (r.on ? "" : " ghost")} disabled={busy === r.id} aria-pressed={r.on} onClick={() => void toggle(r)}>{r.on ? "On" : "Off"}</button>
          <button type="button" className="btn ghost sm" onClick={() => setEdit(toDraft(r))}>Edit</button></td></tr>; })}</tbody></table>}
    <span className="acts-row">{rules.length < MAX_RULES && <button type="button" className="btn sm" onClick={() => setEdit({ name: "", trigger: "quoted", days: "3", message: "", on: true })}><Icon name="plus" size={13} />Add a follow-up</button>}
      {!rules.length && STARTERS.map(s => <button key={s.name} type="button" className="link" onClick={() => setEdit({ ...s })}>{s.name}</button>)}</span>
    {edit && <RuleSheet ctx={ctx} draft={edit} onClose={() => setEdit(null)} onSave={async x => { const list = x.id ? rules.map(r => r.id === x.id ? x : toDraft(r)) : [...rules.map(toDraft), x];
      if (await save(list, x.id ? "Saved." : "Follow-up on. It applies to customers from now on.")) setEdit(null); }}
      onDelete={edit.id ? async () => { if (confirm(`Delete "${edit.name}"?`) && await save(rules.filter(r => r.id !== edit.id).map(toDraft), "Deleted.")) setEdit(null); } : undefined} />}
  </li>;
}

function RuleSheet({ ctx, draft, onClose, onSave, onDelete }: { ctx: Ctx; draft: Draft; onClose: () => void; onSave: (d: Draft) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [v, setV] = useState(draft), [busy, setBusy] = useState(false);
  const set = (p: Partial<Draft>) => setV(x => ({ ...x, ...p }));
  const preview = fill(v.message, { first: "Dana", business: ctx.d.setup?.display_name || "your business", owner: (ctx.d.setup?.owner_name || "").split(" ")[0], review_link: ctx.d.setup?.review_link || "" });
  const ok = v.message.trim().length >= 10 && Number(v.days) >= 0 && Number(v.days) <= 730 && v.days !== "";
  return <Sheet onClose={onClose} title={draft.id ? "Follow-up" : "New follow-up"} sub={ok ? ruleWhen({ trigger: v.trigger as Rule["trigger"], days: Number(v.days) }) : "A trigger, a wait, a text"}
    foot={<>{onDelete && <button type="button" className="btn danger" disabled={busy} onClick={() => void onDelete()}>Delete</button>}<span style={{ flex: 1 }} />
      <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn ink" disabled={busy || !ok} onClick={async () => { setBusy(true); await onSave(v); setBusy(false); }}>{busy ? <Spinner /> : "Save"}</button></>}>
    <label className="field"><span>Name <em>for you</em></span><input value={v.name} maxLength={60} onChange={e => set({ name: e.target.value })} placeholder="Quote check-in" /></label>
    <div className="two"><label className="field"><span>When</span><select value={v.trigger} onChange={e => set({ trigger: e.target.value })}>{TRIGGERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="field"><span>Wait <em>days, 0 = right away</em></span><input inputMode="numeric" value={v.days} onChange={e => set({ days: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></label></div>
    {v.trigger === "quoted" && <p className="fine">Only goes out if the quote is still open. Cinder&rsquo;s own quote follow-ups keep running too, so leave a few days between them.</p>}
    <label className="field"><span>The text <em>{"{first}"}, {"{business}"}, {"{owner}"}, {"{review_link}"} fill in</em></span><textarea rows={4} value={v.message} maxLength={480} onChange={e => set({ message: e.target.value })} /></label>
    {v.message.trim() && <div className="card box"><small className="mut">What Dana gets</small><p style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{preview}</p></div>}
    <p className="fine">It goes from your texting number to customers who hit this after you save it, never to everyone from before. Opted-out customers and your do-not-text list are skipped.</p>
    <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={v.on} onChange={e => set({ on: e.target.checked })} /><span>On</span></label>
  </Sheet>;
}
