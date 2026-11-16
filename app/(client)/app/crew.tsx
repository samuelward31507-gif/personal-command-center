"use client";

// The crew side of the app. CrewPick: who is on a job, set by the owner, which texts that person.
// MyDay: what a crew member opens in the truck, today's stops in order with directions, the checklist and photos.
// emailDoc: send a quote or invoice from Cinder, falling back to the owner's mail app when sending isn't on.
import { useState } from "react";
import { onMyWayText } from "@/lib/client-schedule";
import { jobSteps, parseTeam, type Card } from "@/lib/crm";
import { PageHead, Kpis } from "./charts";
import { Avatar, Empty, Icon, Spinner, clock, dateLabel, dayName, first, fmtPhone, initials, useArm, type Api, type Toast } from "./parts";
import { Steps } from "./record";
import { line } from "./jobs";
import { ClockBar, myClock } from "./jobwork";
import { SignoffSheet } from "./finish";
import { ChecklistBox, routeUrl } from "./parity";
import { visitDays, type Plan } from "@/lib/service";
import type { Biz, Data, Go } from "./types";

const d10 = (p: string) => (p || "").replace(/\D/g, "").slice(-10);
/** The owner's team as the app knows it. The owner is always first, as "". */
export function teamOf(d: Data): { cell: string; name: string }[] {
  return [{ cell: "", name: d.owner ? `${first(d.owner)} (you)` : "You" }, ...parseTeam(d.setup?.team ?? "[]").filter(m => m.role === "crew" || m.name).map(m => ({ cell: m.cell, name: m.name || fmtPhone(m.cell) }))];
}
/** Who is on this job, by name, or "" when it's the owner's. */
export function crewName(d: Data, cell: string | undefined): string {
  if (!cell) return "";
  return parseTeam(d.setup?.team ?? "[]").find(m => d10(m.cell) === d10(cell))?.name || fmtPhone(cell);
}
/** The two letters on a calendar block or a Jobs row. */
export const crewTag = (d: Data, cell: string | undefined) => { const n = crewName(d, cell); return !n ? "" : n.startsWith("(") ? n.slice(-4) : n.includes(" ") ? initials(n) : n.slice(0, 8); };

/** "On the job": a select of the owner and the team. Changing it texts the person who was put on. */
export function CrewPick({ d, card, project, api, toast, reload }: { d: Data; card: Card; project: string; api: Api; toast: Toast; reload: () => Promise<void> }) {
  const team = teamOf(d), [busy, setBusy] = useState(false);
  if (team.length < 2) return <div className="money"><span>On the job</span><b className="mut" title="Add your crew in Settings, Account">You</b></div>;
  return <div className="money"><span>On the job</span>
    <span className="crewpick">{busy ? <Spinner /> : card.crewMember ? <Avatar name={crewName(d, card.crewMember)} size="sm" /> : null}
      <select aria-label="Who is on this job" value={card.crewMember ?? ""} disabled={busy} onChange={async e => {
        const member = e.target.value, who = team.find(t => t.cell === member)?.name ?? "";
        setBusy(true);
        try { const r = await api<{ texted?: boolean }>("/api/app/act", { p: project, action: "assign", thread: card.id, member }); toast(member ? `${first(who)} is on it.${r.texted ? ` Texted ${first(who)} the details.` : ""}` : "Back with you."); await reload(); }
        catch (err) { toast(err instanceof Error ? err.message : "That didn't work.", true); }
        finally { setBusy(false); }
      }}>{team.map(t => <option key={t.cell} value={t.cell}>{t.name}</option>)}</select>
    </span>
  </div>;
}

/**
 * Email a quote or an invoice from Cinder in the business's name. When sending isn't switched on, or it fails, the owner's
 * own mail app opens with the same words, so the customer still gets it.
 */
