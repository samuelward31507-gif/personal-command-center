"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { BrandLogo } from "../../cinder-brand";
import { FOLLOW_UP_LIFT, leakMath, SPEEDS, type LeakInputs, type Speed } from "@/lib/prospect-report";
import "./report.css";

type Doc = {
  company: string; trade: string; inputs: LeakInputs; findings: string[]; note: string; date: string;
  from: { name: string; owner: string; email: string; booking: string };
};
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** Public prospect report: what slow follow-up likely costs this business, with numbers they can adjust. */
export default function ReportPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");
  const [inp, setInp] = useState<LeakInputs | null>(null);

  useEffect(() => {
    fetch("/api/report?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "This report link isn't valid."); setDoc(d); setInp(d.inputs); })
      .catch(e => setError(e instanceof Error ? e.message : "This report link isn't valid."));
  }, [token]);

  const res = useMemo(() => (inp ? leakMath(inp) : null), [inp]);
  const edited = !!(doc && inp && JSON.stringify(doc.inputs) !== JSON.stringify(inp));
  const set = <K extends keyof LeakInputs>(k: K, v: LeakInputs[K]) => setInp(p => (p ? { ...p, [k]: v } : p));
  const unit = doc?.trade === "pool" ? "consultation" : "estimate";

  return <div className="prp-page">
    <header className="prp-top"><BrandLogo mono className="prp-logo" title={doc?.from.name ?? "Report"} />
      {doc && <span className="prp-for">Prepared for {doc.company} · {fmt(doc.date)}</span>}</header>
    <div className="prp-main">
      {error ? <div className="prp-msg"><h1>Report not available</h1><p>{error}</p></div>
        : !doc || !inp || !res ? <p className="prp-muted">Loading report…</p>
        : <>
          <section className="prp-hero">
            <p className="prp-kicker">{doc.company}</p>
            <h1>What slow follow-up is likely costing you.</h1>
            <div className="prp-big"><b>{usd(res.year)}</b><span>a year in jobs that go elsewhere, about {usd(res.month)} a month.</span></div>
            <p className="prp-half">Even at half these assumptions, that&apos;s {usd(res.half)} a year.</p>
          </section>

          {doc.note && <section className="prp-note"><p>{doc.note}</p><span>{doc.from.owner}, {doc.from.name}</span></section>}

          {doc.findings.length > 0 && <section className="prp-sec">
            <h2>What we noticed</h2>
            <p className="prp-sub">From the outside, as a customer would see it.</p>
            <ol className="prp-finds">{doc.findings.map((f, i) => <li key={i}><span>{i + 1}</span><p>{f}</p></li>)}</ol>
          </section>}

          <section className="prp-sec">
            <h2>The numbers behind it</h2>
            <p className="prp-sub">These are our estimates. Move them to match your business and the total updates. Nothing you change is saved or sent.</p>
            <div className="prp-calc">
              <div className="prp-inputs">
                <label><span>New inquiries a month <b>{inp.leads}</b></span><input type="range" min={5} max={Math.max(300, inp.leads)} step={5} value={inp.leads} onChange={e => set("leads", +e.target.value)} /></label>
                <label><span>Average job size <b>{usd(inp.jobValue)}</b></span><input type="range" min={1000} max={Math.max(150000, inp.jobValue)} step={500} value={inp.jobValue} onChange={e => set("jobValue", +e.target.value)} /></label>
                <label><span>Inquiries you win <b>{inp.closeRate}%</b></span><input type="range" min={5} max={70} step={1} value={inp.closeRate} onChange={e => set("closeRate", +e.target.value)} /></label>
                <fieldset><legend>How fast new inquiries usually hear back</legend>
                  <div className="prp-seg">{(Object.keys(SPEEDS) as Speed[]).map(k => <button key={k} type="button" aria-pressed={inp.speed === k} onClick={() => set("speed", k)}>{SPEEDS[k].label}</button>)}</div></fieldset>
                <fieldset><legend>Every quote followed up at least twice?</legend>
                  <div className="prp-seg two"><button type="button" aria-pressed={inp.followsUp} onClick={() => set("followsUp", true)}>Yes, every time</button><button type="button" aria-pressed={!inp.followsUp} onClick={() => set("followsUp", false)}>Not always</button></div></fieldset>
                {edited && <button type="button" className="prp-reset" onClick={() => setInp(doc.inputs)}>Back to our estimate</button>}
              </div>
              <ul className="prp-break">
                <li><span>Inquiries a month that go to a faster company</span><b>{res.lostLeads.toFixed(1)}</b></li>
                <li><span>Jobs lost to slow replies, a month</span><b>{res.lostJobs.toFixed(1)}</b></li>
                <li><span>Jobs lost to quotes nobody chased, a month</span><b>{res.followUpJobs.toFixed(1)}</b></li>
                <li className="prp-total"><span>Revenue a year</span><b>{usd(res.year)}</b></li>
              </ul>
            </div>
          </section>

          <section className="prp-sec">
            <h2>What fixing it looks like</h2>
            <div className="prp-steps">
              <div><b>Every inquiry answered in under 10 seconds</b><p>Forms, Facebook leads and missed calls get a personal reply right away, in your wording, day or night.</p></div>
              <div><b>The {unit} booked without phone tag</b><p>Serious leads pick a time on your calendar and get reminders, so they show up. You get a text with the details.</p></div>
              <div><b>Every quote followed up</b><p>Polite follow-ups until you get a yes or a no, so no job is lost to silence.</p></div>
            </div>
            <p className="prp-sub prp-run">Built, monitored and improved for you every month. You don&apos;t touch the tech, and it works with your current phone, website and calendar.</p>
          </section>

          <section className="prp-cta">
            <h2>Want the exact number?</h2>
            <p>A free 20-minute call. We go through how your inquiries are handled today, replace these estimates with your real numbers, and tell you honestly whether it&apos;s worth fixing.</p>
            <div className="prp-ctas">
              {doc.from.booking && <a className="prp-btn" href={doc.from.booking} target="_blank" rel="noopener noreferrer">Book a 20-minute call</a>}
              {doc.from.email && <a className="prp-btn ghost" href={`mailto:${doc.from.email}?subject=${encodeURIComponent("Report for " + doc.company)}`}>Reply by email</a>}
            </div>
          </section>

          <p className="prp-fine">How this is worked out: we assume a share of inquiries hire someone faster (2% when replies come within 5 minutes, 10% within the hour, 20% the same day, 30% the next day or later). Those inquiries times the win rate times the job size gives the first number. If quotes aren&apos;t always chased twice, we assume consistent follow-up would win {Math.round(FOLLOW_UP_LIFT * 100)}% more of the jobs you quote. These are estimates, not promises.</p>
        </>}
    </div>
  </div>;
}
