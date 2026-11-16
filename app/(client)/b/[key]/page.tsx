"use client";

// The business's own booking page, made for a phone. Pick a day, pick a time, leave a name, cell and address, done.
// The times are the owner's real free slots. Without a connected calendar it becomes "ask for a time".
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import "../../doc.css";

type Page = { business: string; owner: string; trade: string; area: string; phone: string; calendar: boolean; slots: { start: string; end: string }[] };
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const dayName = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
const dayNum = (iso: string) => new Date(iso).getDate();
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const longWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
const Check = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

export default function BookPage() {
  const { key } = useParams<{ key: string }>();
  const [p, setP] = useState<Page | null>(null), [err, setErr] = useState("");
  const [day, setDay] = useState(""), [slot, setSlot] = useState<string | null>(null), [step, setStep] = useState<"time" | "you" | "done">("time");
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [address, setAddress] = useState(""), [message, setMessage] = useState(""), [consent, setConsent] = useState(false), [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false), [fail, setFail] = useState(""), [when, setWhen] = useState(""), [booked, setBooked] = useState(false);
  useEffect(() => {
    fetch("/api/book?key=" + encodeURIComponent(key), { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "This booking page isn't available."); setP(j); if (!j.calendar || !j.slots.length) setStep("you"); })
      .catch(e => setErr(e instanceof Error ? e.message : "This booking page isn't available."));
  }, [key]);
  const days = useMemo(() => { const m = new Map<string, string[]>(); for (const s of p?.slots ?? []) { const k = dayKey(s.start); m.set(k, [...(m.get(k) ?? []), s.start]); } return [...m.entries()]; }, [p]);
  useEffect(() => { if (!day && days.length) setDay(days[0][0]); }, [days, day]);
  const biz = p?.business.replace(/\.+$/, "") || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setFail("");
    try {
      const r = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, start: slot, name, phone, address, message, consent, website: hp }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "That didn't go through.");
      setBooked(!!j.booked); setWhen(j.when || (slot ? longWhen(slot) : "")); setStep("done");
    } catch (er) { setFail(er instanceof Error ? er.message : "That didn't go through."); } finally { setBusy(false); }
  }

  return <main className="doc">
    {err ? <section className="doc-card doc-msg"><h1>This page isn&rsquo;t available</h1><p>{err}</p></section>
      : !p ? <section className="doc-card doc-load" aria-busy="true"><i className="skel" /><i className="skel" /><i className="skel" /></section>
      : <>
        <header className="doc-biz"><span className="doc-mono" aria-hidden="true">{biz.charAt(0)}</span><b>{p.business}</b></header>
        <section className="doc-card">
          {step === "done" ? <div className="doc-done ok"><span><Check /></span><div>
            <b>{booked ? "You're booked." : "Got it, thank you."}</b>
            <p>{booked ? `${when}. ${p.owner ? p.owner + " will" : "We'll"} come out, measure and give you a price. A confirmation text is on its way.` : `${p.owner || "We"} will text you shortly to set a time.`}</p>
          </div></div>
          : step === "time" ? <>
            <div><p className="doc-k">Free estimate{p.trade ? `, ${p.trade.toLowerCase()}` : ""}</p><h1 className="bk-h">Pick a time</h1>{p.area && <p className="doc-fine" style={{ textAlign: "left" }}>We serve {p.area}.</p>}</div>
            <div className="bk-days" role="tablist" aria-label="Day">{days.map(([k, list]) => <button key={k} type="button" role="tab" aria-selected={day === k} className={day === k ? "on" : ""} onClick={() => { setDay(k); setSlot(null); }}>
              <small>{dayName(list[0])}</small><b>{dayNum(list[0])}</b></button>)}</div>
            <div className="bk-times">{(days.find(d => d[0] === day)?.[1] ?? []).map(s => <button key={s} type="button" className={slot === s ? "on" : ""} onClick={() => setSlot(s)}>{time(s)}</button>)}</div>
            <div className="doc-acts">
              <button type="button" className="btn ink lg" disabled={!slot} onClick={() => setStep("you")}>{slot ? `Continue with ${longWhen(slot)}` : "Pick a time"}</button>
              <button type="button" className="link" style={{ alignSelf: "center", fontSize: 14 }} onClick={() => { setSlot(null); setStep("you"); }}>None of these work</button>
            </div>
          </>
          : <form className="bk-form" onSubmit={submit}>
            <div><p className="doc-k">{slot ? longWhen(slot) : "Ask for a time"}</p><h1 className="bk-h">Your details</h1></div>
            {slot && <button type="button" className="link" style={{ alignSelf: "flex-start", fontSize: 13 }} onClick={() => setStep("time")}>Change the time</button>}
            <label className="doc-sign"><span>Name</span><input className="input" required value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={80} /></label>
            <label className="doc-sign"><span>Cell</span><input className="input" required type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="(720) 555-0100" /></label>
            <label className="doc-sign"><span>Address of the job</span><input className="input" value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address" maxLength={160} /></label>
            <label className="doc-sign"><span>What do you need? <em>optional</em></span><textarea className="input" rows={3} style={{ height: "auto", padding: 10 }} value={message} onChange={e => setMessage(e.target.value)} maxLength={600} placeholder="About 120 ft of 6 ft cedar along the back, one gate" /></label>
            <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={e => setHp(e.target.value)} aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
            <label className="bk-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>{biz || "The business"} can text me about this estimate. Msg and data rates may apply. Reply STOP to opt out.</span></label>
            <div className="doc-acts"><button type="submit" className="btn ink lg" disabled={busy || !name.trim() || !phone.trim() || !consent}>{busy ? "Booking…" : slot ? "Book it" : "Send my request"}</button></div>
            {fail && <p className="err" role="alert" style={{ textAlign: "center" }}>{fail}</p>}
          </form>}
        </section>
        <p className="doc-foot">{p.phone ? <>Questions? Text <a href={`sms:${p.phone}`} style={{ color: "inherit" }}>{biz}</a>. </> : null}Booking by Cinder</p>
      </>}
  </main>;
}