export async function emailDoc(o: { ready?: boolean; api: Api; project: string; toast: Toast; reload: () => Promise<void>; kind: "quote" | "invoice"; thread?: string; invoice?: string; to?: string; name: string; mailto: string }): Promise<boolean> {
  if (!o.to) { o.toast(`Add ${first(o.name)}'s email on their record first.`, true); return false; }
  if (!o.ready) { window.location.href = o.mailto; return true; }
  try {
    await o.api("/api/app/act", { p: o.project, ...(o.kind === "quote" ? { action: "emailquote", thread: o.thread } : { action: "emailinvoice", invoice: o.invoice }) });
    o.toast(`Emailed ${first(o.name)} at ${o.to}.`); await o.reload(); return true;
  } catch (e) {
    if ((e as { status?: number }).status === 503) { window.location.href = o.mailto; o.toast("Opened your mail app instead.", true); return true; }
    o.toast(e instanceof Error ? e.message : "That didn't send.", true); return false;
  }
}

type Stop = { key: string; kind: "estimate" | "install" | "visit"; at: number; allDay: boolean; day: string; card: Card | null; thread: string; name: string; phone: string; addr: string; mine: boolean; plan?: Plan };
const iso = (t: number) => new Date(t).toLocaleDateString("en-CA");
const maps = (a: string) => `https://maps.google.com/?daddr=${encodeURIComponent(a)}`;

