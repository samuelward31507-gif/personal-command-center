"use client";

// The owner's side of the CRM: the setup flow that tailors Cinder to their trade, and the Jobs board.
// Kept deliberately small: five stages, one card per customer, the job in the trade's own words.
import { useEffect, useMemo, useState } from "react";
import { CinderLogo } from "../cinder-brand";
import {
  ballpark, jobFields, LEAD_SOURCES, LEADS_MONTH, money, parsePriceBook, previewFirstText, PRIORITIES, rangeText, SOFTWARE, STAGE_LABEL, STAGES, TEAM_SIZES, TRADES, YEARS,
  type Details, type PriceBook, type Rate, type Stage,
} from "@/lib/crm";

export type Card = { id: string; name: string; phone: string; source: string; status: string; stage: Stage; details: Details; line: string; value: number | null;
  ballpark: { low: number; high: number } | null; notes: string; quote: { id: string; amount: number | null; status: string; steps: number } | null; next: string | null; at: string };
type Api = <T>(path: string, body?: unknown) => Promise<T>;
type Toast = (t: string, bad?: boolean) => void;

const fmtPhone = (p: string) => { const d = p.replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p; };
const initials = (s: string) => s.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "#";
const short = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : money(n);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(":00", "");
const SRC: Record<string, string> = { missed_call: "Missed call", "web chat": "Website chat", "web form": "Web form", text: "Text", quote: "Quote", owner: "Added by you", angi: "Angi", thumbtack: "Thumbtack", facebook: "Facebook", google: "Google", yelp: "Yelp", rehash: "Old lead" };

