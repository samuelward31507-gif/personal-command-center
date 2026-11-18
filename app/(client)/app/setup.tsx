"use client";

// Setup: five short steps that tailor Cinder to the owner's trade, with a live preview of how Cinder will text
// their leads. Shown once; reopened from settings to change prices or details.
import { useEffect, useMemo, useRef, useState } from "react";
import { ballpark, LEAD_SOURCES, LEADS_MONTH, parsePriceBook, parseTeam, previewFirstText, PRIORITIES, rangeText, SOFTWARE, TEAM_SIZES, TRADES, YEARS, type PriceBook, type Rate } from "@/lib/crm";
import { Wordmark } from "../brand";
import { Icon, Spinner, type Api } from "./parts";

type Setup = Record<string, string>;
const STEPS = ["business", "glance", "leads", "prices", "day", "priority", "watch"] as const;
const HOURS = ["Mon-Fri 7:00-17:00", "Mon-Fri 7:00-18:00, Sat 8:00-12:00", "Mon-Sat 8:00-18:00"];
const COLORS = ["#c2410c", "#2f6b4f", "#1d4ed8", "#7c3aed", "#b91c1c", "#334155"];
type Crew = { name: string; cell: string };
const FENCE_RATES = ["Wood privacy", "Vinyl", "Chain link", "Aluminum"];
const blankRows = (trade: string): Rate[] => (trade === "Fence" ? FENCE_RATES : ["Typical job"]).map(name => ({ name, low: 0, high: 0 }));

function Chips({ options, value, onPick, multi }: { options: readonly string[]; value: string; onPick: (v: string) => void; multi?: boolean }) {
  const on = (o: string) => multi ? value.split(",").map(s => s.trim()).includes(o) : value === o;
  return <div className="chips" role={multi ? "group" : "radiogroup"}>{options.map(o =>
    <button key={o} type="button" role={multi ? undefined : "radio"} aria-checked={multi ? undefined : on(o)} aria-pressed={multi ? on(o) : undefined} className={on(o) ? "on" : ""} onClick={() => onPick(o)}>{o}{on(o) && multi && <Icon name="check" size={13} />}</button>)}</div>;
}

