"use client";

// The owner's side of the CRM: the setup flow that tailors Cinder to their trade, and the Jobs board.
// Kept deliberately small: five stages, one card per customer, the job in the trade's own words.
import { useEffect, useMemo, useState } from "react";
import { CinderLogo } from "../cinder-brand";
import {
  ballpark, jobFields, LEAD_SOURCES, LEADS_MONTH, money, parsePriceBook, previewFirstText, PRIORITIES, rangeText, SOFTWARE, STAGE_LABEL, STAGES, TEAM_SIZES, TRADES, YEARS,
  draftItems, jobSteps, jobProgress, jobProfit, type Costs, type Card, type CardInvoice, type Details, type PriceBook, type Rate, type Stage,
} from "@/lib/crm";
import { dollars, totals, type Item } from "@/lib/billing";
import { IMPORT_BATCH, importSummary, readImportCsv, type ImportAs, type ImportRead } from "@/lib/customer-import";
import { BillingSettings, CustomersView, InvoiceSheet, InvoicesView, LineEditor, invoiceState, type Customer, type InvoiceRow } from "./billing-ui";

export type { Card };
export type Winback = { past: number; eligible: number; names: string[]; draft: string };
type Api = <T>(path: string, body?: unknown) => Promise<T>;
type Toast = (t: string, bad?: boolean) => void;