/** The crew member's Home: today's stops in order, then the rest of the week. Only their jobs once anything is assigned to them. */
export function MyDay({ d, biz, project, api, toast, reload, go }: { d: Data; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go }) {
  const today = iso(Date.now()), weekEnd = iso(Date.now() + 7 * 86400000);
  const me = d10(d.me ?? ""), byId = new Map((d.board ?? []).map(c => [c.id, c]));
  const stops: Stop[] = [];
  for (const a of d.appointments) { const t = Date.parse(a.starts_at), c = byId.get(a.thread_id) ?? null, who = a.crew_member || c?.crewMember || "";
    stops.push({ key: "a" + a.id, kind: "estimate", at: t, allDay: false, day: iso(t), card: c, thread: a.thread_id, name: a.customer_name || fmtPhone(a.customer_phone), phone: a.customer_phone, addr: String(c?.details.address ?? ""), mine: !!me && d10(who) === me }); }
  for (const c of d.board ?? []) if (c.stage === "won" && c.install) for (let k = 0; k < (c.installDays || 1); k++) {
    const day = iso(Date.parse(c.install + "T12:00:00") + k * 86400000), timed = !!c.installTime && (c.installDays || 1) === 1;
    stops.push({ key: `i${c.id}${k}`, kind: "install", at: timed ? Date.parse(`${day}T${c.installTime}`) : Date.parse(day + "T07:00:00"), allDay: !timed, day, card: c, thread: c.id, name: c.name, phone: c.phone, addr: String(c.details.address ?? ""), mine: !!me && d10(c.crewMember ?? "") === me });
  }
  // Service plan visits: every visit day this week, on the plan's own time (or first thing).
  for (const p of d.plans ?? []) for (const day of visitDays(p, today, weekEnd)) { const c = byId.get(p.thread_id) ?? null;
    stops.push({ key: `v${p.id}${day}`, kind: "visit", at: p.time ? Date.parse(`${day}T${p.time}`) : Date.parse(day + "T08:00:00"), allDay: !p.time, day, card: c, thread: p.thread_id, name: p.customer || fmtPhone(p.phone), phone: p.phone,
      addr: String(c?.details.address ?? (d.customers ?? []).find(x => x.id === p.thread_id)?.address ?? ""), mine: !!me && d10(p.crew_member) === me, plan: p }); }
  const anyMine = stops.some(s => s.mine);
  const [all, setAll] = useState(!anyMine), [busy, setBusy] = useState(""), [arm, setArm] = useArm(), [signing, setSigning] = useState<Card | null>(null);
  for (const p of d.plans ?? []) if (p.status === "active" && p.next_on && p.next_on < today) { const c = byId.get(p.thread_id) ?? null;
    stops.push({ key: `v${p.id}late`, kind: "visit", at: Date.parse(today + "T06:00:00"), allDay: true, day: today, card: c, thread: p.thread_id, name: p.customer || fmtPhone(p.phone), phone: p.phone, addr: String(c?.details.address ?? ""), mine: !!me && d10(p.crew_member) === me, plan: p }); }
  const shown = stops.filter(s => (all || s.mine) && s.day >= today && s.day <= weekEnd).sort((a, b) => a.at - b.at);
  const clockOn = myClock(d);
  const now = shown.filter(s => s.day === today), later = shown.filter(s => s.day > today);
  const openSteps = now.reduce((n, s) => n + (s.kind === "install" && s.card ? jobSteps(biz.trade, s.card.details).filter(x => !s.card!.job[x.key]).length : 0), 0);
  async function act(key: string, body: Record<string, unknown>, done: string) {
    setBusy(key);
    try { await api("/api/app/act", { p: project, ...body }); toast(done); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); }
    finally { setBusy(""); setArm(""); }
  }
  const day = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const stop = (s: Stop, big: boolean) => <article key={s.key} className={"stop " + s.kind + (big ? " big" : "")}>
    <div className="stop-h" role="button" tabIndex={0} onClick={() => go.record(s.thread)} onKeyDown={e => { if (e.key === "Enter") go.record(s.thread); }}>
      <time>{big ? (s.allDay ? "All day" : clock(new Date(s.at).toISOString())) : `${dayName(new Date(s.at).toISOString())}${s.allDay ? "" : " " + clock(new Date(s.at).toISOString())}`}</time>
      <Avatar name={s.name} />
      <span className="t"><b>{s.name}</b><small>{[s.kind === "estimate" ? "Estimate" : s.kind === "visit" ? (s.plan!.next_on && s.plan!.next_on < today ? `${s.plan!.name}, late since ${dateLabel(s.plan!.next_on)}` : s.plan!.name) : "Install", s.kind !== "visit" && s.card?.line ? line(s.card) : "", s.addr].filter(Boolean).join(", ")}</small></span>
      {!s.mine && all && ((s.kind === "visit" ? s.plan?.crew_member : s.card?.crewMember) ? <span className="chip">{first(crewName(d, s.kind === "visit" ? s.plan!.crew_member : s.card!.crewMember))}</span> : null)}
    </div>
    {big && s.card?.crew && <p className="stop-note"><Icon name="alert" size={13} />{s.card.crew}</p>}
    {big && <div className="acts-row">
      {s.addr && <a className="btn sm" href={maps(s.addr)} target="_blank" rel="noreferrer"><Icon name="pin" size={13} />Directions</a>}
      <a className="btn sm" href={`tel:${s.phone}`}><Icon name="phone" size={13} />Call</a>
      <button type="button" className={"btn sm" + (arm === "omw" + s.key ? " ink" : "")} disabled={busy === "omw" + s.key} onClick={() => { if (arm === "omw" + s.key) void act("omw" + s.key, { action: "reply", thread: s.thread, body: onMyWayText(s.name, "", d.business) }, `Texted ${first(s.name)} you're on the way.`); else setArm("omw" + s.key); }}>{busy === "omw" + s.key ? <Spinner /> : <Icon name="car" size={13} />}{arm === "omw" + s.key ? "Tap to send" : "On my way"}</button>
      {s.kind !== "estimate" && <button type="button" className={"btn sm" + (clockOn?.thread_id === s.thread ? " ink" : "")} disabled={busy === "clk" + s.key} onClick={() => void act("clk" + s.key, clockOn?.thread_id === s.thread ? { action: "clockout" } : { action: "clockin", thread: s.thread }, clockOn?.thread_id === s.thread ? "Clocked out." : `Clocked in at ${first(s.name)}'s.`)}>{busy === "clk" + s.key ? <Spinner /> : <Icon name="clock" size={13} />}{clockOn?.thread_id === s.thread ? "Clock out" : "Clock in"}</button>}
      {s.kind === "visit" && s.plan && s.plan.next_on && s.plan.next_on <= s.day && <button type="button" className={"btn sm" + (arm === "vd" + s.key ? " ink" : "")} disabled={busy === "vd" + s.key} onClick={() => { if (arm === "vd" + s.key) void act("vd" + s.key, { action: "visit", plan: s.plan!.id }, `${first(s.name)}'s visit is done.${d.role === "crew" ? "" : s.plan!.invoice ? " Invoice texted." : ""}`); else setArm("vd" + s.key); }}>{busy === "vd" + s.key ? <Spinner /> : <Icon name="check" size={13} />}{arm === "vd" + s.key ? "Tap: visit done" : "Visit done"}</button>}
      {s.kind === "install" && s.card && (s.card.signoff ? <span className="chip good"><Icon name="check" size={11} />Signed off</span> : <button type="button" className="btn sm" onClick={() => setSigning(s.card)}><Icon name="check" size={13} />Sign-off</button>)}
      <button type="button" className="btn sm" onClick={() => go.record(s.thread)}><Icon name="upload" size={13} />Photos and notes</button>
    </div>}
    {big && s.kind !== "estimate" && s.card?.checklist && <ChecklistBox d={d} card={s.card} trade={biz.trade} busy={busy} canPick={false} act={(k, body, done) => act(k, { ...body, thread: s.thread }, done)} />}
    {big && s.kind === "install" && s.card && <Steps card={s.card} trade={biz.trade} busy={busy} tick={(step, done) => void act("step:" + step, { action: "jobstep", thread: s.thread, step, done }, done ? "Ticked." : "Unticked.")} />}
  </article>;
  return <>
    <PageHead title="Your day" sub={day} actions={<>{anyMine && <div className="seg" role="radiogroup" aria-label="Whose jobs">
      <button type="button" role="radio" aria-checked={!all} className={!all ? "on" : ""} onClick={() => setAll(false)}>Mine</button>
      <button type="button" role="radio" aria-checked={all} className={all ? "on" : ""} onClick={() => setAll(true)}>Everyone</button></div>}
      {routeUrl(now.map(s => s.addr)) && <a className="btn" href={routeUrl(now.map(s => s.addr))!} target="_blank" rel="noreferrer"><Icon name="pin" size={14} />Today's route</a>}
      {!clockOn && <button type="button" className="btn" disabled={busy === "clkgen"} onClick={() => void act("clkgen", { action: "clockin" }, "Clocked in. Clock out when you're done.")}><Icon name="clock" size={14} />Clock in</button>}</>} />
    <div className="dash myday">
    <ClockBar d={d} busy={busy === "out"} onOut={() => void act("out", { action: "clockout" }, "Clocked out.")} />
    <Kpis items={[{ label: "Stops today", value: String(now.length), sub: now[0] ? `First at ${now[0].allDay ? "7 AM" : clock(new Date(now[0].at).toISOString())}` : "Nothing booked" },
      { label: "Rest of the week", value: String(later.length), sub: later[0] ? `Next ${dateLabel(later[0].day)}` : "Clear" },
      { label: "Steps left", value: String(openSteps), sub: openSteps ? "On today's installs" : "Nothing left to tick" }]} />
    <section className="panel"><div className="panel-h"><h2>Today</h2><small>{now.length ? `${now.length} ${now.length === 1 ? "stop" : "stops"}` : ""}</small></div>
      <div className="panel-b">{now.length ? <div className="stops">{now.map(s => stop(s, true))}</div> : <Empty icon="cal" title="Nothing on today" text={later.length ? "Your next stop is below." : "When the owner puts you on a job, it shows up here and you get a text."} />}</div>
    </section>
    {later.length > 0 && <section className="panel"><div className="panel-h"><h2>This week</h2></div><div className="panel-b"><div className="stops">{later.map(s => stop(s, false))}</div></div></section>}
    </div>
    {signing && <SignoffSheet card={signing} trade={biz.trade} owner={d.role !== "crew"} onClose={() => setSigning(null)} save={async input => {
      try { await api("/api/app/act", { p: project, action: "signoff", thread: signing.id, input }); toast(`${first(signing.name)} signed off the job.`); await reload(); return true; }
      catch (e) { toast(e instanceof Error ? e.message : "That didn't save.", true); return false; } }} />}
  </>;
}