export function Onboarding({ project, initial, api, onDone, onClose }: { project: string; initial: Setup; api: Api; onDone: (s: Setup) => void; onClose?: () => void }) {
  const [s, setS] = useState<Setup>(() => ({ ...initial, trade: initial.trade || "", share_ballpark: initial.share_ballpark || "yes" }));
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState(false);
  const book0 = parsePriceBook(initial.price_book);
  const [rows, setRows] = useState<Rate[]>(() => book0?.rates.length ? book0.rates : blankRows(initial.trade || "Fence"));
  const [gate, setGate] = useState<[string, string]>(() => book0?.gate ? [String(book0.gate[0]), String(book0.gate[1])] : ["", ""]);
  const fence = s.trade === "Fence";
  const [crew, setCrew] = useState<Crew[]>(() => { const t = parseTeam(initial.team).filter(m => m.role === "crew").map(m => ({ name: m.name, cell: m.cell.replace(/^\+1/, "") })); return t.length ? t : [{ name: "", cell: "" }]; });
  const set = (k: string, v: string) => { setS(x => ({ ...x, [k]: v })); setErr(""); };
  const toggle = (k: string, v: string) => { const list = (s[k] || "").split(",").map(x => x.trim()).filter(Boolean); set(k, (list.includes(v) ? list.filter(x => x !== v) : [...list, v]).join(", ")); };
  useEffect(() => { if (!book0) setRows(blankRows(s.trade || "Fence")); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.trade]);
  const book: PriceBook | null = useMemo(() => {
    const rates = rows.filter(r => r.name.trim() && r.low > 0 && r.high >= r.low);
    const g: [number, number] | undefined = Number(gate[0]) > 0 && Number(gate[1]) >= Number(gate[0]) ? [Number(gate[0]), Number(gate[1])] : undefined;
    return rates.length ? { unit: fence ? "ft" : "job", rates, gate: fence ? g : undefined } : null;
  }, [rows, gate, fence]);
  const example = book ? ballpark(book, fence ? { length_ft: 150, material: book.rates[0].name, gates: 1 } : { service: book.rates[0].name }) : null;
  const key = STEPS[step];
  const ready = key === "business" ? !!(s.display_name?.trim() && s.owner_name?.trim() && s.trade) : key === "priority" ? !!s.priority : true;
  async function save(last: boolean) {
    setBusy(true); setErr("");
    const people = crew.filter(m => m.name.trim() && m.cell.replace(/\D/g, "").length >= 10);
    const kept = parseTeam(initial.team).filter(m => m.role === "office" || m.role === "owner");
    const patch: Setup = { ...s, price_book: book ? JSON.stringify(book) : "", ...(key === "day" ? { team: JSON.stringify([...kept, ...people.map(m => ({ name: m.name.trim(), cell: m.cell, role: "crew" as const }))]) } : {}) };
    if (last) patch.onboarded_at = new Date().toISOString();
    try { await api("/api/app/act", { p: project, action: "setup", setup: patch }); if (last) { setDone(true); onDone(patch); } else setStep(step + 1); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save. Try again."); }
    finally { setBusy(false); }
  }
  const first = (s.owner_name || "").trim().split(" ")[0];
  const preview = <aside className="ob-side" aria-hidden="true"><div className="prev">
    <p className="k">{key === "prices" ? "What a new lead hears about price" : key === "priority" ? "What Cinder does for you" : key === "day" ? "Your quotes and booking page" : "How Cinder answers your next lead"}</p>
    {key === "day" ? <div className="ob-brand" style={{ ["--b" as string]: s.brand_color || "#c2410c" }}>
      <b>{s.display_name || "Your business"}</b><span>Quote for 150 ft cedar privacy</span><i>Approve the quote</i><small>{s.hours ? `Open ${s.hours}` : "Your hours here"}</small>
    </div> : key === "priority" ? <ul>
      <li><b>Every lead texted back</b><span>Calls you miss, forms, Angi and Facebook, in seconds.</span></li>
      <li><b>Estimate-ready jobs</b><span>{fence ? "Feet, material, gates and HOA" : "The job, size and address"}, before you call.</span></li>
      <li><b>Quotes chased for you</b><span>Until it&rsquo;s a yes or a no. Stops when they reply.</span></li>
    </ul> : <div className="phone">
      <span className="bubble">{fence ? "Hi, I need a quote for a new fence in the backyard" : "Hi, can I get a quote?"}</span>
      <span className="bubble out">{previewFirstText(s.display_name || "", s.trade)}</span>
      {key === "prices" && <><span className="bubble">{fence ? `About 150 ft of ${book?.rates[0]?.name.toLowerCase() || "wood privacy"}, 1 gate` : `${book?.rates[0]?.name || "A full job"}, please`}</span>
        <span className="bubble out">{example ? `Thanks! For that, most jobs run ${rangeText(example)}. ${first || "We"} can come out to measure and give you an exact price. Does Thursday or Friday work?` : `Thanks! ${first || "We"} can come out for a free estimate. Does Thursday or Friday work?`}</span></>}
    </div>}
    <p className="foot">{key === "day" ? "Your color on everything customers see. Change it any time in Settings." : key === "prices" ? (example && s.share_ballpark !== "no" ? "From your own prices. Never a firm quote." : "Add your prices and Cinder can give leads a ballpark.") : "From your business number, in seconds, day or night."}</p>
  </div></aside>;

  if (done) return <div className="ob"><div className="ob-main"><div className="ob-in done">
    <span className="ic ok" style={{ width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center" }}><Icon name="check" size={22} /></span>
    <h1>You&rsquo;re set{first ? `, ${first}` : ""}.</h1>
    <p className="sub" style={{ marginTop: 0 }}>Here&rsquo;s what happens next:</p>
    <ol>
      <li><b>Sam connects your number.</b><span>Usually within a day. You&rsquo;ll get a text when it&rsquo;s live.</span></li>
      <li><b>Every lead lands in Jobs.</b><span>{fence ? "With the feet, material, gates and HOA already filled in." : "With the job details already filled in."}</span></li>
      <li><b>You move a job when it moves.</b><span>Quoted starts the follow-ups. Won stops them.</span></li>
    </ol>
    <button type="button" className="btn ink lg" onClick={onClose}>Go to my jobs</button>
  </div></div>{preview}</div>;

  return <div className="ob">
    <div className="ob-main"><div className="ob-in">
      <div className="ob-top"><Wordmark className="word" />{onClose && <button type="button" className="btn ghost ic" onClick={onClose} aria-label="Close setup"><Icon name="x" size={18} /></button>}</div>
      <div className="prog" aria-label={`Step ${step + 1} of ${STEPS.length}`}>{STEPS.map((k, i) => <i key={k} className={i <= step ? "on" : ""} />)}</div>

      {key === "business" && <>
        <h1>Tell us about your business</h1>
        <p className="sub">Cinder texts your customers as your business, so this is what they&rsquo;ll see.</p>
        <label className="field"><span>Business name</span><input value={s.display_name || ""} onChange={e => set("display_name", e.target.value)} placeholder="Front Range Fence" autoFocus /></label>
        <label className="field"><span>Your first name</span><input value={s.owner_name || ""} onChange={e => set("owner_name", e.target.value)} placeholder="Mike" /></label>
        <label className="field"><span>Website <em>optional</em></span><input inputMode="url" value={s.website || ""} onChange={e => set("website", e.target.value)} placeholder="frontrangefence.com" /></label>
        <div className="q"><b>What do you do?</b><Chips options={TRADES} value={s.trade || ""} onPick={v => set("trade", v)} /></div>
      </>}
      {key === "glance" && <>
        <h1>Your business at a glance</h1>
        <p className="sub">So Cinder fits how big you are, not how big software companies want you to be.</p>
        <div className="q"><b>How many people work at your company, including you?</b><Chips options={TEAM_SIZES} value={s.team_size || ""} onPick={v => set("team_size", v)} /></div>
        <div className="q"><b>How long have you been in business?</b><Chips options={YEARS} value={s.years || ""} onPick={v => set("years", v)} /></div>
        <div className="q"><b>About how many leads do you get a month?</b><Chips options={LEADS_MONTH} value={s.leads_month || ""} onPick={v => set("leads_month", v)} /></div>
      </>}
      {key === "leads" && <>
        <h1>Where do your leads come from?</h1>
        <p className="sub">Cinder answers every one of these the same way: fast, from your number.</p>
        <div className="q"><b>Pick all that apply</b><Chips multi options={LEAD_SOURCES} value={s.lead_sources || ""} onPick={v => toggle("lead_sources", v)} /></div>
        <div className="q"><b>What do you run your jobs on today?</b><Chips options={SOFTWARE} value={s.software || ""} onPick={v => set("software", v)} /></div>
        {s.software && s.software !== "None, just my phone" && s.software !== "Spreadsheet or paper" && <p className="note">{s.software === "Jobber" ? "Good: you can import your Jobber customers in one step, and bookings can go into Jobber too. Sam connects it with you." : "Keep it. Sam can send your leads and bookings there too."}</p>}
        {(s.software === "None, just my phone" || s.software === "Spreadsheet or paper") && <p className="note">Then Cinder is your CRM. No extra software to learn.</p>}
      </>}
      {key === "prices" && <>
        <h1>{fence ? "Your prices per foot" : "Your typical prices"}</h1>
        <p className="sub">{fence ? "Rough installed prices. Cinder uses them to give new leads a ballpark, so you stop driving out to tire-kickers." : "Rough ranges. Cinder uses them to give new leads a ballpark before you call."}</p>
        <div className="rates">
          <div className="rh"><span>{fence ? "Fence type" : "Service"}</span><span>Low</span><span>High</span><span /></div>
          {rows.map((r, i) => <div key={i} className="rr">
            <input className="input" aria-label="Name" value={r.name} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <label className="inwrap"><i>$</i><input aria-label={`${r.name} low`} inputMode="decimal" placeholder={fence ? "32" : "900"} value={r.low || ""} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, low: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } : x))} />{fence && <em>/ft</em>}</label>
            <label className="inwrap"><i>$</i><input aria-label={`${r.name} high`} inputMode="decimal" placeholder={fence ? "45" : "2,400"} value={r.high || ""} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, high: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } : x))} />{fence && <em>/ft</em>}</label>
            <button type="button" className="btn ghost ic" aria-label={`Remove ${r.name}`} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><Icon name="x" size={15} /></button>
          </div>)}
          {rows.length < 10 && <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setRows(rs => [...rs, { name: "", low: 0, high: 0 }])}><Icon name="plus" size={14} />Add a {fence ? "fence type" : "service"}</button>}
          {fence && <div className="rr"><span className="t-em" style={{ fontSize: 13 }}>Each gate</span>
            <label className="inwrap"><i>$</i><input aria-label="Gate low" inputMode="decimal" placeholder="450" value={gate[0]} onChange={e => setGate([e.target.value.replace(/[^\d.]/g, ""), gate[1]])} /></label>
            <label className="inwrap"><i>$</i><input aria-label="Gate high" inputMode="decimal" placeholder="650" value={gate[1]} onChange={e => setGate([gate[0], e.target.value.replace(/[^\d.]/g, "")])} /></label><span /></div>}
        </div>
        <label className="toggle"><input type="checkbox" checked={s.share_ballpark !== "no"} onChange={e => set("share_ballpark", e.target.checked ? "yes" : "no")} /><i /><span><b>Text new leads a ballpark range</b><small>Always a range, always &ldquo;final price after we measure.&rdquo; Turn it off and Cinder only books the estimate.</small></span></label>
      </>}
      {key === "priority" && <>
        <h1>{first ? `${first}, what` : "What"} matters most right now?</h1>
        <p className="sub">Cinder does all of it. This decides what you see first.</p>
        <div className="pri" role="radiogroup">{PRIORITIES.map(p => <button key={p.key} type="button" role="radio" aria-checked={s.priority === p.key} className={s.priority === p.key ? "on" : ""} onClick={() => set("priority", p.key)}>{p.label}</button>)}</div>
      </>}

      {key === "day" && <>
        <h1>Your hours, color and crew</h1>
        <p className="sub">Hours decide which estimate times leads are offered. Your color goes on your quotes, invoices and booking page.</p>
        <div className="q"><b>When can you do estimates?</b><Chips options={HOURS} value={s.hours || ""} onPick={v => set("hours", v)} />
          <input className="input" aria-label="Hours" value={s.hours || ""} onChange={e => set("hours", e.target.value)} placeholder="Mon-Fri 7:00-17:00, Sat 8:00-12:00" /></div>
        <div className="q"><b>Your business color</b><div className="ob-colors" role="radiogroup" aria-label="Business color">{COLORS.map(c =>
          <button key={c} type="button" role="radio" aria-checked={(s.brand_color || "").toLowerCase() === c} aria-label={c} style={{ background: c }} onClick={() => set("brand_color", c)}>{(s.brand_color || "").toLowerCase() === c && <Icon name="check" size={14} />}</button>)}
          <label className="ob-pick"><input type="color" value={s.brand_color || "#c2410c"} onChange={e => set("brand_color", e.target.value)} aria-label="Pick any color" /><span>Other</span></label></div></div>
        <div className="q"><b>Your crew <em className="mut" style={{ fontStyle: "normal", fontWeight: 400 }}>optional</em></b>
          <p className="fine" style={{ margin: 0 }}>They sign in with their cell and see the schedule and their jobs, not your money. Nobody gets a text from this.</p>
          {crew.map((m, i) => <div key={i} className="ob-crew">
            <input className="input" aria-label={`Crew member ${i + 1} name`} placeholder="Name" value={m.name} onChange={e => setCrew(cs => cs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <input className="input" aria-label={`Crew member ${i + 1} cell`} inputMode="tel" placeholder="Cell" value={m.cell} onChange={e => setCrew(cs => cs.map((x, j) => j === i ? { ...x, cell: e.target.value } : x))} />
            <button type="button" className="btn ghost ic" aria-label={`Remove crew member ${i + 1}`} onClick={() => setCrew(cs => cs.length > 1 ? cs.filter((_, j) => j !== i) : [{ name: "", cell: "" }])}><Icon name="x" size={15} /></button></div>)}
          {crew.length < 8 && <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setCrew(cs => [...cs, { name: "", cell: "" }])}><Icon name="plus" size={14} />Add someone</button>}
        </div>
      </>}
      {key === "watch" && <Practice project={project} api={api} s={s} />}

      {err && <p className="err" role="alert">{err}</p>}
      <div className="btns">
        {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>Back</button>}
        {key === "prices" && !book && <button type="button" className="btn ghost" disabled={busy} onClick={() => void save(false)}>Add prices later</button>}
        <button type="button" className="btn ink" disabled={!ready || busy} onClick={() => void save(step === STEPS.length - 1)}>{busy ? <Spinner /> : step === STEPS.length - 1 ? "Finish" : "Next"}</button>
      </div>
    </div></div>
    {key === "watch" ? null : preview}
  </div>;
}