const fmtPhone = (p: string) => { const d = p.replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p; };
/** A soft avatar tone picked from the name, the way the CRM does it: same person, same color. */
const tone = (s: string) => [...(s || "#")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 6;
const initials = (s: string) => s.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "#";
const short = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : money(n);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(":00", "");
const SRC: Record<string, string> = { missed_call: "Missed call", "web chat": "Website chat", "web form": "Web form", text: "Text", quote: "Quote", owner: "Added by you", import: "Imported", angi: "Angi", thumbtack: "Thumbtack", facebook: "Facebook", google: "Google", yelp: "Yelp", rehash: "Old lead" };

function Svg({ d, size = 18 }: { d: React.ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}
const I = {
  plus: <path d="M12 5v14M5 12h14" />, upload: <><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></>, link: <><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.2 1.2" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.2-1.2" /></>,
  star: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />, send: <path d="M4 12 20 4l-4 16-4-7z M12 13l8-9" />, eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.6" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 13.6A5.5 5.5 0 0 1 20.5 19" /></>, x: <path d="M6 6l12 12M18 6 6 18" />, back: <path d="M15 5l-7 7 7 7" />, check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  ruler: <><rect x="3" y="8" width="18" height="8" rx="1.5" /><path d="M7 8v3M11 8v4M15 8v3M19 8v2" /></>, cal: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  dot: <circle cx="12" cy="12" r="3.5" />, dollar: <path d="M12 3v18M16.5 7.5c-.8-1.2-2.4-2-4.5-2-2.5 0-4 1.3-4 3s1.5 2.6 4 3 4 1.4 4 3.2-1.6 3.1-4.2 3.1c-2.2 0-3.8-.9-4.6-2.2" />,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>,
  chat: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 20 12z" />, phone: <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
};

// ---------- Setup ----------
type Setup = Record<string, string>;
const STEPS = ["business", "glance", "leads", "prices", "priority"] as const;
const FENCE_RATES = ["Wood privacy", "Vinyl", "Chain link", "Aluminum"];
const blankRows = (trade: string): Rate[] => (trade === "Fence" ? FENCE_RATES : ["Typical job"]).map(name => ({ name, low: 0, high: 0 }));

function Chips({ options, value, onPick, multi }: { options: readonly string[]; value: string; onPick: (v: string) => void; multi?: boolean }) {
  const on = (o: string) => multi ? value.split(",").map(s => s.trim()).includes(o) : value === o;
  return <div className="ob-chips" role={multi ? "group" : "radiogroup"}>{options.map(o =>
    <button key={o} type="button" role={multi ? undefined : "radio"} aria-checked={multi ? undefined : on(o)} aria-pressed={multi ? on(o) : undefined}
      className={on(o) ? "on" : ""} onClick={() => onPick(o)}>{o}{on(o) && multi && <Svg d={I.check} size={14} />}</button>)}</div>;
}

/** Jobber-style setup in Cinder's look: five short steps, a live preview of how Cinder will text their leads. */
export function Onboarding({ project, initial, api, onDone, onClose }: { project: string; initial: Setup; api: Api; onDone: (s: Setup) => void; onClose?: () => void }) {
  const [s, setS] = useState<Setup>(() => ({ ...initial, trade: initial.trade || "", share_ballpark: initial.share_ballpark || "yes" }));
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState(false);
  const book0 = parsePriceBook(initial.price_book);
  const [rows, setRows] = useState<Rate[]>(() => book0?.rates.length ? book0.rates : blankRows(initial.trade || "Fence"));
  const [gate, setGate] = useState<[string, string]>(() => book0?.gate ? [String(book0.gate[0]), String(book0.gate[1])] : ["", ""]);
  const fence = s.trade === "Fence";
  const set = (k: string, v: string) => { setS(x => ({ ...x, [k]: v })); setErr(""); };
  const toggle = (k: string, v: string) => { const list = (s[k] || "").split(",").map(x => x.trim()).filter(Boolean); set(k, (list.includes(v) ? list.filter(x => x !== v) : [...list, v]).join(", ")); };
  useEffect(() => { if (!book0) setRows(blankRows(s.trade || "Fence")); /* new trade, new rows */ // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const patch: Setup = { ...s, price_book: book ? JSON.stringify(book) : "" };
    if (last) patch.onboarded_at = new Date().toISOString();
    try { await api("/api/app/act", { p: project, action: "setup", setup: patch }); if (last) { setDone(true); onDone(patch); } else setStep(step + 1); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save. Try again."); }
    finally { setBusy(false); }
  }

  const first = (s.owner_name || "").trim().split(" ")[0];
  const preview = <aside className="ob-side" aria-hidden="true">
    <div className="ob-glow" />
    <div className="ob-prev">
      <p className="ob-prev-k">{key === "prices" ? "What a new lead hears about price" : key === "priority" ? "What Cinder does for you" : "How Cinder answers your next lead"}</p>
      {key === "priority" ? <ul className="ob-prev-list">
        <li><b>Every lead texted back</b><span>Calls you miss, forms, Angi and Facebook, in seconds.</span></li>
        <li><b>Estimate-ready jobs</b><span>{fence ? "Feet, material, gates and HOA" : "The job, size and address"}, before you call.</span></li>
        <li><b>Quotes chased for you</b><span>Until it&rsquo;s a yes or a no. Stops when they reply.</span></li>
      </ul> : <div className="ob-phone">
        <div className="ob-b in">{fence ? "Hi, I need a quote for a new fence in the backyard" : "Hi, can I get a quote?"}</div>
        <div className="ob-b out">{previewFirstText(s.display_name || "", s.trade)}</div>
        {key === "prices" && <><div className="ob-b in">{fence ? `About 150 ft of ${book?.rates[0]?.name.toLowerCase() || "wood privacy"}, 1 gate` : `${book?.rates[0]?.name || "A full job"}, please`}</div>
          <div className="ob-b out">{example ? `Thanks! For that, most jobs run ${rangeText(example)}. ${first || "We"} can come out to measure and give you an exact price. Does Thursday or Friday work?`
            : `Thanks! ${first || "We"} can come out for a free estimate. Does Thursday or Friday work?`}</div></>}
      </div>}
      <p className="ob-prev-foot">{key === "prices" ? (example && s.share_ballpark !== "no" ? "From your own prices. Never a firm quote." : "Add your prices and Cinder can give leads a ballpark.") : "From your business number, in seconds, day or night."}</p>
    </div>
  </aside>;

  if (done) return <div className="ob"><div className="ob-main"><div className="ob-in ob-done">
    <span className="ob-done-ic"><Svg d={I.check} size={28} /></span>
    <h1>You&rsquo;re set{first ? `, ${first}` : ""}.</h1>
    <p>Here&rsquo;s what happens next:</p>
    <ol className="ob-list">
      <li><b>Sam connects your number.</b><span>Usually within a day. You&rsquo;ll get a text when it&rsquo;s live.</span></li>
      <li><b>Every lead lands on your Jobs board.</b><span>{fence ? "With the feet, material, gates and HOA already filled in." : "With the job details already filled in."}</span></li>
      <li><b>You move a card when a job moves.</b><span>Quoted starts the follow-ups. Won stops them.</span></li>
    </ol>
    <button type="button" className="ob-go" onClick={onClose}>Go to my jobs</button>
  </div></div>{preview}</div>;

  return <div className="ob">
    <div className="ob-main"><div className="ob-in">
      <div className="ob-top"><CinderLogo className="ob-logo" ink="#121417" title="Cinder" />{onClose && <button type="button" className="ob-x" onClick={onClose} aria-label="Close setup"><Svg d={I.x} size={20} /></button>}</div>
      <div className="ob-prog" aria-label={`Step ${step + 1} of ${STEPS.length}`}>{STEPS.map((k, i) => <i key={k} className={i <= step ? "on" : ""} />)}</div>

      {key === "business" && <>
        <h1>Tell us about your business</h1>
        <p className="ob-sub">Cinder texts your customers as your business, so this is what they&rsquo;ll see.</p>
        <label className="ob-f"><span>Business name</span><input value={s.display_name || ""} onChange={e => set("display_name", e.target.value)} placeholder="Front Range Fence" autoFocus /></label>
        <label className="ob-f"><span>Your first name</span><input value={s.owner_name || ""} onChange={e => set("owner_name", e.target.value)} placeholder="Mike" /></label>
        <label className="ob-f"><span>Website <em>optional</em></span><input inputMode="url" value={s.website || ""} onChange={e => set("website", e.target.value)} placeholder="frontrangefence.com" /></label>
        <div className="ob-q"><b>What do you do?</b><Chips options={TRADES} value={s.trade || ""} onPick={v => set("trade", v)} /></div>
      </>}

      {key === "glance" && <>
        <h1>Your business at a glance</h1>
        <p className="ob-sub">So Cinder fits how big you are, not how big software companies want you to be.</p>
        <div className="ob-q"><b>How many people work at your company, including you?</b><Chips options={TEAM_SIZES} value={s.team_size || ""} onPick={v => set("team_size", v)} /></div>
        <div className="ob-q"><b>How long have you been in business?</b><Chips options={YEARS} value={s.years || ""} onPick={v => set("years", v)} /></div>
        <div className="ob-q"><b>About how many leads do you get a month?</b><Chips options={LEADS_MONTH} value={s.leads_month || ""} onPick={v => set("leads_month", v)} /></div>
      </>}

      {key === "leads" && <>
        <h1>Where do your leads come from?</h1>
        <p className="ob-sub">Cinder answers every one of these the same way: fast, from your number.</p>
        <div className="ob-q"><b>Pick all that apply</b><Chips multi options={LEAD_SOURCES} value={s.lead_sources || ""} onPick={v => toggle("lead_sources", v)} /></div>
        <div className="ob-q"><b>What do you run your jobs on today?</b><Chips options={SOFTWARE} value={s.software || ""} onPick={v => set("software", v)} /></div>
        {s.software && s.software !== "None, just my phone" && s.software !== "Spreadsheet or paper" && <p className="ob-note">{s.software === "Jobber" ? "Good: bookings can go straight into Jobber too. Sam connects it with you." : "Keep it. Sam can send your leads and bookings there too."}</p>}
        {(s.software === "None, just my phone" || s.software === "Spreadsheet or paper") && <p className="ob-note">Then Cinder&rsquo;s Jobs board is your CRM. No extra software to learn.</p>}
      </>}

      {key === "prices" && <>
        <h1>{fence ? "Your prices per foot" : "Your typical prices"}</h1>
        <p className="ob-sub">{fence ? "Rough installed prices. Cinder uses them to give new leads a ballpark, so you stop driving out to tire-kickers." : "Rough ranges. Cinder uses them to give new leads a ballpark before you call."}</p>
        <div className="ob-rates">
          <div className="ob-rate-h"><span>{fence ? "Fence type" : "Service"}</span><span>Low</span><span>High</span><span /></div>
          {rows.map((r, i) => <div key={i} className="ob-rate">
            <input aria-label="Name" value={r.name} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <label className="ob-money"><i>$</i><input aria-label={`${r.name} low`} inputMode="decimal" placeholder={fence ? "32" : "900"} value={r.low || ""} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, low: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } : x))} />{fence && <em>/ft</em>}</label>
            <label className="ob-money"><i>$</i><input aria-label={`${r.name} high`} inputMode="decimal" placeholder={fence ? "45" : "2,400"} value={r.high || ""} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, high: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } : x))} />{fence && <em>/ft</em>}</label>
            <button type="button" className="ob-rm" aria-label={`Remove ${r.name}`} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><Svg d={I.x} size={16} /></button>
          </div>)}
          {rows.length < 10 && <button type="button" className="ob-add" onClick={() => setRows(rs => [...rs, { name: "", low: 0, high: 0 }])}><Svg d={I.plus} size={16} />Add a {fence ? "fence type" : "service"}</button>}
          {fence && <div className="ob-rate gate"><span className="ob-gate-l">Each gate</span>
            <label className="ob-money"><i>$</i><input aria-label="Gate low" inputMode="decimal" placeholder="450" value={gate[0]} onChange={e => setGate([e.target.value.replace(/[^\d.]/g, ""), gate[1]])} /></label>
            <label className="ob-money"><i>$</i><input aria-label="Gate high" inputMode="decimal" placeholder="650" value={gate[1]} onChange={e => setGate([gate[0], e.target.value.replace(/[^\d.]/g, "")])} /></label><span /></div>}
        </div>
        <label className="ob-switch"><input type="checkbox" checked={s.share_ballpark !== "no"} onChange={e => set("share_ballpark", e.target.checked ? "yes" : "no")} />
          <span><b>Text new leads a ballpark range</b><small>Always a range, always &ldquo;final price after we measure.&rdquo; Turn it off and Cinder only books the estimate.</small></span></label>
      </>}

      {key === "priority" && <>
        <h1>{first ? `${first}, what` : "What"} matters most right now?</h1>
        <p className="ob-sub">Cinder does all of it. This decides what you see first.</p>
        <div className="ob-pri" role="radiogroup">{PRIORITIES.map(p => <button key={p.key} type="button" role="radio" aria-checked={s.priority === p.key} className={s.priority === p.key ? "on" : ""} onClick={() => set("priority", p.key)}>{p.label}</button>)}</div>
      </>}

      {err && <p className="ob-err" role="alert">{err}</p>}
      <div className="ob-btns">
        {step > 0 && <button type="button" className="ob-back" onClick={() => setStep(step - 1)}>Back</button>}
        {key === "prices" && !book && <button type="button" className="ob-skip" disabled={busy} onClick={() => void save(false)}>Add prices later</button>}
        <button type="button" className="ob-next" disabled={!ready || busy} onClick={() => void save(step === STEPS.length - 1)}>{busy ? <span className="ca-spin" /> : step === STEPS.length - 1 ? "Finish" : "Next"}</button>
      </div>
    </div></div>
    {preview}
  </div>;
}

