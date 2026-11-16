"use client";

// Reports: the numbers an owner runs the business on, for a period he picks, each against the period before.
// The funnel first (leads, booked, quoted, won), then the rates and money that explain it, then where the work came
// from and why jobs were lost, then reviews and win-back. Definitions match Jobber and ServiceTitan.
import { useCallback, useEffect, useState } from "react";
import type { Period, Report, ReportNumbers } from "@/lib/client-reports";
import { Avatar, Spinner, ago, secs, usd, type Api, type Toast } from "./parts";
import { sourceLabel, type Biz, type Data, type Go } from "./types";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const PERIOD: Record<Period, string> = { 30: "Last 30 days", 90: "Last 90 days", 365: "Last 12 months" };

/** "+12% vs before", green when it's better. `lowerIsBetter` for times; `points` for rates. */
function Delta({ now, before, lowerIsBetter, points }: { now: number | null; before: number | null; lowerIsBetter?: boolean; points?: boolean }) {
  if (now == null || before == null || (before === 0 && now === 0)) return <small className="faint">No change</small>;
  if (before === 0) return <small className={lowerIsBetter ? "down" : "up"}>New this period</small>;
  const d = points ? Math.round(now - before) : Math.round(((now - before) / before) * 100);
  if (d === 0) return <small className="faint">Same as before</small>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return <small className={good ? "up" : "down"}>{d > 0 ? "+" : ""}{d}{points ? " pts" : "%"} vs before</small>;
}