function Svg({ d, size = 18 }: { d: React.ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}
const I = {
  plus: <path d="M12 5v14M5 12h14" />, x: <path d="M6 6l12 12M18 6 6 18" />, back: <path d="M15 5l-7 7 7 7" />, check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
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
function cardTag(c: Card): { text: string; tone?: "blue" | "green" | "warn" } {
  if (c.stage === "won") return { text: "Won", tone: "green" };
  if (c.stage === "lost") return { text: c.status === "opted_out" ? "Opted out" : "Lost" };
  if (c.quote && c.stage === "quoted") return c.quote.status === "replied" ? { text: "They replied", tone: "warn" } : { text: c.quote.steps ? `Follow-up ${c.quote.steps} of 4` : "Follow-up in 2 days" };
  if (c.next) return { text: when(c.next), tone: "blue" };
  if (c.status === "paused") return { text: "Needs you", tone: "warn" };
  return { text: SRC[c.source] ?? c.source };
}
const priceOf = (c: Card) => c.value ? short(c.value) : c.ballpark ? `~${short(c.ballpark.low)}–${short(c.ballpark.high).replace("$", "")}` : "";

export function JobsTab({ cards, trade, project, api, toast, reload, onOpen, canCall, wide }: { cards: Card[]; trade: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onOpen: (id: string) => void; canCall: boolean; wide: boolean }) {
  const [sel, setSel] = useState<string | null>(null), [adding, setAdding] = useState(false), [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<Stage | null>(null);
  const [pending, setPending] = useState<{ id: string; stage: Stage } | null>(null);
  const by = useMemo(() => Object.fromEntries(STAGES.map(s => [s, cards.filter(c => c.stage === s)])) as Record<Stage, Card[]>, [cards]);
  const open = cards.filter(c => c.stage === "new" || c.stage === "booked" || c.stage === "quoted");
  const openValue = open.reduce((a, c) => a + (c.value ?? (c.ballpark ? (c.ballpark.low + c.ballpark.high) / 2 : 0)), 0);
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
      <div><p>Your jobs</p><h1>{open.length ? <>{open.length} open {open.length === 1 ? "job" : "jobs"}{openValue ? <span> worth about {money(openValue)}</span> : null}.</> : "No open jobs yet."}</h1></div>
      <button type="button" className="jb-add" onClick={() => setAdding(true)}><Svg d={I.plus} size={16} />Add lead</button>
    </div>
    <div className={"jb-board" + (wide ? " wide" : "")}>
      {STAGES.map(stage => { const list = by[stage]; const total = list.reduce((a, c) => a + (c.value ?? 0), 0); return <section key={stage} className={"jb-col" + (over === stage ? " over" : "")} aria-label={STAGE_LABEL[stage]}
        onDragOver={e => { if (drag) { e.preventDefault(); setOver(stage); } }} onDragLeave={() => setOver(o => o === stage ? null : o)}
        onDrop={e => { e.preventDefault(); setOver(null); if (drag) void move(drag, stage); setDrag(null); }}>
        <h2><span>{STAGE_LABEL[stage]}</span><small>{list.length}{total ? ` · ${short(total)}` : ""}</small></h2>
        {list.length ? <ul>{list.map(c => { const tag = cardTag(c); return <li key={c.id}>
          <button type="button" className="jb-card" draggable={wide} onDragStart={() => setDrag(c.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => { setPending(null); setSel(c.id); }}>
            <span className="jb-name">{c.name || fmtPhone(c.phone)}</span>
            <span className="jb-line">{c.line || (c.notes ? c.notes.slice(0, 60) : "No job details yet")}</span>
            <span className="jb-foot"><span className={"jb-tag" + (tag.tone ? " " + tag.tone : "")}>{tag.text}</span>{priceOf(c) && <em className={c.value ? "" : "est"} title={c.value ? "Job value" : "Ballpark from your prices"}>{priceOf(c)}</em>}</span>
          </button></li>; })}</ul>
          : <p className="jb-empty">{stage === "new" ? "New leads land here." : stage === "booked" ? "Booked estimates." : stage === "quoted" ? "Quotes Cinder is chasing." : stage === "won" ? "Jobs you won." : "Lost or not a fit."}</p>}
      </section>; })}
    </div>
    {card && <CardSheet key={card.id} card={card} trade={trade} project={project} api={api} toast={toast} reload={reload} onOpen={onOpen} canCall={canCall}
      pending={pending?.id === card.id ? pending.stage : null} onClose={() => { setSel(null); setPending(null); }} />}
    {adding && <AddLead trade={trade} project={project} api={api} toast={toast} reload={reload} onClose={() => setAdding(false)} />}
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
      : <span className="jb-in"><input inputMode={f.kind === "number" ? "decimal" : undefined} value={d[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.key === "length_ft" ? "150" : f.key === "gates" ? "1" : ""} />{f.unit && <em>{f.unit}</em>}</span>}
  </label>)}</div>;
}
const asStrings = (d: Details) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)]));

