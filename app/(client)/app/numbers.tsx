"use client";

// Reports: the numbers an owner runs the business on, for a period he picks, each against the period before.
// Stat boxes with trends, the funnel from lead to won, money over time, where the work came from, why jobs were
// lost, then reviews and win-back. Definitions match Jobber and ServiceTitan.
import { useCallback, useEffect, useState } from "react";
import { jobPrice } from "@/lib/service";
import type { Period, Report, ReportNumbers } from "@/lib/client-reports";
import { Avatar, Spinner, ago, secs, short, usd, type Api, type Toast } from "./parts";
import { Bars, Donut, Guide, Kpis, PageHead, type Kpi } from "./charts";
import { HoursPanel, RecurringPanel } from "./jobwork";
import { sourceLabel, type Biz, type Data, type Go } from "./types";
import { jobProfit, parseTeam } from "@/lib/crm";
import { totals } from "@/lib/billing";
import { commissions, minutesOf } from "@/lib/service";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const PERIOD: Record<Period, string> = { 30: "the last 30 days", 90: "the last 90 days", 365: "the last 12 months" };
const SRC_COLORS = ["#121417", "#d0663f", "#1a8f55", "#0a7cf0", "#8a8f98", "#c9a227", "#6b3f86", "#b4b8bf"];

/** "+12% vs before", green when it's better. `lowerIsBetter` for times; `points` for rates. */
function delta(now: number | null, before: number | null, o: { lowerIsBetter?: boolean; points?: boolean } = {}): Pick<Kpi, "sub" | "tone"> {
  if (now == null || before == null || (before === 0 && now === 0)) return { sub: "No change vs before", tone: "" };
  if (before === 0) return { sub: "New this period", tone: o.lowerIsBetter ? "" : "up" };
  const d = o.points ? Math.round(now - before) : Math.round(((now - before) / before) * 100);
  if (d === 0) return { sub: "Same as before", tone: "" };
  const good = o.lowerIsBetter ? d < 0 : d > 0;
  return { sub: `${d > 0 ? "+" : ""}${d}${o.points ? " pts" : "%"} vs before`, tone: good ? "up" : "down" };
}