// ---------- Jobs board ----------
const dateLabel = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const todayIso = () => new Date().toLocaleDateString("en-CA");
function cardTag(c: Card): { text: string; tone?: "blue" | "green" | "warn" } {
  if (c.pastCustomer) return { text: "Past customer", tone: "warn" };
  if (c.stage === "won") {
    if (c.reviewSent) return { text: "Review asked", tone: "green" };
    if (c.install && c.install >= todayIso()) return { text: `Install ${dateLabel(c.install)}`, tone: "blue" };
    return { text: "Won", tone: "green" };
  }
  if (c.stage === "lost") return { text: c.status === "opted_out" ? "Opted out" : "Lost" };
  if (c.quote && c.stage === "quoted") {
    if (c.quote.status === "replied") return { text: "They replied", tone: "warn" };
    if (c.quote.viewed) return { text: "Opened the quote", tone: "blue" };
    return { text: c.quote.steps ? `Follow-up ${c.quote.steps} of 4` : c.quote.linked ? "Quote texted" : "Follow-up in 2 days" };
  }
  if (c.next) return { text: when(c.next), tone: "blue" };
  if (c.status === "paused") return { text: "Needs you", tone: "warn" };
  return { text: SRC[c.source] ?? c.source };
}
const priceOf = (c: Card) => c.value ? short(c.value) : c.ballpark ? `~${short(c.ballpark.low)}–${short(c.ballpark.high).replace("$", "")}` : "";
type Biz = { reviewLink: boolean; number: boolean; owner: string; business: string; priceBook: string; taxRate: string; payLink: boolean; calendar: boolean };

