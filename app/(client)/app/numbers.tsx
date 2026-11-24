"use client";

// Reports: the numbers an owner runs the business on, for a period he picks, each against the period before.
// Stat boxes with trends, the funnel from lead to won, money over time, where the work came from, why jobs were
// lost, then reviews and win-back. Definitions match Jobber and ServiceTitan.
import { useCallback, useEffect, useState } from "react";
import { jobPrice } from "@/lib/service";
import type { People, Period, Report, ReportNumbers } from "@/lib/client-reports";
import { PERIODS, periodRange, type PeriodKey } from "@/lib/periods";
import { Avatar, Spinner, ago, secs, short, usd, type Api, type Toast } from "./parts";
import { Bars, Donut, Guide, Kpis, PageHead, type Kpi } from "./charts";
import { GroupedBars, UnitDots, C } from "./v5-charts";
import { HoursPanel, RecurringPanel } from "./jobwork";
import { GoalBox } from "./today";
import { sourceLabel, type Biz, type Data, type Go } from "./types";
import { jobProfit, parseTeam } from "@/lib/crm";
import { totals } from "@/lib/billing";
import { commissions, minutesOf } from "@/lib/service";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const SRC_COLORS = ["#121417", "#d0663f", "#1a8f55", "#0a7cf0", "#8a8f98", "#c9a227", "#6b3f86", "#b4b8bf"];

/** "+12% vs before". Coloured only for money (`money`): green and red mean money in this app. `lowerIsBetter` for times; `points` for rates. */
function delta(now: number | null, before: number | null, o: { lowerIsBetter?: boolean; points?: boolean; money?: boolean } = {}): Pick<Kpi, "sub" | "tone"> {
  const r = delta0(now, before, o);
  return o.money ? r : { sub: r.sub, tone: "" };
}
function delta0(now: number | null, before: number | null, o: { lowerIsBetter?: boolean; points?: boolean } = {}): Pick<Kpi, "sub" | "tone"> {
  if (now == null || before == null || (before === 0 && now === 0)) return { sub: "No change vs before", tone: "" };
  if (before === 0) return { sub: "New this period", tone: o.lowerIsBetter ? "" : "up" };
  const d = o.points ? Math.round(now - before) : Math.round(((now - before) / before) * 100);
  if (d === 0) return { sub: "Same as before", tone: "" };
  const good = o.lowerIsBetter ? d < 0 : d > 0;
  return { sub: `${d > 0 ? "+" : ""}${d}${o.points ? " pts" : "%"} vs before`, tone: good ? "up" : "down" };
}