export function ReportsScreen({ d, biz, go, project, api, toast, reload, onWinback }: { d: Data; biz: Biz; go: Go; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onWinback: () => void }) {
  const [days, setDays] = useState<Period>(30);
  const [r, setR] = useState<Report | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState("");
  const load = useCallback(async (n: Period) => {
    setErr("");
    try { setR((await api<{ report: Report }>(`/api/app/data?p=${project}&report=${n}`)).report); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load the report."); }
  }, [api, project]);
  useEffect(() => { void load(days); }, [days, load]);
  const askReview = async (id: string, name: string) => { setBusy(id); try { await api("/api/app/act", { p: project, action: "review", quote: id }); toast(`Review request sent to ${name.split(" ")[0]}.`); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Didn't send.", true); } finally { setBusy(""); } };

  const n = r?.now, b = r?.before, ser = r?.series ?? [];
  const rate = (x?: ReportNumbers) => x ? { book: pct(x.booked, x.leads), quote: pct(x.quoted, x.booked), close: pct(x.won, x.quoted), avg: x.won ? x.wonValue / x.won : null, noShow: pct(x.noShows, x.appts) } : null;
  const R = rate(n), B = rate(b);
  const lab = (k: string, i: number) => { const t = new Date(k + "T12:00:00"); return days === 365 ? t.toLocaleDateString("en-US", { month: "short" }) : i === ser.length - 1 ? "This week" : t.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const pending = d.wonJobs ?? [], wb = d.winback;
  const lostTotal = r?.lostReasons.reduce((a, x) => a + x.n, 0) ?? 0;
  const srcTotal = r?.sources.reduce((a, s) => a + s.wonValue, 0) ?? 0;
  const ready = !!(r && n && b && R && B);

  return <>
    <PageHead title="Reports" sub={ready && n!.leads ? `${usd(n!.wonValue)} won from ${n!.leads} leads in ${PERIOD[days]}.` : ready ? "No leads yet in this period." : `How ${PERIOD[days]} went.`}
      actions={<div className="seg" role="tablist" aria-label="Period">{([30, 90, 365] as Period[]).map(p => <button key={p} type="button" role="tab" aria-selected={days === p} className={days === p ? "on" : ""} onClick={() => setDays(p)}>{p === 365 ? "12 months" : `${p} days`}</button>)}</div>} />
    <div className="dash rep2">
      {err ? <div className="panel"><div className="panel-b"><p className="fine" style={{ color: "var(--bad)", padding: "12px 0" }}>{err} <button type="button" className="link" onClick={() => void load(days)}>Try again</button></p></div></div>
      : !ready ? <div className="panel"><div className="panel-b skel-rows" style={{ padding: 18 }}><i className="skel" /><i className="skel" /><i className="skel" /></div></div>
      : n!.leads === 0 && b!.leads === 0 && !ser.length ? <Guide title="Your numbers start with your first lead"
        sub="Book rate, close rate, average job, speed to lead, money collected and where the work comes from, all worked out for you and compared with the period before. Nothing to set up."
        steps={[
          { title: "Get leads flowing in", text: "Your number, website chat, form or booking page. Settings shows what's connected.", action: <button type="button" className="btn sm" onClick={() => go.tab("system")}>Connections</button> },
          { title: "Mark jobs won or lost", text: "With a reason when it's lost, so you see what's costing you jobs." },
          { title: "Record payments", text: "So collected money and days to get paid are real numbers.", action: <button type="button" className="btn sm" onClick={() => go.tab("invoices")}>Money</button> },
        ]} />
      : <>
        <Kpis items={[
          { label: "Won", value: usd(n!.wonValue), ...delta(n!.wonValue, b!.wonValue), spark: ser.map(p => p.wonValue), sparkTone: "good" },
          { label: "Book rate", value: R!.book == null ? "–" : `${R!.book}%`, ...delta(R!.book, B!.book, { points: true }), spark: ser.map(p => p.leads ? p.booked / p.leads : 0) },
          { label: "Close rate", value: R!.close == null ? "–" : `${R!.close}%`, ...delta(R!.close, B!.close, { points: true }) },
          { label: "Average job", value: R!.avg == null ? "–" : usd(R!.avg), ...delta(R!.avg, B!.avg) },
        ]} />
        <Kpis items={[
          { label: "Speed to lead", value: secs(n!.replySec), ...delta(n!.replySec, b!.replySec, { lowerIsBetter: true }) },
          { label: "Sales cycle", value: n!.cycleDays == null ? "–" : `${n!.cycleDays} days`, ...delta(n!.cycleDays, b!.cycleDays, { lowerIsBetter: true }) },
          { label: "Collected", value: usd(n!.collected), ...delta(n!.collected, b!.collected), spark: ser.map(p => p.collected), sparkTone: "good" },
          { label: "Days to get paid", value: n!.payDays == null ? "–" : `${n!.payDays} days`, ...delta(n!.payDays, b!.payDays, { lowerIsBetter: true }) },
        ]} />

        <div className="grid12">
          <section className="panel s5">
            <div className="panel-h"><h2>From lead to won</h2><small>{PERIOD[days]}</small></div>
            <div className="panel-b funnel2">{([["Leads", n!.leads, null, ""], ["Estimates booked", n!.booked, R!.book, "book rate"], ["Quoted", n!.quoted, R!.quote, "of booked"], ["Won", n!.won, R!.close, "close rate"]] as const).map(([k, v, of, l], i) =>
              <div key={k} className="fn"><div className="fn-t"><span>{k}</span><b>{v}</b>{of != null && <em>{of}% {l}</em>}</div>
                <i className={"fn-bar s" + i} style={{ width: `${n!.leads ? Math.max(3, (v / n!.leads) * 100) : 0}%` }} /></div>)}
              <p className="fine" style={{ marginTop: 10 }}>{n!.afterHoursLeads} of the {n!.leads} leads came in at night or on a weekend, and every one was answered.</p>
            </div>
          </section>
          <section className="panel s7">
            <div className="panel-h"><h2>Leads and bookings</h2><small>{days === 365 ? "by month" : "by week"}</small></div>
            <div className="panel-b" style={{ paddingTop: 18 }}>{ser.length > 1 ? <Bars data={ser.map((p, i) => ({ label: lab(p.label, i), a: p.leads, b: p.booked }))} a="Leads" b="Booked" height={190} />
              : <p className="fine" style={{ padding: "30px 0" }}>The chart fills in as the weeks go by.</p>}</div>
          </section>
          <section className="panel s7">
            <div className="panel-h"><h2>Money in</h2><small>won and collected, {days === 365 ? "by month" : "by week"}</small></div>
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
              {r!.lostReasons.length ? <ul className="bars">{r!.lostReasons.map(x => <li key={x.reason}><span>{x.reason}</span><i style={{ width: `${(x.n / (r!.lostReasons[0]?.n || 1)) * 100}%` }} /><b>{x.n}</b></li>)}</ul>
                : <p className="fine">Mark a job lost with a reason and the pattern shows here.</p>}
            </div>
          </section>
          {(() => {
            const profit = n!.costedValue - n!.costs, margin = n!.costedValue ? Math.round((profit / n!.costedValue) * 100) : null;
            const jobs = (d.board ?? []).filter(c => c.stage === "won").map(c => ({ c, p: jobProfit(jobPrice(c), c.costs) })).filter(x => x.p).sort((a, b) => a.p!.margin - b.p!.margin);
            const uncosted = Math.max(0, n!.won - n!.costed);
            return <section className="panel s12">
              <div className="panel-h"><h2>Profit on won jobs</h2><small>{n!.costed ? `${n!.costed} of ${n!.won} won ${n!.won === 1 ? "job" : "jobs"} with costs logged` : PERIOD[days]}</small></div>
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
          <section className="panel s12">
            <div className="panel-h"><h2>Where the work came from</h2><small>{PERIOD[days]}</small></div>
            <div className="panel-b src2">
              {r!.sources.length ? <>
                <Donut parts={r!.sources.map((s, i) => ({ label: s.source, value: s.wonValue || s.leads * 0.001, color: SRC_COLORS[i % SRC_COLORS.length] }))} total={short(srcTotal)} label="won" size={150} />
                <table className="tbl flush"><thead><tr><th>Source</th><th className="right">Leads</th><th className="right">Book rate</th><th className="right">Close rate</th><th className="right">Won</th><th className="right" title="Money collected on these jobs so far">Paid</th><th className="right">Share</th></tr></thead>
                  <tbody>{r!.sources.map((s, i) => { const br = pct(s.booked, s.leads), cr = pct(s.won, s.quoted); return <tr key={s.source} style={{ cursor: "default" }}>
                    <td><span className="src-n"><i style={{ background: SRC_COLORS[i % SRC_COLORS.length] }} /><b>{sourceLabel(s.source)}</b></span></td><td className="num">{s.leads}</td><td className="num mut">{br == null ? "–" : `${br}%`}</td><td className="num mut">{cr == null ? "–" : `${cr}%`}</td>
                    <td className="num"><b>{s.wonValue ? usd(s.wonValue) : <span className="faint">–</span>}</b></td><td className="num">{s.paid ? usd(s.paid) : <span className="faint">–</span>}</td><td className="num mut">{srcTotal && s.wonValue ? `${Math.round((s.wonValue / srcTotal) * 100)}%` : "–"}</td></tr>; })}</tbody></table>
              </> : <p className="fine" style={{ padding: "18px 0" }}>Once leads come in, this shows which source pays.</p>}
            </div>
          </section>
          <RecurringPanel d={d} go={go} onPlans={() => go.tab("plans")} />
          <HoursPanel d={d} go={go} />
          <CrewPanel d={d} days={days} />
          <CommissionPanel d={d} days={days} />
          <TaxPanel d={d} days={days} />
          <section className="panel s6">
            <div className="panel-h"><h2>Reviews</h2><small>{n!.reviews} asked {days === 365 ? "this year" : `in ${days} days`}</small></div>
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
function CrewPanel({ d, days }: { d: Data; days: number }) {
  const team = parseTeam(d.setup?.team ?? "[]"), since = Date.now() - days * 86400000, d10 = (p: string) => p.replace(/\D/g, "").slice(-10);
  if (!team.length) return null;
  const rows = [{ cell: "", name: d.owner ? d.owner.split(" ")[0] + " (you)" : "You" }, ...team.map(m => ({ cell: m.cell, name: m.name || m.cell }))].map(p => {
    const jobs = (d.board ?? []).filter(c => c.stage === "won" && !c.pastCustomer && Date.parse(c.stageAt ?? c.at) > since && d10(c.crewMember ?? "") === d10(p.cell));
    const mins = (d.time ?? []).filter(e => Date.parse(e.started_at) > since && d10(e.member) === d10(p.cell)).reduce((a, e) => a + minutesOf(e), 0);
    return { ...p, jobs: jobs.length, value: jobs.reduce((a, c) => a + (jobPrice(c) ?? 0), 0), hours: Math.round(mins / 6) / 10 };
  }).filter(r => r.jobs || r.hours);
  return <section className="panel s6">
    <div className="panel-h"><h2>Crew</h2><small>won jobs they were on, and hours, last {days} days</small></div>
    <div className="panel-b">{rows.length ? <table className="tbl flush"><thead><tr><th>Who</th><th className="right">Jobs</th><th className="right">Value</th><th className="right">Hours</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.cell || "me"} style={{ cursor: "default" }}><td><b>{r.name}</b></td><td className="num">{r.jobs}</td><td className="num">{r.value ? usd(r.value) : "–"}</td><td className="num mut">{r.hours || "–"}</td></tr>)}</tbody></table>
      : <p className="fine" style={{ padding: "8px 0" }}>Assign jobs to your crew and have them clock in, and this shows who did what.</p>}</div>
  </section>;
}

/** Sales tax on what was paid in the period, by month: what to send the state. */
function TaxPanel({ d, days }: { d: Data; days: number }) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const paid = (d.invoices ?? []).filter(i => i.status === "paid" && (i.paid_at ?? "").slice(0, 10) >= since && i.tax_rate > 0);
  const months = new Map<string, { taxable: number; tax: number; n: number }>();
  for (const i of paid) { const t = totals(i.items, i.tax_rate), k = (i.paid_at ?? "").slice(0, 7); const m = months.get(k) ?? { taxable: 0, tax: 0, n: 0 }; m.taxable += t.subtotal; m.tax += t.tax; m.n++; months.set(k, m); }
  const list = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return <section className="panel s6">
    <div className="panel-h"><h2>Sales tax</h2><small>on invoices paid, last {days} days</small></div>
    <div className="panel-b">{list.length ? <table className="tbl flush"><thead><tr><th>Month</th><th className="right">Invoices</th><th className="right">Taxable</th><th className="right">Tax collected</th></tr></thead>
      <tbody>{list.map(([k, m]) => <tr key={k} style={{ cursor: "default" }}><td><b>{new Date(k + "-15T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</b></td><td className="num">{m.n}</td><td className="num">{usd(m.taxable)}</td><td className="num"><b>{usd(m.tax)}</b></td></tr>)}</tbody></table>
      : <p className="fine" style={{ padding: "8px 0" }}>Invoices with sales tax on them show here once they&rsquo;re paid. Set your rate in Invoices and payments.</p>}</div>
  </section>;
}

/** Commissions owed for the period: each person's percentage of what was collected on their jobs. */
function CommissionPanel({ d, days }: { d: Data; days: number }) {
  const team = parseTeam(d.setup?.team ?? "[]");
  if (!team.some(m => m.commission)) return null;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = commissions(team, d.board ?? [], d.payments ?? [], since);
  return <section className="panel s6">
    <div className="panel-h"><h2>Commissions</h2><small>on money collected, last {days} days</small></div>
    <div className="panel-b"><table className="tbl flush"><thead><tr><th>Who</th><th className="right">Rate</th><th className="right">Collected</th><th className="right">Owed</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.name} style={{ cursor: "default" }}><td><b>{r.name}</b><small className="mut">{r.jobs ? `, ${r.jobs} ${r.jobs === 1 ? "job" : "jobs"}` : ""}</small></td><td className="num mut">{r.pct}%</td><td className="num">{usd(r.collected)}</td><td className="num"><b>{usd(r.owed)}</b></td></tr>)}</tbody></table>
      <p className="fine" style={{ marginTop: 6 }}>Set each person&rsquo;s percentage in Settings, Account, next to their hourly rate.</p></div>
  </section>;
}