function CardSheet({ card, trade, project, api, toast, reload, onOpen, onClose, canCall, pending }: { card: Card; trade: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onOpen: (id: string) => void; onClose: () => void; canCall: boolean; pending: Stage | null }) {
  const [d, setD] = useState<Record<string, string>>(() => asStrings(card.details));
  const [value, setValue] = useState(card.value ? String(card.value) : ""), [notes, setNotes] = useState(card.notes);
  const [ask, setAsk] = useState<Stage | null>(pending), [amt, setAmt] = useState(card.value ? String(card.value) : card.quote?.amount ? String(card.quote.amount) : ""), [busy, setBusy] = useState(false), [arm, setArm] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(asStrings(card.details)) || value !== (card.value ? String(card.value) : "") || notes !== card.notes;
  const name = card.name || fmtPhone(card.phone);
  async function act(body: Record<string, unknown>, done: string, close = false) {
    setBusy(true);
    try { await api("/api/app/act", { p: project, thread: card.id, ...body }); toast(done); await reload(); if (close) onClose(); setAsk(null); return true; }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); return false; }
    finally { setBusy(false); setArm(false); }
  }
  const pick = (s: Stage) => { if (s === card.stage) return; if (s === "quoted" || s === "won") { setAsk(s); return; } if (s === "lost" && !arm) { setArm(true); return; } void act({ action: "stage", stage: s }, `Moved to ${STAGE_LABEL[s]}.`); };
  return <Sheet onClose={onClose} title={<div className="jb-who"><span className="ca-av sm" aria-hidden="true">{initials(name)}</span><span><b>{name}</b><small><a href={`tel:${card.phone}`}>{fmtPhone(card.phone)}</a> · {SRC[card.source] ?? card.source}</small></span></div>}>
    <div className="jb-acts">
      <button type="button" onClick={() => { onClose(); onOpen(card.id); }}><Svg d={I.chat} size={16} />Conversation</button>
      {canCall ? <button type="button" disabled={busy} onClick={() => void act({ action: "call" }, "Calling your cell. Pick up and we'll connect them.")}><Svg d={I.phone} size={16} />Call</button>
        : <a href={`tel:${card.phone}`}><Svg d={I.phone} size={16} />Call</a>}
    </div>
    <div className="jb-stages" role="radiogroup" aria-label="Stage">{STAGES.map(s => <button key={s} type="button" role="radio" aria-checked={card.stage === s} className={(card.stage === s ? "on " : "") + (ask === s ? "ask" : "")} disabled={busy} onClick={() => pick(s)}>{s === "lost" && arm ? "Tap again" : STAGE_LABEL[s]}</button>)}</div>
    {ask && <form className="jb-amt" onSubmit={e => { e.preventDefault(); void act({ action: "stage", stage: ask, amount: amt }, ask === "quoted" ? "Cinder will follow up on the quote until they answer." : "Marked won. Follow-ups stopped."); }}>
      <label><span>{ask === "quoted" ? "Quote amount" : "Job amount"}</span><span className="jb-in"><i>$</i><input inputMode="decimal" autoFocus placeholder="7,400" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.,kK]/g, ""))} /></span></label>
      <p>{ask === "quoted" ? "Cinder texts them on day 2, 5, 10 and 21 until it's a yes or a no. Any reply stops it and comes to you." : "Stops any follow-ups and counts the job in your numbers."}</p>
      <div className="jb-amt-row"><button type="button" onClick={() => setAsk(null)}>Cancel</button><button type="submit" className="go" disabled={busy}>{ask === "quoted" ? "Start follow-up" : "Mark won"}</button></div>
    </form>}
    {card.ballpark && <p className="jb-bp">Ballpark from your prices: <b>{rangeText(card.ballpark)}</b></p>}
    <h3 className="jb-h3">The job</h3>
    <DetailFields trade={trade} d={d} set={(k, v) => setD(x => ({ ...x, [k]: v }))} />
    <label className="jb-f full"><span>Job value</span><span className="jb-in"><i>$</i><input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(/[^\d.,kK]/g, ""))} placeholder="What it's worth to you" /></span></label>
    <label className="jb-f full"><span>Notes</span><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gate on the left side, dog in the yard, HOA needs drawings…" /></label>
    <div className="jb-save"><button type="button" className="go" disabled={!dirty || busy} onClick={() => void act({ action: "card", details: d, value: value || null, notes }, "Saved.")}>Save</button></div>
  </Sheet>;
}

function AddLead({ trade, project, api, toast, reload, onClose }: { trade: string; project: string; api: Api; toast: Toast; reload: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [d, setD] = useState<Record<string, string>>({}), [notes, setNotes] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10})/, "");
  return <Sheet onClose={onClose} title={<div className="jb-who"><span><b>Add a lead</b><small>A call you took, a referral, a walk-in</small></span></div>}>
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
      <p className="jb-fine">Cinder won&rsquo;t text a lead you add yourself. Reply from the conversation when you&rsquo;re ready.</p>
      {err && <p className="ca-err" role="alert">{err}</p>}
      <div className="jb-save"><button type="submit" className="go" disabled={busy || digits.length !== 10}>Add lead</button></div>
    </form>
  </Sheet>;
}