export function ReportsScreen({ d, biz, go, project, api, toast, reload, onWinback }: { d: Data; biz: Biz; go: Go; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onWinback: () => void }) {
  const [key, setKey] = useState<PeriodKey>("30");
  const rg = periodRange(key, new Date(), d.setup?.timezone || "America/Denver"), days = (key === "90" ? 90 : rg.unit === "month" ? 365 : 30) as Period;
  const win = { since: rg.from.getTime(), until: rg.to.getTime(), phrase: rg.phrase };
  const [r, setR] = useState<Report | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState("");
  const load = useCallback(async (n: PeriodKey) => {
    setErr("");
    try { setR((await api<{ report: Report }>(`/api/app/data?p=${project}&report=${n}`)).report); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load the report."); }
  }, [api, project]);
  useEffect(() => { void load(key); }, [key, load]);
  const askReview = async (id: string, name: string) => { setBusy(id); try { await api("/api/app/act", { p: project, action: "review", quote: id }); toast(`Review request sent to ${name.split(" ")[0]}.`); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Didn't send.", true); } finally { setBusy(""); } };

  const n = r?.now, b = r?.before, ser = r?.series ?? [];
  const rate = (x?: ReportNumbers) => x ? { book: pct(x.booked, x.leads), quote: pct(x.quoted, x.booked), close: pct(x.won, x.quoted), avg: x.won ? x.wonValue / x.won : null, noShow: pct(x.noShows, x.appts) } : null;
  const R = rate(n), B = rate(b);
  const lab = (k: string, i: number) => { const t = new Date(k + "T12:00:00"); return rg.unit === "month" ? t.toLocaleDateString("en-US", { month: "short" }) : i === ser.length - 1 && rg.current ? "This week" : t.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const pending = d.wonJobs ?? [], wb = d.winback;
  const lostTotal = r?.lostReasons.reduce((a, x) => a + x.n, 0) ?? 0;
  const srcTotal = r?.sources.reduce((a, s) => a + s.wonValue, 0) ?? 0;
  const ready = !!(r && n && b && R && B);

  return <>
    <header className="v5-top v5">
      <div>
        <div className="v5-eyebrow"><span className="v5-lab" style={{ color: "var(--t2)" }}>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).replace(",", " ·").toUpperCase()}</span>{d.project === "demo" && <span className="v5-ex">Example business, sample data</span>}</div>
        <h1 className="v5-h1">Numbers</h1>
        <p className="v5-sub">{ready && n!.leads ? `${usd(n!.wonValue)} won from ${n!.leads} leads in ${rg.phrase}. Both close rates, defined, on one screen.` : ready ? "No leads yet in this period." : `How ${rg.phrase} went.`}</p>
      </div>
      <div className="v5-acts"><span className="acts-row"><div className="v5-seg" role="tablist" aria-label="Period">{(["30", "90", "365"] as PeriodKey[]).map(p => <button key={p} type="button" role="tab" aria-selected={key === p} className={key === p ? "on" : ""} onClick={() => { setR(null); setKey(p); }}>{PERIODS.find(x => x[0] === p)![1]}</button>)}</div>
        <select className="input sm v5-sel" style={{ width: "auto" }} aria-label="Calendar period" value={["month", "lastmonth", "year", "lastyear"].includes(key) ? key : ""} onChange={e => { if (e.target.value) { setR(null); setKey(e.target.value as PeriodKey); } }}>
          <option value="">Month or year</option>{PERIODS.filter(p => !/^\d/.test(p[0])).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></span><a className="b5 pri" href={`/api/app/export?p=${encodeURIComponent(project)}&what=jobs`} onClick={e => { if (project === "demo") { e.preventDefault(); toast("The example business has nothing to export. Your own export downloads a real file."); } }}>Export for my bookkeeper</a></div>
    </header>
    <div className="dash rep2">
      {/* The monthly goal moved here from Today: it's a number to check, not a thing to do. */}
      {!biz.crew && d.role !== "office" && <div className="panel rep-goal"><div className="panel-b"><GoalBox d={d} cards={d.board ?? []} api={api} project={project} toast={toast} reload={reload} /></div></div>}
      {err ? <div className="panel"><div className="panel-b"><p className="fine" style={{ color: "var(--bad)", padding: "12px 0" }}>{err} <button type="button" className="link" onClick={() => void load(key)}>Try again</button></p></div></div>
      : !ready ? <div className="panel"><div className="panel-b skel-rows" style={{ padding: 18 }}><i className="skel" /><i className="skel" /><i className="skel" /></div></div>
      : n!.leads === 0 && b!.leads === 0 && !ser.length ? <Guide title="Your numbers start with your first lead"
        sub="Book rate, close rate, average job, speed to lead, money collected and where the work comes from, all worked out for you and compared with the period before. Nothing to set up."
        steps={[
          { title: "Get leads flowing in", text: "Your number, website chat, form or booking page. Settings shows what's connected.", action: <button type="button" className="btn sm" onClick={() => go.tab("system")}>Connections</button> },
          { title: "Mark jobs won or lost", text: "With a reason when it's lost, so you see what's costing you jobs." },
          { title: "Record payments", text: "So collected money and days to get paid are real numbers.", action: <button type="button" className="btn sm" onClick={() => go.tab("invoices")}>Money</button> },
        ]} />
      : <>
        {(() => {
          const l2w = pct(n!.won, n!.leads), l2wB = pct(b!.won, b!.leads);
          const dPct = (a: number | null, z: number | null, pts = false) => a == null || z == null ? null : pts ? a - z : z ? Math.round(((a - z) / z) * 100) : null;
          const Delta = ({ v, pts }: { v: number | null; pts?: boolean }) => v == null ? null : <span className={"v5-delta " + (v > 0 ? "up" : "flat")}>{v > 0 ? "+" : ""}{v}{pts ? " pts" : "%"}</span>;
          const lostN = n!.lost, waitN = Math.max(0, n!.quoted - n!.won - lostN);
          const cards: { k: string; v: string; d: number | null; pts?: boolean; sub: string; dots?: [number, number] }[] = [
            { k: "Leads", v: String(n!.leads), d: dPct(n!.leads, b!.leads), sub: `vs ${b!.leads} the period before` },
            { k: "Book rate", v: R!.book == null ? "–" : `${R!.book}%`, d: dPct(R!.book, B!.book, true), pts: true, sub: `${n!.booked} of ${n!.leads} booked an estimate`, dots: [n!.leads, n!.booked] },
            { k: "Close rate", v: R!.close == null ? "–" : `${R!.close}%`, d: dPct(R!.close, B!.close, true), pts: true, sub: `won ÷ quoted, ${n!.won} of ${n!.quoted}`, dots: [n!.quoted, n!.won] },
            { k: "Lead to won", v: l2w == null ? "–" : `${l2w}%`, d: dPct(l2w, l2wB, true), pts: true, sub: `won ÷ leads, ${n!.won} of ${n!.leads}`, dots: [n!.leads, n!.won] },
            { k: "Won", v: usd(n!.wonValue), d: dPct(n!.wonValue, b!.wonValue), sub: `${n!.won} ${n!.won === 1 ? "job" : "jobs"}${n!.won ? `, ${usd(n!.wonValue / n!.won)} average` : ""}` },
          ];
          const srcRows = r!.sources.filter(s => s.leads > 0).sort((a, z) => z.leads - a.leads);
          const all = srcRows.reduce((a, s) => ({ leads: a.leads + s.leads, booked: a.booked + s.booked, quoted: a.quoted + s.quoted, won: a.won + s.won, value: a.value + s.wonValue }), { leads: 0, booked: 0, quoted: 0, won: 0, value: 0 });
          const frac = (a: number, z: number) => z ? <>{pct(a, z)}%{z < 10 ? <small className="v5-dim"> ({a}/{z})</small> : null}</> : <span className="v5-dim">–</span>;
          return <div className="v5 n5">
            <div className="n5-kpis">{cards.map(c => <div key={c.k} className="v5-card n5-k"><span className="v5-lab">{c.k}</span><span className="n5-v"><span className="v5-kv">{c.v}</span><Delta v={c.d} pts={c.pts} /></span>
              <small className="v5-muted">{c.sub}</small>{c.dots && c.dots[0] <= 60 && <UnitDots of={c.dots[0]} on={c.dots[1]} label={c.sub} />}</div>)}</div>
            <div className="n5-row">
              <section className="v5-card n5-weeks" aria-label="Leads and bookings"><div className="v5-ch"><span className="v5-ct">Leads and bookings<small>{rg.unit === "month" ? "by month" : "by week"}</small></span>
                <span style={{ display: "flex", gap: 14 }}><span className="v5-leg"><i className="sq" style={{ background: C.grey }} />Leads</span><span className="v5-leg"><i className="sq" style={{ background: C.accent }} />Booked</span></span></div>
                <div style={{ padding: "14px 18px 10px" }}>{ser.length > 1 ? <GroupedBars aLabel="Leads" bLabel="Booked" summary={`Leads and bookings ${rg.unit === "month" ? "by month" : "by week"}`}
                  data={ser.map((p, i) => ({ label: lab(p.label, i), a: p.leads, b: p.booked, note: rg.unit === "month" ? lab(p.label, i) : i === ser.length - 1 && rg.current ? "This week, so far" : `Week of ${lab(p.label, i)}` }))} />
                  : <p className="v5-dim" style={{ padding: "30px 0", fontSize: 13 }}>The chart fills in as the weeks go by.</p>}</div></section>
              <section className="v5-card n5-funnel" aria-label="From lead to won"><div className="v5-ch"><span className="v5-ct">From lead to won<small>{rg.phrase}</small></span></div>
                <div style={{ padding: "8px 18px 16px" }}>{([["Leads", n!.leads, ""], ["Booked an estimate", n!.booked, R!.book != null ? `${R!.book}% of leads` : ""], ["Quoted", n!.quoted, R!.quote != null ? `${R!.quote}% of booked` : ""], ["Won", n!.won, R!.close != null ? `${R!.close}% of quoted · ${lostN} lost, ${waitN} waiting` : ""]] as const).map(([k, v, s], i) =>
                  <div key={k} className="n5-fn"><div className="n5-fn-t"><span>{k}</span><b className="num">{v}</b></div><span className="n5-fn-bar"><i style={{ width: `${n!.leads ? Math.max(2, (v / n!.leads) * 100) : 0}%`, background: i === 3 ? C.accent : i === 0 ? C.grey : "#8b9098" }} /></span>{s && <small className="v5-dim">{s}</small>}</div>)}</div></section>
            </div>
            <section className="v5-card n5-src" aria-label="Where the work came from"><div className="v5-ch"><span className="v5-ct">Where the work came from<small>{rg.phrase}</small></span></div>
              <div className="n5-tw"><table className="n5-tbl"><thead><tr><th>Source</th><th className="r">Leads</th><th className="r">Booked</th><th className="r">Book rate</th><th className="r">Close rate</th><th className="r">Lead to won</th><th className="r">Won</th></tr></thead>
                <tbody>{srcRows.map(s => <tr key={s.source}><td>{sourceLabel(s.source)}</td><td className="r">{s.leads}</td><td className="r">{s.booked}</td><td className="r">{frac(s.booked, s.leads)}</td><td className="r">{frac(s.won, s.quoted)}</td><td className="r">{frac(s.won, s.leads)}</td><td className="r">{s.wonValue ? usd(s.wonValue) : <span className="v5-dim">–</span>}</td></tr>)}</tbody>
                <tfoot><tr><td>All</td><td className="r">{all.leads}</td><td className="r">{all.booked}</td><td className="r">{frac(all.booked, all.leads)}</td><td className="r">{frac(all.won, all.quoted)}</td><td className="r">{frac(all.won, all.leads)}</td><td className="r">{usd(all.value)}</td></tr></tfoot></table></div>
              <p className="n5-def">Book rate = booked ÷ leads. Close rate = won ÷ quoted. Lead to won = won ÷ leads. Each lead counts in the period it came in, so no rate goes over 100%.</p>
            </section>
          </div>;
        })()}

        <div className="grid12">
          <section className="panel s7">
            <div className="panel-h"><h2>Money in</h2><small>won and collected, {rg.unit === "month" ? "by month" : "by week"}</small></div>
            <div className="panel-b" style={{ paddingTop: 18 }}>{ser.length > 1 ? <Bars data={ser.map((p, i) => ({ label: lab(p.label, i), a: p.wonValue, b: p.collected }))} a="Won" b="Collected" height={170} fmt={v => short(v)} />
              : <p className="fine" style={{ padding: "30px 0" }}>The chart fills in as the weeks go by.</p>}</div>
          </section>
          <section className="panel s5">
            <div className="panel-h"><h2>Still on the table</h2></div>
            <div className="panel-b">
              <div className="money"><span>Quotes out, waiting on an answer</span><b>{usd(r!.openQuotes.value)}<small> {r!.openQuotes.n} {r!.openQuotes.n === 1 ? "quote" : "quotes"}</small></b></div>
              <div className="money"><span>Won from after-hours leads</span><b>{usd(n!.afterHoursValue)}<small> {n!.afterHoursWon} {n!.afterHoursWon === 1 ? "job" : "jobs"}</small></b></div>
              <div className="money"><span>Invoiced</span><b>{usd(n!.invoiced)}</b></div>
              <div className="money"><span>No-shows</span><b>{R!.noShow == null ? "–" : `${R!.noShow}%`}<small> {n!.noShows} of {n!.appts}</small></b></div>
              <p className="sec" style={{ marginTop: 16 }}>Why jobs were lost<small>{lostTotal ? `${lostTotal} lost` : ""}</small></p>
              {r!.lostReasons.length ? <ul className="bars lost">{r!.lostReasons.map(x => <li key={x.reason}><span>{x.reason}</span><i style={{ width: `${(x.n / (r!.lostReasons[0]?.n || 1)) * 100}%` }} /><b>{x.n}</b></li>)}</ul>
                : <p className="fine">Mark a job lost with a reason and the pattern shows here.</p>}
            </div>
          </section>
          {(() => {
            const profit = n!.costedValue - n!.costs, margin = n!.costedValue ? Math.round((profit / n!.costedValue) * 100) : null;
            const jobs = (d.board ?? []).filter(c => c.stage === "won").map(c => ({ c, p: jobProfit(jobPrice(c), c.costs) })).filter(x => x.p).sort((a, b) => a.p!.margin - b.p!.margin);
            const uncosted = Math.max(0, n!.won - n!.costed);
            return <section className="panel s12">
              <div className="panel-h"><h2>Profit on won jobs</h2><small>{n!.costed ? `${n!.costed} of ${n!.won} won ${n!.won === 1 ? "job" : "jobs"} with costs logged` : rg.phrase}</small></div>
              <div className="panel-b profit2">{n!.costed ? <>
                <div className="profit-fig">
                  <Donut size={124} total={margin == null ? "–" : `${margin}%`} label="margin" parts={[{ label: "Profit", value: Math.max(0, profit), color: "var(--good)" }, { label: "Costs", value: n!.costs, color: "var(--g3)" }]} />
                  <div>
                    <div className="money"><span>Sold, on costed jobs</span><b>{usd(n!.costedValue)}</b></div>
                    <div className="money"><span>Materials, labor and other</span><b>{usd(n!.costs)}</b></div>
                    <div className="money sum"><span>Profit</span><b style={profit < 0 ? { color: "var(--bad)" } : { color: "var(--good)" }}>{usd(profit)}</b></div>
                    {uncosted > 0 && <p className="fine">{uncosted} won {uncosted === 1 ? "job has" : "jobs have"} no costs yet. Log them on the job to count them here.</p>}
                  </div>
                </div>
                {jobs.length > 0 && <div className="profit-jobs"><p className="sec">Thinnest margins first<small>every won job with costs</small></p>
                  <ul className="bars">{jobs.slice(0, 6).map(({ c, p }) => <li key={c.id}><span><button type="button" className="link" onClick={() => go.record(c.id)}>{c.name}</button></span><i className={p!.margin < 20 ? "warn" : ""} style={{ width: `${Math.max(2, Math.min(100, p!.margin))}%` }} /><b>{p!.margin}%<small> {usd(p!.profit)}</small></b></li>)}</ul></div>}
              </> : <p className="fine" style={{ padding: "6px 0" }}>Log materials, labor and other costs on a won job (the Costs box on the job) and you see what each job really made, and your margin across all of them.</p>}</div>
            </section>;
          })()}
          <RecurringPanel d={d} go={go} onPlans={() => go.tab("plans")} />
          <HoursPanel d={d} go={go} />
          <CrewPanel d={d} win={win} people={r?.people} />
          <CommissionPanel d={d} win={win} people={r?.people} />
          <TaxPanel d={d} win={win} people={r?.people} />
          <section className="panel s6">
            <div className="panel-h"><h2>Reviews</h2><small>{n!.reviews} asked, {rg.phrase}</small></div>
            {d.ratings && d.ratings.n > 0 && <p className="fine" style={{ padding: "8px 0 0" }}>Customers rated finished jobs <b style={{ color: "var(--ink)" }}>{d.ratings.avg} of 5</b> ({d.ratings.n} {d.ratings.n === 1 ? "rating" : "ratings"} this year{d.ratings.low ? `, ${d.ratings.low} at 3 or lower` : ""}).</p>}
            <div className="panel-b">
              {!biz.reviewLink && <p className="fine" style={{ padding: "8px 0" }}>Add your Google review link in Settings, Account, and the morning after each install the customer gets one text asking for a review.</p>}
              {pending.length ? pending.slice(0, 6).map(j => <div key={j.id} className="row"><Avatar name={j.customer_name} size="sm" /><span style={{ minWidth: 0 }}><b>{j.customer_name}</b><small>{j.amount ? `${usd(j.amount)}, ` : ""}won {ago(j.won_at)}, not asked yet</small></span>
                <button type="button" className="btn sm" disabled={!biz.reviewLink || busy === j.id} onClick={() => void askReview(j.id, j.customer_name)}>{busy === j.id ? <Spinner /> : "Ask now"}</button></div>)
                : biz.reviewLink ? <p className="fine" style={{ padding: "8px 0" }}>Every finished job has been asked.</p> : null}
            </div>
          </section>
          <section className="panel s6">
            <div className="panel-h"><h2>Past customers</h2><small>{wb ? `${wb.past} on file` : ""}</small></div>
            <div className="panel-b">
              {wb && wb.past > 0 ? <>
                <p className="fine" style={{ margin: "8px 0 10px" }}>{wb.eligible ? `${wb.eligible} agreed to offers and haven't heard from you in 90 days${wb.names.length ? `: ${wb.names.join(", ")}` : ""}.` : "Everyone who agreed to offers has heard from you in the last 90 days."}</p>
                <div className="acts-row"><button type="button" className="btn sm ink" disabled={!wb.eligible} onClick={onWinback}>Text past customers</button><button type="button" className="btn sm" onClick={go.importCustomers}>Import more</button></div>
              </> : <p className="fine" style={{ padding: "8px 0" }}>Import your past customers and the ones who agreed to offers can get a win-back text. <button type="button" className="link" onClick={go.importCustomers}>Import</button></p>}
            </div>
          </section>
        </div>
      </>}
    </div>
  </>;
}

/** Who on the crew did what in the period: jobs won with them on it, their value, and hours clocked. */
type Win = { since: number; until: number; phrase: string };
const inWin = (w: Win, at: string | number) => { const t = typeof at === "number" ? at : Date.parse(at.length === 10 ? at + "T12:00:00" : at); return t >= w.since && t < w.until; };
function CrewPanel({ d, win, people }: { d: Data; win: Win; people?: People }) {
  const team = parseTeam(d.setup?.team ?? "[]"), d10 = (p: string) => p.replace(/\D/g, "").slice(-10);
  if (!team.length) return null;
  const rows = [{ cell: "", name: d.owner ? d.owner.split(" ")[0] + " (you)" : "You" }, ...team.map(m => ({ cell: m.cell, name: m.name || m.cell }))].map(p => {
    const jobs = (d.board ?? []).filter(c => c.stage === "won" && !c.pastCustomer && inWin(win, c.stageAt ?? c.at) && d10(c.crewMember ?? "") === d10(p.cell));
    const mins = (d.time ?? []).filter(e => inWin(win, e.started_at) && d10(e.member) === d10(p.cell)).reduce((a, e) => a + minutesOf(e), 0);
    const srv = people?.crew.find(x => x.member === d10(p.cell));
    if (people) return { ...p, jobs: srv?.jobs ?? 0, value: srv?.value ?? 0, hours: Math.round((srv?.minutes ?? 0) / 6) / 10 };
    return { ...p, jobs: jobs.length, value: jobs.reduce((a, c) => a + (jobPrice(c) ?? 0), 0), hours: Math.round(mins / 6) / 10 };
  }).filter(r => r.jobs || r.hours);
  return <section className="panel s6">
    <div className="panel-h"><h2>Crew</h2><small>won jobs they were on, and hours, {win.phrase}</small></div>
    <div className="panel-b">{rows.length ? <table className="tbl flush"><thead><tr><th>Who</th><th className="right">Jobs</th><th className="right">Value</th><th className="right">Hours</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.cell || "me"} style={{ cursor: "default" }}><td><b>{r.name}</b></td><td className="num">{r.jobs}</td><td className="num">{r.value ? usd(r.value) : "–"}</td><td className="num mut">{r.hours || "–"}</td></tr>)}</tbody></table>
      : <p className="fine" style={{ padding: "8px 0" }}>Assign jobs to your crew and have them clock in, and this shows who did what.</p>}</div>
  </section>;
}