/**
 * The first-day practice lead: a made-up homeowner texts in, and the owner watches the reply engine answer, give a
 * ballpark from his prices, offer two of his open times and book one. Nothing is saved and nobody is texted.
 */
function Practice({ project, api, s }: { project: string; api: Api; s: Setup }) {
  type Msg = { direction: "in" | "out"; body: string };
  const fence = s.trade === "Fence";
  const script = fence
    ? ["Hi, I need a quote for a new fence in my backyard.", `About 150 feet of 6 ft cedar privacy with one walk gate. No HOA. It's 1420 Maple St${s.service_area ? `, ${s.service_area.split(/,| and /)[0].trim()}` : ""}. Hoping to have it done next month.`, "The first time you said works for me.", "Yes please, book it."]
    : ["Hi, can I get a quote?", `It's a ${(s.trade || "home service").toLowerCase()} job at 1420 Maple St, as soon as you can.`, "The first time you said works for me.", "Yes please, book it."];
  const [msgs, setMsgs] = useState<Msg[]>([]), [state, setState] = useState<"" | "typing" | "booked" | "handoff" | "stopped" | "failed">(""), [booked, setBooked] = useState("");
  const [first, setFirst] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs, state]);
  async function run() {
    let h: Msg[] = [], known: Record<string, unknown> = {};
    setMsgs([]); setBooked(""); setState("typing");
    for (let i = 0; i < script.length; i++) {
      h = [...h, { direction: "in", body: script[i] }]; setMsgs(h); setState("typing");
      const t0 = Date.now();
      try {
        const r = await api<{ reply: string; stage: string; handoff: boolean; booked: string | null; known: Record<string, unknown> }>("/api/app/act", { p: project, action: "rehearse", history: h, known });
        if (i === 0) setFirst(Math.max(1, Math.round((Date.now() - t0) / 1000)));
        known = r.known ?? known;
        if (r.reply) { h = [...h, { direction: "out", body: r.reply }]; setMsgs(h); }
        if (r.booked || r.stage === "booked") { setBooked(r.booked || "the time they picked"); setState("booked"); return; }
        if (r.handoff) { setState("handoff"); return; }
      } catch { setState("failed"); return; }
    }
    setState("stopped");
  }
  return <>
    <h1>Watch your first lead get booked</h1>
    <p className="sub">A practice lead texts in. Cinder answers it the way it will answer every real one: your prices, your hours, your open times. Nobody is texted and nothing is saved.</p>
    <div className="ob-chat" aria-live="polite">
      {!msgs.length && !state && <p className="mut">The homeowner&rsquo;s texts are on the left, your business&rsquo;s replies on the right.</p>}
      {msgs.map((m, i) => <span key={i} className={"bubble" + (m.direction === "out" ? " out" : "")}>{m.body}</span>)}
      {state === "typing" && <span className="bubble out typing" aria-label="Replying"><i /><i /><i /></span>}
      <div ref={end} />
    </div>
    {state === "booked" ? <p className="note ok">Booked: {booked}, first reply in {first} {first === 1 ? "second" : "seconds"}. That&rsquo;s every lead, day or night, from your number. This one was practice: nothing is on your calendar.</p>
      : state === "handoff" ? <p className="note">Cinder handed this one to you, the way it will when a lead needs a person. Your rules for that are in Settings.</p>
      : state === "failed" ? <p className="note">The practice lead couldn&rsquo;t run just now. You can finish; real leads are answered the same way once your number is connected.</p>
      : state === "stopped" ? <p className="note">It didn&rsquo;t book in four texts. Check your hours in the last step: leads are only offered times inside them.</p> : null}
    {state !== "typing" && <button type="button" className={"btn" + (state ? "" : " ink")} style={{ alignSelf: "flex-start" }} onClick={() => void run()}>{state ? "Run it again" : "Send the practice lead"}</button>}
  </>;
}