function Metric({ label, value, hint, children }: { label: string; value: string; hint: string; children?: React.ReactNode }) {
  return <div className="met"><span>{label}</span><b>{value}</b>{children}<em>{hint}</em></div>;
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

  const n = r?.now, b = r?.before;
  const rate = (x?: ReportNumbers) => x ? { book: pct(x.booked, x.leads), quote: pct(x.quoted, x.booked), close: pct(x.won, x.quoted), avg: x.won ? x.wonValue / x.won : null, noShow: pct(x.noShows, x.appts) } : null;
  const R = rate(n), B = rate(b);
  const steps = n && R ? [{ k: "Leads", v: n.leads, of: null as number | null, l: "" }, { k: "Estimates booked", v: n.booked, of: R.book, l: "book rate" }, { k: "Quoted", v: n.quoted, of: R.quote, l: "of booked" }, { k: "Won", v: n.won, of: R.close, l: "close rate" }] : [];
  const pending = d.wonJobs ?? [], wb = d.winback;
  const lostTotal = r?.lostReasons.reduce((a, x) => a + x.n, 0) ?? 0;

  return <>
    <header className="tb"><h1 className="h1">Reports</h1><span className="sub">{PERIOD[days]}, compared with the {days === 365 ? "12 months" : `${days} days`} before</span>
      <div className="acts"><div className="seg" role="tablist" aria-label="Period">{([30, 90, 365] as Period[]).map(p => <button key={p} type="button" role="tab" aria-selected={days === p} className={days === p ? "on" : ""} onClick={() => setDays(p)}>{p === 365 ? "12 months" : `${p} days`}</button>)}</div></div></header>
    <div className="pad rep">
      {err ? <p className="fine" style={{ color: "var(--bad)" }}>{err} <button type="button" className="link" onClick={() => void load(days)}>Try again</button></p>
      : !r || !n || !b || !R || !B ? <div className="skel-rows"><i className="skel" /><i className="skel" /><i className="skel" /></div>
      : <>
        <section className="funnel" aria-label="From lead to won">
          {steps.map((s, i) => <div key={s.k} className="fstep">
            <span>{s.k}</span><b>{s.v}</b>
            <i className="fbar" style={{ width: `${n.leads ? Math.max(2, (s.v / n.leads) * 100) : 0}%` }} />
            <small>{i === 0 ? `${n.afterHoursLeads} came in nights or weekends` : s.of == null ? "–" : `${s.of}% ${s.l}`}</small>
          </div>)}
        </section>

        <section className="mets">
          <Metric label="Won" value={usd(n.wonValue)} hint="Jobs won from leads in this period"><Delta now={n.wonValue} before={b.wonValue} /></Metric>
          <Metric label="Book rate" value={R.book == null ? "–" : `${R.book}%`} hint="Leads that booked an estimate. Strong shops book 50 to 70%"><Delta now={R.book} before={B.book} points /></Metric>
          <Metric label="Close rate" value={R.close == null ? "–" : `${R.close}%`} hint="Quoted jobs that were won"><Delta now={R.close} before={B.close} points /></Metric>
          <Metric label="Average job" value={R.avg == null ? "–" : usd(R.avg)} hint="Won value divided by jobs won"><Delta now={R.avg} before={B.avg} /></Metric>
          <Metric label="Speed to lead" value={secs(n.replySec)} hint="Median time to the first reply. Under 5 minutes wins far more jobs"><Delta now={n.replySec} before={b.replySec} lowerIsBetter /></Metric>
          <Metric label="Sales cycle" value={n.cycleDays == null ? "–" : `${n.cycleDays} days`} hint="First contact to won, on average"><Delta now={n.cycleDays} before={b.cycleDays} lowerIsBetter /></Metric>
          <Metric label="Collected" value={usd(n.collected)} hint="Payments recorded in this period"><Delta now={n.collected} before={b.collected} /></Metric>
          <Metric label="Days to get paid" value={n.payDays == null ? "–" : `${n.payDays} days`} hint="Invoice sent to paid, on average"><Delta now={n.payDays} before={b.payDays} lowerIsBetter /></Metric>
        </section>

        <div className="rep-cols">
          <section>
            <p className="sec">Where the work came from<small>{PERIOD[days].toLowerCase()}</small></p>
            {r.sources.length ? <table className="tbl flush">
              <thead><tr><th>Source</th><th className="right">Leads</th><th className="right">Book rate</th><th className="right">Close rate</th><th className="right">Won</th></tr></thead>
              <tbody>{r.sources.map(s => { const br = pct(s.booked, s.leads), cr = pct(s.won, s.quoted); return <tr key={s.source} style={{ cursor: "default" }}>
                <td><b>{sourceLabel(s.source)}</b></td><td className="num">{s.leads}</td><td className="num mut">{br == null ? "–" : `${br}%`}</td><td className="num mut">{cr == null ? "–" : `${cr}%`}</td><td className="num">{s.wonValue ? usd(s.wonValue) : <span className="faint">–</span>}</td></tr>; })}</tbody></table>
              : <p className="fine">Once leads come in, this shows which source pays.</p>}
          </section>
          <section>
            <p className="sec">Still on the table</p>
            <div className="money"><span>Quotes out, waiting on an answer</span><b>{usd(r.openQuotes.value)}<small> {r.openQuotes.n} {r.openQuotes.n === 1 ? "quote" : "quotes"}</small></b></div>
            <div className="money"><span>Won from after-hours leads</span><b>{usd(n.afterHoursValue)}<small> {n.afterHoursWon} {n.afterHoursWon === 1 ? "job" : "jobs"}</small></b></div>
            <div className="money"><span>Invoiced</span><b>{usd(n.invoiced)}</b></div>
            <div className="money"><span>No-shows</span><b>{R.noShow == null ? "–" : `${R.noShow}%`}<small> {n.noShows} of {n.appts}</small></b></div>
            <p className="sec" style={{ marginTop: 18 }}>Why jobs were lost<small>{lostTotal ? `${lostTotal} lost` : ""}</small></p>
            {r.lostReasons.length ? <ul className="bars">{r.lostReasons.map(x => <li key={x.reason}><span>{x.reason}</span><i style={{ width: `${(x.n / (r.lostReasons[0]?.n || 1)) * 100}%` }} /><b>{x.n}</b></li>)}</ul>
              : <p className="fine">Mark a job lost with a reason and the pattern shows here.</p>}
          </section>
        </div>

        <div className="rep-cols">
          <section>
            <p className="sec">Reviews<small>{n.reviews} asked {days === 365 ? "this year" : `in ${days} days`}</small></p>
            {!biz.reviewLink && <p className="fine">Add your Google review link (ask Sam) and the morning after each install the customer gets one text asking for a review.</p>}
            {pending.length ? pending.slice(0, 6).map(j => <div key={j.id} className="row"><Avatar name={j.customer_name} size="sm" /><span style={{ minWidth: 0 }}><b>{j.customer_name}</b><small>{j.amount ? `${usd(j.amount)}, ` : ""}won {ago(j.won_at)}, not asked yet</small></span>
              <button type="button" className="btn sm" disabled={!biz.reviewLink || busy === j.id} onClick={() => void askReview(j.id, j.customer_name)}>{busy === j.id ? <Spinner /> : "Ask now"}</button></div>)
              : biz.reviewLink ? <p className="fine">Every finished job has been asked.</p> : null}
          </section>
          <section>
            <p className="sec">Past customers<small>{wb ? `${wb.past} on file` : ""}</small></p>
            {wb && wb.past > 0 ? <>
              <p className="fine" style={{ marginBottom: 8 }}>{wb.eligible ? `${wb.eligible} agreed to offers and haven't heard from you in 90 days${wb.names.length ? `: ${wb.names.join(", ")}` : ""}.` : "Everyone who agreed to offers has heard from you in the last 90 days."}</p>
              <div className="acts-row"><button type="button" className="btn sm" disabled={!wb.eligible} onClick={onWinback}>Text past customers</button><button type="button" className="btn ghost sm" onClick={go.importCustomers}>Import more</button></div>
            </> : <p className="fine">Import your past customers and the ones who agreed to offers can get a win-back text. <button type="button" className="link" onClick={go.importCustomers}>Import</button></p>}
          </section>
        </div>
      </>}
    </div>
  </>;
}