/** Sales tax on what was paid in the period, by month: what to send the state. */
function TaxPanel({ d, win, people }: { d: Data; win: Win; people?: People }) {
  const paid = (d.invoices ?? []).filter(i => i.status === "paid" && !!i.paid_at && inWin(win, i.paid_at) && i.tax_rate > 0);
  const months = new Map<string, { taxable: number; tax: number; n: number }>();
  for (const i of paid) { const t = totals(i.items, i.tax_rate), k = (i.paid_at ?? "").slice(0, 7); const m = months.get(k) ?? { taxable: 0, tax: 0, n: 0 }; m.taxable += t.subtotal; m.tax += t.tax; m.n++; months.set(k, m); }
  const list = people ? people.tax.map(t => [t.month, t] as const) : [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return <section className="panel s6">
    <div className="panel-h"><h2>Sales tax</h2><small>on invoices paid, {win.phrase}</small></div>
    <div className="panel-b">{list.length ? <table className="tbl flush"><thead><tr><th>Month</th><th className="right">Invoices</th><th className="right">Taxable</th><th className="right">Tax collected</th></tr></thead>
      <tbody>{list.map(([k, m]) => <tr key={k} style={{ cursor: "default" }}><td><b>{new Date(k + "-15T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</b></td><td className="num">{m.n}</td><td className="num">{usd(m.taxable)}</td><td className="num"><b>{usd(m.tax)}</b></td></tr>)}</tbody></table>
      : <p className="fine" style={{ padding: "8px 0" }}>Invoices with sales tax on them show here once they&rsquo;re paid. Set your rate in Invoices and payments.</p>}</div>
  </section>;
}

/** Commissions owed for the period: each person's percentage of what was collected on their jobs. */
function CommissionPanel({ d, win, people }: { d: Data; win: Win; people?: People }) {
  const team = parseTeam(d.setup?.team ?? "[]");
  if (!team.some(m => m.commission)) return null;
  const rows = people ? team.filter(m => (m.commission ?? 0) > 0).map(m => { const c = people.collected.find(x => x.member === m.cell.replace(/\D/g, "").slice(-10));
      const collected = c?.amount ?? 0; return { name: m.name || m.cell, pct: m.commission!, collected, jobs: c?.jobs ?? 0, owed: Math.round(collected * m.commission!) / 100 }; }).sort((a, b) => b.owed - a.owed)
    : commissions(team, d.board ?? [], (d.payments ?? []).filter(p => inWin(win, p.paid_on)), "0000-00-00");
  return <section className="panel s6">
    <div className="panel-h"><h2>Commissions</h2><small>on money collected, {win.phrase}</small></div>
    <div className="panel-b"><table className="tbl flush"><thead><tr><th>Who</th><th className="right">Rate</th><th className="right">Collected</th><th className="right">Owed</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.name} style={{ cursor: "default" }}><td><b>{r.name}</b><small className="mut">{r.jobs ? `, ${r.jobs} ${r.jobs === 1 ? "job" : "jobs"}` : ""}</small></td><td className="num mut">{r.pct}%</td><td className="num">{usd(r.collected)}</td><td className="num"><b>{usd(r.owed)}</b></td></tr>)}</tbody></table>
      <p className="fine" style={{ marginTop: 6 }}>Set each person&rsquo;s percentage in Settings, Account, next to their hourly rate.</p></div>
  </section>;
}