export function JobsTab({ cards, trade, project, api, toast, reload, onOpen, canCall, wide, biz, winback, customers = [], invoices = [], setup = {}, focus = null }: { focus?: { card?: string; stage?: "quoted" | "won"; invoice?: string; view?: "pipeline" | "customers" | "invoices"; n: number } | null; cards: Card[]; trade: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onOpen: (id: string) => void; canCall: boolean; wide: boolean; biz: Biz; winback?: Winback; customers?: Customer[]; invoices?: InvoiceRow[]; setup?: Record<string, string> }) {
  const [sel, setSel] = useState<string | null>(null), [adding, setAdding] = useState(false), [importing, setImporting] = useState(false), [wb, setWb] = useState(false), [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<Stage | null>(null);
  const [view, setView] = useState<"pipeline" | "customers" | "invoices">("pipeline");
  const [inv, setInv] = useState<{ id: string; customer: string } | null>(null), [billing, setBilling] = useState(false);
  // The open invoice is read fresh from the latest data, so a save or a send shows straight away.
  const invNow = inv ? (invoices.find(i => i.id === inv.id) ?? cards.map(c => c.invoice).find(i => i?.id === inv.id) ?? null) : null;
  const owed = invoices.filter(i => i.status === "sent").length;
  // Opened from Today: jump straight to the card (and the quote or won form) or the invoice.
  useEffect(() => {
    if (!focus) return;
    if (focus.view) setView(focus.view);
    if (focus.card) { setView("pipeline"); setSel(focus.card); setPending(focus.stage ? { id: focus.card, stage: focus.stage } : null); }
    if (focus.invoice) { const i = invoices.find(x => x.id === focus.invoice); setInv({ id: focus.invoice, customer: i ? i.customer || fmtPhone(i.phone) : "" }); }
  }, [focus?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pending, setPending] = useState<{ id: string; stage: Stage } | null>(null);
  const [cust, setCust] = useState<string | null>(null);
  const custNow = cust ? customers.find(c => c.id === cust) ?? null : null;
  const by = useMemo(() => Object.fromEntries(STAGES.map(s => [s, cards.filter(c => c.stage === s)])) as Record<Stage, Card[]>, [cards]);
  const open = cards.filter(c => c.stage === "new" || c.stage === "booked" || c.stage === "quoted");
  const card = cards.find(c => c.id === sel) ?? null;

  async function move(id: string, stage: Stage) {
    const c = cards.find(x => x.id === id);
    if (!c || c.stage === stage) return;
    if (stage === "quoted" || stage === "won") { setSel(id); setPending({ id, stage }); return; } // asks for the amount
    try { await api("/api/app/act", { p: project, action: "stage", thread: id, stage }); toast(`Moved to ${STAGE_LABEL[stage]}.`); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); }
  }

  return <>
    <div className="ca-hello jb-hello">
      <div className="ca-seg jb-views" role="tablist" aria-label="View">{([["pipeline", "Pipeline"], ["customers", "Customers"], ["invoices", `Invoices${owed ? ` · ${owed}` : ""}`]] as const).map(([k, l]) =>
        <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div>
      <div className="jb-hello-acts">
        {view === "pipeline" && winback && winback.past > 0 && <button type="button" className="jb-ghost" onClick={() => setWb(true)}><Svg d={I.users} size={16} />Past customers</button>}
        {view === "invoices" && <button type="button" className="jb-ghost" onClick={() => setBilling(true)}>Pay link and tax</button>}
        {view !== "invoices" && <button type="button" className="jb-ghost" onClick={() => setImporting(true)}><Svg d={I.upload} size={16} />Import</button>}
        {view !== "invoices" && <button type="button" className="jb-add" onClick={() => setAdding(true)}><Svg d={I.plus} size={16} />Add lead</button>}
      </div>
    </div>
    {view === "customers" && <CustomersView list={customers} onOpen={c => setCust(c.id)} />}
    {view === "invoices" && <InvoicesView list={invoices} onOpen={i => setInv({ id: i.id, customer: i.customer || fmtPhone(i.phone) })} />}
    {view === "pipeline" && <>
    <div className={"jb-board" + (wide ? " wide" : "")}>
      {STAGES.map(stage => { const list = by[stage]; const total = list.reduce((a, c) => a + (c.value ?? 0), 0); return <section key={stage} id={"jb-col-" + stage} className={"jb-col" + (over === stage ? " over" : "")} aria-label={STAGE_LABEL[stage]}
        onDragOver={e => { if (drag) { e.preventDefault(); setOver(stage); } }} onDragLeave={() => setOver(o => o === stage ? null : o)}
        onDrop={e => { e.preventDefault(); setOver(null); if (drag) void move(drag, stage); setDrag(null); }}>
        <h2><span>{STAGE_LABEL[stage]}<em>{list.length}</em></span><b>{total ? short(total) : "–"}</b></h2>
        {list.length ? <ul>{list.map(c => { const tag = cardTag(c); return <li key={c.id}>
          <button type="button" className="jb-card" draggable={wide} onDragStart={() => setDrag(c.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => { setPending(null); setSel(c.id); }}>
            <span className="jb-name"><span className="ca-av xs" data-tone={tone(c.name || c.phone)} aria-hidden="true">{initials(c.name || "#")}</span>{c.name || fmtPhone(c.phone)}</span>
            <span className="jb-attr"><Svg d={I.ruler} size={14} /><span>{c.line || (c.notes ? c.notes.slice(0, 60) : "No job details yet")}</span></span>
            <span className={"jb-attr" + (tag.tone ? " " + tag.tone : "")}><Svg d={tag.tone === "blue" ? I.cal : tag.tone === "green" ? I.check : I.dot} size={14} /><span>{tag.text}</span></span>
            {priceOf(c) && <span className="jb-attr"><Svg d={I.dollar} size={14} /><span className={c.value ? "v" : "est"}>{priceOf(c)}{c.value ? "" : " ballpark"}</span></span>}
          </button></li>; })}</ul>
          : <p className="jb-empty">{stage === "new" ? "New leads land here." : stage === "booked" ? "Booked estimates." : stage === "quoted" ? "Quotes Cinder is chasing." : stage === "won" ? "Jobs you won." : "Lost or not a fit."}</p>}
      </section>; })}
    </div>
    </>}
    {card && <CardSheet key={card.id} card={card} trade={trade} project={project} api={api} toast={toast} reload={reload} onOpen={onOpen} canCall={canCall} biz={biz}
      onInvoice={i => { setSel(null); setPending(null); setInv({ id: i.id, customer: card.name || fmtPhone(card.phone) }); }}
      pending={pending?.id === card.id ? pending.stage : null} onClose={() => { setSel(null); setPending(null); }} />}
    {custNow && <CustomerSheet c={custNow} card={cards.find(x => x.id === custNow.id) ?? null} trade={trade} invoices={invoices.filter(i => i.thread_id === custNow.id)} canCall={canCall}
      onClose={() => setCust(null)} onText={() => { setCust(null); onOpen(custNow.id); }} onJob={() => { setCust(null); setPending(null); setSel(custNow.id); }}
      onInvoice={i => { setCust(null); setInv({ id: i.id, customer: custNow.name || fmtPhone(custNow.phone) }); }}
      call={() => void api("/api/app/act", { p: project, action: "call", thread: custNow.id }).then(() => toast("Calling your cell now."), e => toast(e instanceof Error ? e.message : "That didn't work.", true))} />}
    {adding && <AddLead trade={trade} project={project} api={api} toast={toast} reload={reload} onClose={() => setAdding(false)} />}
    {importing && <ImportSheet project={project} api={api} toast={toast} reload={reload} customers={customers} business={biz.business} onClose={() => setImporting(false)} />}
    {inv && invNow && <InvoiceSheet key={invNow.id + invNow.status} inv={invNow} customer={inv.customer} project={project} api={api} toast={toast} reload={reload} payLink={biz.payLink} onClose={() => setInv(null)} onSetup={() => setBilling(true)} />}
    {billing && <BillingSettings setup={setup} project={project} api={api} toast={toast} reload={reload} onClose={() => setBilling(false)} />}
    {wb && winback && <WinbackSheet w={winback} biz={biz} project={project} api={api} toast={toast} reload={reload} onClose={() => setWb(false)} />}
  </>;
}

function Sheet({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, [onClose]);
  return <div className="jb-scrim" onClick={onClose}><div className="jb-sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
    <div className="jb-sheet-h">{title}<button type="button" className="jb-x" onClick={onClose} aria-label="Close"><Svg d={I.x} size={20} /></button></div>
    <div className="jb-sheet-b">{children}</div></div></div>;
}

function DetailFields({ trade, d, set }: { trade: string; d: Record<string, string>; set: (k: string, v: string) => void }) {
  return <div className="jb-fields">{jobFields(trade).map(f => <label key={f.key} className={"jb-f" + (f.key === "address" ? " full" : "")}><span>{f.label}</span>
    {f.kind === "choice" ? <select value={d[f.key] ?? ""} onChange={e => set(f.key, e.target.value)}><option value="">–</option>{f.options!.map(o => <option key={o}>{o}</option>)}</select>
      : <span className="jb-in"><input inputMode={f.kind === "number" ? "decimal" : undefined} value={d[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} placeholder="Not set" />{f.unit && <em>{f.unit}</em>}</span>}
  </label>)}</div>;
}
const asStrings = (d: Details) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)]));
const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

function Toggle({ on, set, title, sub, disabled }: { on: boolean; set: (v: boolean) => void; title: string; sub?: React.ReactNode; disabled?: boolean }) {
  return <label className={"jb-toggle" + (disabled ? " off" : "")}><input type="checkbox" checked={on && !disabled} disabled={disabled} onChange={e => set(e.target.checked)} />
    <i aria-hidden="true" /><span><b>{title}</b>{sub && <small>{sub}</small>}</span></label>;
}

function CardSheet({ card, trade, project, api, toast, reload, onOpen, onClose, canCall, pending, biz, onInvoice }: { card: Card; trade: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onOpen: (id: string) => void; onClose: () => void; canCall: boolean; pending: Stage | null; biz: Biz; onInvoice: (inv: CardInvoice) => void }) {
  const [d, setD] = useState<Record<string, string>>(() => asStrings(card.details));
  const [value, setValue] = useState(card.value ? String(card.value) : ""), [notes, setNotes] = useState(card.notes);
  const [ask, setAsk] = useState<Stage | null>(pending), [amt, setAmt] = useState(card.value ? String(card.value) : card.quote?.amount ? String(card.quote.amount) : ""), [busy, setBusy] = useState(""), [arm, setArm] = useState(false);
  const canText = biz.number && card.status !== "opted_out";
  const q = card.quote;
  // The quote's lines: what he saved, else a first draft from what Cinder learned and his own prices. He checks every line.
  const [items, setItems] = useState<Item[]>(() => q?.items?.length ? q.items : draftItems(trade, card.details, biz.priceBook));
  const [tax, setTax] = useState<number>(() => q?.items?.length ? q.tax : Number(biz.taxRate) || 0);
  const [editLines, setEditLines] = useState(false);
  const [incl, setIncl] = useState(q?.note ?? "");
  const [install, setInstall] = useState(card.install ?? ""), [itime, setItime] = useState(card.installTime ?? ""), [idays, setIdays] = useState(String(card.installDays || 1));
  const [review, setReview] = useState(card.stage === "won" ? card.reviewAuto : biz.reviewLink);
  const installDirty = install !== (card.install ?? "") || itime !== (card.installTime ?? "") || idays !== String(card.installDays || 1);
  const dirty = JSON.stringify(d) !== JSON.stringify(asStrings(card.details)) || value !== (card.value ? String(card.value) : "") || notes !== card.notes || (card.stage === "won" && review !== card.reviewAuto);
  const name = card.name || fmtPhone(card.phone), firstName = (card.name || "").split(" ")[0] || "them";
  const quoteTotal = totals(items.filter(i => i.name.trim()), tax).total;
  async function act(key: string, body: Record<string, unknown>, done: string | ((r: { sent?: boolean; warn?: string; link?: string; calendar?: string; invoice?: CardInvoice }) => string), close = false) {
    setBusy(key);
    try {
      const r = await api<{ sent?: boolean; warn?: string; link?: string; calendar?: string; invoice?: CardInvoice }>("/api/app/act", { p: project, thread: card.id, ...body });
      const msg = typeof done === "string" ? done : done(r);
      toast(msg, (!!r.warn && !r.sent) || r.calendar === "failed"); await reload(); if (close) onClose(); setAsk(null); return r;
    } catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); return null; }
    finally { setBusy(""); setArm(false); }
  }
  async function copy() {
    const r = card.quote?.url ? { link: card.quote.url } : await act("copy", { action: "quotelink", send: false, note: incl }, "Link ready.");
    if (!r?.link) return;
    try { await navigator.clipboard.writeText(r.link); toast("Quote link copied."); } catch { prompt("Copy the quote link:", r.link); }
  }
  const calMsg = (c?: string) => c === "added" ? " On your Google Calendar." : c === "removed" ? " Taken off your calendar." : c === "not_connected" ? " Connect Google Calendar to put it there." : c === "failed" ? " It didn't save to your calendar; try again." : "";
  const pick = (s: Stage) => { if (s === card.stage) return; if (s === "quoted" || s === "won") { setAsk(s); if (s === "won" && !amt && q?.amount) setAmt(String(q.amount)); return; } if (s === "lost" && !arm) { setArm(true); return; } void act("stage", { action: "stage", stage: s }, `Moved to ${STAGE_LABEL[s]}.`); };
  const lines = <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} />;
  const installFields = <div className="jb-three">
    <label className="jb-f"><span>Install day</span><span className="jb-in"><input type="date" value={install} onChange={e => setInstall(e.target.value)} /></span></label>
    <label className="jb-f"><span>Start</span><span className="jb-in"><input type="time" value={itime} onChange={e => setItime(e.target.value)} disabled={!install || idays !== "1"} /></span></label>
    <label className="jb-f"><span>Days</span><select value={idays} onChange={e => setIdays(e.target.value)} disabled={!install}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
  </div>;
  return <Sheet onClose={onClose} title={<div className="jb-who"><span className="ca-av sm" data-tone={tone(name)} aria-hidden="true">{initials(name)}</span><span><b>{name}</b><small><a href={`tel:${card.phone}`}>{fmtPhone(card.phone)}</a> · {SRC[card.source] ?? card.source}</small></span></div>}>
    <div className="jb-acts">
      <button type="button" onClick={() => { onClose(); onOpen(card.id); }}><Svg d={I.chat} size={16} />Conversation</button>
      {canCall ? <button type="button" disabled={!!busy} onClick={() => void act("call", { action: "call" }, "Calling your cell now.")}><Svg d={I.phone} size={16} />Call</button>
        : <a href={`tel:${card.phone}`}><Svg d={I.phone} size={16} />Call</a>}
    </div>
    <div className="jb-stages" role="radiogroup" aria-label="Stage">{STAGES.map(s => <button key={s} type="button" role="radio" aria-checked={card.stage === s} className={(card.stage === s ? "on " : "") + (ask === s ? "ask" : "")} disabled={!!busy} onClick={() => pick(s)}>{s === "lost" && arm ? "Tap again" : STAGE_LABEL[s]}</button>)}</div>

    {ask === "quoted" && <form className="jb-amt" onSubmit={e => e.preventDefault()}>
      <p className="jb-amt-k">The quote</p>
      {lines}
      <label style={{ marginTop: 12 }}><span>What&rsquo;s included <em>optional, they&rsquo;ll see it</em></span><textarea rows={2} value={incl} maxLength={600} onChange={e => setIncl(e.target.value)} placeholder="Tear-out and haul-away, steel posts in concrete, 2-year warranty" /></label>
      <p>Follow-ups on day 2, 5, 10 and 21 after you send.</p>
      <div className="jb-amt-row">
        <button type="button" onClick={() => setAsk(null)}>Cancel</button>
        <button type="button" disabled={!!busy || quoteTotal <= 0} onClick={() => void act("save", { action: "stage", stage: "quoted", amount: String(quoteTotal), items, tax, note: incl }, `Quote saved: ${dollars(quoteTotal)}. Not sent yet.`)}>Save</button>
        <button type="button" className="go" disabled={!!busy || !canText || quoteTotal <= 0} onClick={() => void act("stage", { action: "stage", stage: "quoted", amount: String(quoteTotal), items, tax, note: incl, link: true },
          r => r.sent ? `Quote texted to ${firstName}: ${dollars(quoteTotal)}.` : r.warn || "Saved.")}>{busy === "stage" ? <span className="ca-spin" /> : `Send ${dollars(quoteTotal)}`}</button>
      </div>
    </form>}
    {ask === "won" && <form className="jb-amt" onSubmit={e => { e.preventDefault(); void act("stage", { action: "stage", stage: "won", amount: amt, install: install || null, time: itime || null, days: Number(idays), review: review && biz.reviewLink },
      r => `Marked won.${calMsg(r.calendar)}${review && biz.reviewLink && install ? " Review ask goes out the morning after." : ""}`); }}>
      <label><span>Job amount</span><span className="jb-in"><i>$</i><input inputMode="decimal" autoFocus placeholder="7,400" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.,kK]/g, ""))} /></span></label>
      <div style={{ marginTop: 12 }}>{installFields}</div>
      {!biz.calendar && <p>Connect Google Calendar to add installs to it.</p>}
      <Toggle on={review} set={setReview} disabled={!biz.reviewLink} title="Ask for a Google review"
        sub={!biz.reviewLink ? "Needs your Google review link." : install ? "Morning after the install." : "Set an install day."} />
      <div className="jb-amt-row"><button type="button" onClick={() => setAsk(null)}>Cancel</button><button type="submit" className="go" disabled={!!busy}>{busy ? <span className="ca-spin" /> : "Mark won"}</button></div>
    </form>}

    {!ask && card.stage === "quoted" && q && <section className="jb-box">
      <div className="jb-box-h"><b>The quote{q.amount ? ` · ${dollars(q.amount)}` : ""}</b>
        <span className={"jb-pill" + (q.viewed ? " blue" : "")}>{q.status === "replied" ? "They replied" : q.viewed ? <><Svg d={I.eye} size={13} />Opened {ago(q.viewed)}</> : q.linked ? "Texted, not opened yet" : "Not sent yet"}</span></div>
      {editLines ? <div style={{ marginTop: 12 }}>{lines}</div>
        : q.items.length > 0 && <ul className="jb-lines">{q.items.map((i, k) => <li key={k}><span>{i.name}<small>{i.qty !== 1 || i.unit ? `${i.qty}${i.unit ? " " + i.unit : ""} × ${dollars(i.price)}` : ""}</small></span><b>{dollars(i.qty * i.price)}</b></li>)}</ul>}
      {q.note && !editLines && <p className="jb-box-p">{q.note}</p>}
      <p className="jb-box-s">{!q.linked ? "Not sent." : q.steps ? `Follow-up ${q.steps} of 4 sent.` : "First follow-up in 2 days."}</p>
      <div className="jb-box-acts">
        {editLines ? <>
          <button type="button" disabled={!!busy} onClick={() => setEditLines(false)}>Cancel</button>
          <button type="button" className="go" disabled={!!busy || quoteTotal <= 0} onClick={async () => { if (await act("lines", { action: "quotelines", items, tax, note: incl }, `Quote updated: ${dollars(quoteTotal)}.`)) setEditLines(false); }}>Save lines</button>
        </> : <>
          <button type="button" className="go" disabled={!!busy || !canText} onClick={() => void act("send", { action: "quotelink", note: incl }, r => r.sent ? `Quote texted to ${firstName}.` : r.warn || "Saved.")}>
            {busy === "send" ? <span className="ca-spin" /> : <><Svg d={I.send} size={15} />{q.linked ? "Text it again" : `Send to ${firstName}`}</>}</button>
          <button type="button" disabled={!!busy} onClick={() => setEditLines(true)}>Edit lines</button>
          <button type="button" disabled={!!busy} onClick={() => void copy()}><Svg d={I.link} size={15} />Copy link</button>
        </>}
      </div>
    </section>}

    {!ask && card.stage === "won" && !card.pastCustomer && <>
      <JobTracker card={card} trade={trade} busy={busy} tick={(step, done) => void act("step:" + step, { action: "jobstep", step, done }, done ? "Done." : "Unticked.")} />
      <section className="jb-box">
        <div className="jb-box-h"><b>Install</b>{card.install ? <span className={"jb-pill" + (card.onCalendar ? " green" : "")}>{card.onCalendar ? "On Google Calendar" : "Not on a calendar"}</span> : null}</div>
        <div style={{ marginTop: 12 }}>{installFields}</div>
        {installDirty && <div className="jb-box-acts"><button type="button" className="go" disabled={!!busy} onClick={() => void act("install", { action: "install", install: install || null, time: itime || null, days: Number(idays) },
          r => (install ? `Install set for ${dateLabel(install)}.` : "Install date cleared.") + calMsg(r.calendar))}>{busy === "install" ? <span className="ca-spin" /> : install ? "Save install" : "Clear install"}</button></div>}
      </section>
      <section className="jb-box">
        <div className="jb-box-h"><b>Invoice</b>{card.invoice && <span className={"jb-pill " + invoiceState(card.invoice).tone}>{invoiceState(card.invoice).text}</span>}</div>
        {card.invoice ? <>
          <p className="jb-box-s">#{card.invoice.number} · {dollars(card.invoice.total)}{card.invoice.status === "sent" && card.invoice.due_on ? ` · due ${dateLabel(card.invoice.due_on)}` : ""}</p>
          <div className="jb-box-acts"><button type="button" className="go" onClick={() => onInvoice(card.invoice!)}>Open invoice</button></div>
        </> : <>
          <p className="jb-box-s">Pulls the lines from the quote.</p>
          <div className="jb-box-acts"><button type="button" className="go" disabled={!!busy} onClick={async () => { const r = await act("invoice", { action: "invoice" }, "Invoice drafted."); if (r?.invoice) onInvoice(r.invoice); }}>
            {busy === "invoice" ? <span className="ca-spin" /> : "Create invoice"}</button></div>
        </>}
      </section>
      <section className="jb-box">
        <div className="jb-box-h"><b>Review</b>{card.reviewSent ? <span className="jb-pill green"><Svg d={I.star} size={13} />Asked {ago(card.reviewSent)}</span> : null}</div>
        {!card.reviewSent && <Toggle on={review} set={setReview} disabled={!biz.reviewLink} title="Ask for a Google review"
          sub={!biz.reviewLink ? "Needs your Google review link." : card.install ? `Goes out ${dateLabel(new Date(Date.parse(card.install + "T12:00:00") + 86400000).toLocaleDateString("en-CA"))}.` : "Set an install day."} />}
        {!card.reviewSent && biz.reviewLink && <div className="jb-box-acts">
          <button type="button" disabled={!!busy || !canText} onClick={() => arm ? void act("review", { action: "reviewnow" }, `Review request sent to ${firstName}.`) : setArm(true)}>
            {busy === "review" ? <span className="ca-spin" /> : <><Svg d={I.star} size={15} />{arm ? "Tap to send it now" : "Job done, ask now"}</>}</button>
        </div>}
      </section>
      <CostBox card={card} busy={busy} save={c => void act("costs", { action: "jobcosts", costs: c }, "Costs saved.")} />
    </>}

    {card.ballpark && (card.stage === "new" || card.stage === "booked") && !ask && <p className="jb-bp">Ballpark from your prices: <b>{rangeText(card.ballpark)}</b></p>}
    <h3 className="jb-h3">The job</h3>
    <DetailFields trade={trade} d={d} set={(k, v) => setD(x => ({ ...x, [k]: v }))} />
    <label className="jb-f full"><span>Job value</span><span className="jb-in"><i>$</i><input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(/[^\d.,kK]/g, ""))} placeholder="What it's worth to you" /></span></label>
    <label className="jb-f full"><span>Notes</span><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gate on the left side, dog in the yard, HOA needs drawings…" /></label>
    <div className="jb-save"><button type="button" className="go" disabled={!dirty || !!busy} onClick={() => void act("save", { action: "card", details: d, value: value || null, notes, ...(card.stage === "won" ? { review } : {}) }, "Saved.")}>Save</button></div>
  </Sheet>;
}

