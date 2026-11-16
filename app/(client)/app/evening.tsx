"use client";

// The top of Today: speed to first reply this week, and "While you worked", the last 24 hours in four figures.
// This card is why owners keep paying, so it gets the most care: big tabular figures that count up once, plain words.
import { useState } from "react";
import type { Evening } from "@/lib/client-evening";
import { Icon, Spinner, type Api, type Toast } from "./parts";
import { CountUp, secText } from "./sources";
import type { Data } from "./types";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export function TodayTop({ d, api, project, toast, owner }: { d: Data; api: Api; project: string; toast: Toast; owner: boolean }) {
  const L = d.live, e = d.evening, sec = L.replySecWeek ?? L.replySec ?? null;
  const [txt, setTxt] = useState(d.setup?.evening_text === "yes"), [busy, setBusy] = useState(false);
  const hour = new Date().getHours(), label = hour >= 17 ? "While you worked" : hour < 11 ? "While you were off" : "The last 24 hours";
  const at = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "");
  const any = !!e && (e.leads || e.booked || e.quotesBackValue || e.paid || e.reviews);
  const figs = e ? [
    { n: e.afterHours || e.leads, label: e.afterHours ? "leads answered after hours" : "leads answered", show: true },
    { n: e.booked, label: e.booked === 1 ? "estimate booked" : "estimates booked", show: true },
    { n: e.quotesBackValue, label: "in quotes back", money: true, show: true },
    { n: e.paid, label: "paid to you", money: true, show: e.paid > 0 },
    { n: e.reviews, label: e.reviews === 1 ? "review ask sent" : "review asks sent", show: e.reviews > 0 && !(e.paid > 0) },
  ].filter(f => f.show).slice(0, 4) : [];
  async function toggle() {
    setBusy(true);
    try { await api("/api/app/act", { p: project, action: "setup", setup: { evening_text: txt ? "no" : "yes" } }); setTxt(!txt); toast(txt ? "No evening text." : "You'll get this as a text at 6 PM."); }
    catch (err) { toast(err instanceof Error ? err.message : "Didn't save.", true); } finally { setBusy(false); }
  }
  return <div className="today-top">
    <section className="speed panel">
      <span className="klab">Speed to first reply</span>
      <b className="speed-fig">{sec == null ? "–" : <CountUp value={sec} format={n => secText(Math.round(n))} ms={700} />}</b>
      <small>{sec == null ? "Shows once the first lead comes in" : `median, this week${L.leadsWeek ? `, ${L.leadsWeek} ${L.leadsWeek === 1 ? "lead" : "leads"}` : ""}`}</small>
    </section>
    {e && <section className={"wyw panel" + (any ? "" : " quiet")} aria-label={label}>
      <div className="wyw-h"><h2>{label}</h2><time>{at}</time></div>
      {any ? <div className="wyw-figs">{figs.map(f => <div key={f.label}><b><CountUp value={f.n} format={n => f.money ? usd(n) : Math.round(n).toLocaleString("en-US")} /></b><span>{f.label}</span></div>)}</div>
        : <p className="wyw-none">A quiet day. Every lead that comes in tonight gets an answer in seconds, and it shows up here.</p>}
      {owner && <button type="button" className="wyw-text" disabled={busy} onClick={() => void toggle()}>{busy ? <Spinner /> : <Icon name={txt ? "check" : "phone"} size={13} />}{txt ? "Texting you this at 6 PM" : "Text me this at 6 PM"}</button>}
    </section>}
  </div>;
}