/** One customer, everything about them: how to reach them, where they live, what they've bought, what they owe. */
function CustomerSheet({ c, card, trade, invoices, canCall, onClose, onText, onJob, onInvoice, call }: { c: Customer; card: Card | null; trade: string; invoices: InvoiceRow[]; canCall: boolean;
  onClose: () => void; onText: () => void; onJob: () => void; onInvoice: (i: InvoiceRow) => void; call: () => void }) {
  const name = c.name || fmtPhone(c.phone);
  const since = new Date(c.since).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const p = card && card.stage === "won" && !card.pastCustomer ? jobProgress(trade, card) : null;
  const stageText = card ? (card.pastCustomer ? "Came back" : STAGE_LABEL[card.stage]) : null;
  const price = card ? card.invoice?.total || card.value || card.quote?.amount || null : null;
  return <Sheet onClose={onClose} title={<div className="jb-who"><span className="ca-av sm" data-tone={tone(name)} aria-hidden="true">{initials(name)}</span><span><b>{name}</b><small>{SRC[c.source] ?? c.source} · since {since}</small></span></div>}>
    <div className="cs-acts">
      <button type="button" onClick={onText}><Svg d={I.chat} size={17} />Text</button>
      {canCall ? <button type="button" onClick={call}><Svg d={I.phone} size={17} />Call</button> : <a href={`tel:${c.phone}`}><Svg d={I.phone} size={17} />Call</a>}
      {c.address ? <a href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer"><Svg d={I.pin} size={17} />Directions</a>
        : <button type="button" disabled><Svg d={I.pin} size={17} />No address</button>}
    </div>
    <dl className="cs-facts">
      <div><dt>Phone</dt><dd><a href={`tel:${c.phone}`}>{fmtPhone(c.phone)}</a></dd></div>
      {c.address && <div><dt>Address</dt><dd>{c.address}</dd></div>}
      {card?.notes && <div><dt>Notes</dt><dd>{card.notes}</dd></div>}
    </dl>
    <dl className="jt-profit cs-money"><div><dt>Billed</dt><dd>{dollars(c.spent)}</dd></div><div><dt>Jobs</dt><dd>{c.jobs}</dd></div><div className={c.owed > 0 ? "down" : ""}><dt>Owes you</dt><dd>{dollars(c.owed)}</dd></div></dl>

    <h3 className="jb-h3">Jobs</h3>
    {card ? <button type="button" className="cs-row" onClick={onJob}>
      <span className="cs-row-t"><b>{card.line || "Job details not filled in"}</b><small>{stageText}{p ? ` · ${p.next ? `next: ${p.next}` : "paid in full"}` : card.install ? ` · install ${dateLabel(card.install)}` : ""}</small>
        {p && <span className="jt-bar" aria-hidden="true"><i style={{ width: `${(p.done / p.total) * 100}%` }} /></span>}</span>
      <span className="cs-row-n">{price ? dollars(price) : ""}</span></button>
      : <p className="jb-box-s">No job on the board for {name.split(" ")[0]} right now.</p>}

    {invoices.length > 0 && <><h3 className="jb-h3">Invoices</h3>
      {invoices.map(i => { const st = invoiceState(i); return <button key={i.id} type="button" className="cs-row" onClick={() => onInvoice(i)}>
        <span className="cs-row-t"><b>Invoice #{i.number}</b><small className={"bl-st " + st.tone}>{st.text}</small></span><span className="cs-row-n">{dollars(i.total)}</span></button>; })}</>}
  </Sheet>;
}

/** Won to paid, one step at a time. The owner ticks steps; the invoice steps tick themselves. */
function JobTracker({ card, trade, busy, tick }: { card: Card; trade: string; busy: string; tick: (step: string, done: boolean) => void }) {
  const steps = jobSteps(trade, card.details);
  const p = jobProgress(trade, card);
  const inv = card.invoice, sent = !!inv && inv.status !== "draft" && inv.status !== "void", paid = inv?.status === "paid";
  const nextKey = steps.find(s => !card.job[s.key])?.key;
  return <section className="jb-box jt">
    <div className="jb-box-h"><b>The job</b><span className={"jb-pill" + (p.next ? "" : " green")}>{p.next ? `${p.done} of ${p.total} done` : "Paid in full"}</span></div>
    <div className="jt-bar" aria-hidden="true"><i style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
    <ol className="jt-steps">
      {steps.map(s => { const on = card.job[s.key]; return <li key={s.key} className={on ? "done" : s.key === nextKey ? "next" : ""}>
        <button type="button" role="checkbox" aria-checked={!!on} disabled={!!busy} onClick={() => tick(s.key, !on)}>
          <span className="jt-check" aria-hidden="true">{busy === "step:" + s.key ? <span className="ca-spin" /> : on ? <Svg d={I.check} size={13} /> : null}</span>
          <span className="jt-t"><b>{s.label}</b>{on ? <small>{dateLabel(on)}</small> : s.key === nextKey && s.hint ? <small>{s.hint}</small> : null}</span>
        </button></li>; })}
      <li className={"auto " + (sent ? "done" : steps.every(s => card.job[s.key]) ? "next" : "")}><div><span className="jt-check" aria-hidden="true">{sent ? <Svg d={I.check} size={13} /> : null}</span>
        <span className="jt-t"><b>Invoice sent</b><small>{sent && inv?.sent_at ? dateLabel(inv.sent_at.slice(0, 10)) : "Ticks itself when you send the invoice."}</small></span></div></li>
      <li className={"auto " + (paid ? "done" : sent ? "next" : "")}><div><span className="jt-check" aria-hidden="true">{paid ? <Svg d={I.check} size={13} /> : null}</span>
        <span className="jt-t"><b>Paid</b><small>{paid && inv?.paid_at ? dateLabel(inv.paid_at.slice(0, 10)) : "Ticks itself when you mark the invoice paid."}</small></span></div></li>
    </ol>
  </section>;
}

/** What the job cost, and what it made. Three numbers, no spreadsheet. */
function CostBox({ card, busy, save }: { card: Card; busy: string; save: (c: Costs) => void }) {
  const [c, setC] = useState({ materials: card.costs.materials ? String(card.costs.materials) : "", labor: card.costs.labor ? String(card.costs.labor) : "", other: card.costs.other ? String(card.costs.other) : "" });
  const num = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;
  const now = { materials: num(c.materials), labor: num(c.labor), other: num(c.other) };
  const dirty = now.materials !== card.costs.materials || now.labor !== card.costs.labor || now.other !== card.costs.other;
  const price = card.invoice?.total || card.value || card.quote?.amount || null;
  const pr = jobProfit(price, now);
  const f = (k: keyof typeof c, label: string) => <label className="jb-f"><span>{label}</span><span className="jb-in"><i>$</i><input inputMode="decimal" placeholder="0" value={c[k]} onChange={e => setC(x => ({ ...x, [k]: e.target.value.replace(/[^\d.,]/g, "") }))} /></span></label>;
  return <section className="jb-box">
    <div className="jb-box-h"><b>Costs and profit</b>{pr && <span className={"jb-pill " + (pr.profit >= 0 ? "green" : "red")}>{pr.margin}% margin</span>}</div>
    <div className="jb-three" style={{ marginTop: 12 }}>{f("materials", "Materials")}{f("labor", "Labor")}{f("other", "Other")}</div>
    {pr ? <dl className="jt-profit"><div><dt>Price</dt><dd>{dollars(price!)}</dd></div><div><dt>Cost</dt><dd>{dollars(pr.cost)}</dd></div><div className={pr.profit >= 0 ? "up" : "down"}><dt>Profit</dt><dd>{dollars(pr.profit)}</dd></div></dl>
      : <p className="jb-box-s">Add what you spent and you&rsquo;ll see what this job made.</p>}
    {dirty && <div className="jb-box-acts"><button type="button" className="go" disabled={!!busy} onClick={() => save(now)}>{busy === "costs" ? <span className="ca-spin" /> : "Save costs"}</button></div>}
  </section>;
}

function WinbackSheet({ w, biz, project, api, toast, reload, onClose }: { w: Winback; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const [body, setBody] = useState(w.draft), [busy, setBusy] = useState(false), [arm, setArm] = useState(false), [err, setErr] = useState("");
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 5000); return () => clearTimeout(t); }, [arm]);
  const sample = w.names[0] || "Dana";
  const preview = body.replace(/\s*\{first\}(?=[,!.?])/g, " " + sample).replace(/\{first\}/g, sample).replace(/\{business\}/g, biz.business).replace(/\{owner\}/g, biz.owner);
  const many = w.eligible === 1 ? "1 customer" : `${w.eligible} customers`;
  return <Sheet onClose={onClose} title={<div className="jb-who"><span><b>Text past customers</b><small>Won jobs, 30+ days old</small></span></div>}>
    <div className="wb-count">
      <div><b>{w.past}</b><span>past {w.past === 1 ? "customer" : "customers"}</span></div>
      <div className="on"><b>{w.eligible}</b><span>can get this text</span></div>
    </div>
    <p className="jb-fine wb-why">Only customers who opted in to offers on your form. Max one text every 90 days.</p>
    {w.eligible > 0 ? <>
      <label className="jb-f full"><span>Your text <em>{body.length}/320</em></span><textarea rows={4} value={body} maxLength={320} onChange={e => { setBody(e.target.value); setErr(""); setArm(false); }} /></label>
      <p className="wb-tip">{"{first}"} = their first name.</p>
      <div className="wb-prev" aria-label="Preview"><span>{sample}&rsquo;s phone</span><div className="ob-b out">{preview}{"\n\n"}Reply STOP to opt out.</div></div>
      {err && <p className="ca-err" role="alert">{err}</p>}
      <div className="jb-save"><button type="button" className="go" disabled={busy || body.trim().length < 20} onClick={async () => {
        if (!arm) { setArm(true); return; }
        setBusy(true); setErr("");
        try { const r = await api<{ sent: number; left: number }>("/api/app/act", { p: project, action: "winback", body }); toast(`Sent to ${r.sent} ${r.sent === 1 ? "customer" : "customers"}.${r.left ? ` ${r.left} more tomorrow.` : ""}`); await reload(); onClose(); }
        catch (e) { setErr(e instanceof Error ? e.message : "Didn't send."); } finally { setBusy(false); setArm(false); }
      }}>{busy ? <span className="ca-spin" /> : arm ? `Tap again to text ${many}` : `Send to ${many}`}</button></div>
    </> : <div className="wb-none"><b>No one to text yet</b><p>Customers who opt in on your website form show up here.</p></div>}
  </Sheet>;
}

// ---------- Import customers ----------
/**
 * The owner's existing customers, from a Jobber export or any spreadsheet saved as CSV. The file is read right here
 * in the browser so they see what's in it before anything is saved: who's ready, who's already on the board, who has
 * no phone. Then it goes up in batches. Nobody gets a text.
 */
function ImportSheet({ project, api, toast, reload, onClose, customers, business }: { project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void; customers: Customer[]; business: string }) {
  const [read, setRead] = useState<ImportRead | null>(null), [fileName, setFileName] = useState(""), [err, setErr] = useState("");
  const [as, setAs] = useState<ImportAs>("customers"), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(0);
  const [paste, setPaste] = useState(false), [text, setText] = useState("");
  const here = useMemo(() => new Set(customers.map(c => c.phone.replace(/\D/g, "").slice(-10))), [customers]);
  const load = (name: string, body: string) => { const r = readImportCsv(body); if ("error" in r) { setRead(null); setErr(r.error); } else { setRead(r); setErr(""); setFileName(name); } };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5_000_000) { setErr("That file is over 5 MB. Export a smaller list, or just the tags you need."); return; }
    f.text().then(t => load(f.name, t), () => setErr("Couldn't read that file."));
  };
  const already = read ? read.rows.filter(r => here.has(r.phone.slice(-10))).length : 0;
  async function go() {
    if (!read) return;
    setBusy(true); setErr(""); setDone(0);
    let added = 0, existing = 0;
    try {
      for (let i = 0; i < read.rows.length; i += IMPORT_BATCH) {
        const r = await api<{ added: number; existing: number }>("/api/app/act", { p: project, action: "import", rows: read.rows.slice(i, i + IMPORT_BATCH), as, consent: as === "customers" && consent, from: read.jobber ? "jobber" : "csv" });
        added += r.added; existing += r.existing; setDone(Math.min(read.rows.length, i + IMPORT_BATCH));
      }
      toast(importSummary({ added, existing, skipped: read.skipped.length, as }));
      await reload(); onClose();
    } catch (e) {
      setErr((e instanceof Error ? e.message : "That didn't work.") + (added ? ` ${added} went in before it stopped. Running the same file again is safe: nobody is added twice.` : ""));
    } finally { setBusy(false); }
  }
  return <Sheet onClose={onClose} title={<div className="jb-who"><span><b>Import customers</b><small>From Jobber or any spreadsheet</small></span></div>}>
    {!read ? <>
      <label className="im-drop">
        <input type="file" accept=".csv,text/csv,text/plain" onChange={e => onFile(e.target.files?.[0])} aria-label="Choose a CSV file" />
        <Svg d={I.upload} size={24} /><b>Choose a CSV file</b>
        <small>In Jobber: Clients, then More actions, then Export. Any spreadsheet saved as CSV works too.</small>
      </label>
      <p className="jb-fine">Each row needs a phone number. Names, addresses, emails, tags and notes come along when they&rsquo;re there. Nobody gets a text.</p>
      {paste ? <>
        <label className="jb-f full"><span>Rows</span><textarea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={"Name, Phone, Address\nDana Ruiz, (720) 555-0177, 2210 Oak Dr"} /></label>
        <div className="jb-save"><button type="button" className="go" disabled={!text.trim()} onClick={() => load("Pasted rows", text)}>Read rows</button></div>
      </> : <button type="button" className="ca-text-btn im-paste" onClick={() => setPaste(true)}>Or paste rows from a spreadsheet</button>}
      {err && <p className="ca-err" role="alert">{err}</p>}
    </> : <>
      <div className="jb-box im-sum">
        <div className="jb-box-h"><b>{fileName}</b><button type="button" className="ca-text-btn" onClick={() => { setRead(null); setErr(""); }}>Change file</button></div>
        <dl className="im-counts">
          <div><dt>Ready</dt><dd>{read.rows.length - already}</dd></div>
          {already > 0 && <div><dt>Already here</dt><dd>{already}</dd></div>}
          {read.skipped.length > 0 && <div><dt>No phone</dt><dd>{read.skipped.length}</dd></div>}
          {read.duplicates > 0 && <div><dt>Repeats</dt><dd>{read.duplicates}</dd></div>}
        </dl>
        {read.jobber && <p className="jb-fine">Looks like a Jobber export.</p>}
      </div>
      <ul className="im-rows" aria-label="First rows">{read.rows.slice(0, 6).map(r => <li key={r.phone}>
        <span className="ca-av xs" data-tone={tone(r.name || r.phone)} aria-hidden="true">{initials(r.name || "#")}</span>
        <span className="im-row-t"><b>{r.name || fmtPhone(r.phone)}</b><small>{[fmtPhone(r.phone), r.address].filter(Boolean).join(" · ")}</small></span>
        {here.has(r.phone.slice(-10)) && <span className="jb-tag">Already here</span>}
      </li>)}
        {read.rows.length > 6 && <li className="im-more">and {read.rows.length - 6} more</li>}</ul>
      {read.skipped.length > 0 && <details className="im-skipped"><summary>{read.skipped.length} skipped with no phone number</summary>
        <ul>{read.skipped.slice(0, 25).map(s => <li key={s.line}>Row {s.line}: {s.name}</li>)}{read.skipped.length > 25 && <li>and {read.skipped.length - 25} more</li>}</ul></details>}
      <h3 className="jb-h3">They are</h3>
      <div className="ca-seg wide" role="radiogroup" aria-label="Import as">
        <button type="button" role="radio" aria-checked={as === "customers"} className={as === "customers" ? "on" : ""} onClick={() => setAs("customers")}>Past customers</button>
        <button type="button" role="radio" aria-checked={as === "leads"} className={as === "leads" ? "on" : ""} onClick={() => setAs("leads")}>Open leads</button>
      </div>
      <p className="jb-fine">{as === "customers" ? "They go in Customers as past customers. They stay off the Jobs board until they text in or you move them." : "They land in New on the Jobs board as yours. Cinder won\u2019t text them."}</p>
      {as === "customers" && <label className="im-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span><b>They agreed to get texts from {business || "you"}</b><small>Tick this only if they opted in. It goes on each number&rsquo;s consent record and lets your win-back texts reach them.</small></span></label>}
      {err && <p className="ca-err" role="alert">{err}</p>}
      <div className="jb-save"><button type="button" className="go" disabled={busy || !read.rows.length} onClick={() => void go()}>
        {busy ? `Importing ${done} of ${read.rows.length}\u2026` : `Import ${read.rows.length} ${as === "leads" ? (read.rows.length === 1 ? "lead" : "leads") : (read.rows.length === 1 ? "customer" : "customers")}`}</button></div>
    </>}
  </Sheet>;
}

function AddLead({ trade, project, api, toast, reload, onClose }: { trade: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [d, setD] = useState<Record<string, string>>({}), [notes, setNotes] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10})/, "");
  return <Sheet onClose={onClose} title={<div className="jb-who"><span><b>Add a lead</b><small>Calls, referrals, walk-ins</small></span></div>}>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setErr("");
      try { await api("/api/app/act", { p: project, action: "lead", name, phone: digits, details: d, notes }); toast("Added to New."); await reload(); onClose(); }
      catch (er) { setErr(er instanceof Error ? er.message : "Couldn't add it."); } finally { setBusy(false); } }}>
      <div className="jb-fields">
        <label className="jb-f full"><span>Name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Dana Ruiz" autoFocus /></label>
        <label className="jb-f full"><span>Phone</span><input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(720) 555-0148" /></label>
      </div>
      <h3 className="jb-h3">The job</h3>
      <DetailFields trade={trade} d={d} set={(k, v) => setD(x => ({ ...x, [k]: v }))} />
      <label className="jb-f full"><span>Notes</span><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <p className="jb-fine">Cinder won&rsquo;t text leads you add.</p>
      {err && <p className="ca-err" role="alert">{err}</p>}
      <div className="jb-save"><button type="submit" className="go" disabled={busy || digits.length !== 10}>Add lead</button></div>
    </form>
  </Sheet>;
}
