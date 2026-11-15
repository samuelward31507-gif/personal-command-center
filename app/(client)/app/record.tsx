"use client";

// One customer, everything about them, on one page: the job's details on the left, every text and event in the
// middle with the composer under it, money and the next step on the right. Replaces the old card and customer sheets.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { draftItems, jobFields, jobProfit, jobProgress, jobSteps, rangeText, STAGE_LABEL, STAGES, type Card, type CardInvoice, type Costs, type Details, type Stage } from "@/lib/crm";
import { dollars, totals, type Item } from "@/lib/billing";
import { Avatar, Empty, Icon, Spinner, StageChip, ago, clock, dateLabel, dayKey, dayName, first, fmtPhone, useArm, type Api, type Toast } from "./parts";
import { LineEditor, invoiceState } from "./money";
import { nextUp } from "./jobs";
import { sourceLabel, type Biz, type Data, type Go, type Text, type Thread } from "./types";

type R = { sent?: boolean; warn?: string; link?: string; calendar?: string; invoice?: CardInvoice; review?: string };
const asStrings = (d: Details) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)]));
const QUICK = ["On my way", "I'll call you in 10 minutes", "Sending your quote now", "Can you send a photo?"];

export function RecordPage({ id, ask: ask0, view: view0, d, biz, project, api, toast, reload, go, onBack }: { id: string; ask?: "quoted" | "won"; view?: "activity" | "job"; d: Data; biz: Biz; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; onBack: () => void }) {
  const card = (d.board ?? []).find(c => c.id === id) ?? null;
  const cust = (d.customers ?? []).find(c => c.id === id) ?? null;
  const invoices = (d.invoices ?? []).filter(i => i.thread_id === id);
  const [tab, setTab] = useState<"activity" | "job">(view0 ?? (ask0 ? "job" : "activity"));
  const [ask, setAsk] = useState<Stage | null>(ask0 ?? null);
  const [busy, setBusy] = useState(""), [arm, setArm] = useArm();
  const [wide, setWide] = useState(false);
  useEffect(() => { const m = matchMedia("(min-width: 900px)"); const h = () => setWide(m.matches); h(); m.addEventListener("change", h); return () => m.removeEventListener("change", h); }, []);

  // The conversation: texts and system events, polled while the page is open.
  const [thread, setThread] = useState<Thread | null>(null), [texts, setTexts] = useState<Text[] | null>(null);
  const load = useCallback(() => api<{ thread: Thread; texts: Text[] }>(`/api/app/data?p=${project}&thread=${id}`).then(j => { setThread(j.thread); setTexts(j.texts); }).catch(() => {}), [api, id, project]);
  useEffect(() => { void load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);

  const name = card?.name || cust?.name || thread?.customer_name || fmtPhone(card?.phone || cust?.phone || thread?.customer_phone || "");
  const phone = card?.phone || cust?.phone || thread?.customer_phone || "";
  const address = String(card?.details.address ?? cust?.address ?? "");
  const source = card?.source || cust?.source || thread?.source || "";
  const since = cust?.since ? new Date(cust.since).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
  const status = card?.status || thread?.status || cust?.status || "auto";
  const canText = biz.number && status !== "opted_out";
  const price = card ? card.invoice?.total || card.value || card.quote?.amount || null : null;
  const next = card ? nextUp(card) : null;
  const inv = card?.invoice ?? invoices.find(i => i.status !== "void") ?? null;
  const paid = invoices.filter(i => i.status === "paid").reduce((a, i) => a + i.total, 0);
  const owed = invoices.filter(i => i.status === "sent").reduce((a, i) => a + i.total, 0);

  async function act(key: string, body: Record<string, unknown>, done: string | ((r: R) => string)) {
    setBusy(key);
    try {
      const r = await api<R>("/api/app/act", { p: project, thread: id, ...body });
      toast(typeof done === "string" ? done : done(r), (!!r.warn && !r.sent) || r.calendar === "failed");
      await Promise.all([reload(), load()]); setAsk(null); return r;
    } catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); return null; }
    finally { setBusy(""); setArm(""); }
  }
  const pick = (s: Stage) => {
    if (card && s === card.stage) return;
    if (s === "quoted" || s === "won") { setAsk(s); setTab("job"); return; }
    if (s === "lost" && arm !== "lost") { setArm("lost"); return; }
    void act("stage", { action: "stage", stage: s }, `Moved to ${STAGE_LABEL[s]}.`);
  };
  const primary = (() => {
    if (!card) return null;
    if (card.stage === "won" && inv) return <button type="button" className="btn ink" onClick={() => go.invoice(inv.id)}><Icon name="invoice" size={15} />Open invoice</button>;
    if (card.stage === "won") return <button type="button" className="btn ink" onClick={() => setTab("job")}><Icon name="invoice" size={15} />Create invoice</button>;
    if (card.stage === "quoted" && card.quote && !card.quote.linked) return <button type="button" className="btn ink" onClick={() => setTab("job")}><Icon name="send" size={15} />Send the quote</button>;
    if (card.stage === "quoted") return <button type="button" className="btn ink" onClick={() => pick("won")}><Icon name="check" size={15} />Mark won</button>;
    return <button type="button" className="btn ink" onClick={() => pick("quoted")}><Icon name="quote" size={15} />Write quote</button>;
  })();

  const money = <section className="card"><div className="hd"><h2>Money</h2></div><div className="bd" style={{ paddingTop: 8, paddingBottom: 10 }}>
    <div className="money"><span>Quote</span><b className={card?.quote?.amount || card?.value ? "" : "mut"}>{card?.quote?.amount ? dollars(card.quote.amount) : card?.value ? dollars(card.value) : card?.ballpark ? `~${rangeText(card.ballpark)}` : "–"}</b></div>
    {invoices.map(i => { const st = invoiceState(i); return <div key={i.id} className="money"><span>Invoice #{i.number} <span className={"tag " + st.tone}>{st.text}</span></span><b>{dollars(i.total)}</b></div>; })}
    <div className="money"><span>Paid</span><b className={paid ? "" : "mut"}>{dollars(paid)}</b></div>
    <div className="money sum"><span className="t-em">Owed</span><b style={owed ? { color: "var(--red-text)" } : undefined}>{dollars(owed)}</b></div>
  </div></section>;
  const needs = next && (next.tone === "red" || next.tone === "amber") && card ? <section className="card warn"><div className="bd">
    <p className="sec">Needs you</p><b className="t-em" style={{ fontSize: 14 }}>{next.text}</b>
    <div className="acts-row" style={{ marginTop: 10 }}>
      {next.icon === "chat" && <button type="button" className="btn ink sm" onClick={() => { setTab("activity"); ta.current?.focus(); }}>Reply</button>}
      {next.icon === "quote" && <button type="button" className="btn ink sm" onClick={() => { if (card.quote && !card.quote.linked) setTab("job"); else pick("quoted"); }}>{card.quote && !card.quote.linked ? "Send the quote" : "Write the quote"}</button>}
      {next.icon === "invoice" && inv && <button type="button" className="btn ink sm" onClick={() => go.invoice(inv.id)}>Open invoice</button>}
      {next.icon === "invoice" && !inv && <button type="button" className="btn ink sm" onClick={() => setTab("job")}>Create invoice</button>}
      {next.icon === "cal" && <button type="button" className="btn ink sm" onClick={() => setTab("job")}>Open the job</button>}
      {biz.canCall ? <button type="button" className="btn sm" disabled={!!busy} onClick={() => void act("call", { action: "call" }, "Calling your cell now.")}>Call {first(name)}</button> : <a className="btn sm" href={`tel:${phone}`}>Call {first(name)}</a>}
    </div></div></section> : null;
  const rail = <>{needs}{money}{card && card.stage === "won" && !card.pastCustomer && <CostBox card={card} busy={busy} save={c => void act("costs", { action: "jobcosts", costs: c }, "Costs saved.")} />}
    <section className="card"><div className="hd"><h2>On file</h2></div><div className="bd" style={{ paddingTop: 8, paddingBottom: 10 }}>
      <div className="money"><span>Source</span><b>{sourceLabel(source)}</b></div>
      {since && <div className="money"><span>Since</span><b>{since}</b></div>}
      <div className="money"><span>Texting</span>{status === "opted_out" ? <span className="tag red">opted out</span> : status === "paused" ? <span className="tag ember">you&rsquo;re replying</span> : <span className="tag">Cinder replying</span>}</div>
      {card?.reviewSent && <div className="money"><span>Review</span><b>asked {dateLabel(card.reviewSent)}</b></div>}
      {card?.install && <div className="money"><span>Install</span><b>{dateLabel(card.install)}{card.installDays > 1 ? ` · ${card.installDays} days` : ""}{card.onCalendar ? " · on calendar" : ""}</b></div>}
    </div></section></>;

  const ta = useRef<HTMLTextAreaElement>(null);
  return <div className="rec">
    <header className="rec-h">
      <button type="button" className="btn ghost ic" onClick={onBack} aria-label="Back"><Icon name="back" size={18} /></button>
      <Avatar name={name} size="lg" />
      <div className="t"><h1>{name}</h1><span>{[fmtPhone(phone), address, since ? `Customer since ${since}` : sourceLabel(source)].filter(Boolean).join(" · ")}</span></div>
      {card && <StageChip stage={card.stage} text={`${card.pastCustomer ? "Past customer" : STAGE_LABEL[card.stage]}${price ? ` · ${dollars(price)}` : ""}`} />}
      <div className="acts">
        {biz.canCall ? <button type="button" className="btn" disabled={!!busy} onClick={() => void act("call", { action: "call" }, "Calling your cell now.")}><Icon name="phone" size={15} />Call</button> : <a className="btn" href={`tel:${phone}`}><Icon name="phone" size={15} />Call</a>}
        <button type="button" className="btn" onClick={() => { setTab("activity"); setTimeout(() => ta.current?.focus(), 50); }}><Icon name="chat" size={15} />Text</button>
        {address && <a className="btn ic" href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" aria-label="Directions" title="Directions"><Icon name="pin" size={15} /></a>}
        {primary}
      </div>
    </header>
    <div className="rec-body">
      <aside className="rec-side" aria-label="Details">
        <section>
          <p className="sec">The job{card && <button type="button" className="link" onClick={() => setTab("job")}>Edit</button>}</p>
          {card ? <dl>
            {jobFields(biz.trade).filter(f => f.key !== "address" && card.details[f.key] != null && card.details[f.key] !== "").map(f => <div key={f.key} className="kv"><dt>{f.label}</dt><dd>{String(card.details[f.key])}{f.unit ? ` ${f.unit}` : ""}</dd></div>)}
            {address && <div className="kv"><dt>Address</dt><dd title={address}>{address}</dd></div>}
            <div className="kv"><dt>Source</dt><dd>{sourceLabel(source)}</dd></div>
            <div className="kv"><dt>Job value</dt><dd className={card.value ? "" : "mut"}>{card.value ? dollars(card.value) : card.ballpark ? `~${rangeText(card.ballpark)}` : "Not set"}</dd></div>
            {card.next && <div className="kv"><dt>Estimate</dt><dd>{new Date(card.next).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</dd></div>}
            {card.install && <div className="kv"><dt>Install</dt><dd>{dateLabel(card.install)}{card.installDays > 1 ? ` · ${card.installDays} days` : ""}{card.onCalendar ? " · on calendar" : ""}</dd></div>}
            {!card.line && !address && <p className="fine">Nothing yet. Cinder fills these in as the customer answers.</p>}
          </dl> : <>
            <dl>{address && <div className="kv"><dt>Address</dt><dd title={address}>{address}</dd></div>}<div className="kv"><dt>Source</dt><dd>{sourceLabel(source)}</dd></div>{cust && cust.spent > 0 && <div className="kv"><dt>Billed</dt><dd>{dollars(cust.spent)} · {cust.jobs} {cust.jobs === 1 ? "job" : "jobs"}</dd></div>}</dl>
            <p className="fine" style={{ marginTop: 8 }}>No job on the board for {first(name)} right now.</p>
            <button type="button" className="btn sm" style={{ marginTop: 10 }} disabled={!!busy} onClick={() => void act("stage", { action: "stage", stage: "new" }, "Added to New on the board.")}><Icon name="plus" size={14} />Start a job</button>
          </>}
        </section>
        {card && <section>
          <p className="sec">Stage</p>
          <div className="chips" role="radiogroup" aria-label="Stage">{STAGES.map(s => <button key={s} type="button" role="radio" aria-checked={card.stage === s} className={card.stage === s ? "on" : ""} disabled={!!busy} onClick={() => pick(s)} style={{ height: 30, fontSize: 12.5 }}>{s === "lost" && arm === "lost" ? "Tap again" : STAGE_LABEL[s]}</button>)}</div>
          {card.ballpark && (card.stage === "new" || card.stage === "booked") && <p className="fine" style={{ marginTop: 8 }}>Ballpark from your prices: <b className="t-em">{rangeText(card.ballpark)}</b></p>}
        </section>}
        {card && card.stage === "won" && !card.pastCustomer && <Steps card={card} trade={biz.trade} busy={busy} tick={(step, done) => void act("step:" + step, { action: "jobstep", step, done }, done ? "Done." : "Unticked.")} />}
        {(card?.notes || cust?.line) && <section><p className="sec">Notes</p><p style={{ color: "var(--g800)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{card?.notes || cust?.line}</p></section>}
        {!wide && <div className="rail-mobile">{rail}</div>}
      </aside>

      <section className="rec-act" aria-label="Activity">
        <div className="rec-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity</button>
          <button type="button" role="tab" aria-selected={tab === "job"} className={tab === "job" ? "on" : ""} onClick={() => setTab("job")}>{card ? (card.stage === "won" ? "Job, invoice, review" : card.stage === "quoted" ? "The quote" : "Job details") : "Details"}</button>
        </div>
        {tab === "activity" ? <Activity card={card} texts={texts} name={name} canText={!!canText} status={status} busy={busy} act={act} ta={ta} />
          : <JobPanel card={card} biz={biz} ask={ask} setAsk={setAsk} busy={busy} act={act} go={go} canText={!!canText} name={name} />}
      </section>

      {wide && <aside className="rec-rail" aria-label="Money and next steps">{rail}</aside>}
    </div>
  </div>;
}

// ---------- Activity: texts and events in one timeline, composer under it ----------
type Ev = { at: string; kind: "text" | "event"; text?: Text; title?: string; sub?: string; icon?: string; tone?: string };
function Activity({ card, texts, name, canText, status, busy, act, ta }: { card: Card | null; texts: Text[] | null; name: string; canText: boolean; status: string; busy: string; act: (k: string, b: Record<string, unknown>, done: string | ((r: R) => string)) => Promise<R | null>; ta: React.RefObject<HTMLTextAreaElement | null> }) {
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const items = useMemo<Ev[]>(() => {
    const out: Ev[] = (texts ?? []).map(t => ({ at: t.at, kind: "text", text: t }));
    const inv = card?.invoice;
    if (inv?.sent_at) out.push({ at: inv.sent_at, kind: "event", title: `Invoice #${inv.number} sent`, sub: `${dollars(inv.total)}${inv.due_on ? ` · due ${dateLabel(inv.due_on)}` : ""}`, icon: "invoice", tone: "blue" });
    if (inv?.viewed_at) out.push({ at: inv.viewed_at, kind: "event", title: `${first(name)} opened the invoice`, icon: "eye" });
    if (inv?.paid_at) out.push({ at: inv.paid_at, kind: "event", title: `Invoice #${inv.number} paid`, sub: dollars(inv.total), icon: "check", tone: "ok" });
    if (card?.reviewSent) out.push({ at: card.reviewSent, kind: "event", title: "Review request sent", sub: "Google review link, by text", icon: "star", tone: "ok" });
    if (card?.quote?.viewed) out.push({ at: card.quote.viewed, kind: "event", title: `${first(name)} opened the quote`, sub: card.quote.amount ? dollars(card.quote.amount) : "", icon: "eye" });
    if (card) for (const [k, day] of Object.entries(card.job)) out.push({ at: day + "T12:00:00", kind: "event", title: k === "installed" ? "Installed" : k === "walk" ? "Walk-through done" : k.charAt(0).toUpperCase() + k.slice(1) + " done", icon: "check", tone: "ok" });
    return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }, [texts, card, name]);
  // Scroll to the newest text only when one arrives after the first load, so opening a record starts at the top.
  const seen = useRef<number | null>(null);
  useEffect(() => { if (texts === null) return; if (seen.current !== null && items.length > seen.current) end.current?.scrollIntoView({ block: "nearest" }); seen.current = items.length; }, [items.length, texts]);
  useEffect(() => { const el = ta.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(160, el.scrollHeight) + "px"; } }, [draft, ta]);
  const mine = status === "paused";
  let lastDay = "";
  return <>
    <div className="texts" style={{ padding: "4px 0 12px", flex: 1 }}>
      {texts === null ? <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12 }}><i className="skel" style={{ height: 36, width: "60%" }} /><i className="skel" style={{ height: 36, width: "70%", alignSelf: "flex-end" }} /></div>
        : items.length === 0 ? <Empty icon="chat" title="Nothing here yet" text={canText ? "Anything you send goes from your business number." : "No texts on this customer yet."} />
        : items.map((x, i) => {
          const sep = dayKey(x.at) !== lastDay ? <p className="day" key={"d" + i}><span>{dayName(x.at)}</span></p> : null; lastDay = dayKey(x.at);
          if (x.kind === "event") return <div key={"e" + i}>{sep}<article className="ev"><span className={"ic " + (x.tone ?? "")}><Icon name={x.icon ?? "check"} size={14} /></span><div><header><b>{x.title}</b>{x.sub && <span>{x.sub}</span>}<time>{clock(x.at)}</time></header></div></article></div>;
          const t = x.text!;
          if (t.author === "system") return <div key={t.id}>{sep}<article className="ev"><span className="ic ember"><Icon name="bolt" size={14} /></span><div><header><b>{t.body}</b><time>{clock(t.at)}</time></header></div></article></div>;
          const who = t.direction === "in" ? "them" : t.author === "owner" ? "you" : "cinder";
          const photos = (t.media ?? []).map((_, k) => `/api/app/media?id=${t.id}&i=${k}`);
          const words = photos.length && /^\(sent (a photo|\d+ photos)\)$/.test(t.body) ? "" : t.body;
          return <div key={t.id}>{sep}<article className="ev">
            {who === "them" ? <Avatar name={name} /> : who === "you" ? <span className="ic" style={{ background: "var(--ink)", color: "#fff" }}><Icon name="user" size={13} /></span> : <span className="ic ember"><Icon name="bolt" size={13} /></span>}
            <div><header><b>{who === "them" ? name : who === "you" ? "You" : "Cinder"}</b><span>text</span><time>{clock(t.at)}</time></header>
              {photos.length > 0 && <div className="photos">{photos.map(src => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="Photo from the customer" loading="lazy" /></a>)}</div>}
              {words && <p><span className={"bubble" + (who === "you" ? " out" : who === "cinder" ? " cinder" : "")}>{words}</span></p>}</div>
          </article></div>;
        })}
      <div ref={end} />
    </div>
    {canText && <div className="compose">
      <form className="box" onSubmit={async e => { e.preventDefault(); if (draft.trim() && await act("reply", { action: "reply", body: draft }, "Sent from your business number.")) setDraft(""); }}>
        <textarea ref={ta} rows={1} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement)?.requestSubmit(); }} placeholder={`Text ${first(name)} from your business number`} aria-label="Reply" />
        <div className="tools">
          <button type="button" className={"who" + (mine ? " on" : "")} disabled={!!busy || (!mine && status === "booked")} onClick={() => void (mine ? act("status", { action: "status", status: "auto" }, "Cinder will handle replies again.") : act("status", { action: "status", status: "paused" }, "Cinder stepped back. You've got this one."))}>
            <i aria-hidden="true" />{mine ? "You're replying" : "Cinder is replying"}</button>
          <select aria-label="Quick reply" value="" onChange={e => { if (e.target.value) setDraft(e.target.value); }}><option value="">Quick reply</option>{QUICK.map(q => <option key={q} value={q}>{q}</option>)}</select>
          <button type="submit" className="btn ink sm send" disabled={!!busy || !draft.trim()}>{busy === "reply" ? <Spinner /> : <><Icon name="send" size={14} />Send</>}</button>
        </div>
      </form>
    </div>}
    {!canText && status === "opted_out" && <p className="fine" style={{ padding: "8px 0" }}>{first(name)} opted out of texts. Call instead.</p>}
  </>;
}

// ---------- The job: quote, won, install, invoice, review, details ----------
function JobPanel({ card, biz, ask, setAsk, busy, act, go, canText, name }: { card: Card | null; biz: Biz; ask: Stage | null; setAsk: (s: Stage | null) => void; busy: string; act: (k: string, b: Record<string, unknown>, done: string | ((r: R) => string)) => Promise<R | null>; go: Go; canText: boolean; name: string }) {
  const [d, setD] = useState<Record<string, string>>(() => asStrings(card?.details ?? {}));
  const [value, setValue] = useState(card?.value ? String(card.value) : ""), [notes, setNotes] = useState(card?.notes ?? "");
  const [amt, setAmt] = useState(card?.value ? String(card.value) : card?.quote?.amount ? String(card.quote.amount) : "");
  const q = card?.quote ?? null;
  const [items, setItems] = useState<Item[]>(() => q?.items?.length ? q.items : draftItems(biz.trade, card?.details ?? {}, biz.priceBook));
  const [tax, setTax] = useState<number>(() => q?.items?.length ? q.tax : Number(biz.taxRate) || 0);
  const [editLines, setEditLines] = useState(false), [incl, setIncl] = useState(q?.note ?? "");
  const [install, setInstall] = useState(card?.install ?? ""), [itime, setItime] = useState(card?.installTime ?? ""), [idays, setIdays] = useState(String(card?.installDays || 1));
  const [review, setReview] = useState(card ? (card.stage === "won" ? card.reviewAuto : biz.reviewLink) : false);
  const [arm, setArm] = useArm();
  if (!card) return <Empty icon="jobs" title="No job on the board" text={`Start a job to track ${first(name)} from estimate to paid.`} />;
  const firstName = first(card.name);
  const installDirty = install !== (card.install ?? "") || itime !== (card.installTime ?? "") || idays !== String(card.installDays || 1);
  const dirty = JSON.stringify(d) !== JSON.stringify(asStrings(card.details)) || value !== (card.value ? String(card.value) : "") || notes !== card.notes || (card.stage === "won" && review !== card.reviewAuto);
  const quoteTotal = totals(items.filter(i => i.name.trim()), tax).total;
  const calMsg = (c?: string) => c === "added" ? " On your Google Calendar." : c === "removed" ? " Taken off your calendar." : c === "not_connected" ? " Connect Google Calendar to put it there." : c === "failed" ? " It didn't save to your calendar; try again." : "";
  async function copy() {
    const r = q?.url ? { link: q.url } : await act("copy", { action: "quotelink", send: false, note: incl }, "Link ready.");
    if (!r?.link) return;
    try { await navigator.clipboard.writeText(r.link); toastCopy(); } catch { prompt("Copy the quote link:", r.link); }
  }
  const toastCopy = () => void act("noop", { action: "status", status: card.status }, "Quote link copied.");
  const installFields = <div className="three">
    <label className="field"><span>Install day</span><input type="date" value={install} onChange={e => setInstall(e.target.value)} /></label>
    <label className="field"><span>Start</span><input type="time" value={itime} onChange={e => setItime(e.target.value)} disabled={!install || idays !== "1"} /></label>
    <label className="field"><span>Days</span><select value={idays} onChange={e => setIdays(e.target.value)} disabled={!install}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
  </div>;
  const sec = (title: string, right: React.ReactNode, body: React.ReactNode) => <section className="card"><div className="hd"><h2>{title}</h2>{right}</div><div className="bd" style={{ display: "flex", flexDirection: "column", gap: 12 }}>{body}</div></section>;

  return <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 14 }}>
    {ask === "quoted" && sec("The quote", <button type="button" className="link" onClick={() => setAsk(null)}>Cancel</button>, <>
      <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} />
      <label className="field"><span>What&rsquo;s included <em>optional, they&rsquo;ll see it</em></span><textarea rows={2} value={incl} maxLength={600} onChange={e => setIncl(e.target.value)} placeholder="Tear-out and haul-away, steel posts in concrete, 2-year warranty" /></label>
      <p className="fine">Cinder follows up on day 2, 5, 10 and 21 after you send, and stops the moment they reply.</p>
      <div className="acts-row end">
        <button type="button" className="btn" disabled={!!busy || quoteTotal <= 0} onClick={() => void act("save", { action: "stage", stage: "quoted", amount: String(quoteTotal), items, tax, note: incl }, `Quote saved: ${dollars(quoteTotal)}. Not sent yet.`)}>Save, don&rsquo;t send</button>
        <button type="button" className="btn ink" disabled={!!busy || !canText || quoteTotal <= 0} onClick={() => void act("stage", { action: "stage", stage: "quoted", amount: String(quoteTotal), items, tax, note: incl, link: true }, r => r.sent ? `Quote texted to ${firstName}: ${dollars(quoteTotal)}.` : r.warn || "Saved.")}>{busy === "stage" ? <Spinner /> : <><Icon name="send" size={14} />Text {firstName} {dollars(quoteTotal)}</>}</button>
      </div>
    </>)}
    {ask === "won" && sec("Mark won", <button type="button" className="link" onClick={() => setAsk(null)}>Cancel</button>, <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={e => { e.preventDefault(); void act("stage", { action: "stage", stage: "won", amount: amt, install: install || null, time: itime || null, days: Number(idays), review: review && biz.reviewLink }, r => `Marked won.${calMsg(r.calendar)}${review && biz.reviewLink && install ? " Review ask goes out the morning after." : ""}`); }}>
      <label className="field"><span>Job amount</span><span className="inwrap"><i>$</i><input inputMode="decimal" autoFocus placeholder="7,400" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.,kK]/g, ""))} /></span></label>
      {installFields}
      {!biz.calendar && <p className="fine">Connect Google Calendar to add installs to it.</p>}
      <label className={"toggle" + (biz.reviewLink ? "" : " off")}><input type="checkbox" checked={review && biz.reviewLink} disabled={!biz.reviewLink} onChange={e => setReview(e.target.checked)} /><i /><span><b>Ask for a Google review</b><small>{!biz.reviewLink ? "Needs your Google review link. Ask Sam." : install ? "The morning after the install." : "Set an install day first."}</small></span></label>
      <div className="acts-row end"><button type="submit" className="btn ink" disabled={!!busy}>{busy ? <Spinner /> : <><Icon name="check" size={14} />Mark won</>}</button></div>
    </form>)}

    {!ask && card.stage === "quoted" && q && sec(`The quote${q.amount ? ` · ${dollars(q.amount)}` : ""}`, <span className={"tag " + (q.status === "replied" ? "red" : q.viewed ? "blue" : "")} style={{ marginLeft: "auto" }}>{q.status === "replied" ? "They replied" : q.viewed ? <><Icon name="eye" size={12} />Opened {ago(q.viewed)}</> : q.linked ? "Texted, not opened yet" : "Not sent yet"}</span>, <>
      {editLines ? <LineEditor items={items} setItems={setItems} tax={tax} setTax={setTax} />
        : q.items.length > 0 ? <ul className="lines">{q.items.map((i, k) => <li key={k}><span>{i.name}<small>{i.qty !== 1 || i.unit ? `${i.qty}${i.unit ? " " + i.unit : ""} × ${dollars(i.price)}` : ""}</small></span><b>{dollars(i.qty * i.price)}</b></li>)}</ul> : null}
      {q.note && !editLines && <p className="fine">{q.note}</p>}
      <p className="fine">{!q.linked ? "Not sent." : q.steps ? `Follow-up ${q.steps} of 4 sent.` : "First follow-up in 2 days."}</p>
      <div className="acts-row end">
        {editLines ? <>
          <button type="button" className="btn" disabled={!!busy} onClick={() => setEditLines(false)}>Cancel</button>
          <button type="button" className="btn ink" disabled={!!busy || quoteTotal <= 0} onClick={async () => { if (await act("lines", { action: "quotelines", items, tax, note: incl }, `Quote updated: ${dollars(quoteTotal)}.`)) setEditLines(false); }}>Save lines</button>
        </> : <>
          <button type="button" className="btn" disabled={!!busy} onClick={() => void copy()}><Icon name="link" size={14} />Copy link</button>
          <button type="button" className="btn" disabled={!!busy} onClick={() => setEditLines(true)}><Icon name="edit" size={14} />Edit lines</button>
          <button type="button" className="btn ink" disabled={!!busy || !canText} onClick={() => void act("send", { action: "quotelink", note: incl }, r => r.sent ? `Quote texted to ${firstName}.` : r.warn || "Saved.")}>{busy === "send" ? <Spinner /> : <><Icon name="send" size={14} />{q.linked ? "Text it again" : `Text ${firstName}`}</>}</button>
        </>}
      </div>
    </>)}

    {!ask && card.stage === "won" && !card.pastCustomer && <>
      {sec("Install", card.install ? <span className={"tag " + (card.onCalendar ? "green" : "")} style={{ marginLeft: "auto" }}>{card.onCalendar ? "On Google Calendar" : "Not on a calendar"}</span> : null, <>
        {installFields}
        {installDirty && <div className="acts-row end"><button type="button" className="btn ink" disabled={!!busy} onClick={() => void act("install", { action: "install", install: install || null, time: itime || null, days: Number(idays) }, r => (install ? `Install set for ${dateLabel(install)}.` : "Install date cleared.") + calMsg(r.calendar))}>{busy === "install" ? <Spinner /> : install ? "Save install" : "Clear install"}</button></div>}
      </>)}
      {sec("Invoice", card.invoice ? <span className={"tag " + invoiceState(card.invoice).tone} style={{ marginLeft: "auto" }}>{invoiceState(card.invoice).text}</span> : null, card.invoice ? <>
        <div className="money"><span>#{card.invoice.number}{card.invoice.status === "sent" && card.invoice.due_on ? ` · due ${dateLabel(card.invoice.due_on)}` : ""}</span><b>{dollars(card.invoice.total)}</b></div>
        <div className="acts-row end"><button type="button" className="btn ink" onClick={() => go.invoice(card.invoice!.id)}>Open invoice</button></div>
      </> : <>
        <p className="fine">Pulls the lines from the quote. You check it before it goes.</p>
        <div className="acts-row end"><button type="button" className="btn ink" disabled={!!busy} onClick={async () => { const r = await act("invoice", { action: "invoice" }, "Invoice drafted."); if (r?.invoice) go.invoice(r.invoice.id); }}>{busy === "invoice" ? <Spinner /> : "Create invoice"}</button></div>
      </>)}
      {sec("Review", card.reviewSent ? <span className="tag green" style={{ marginLeft: "auto" }}><Icon name="star" size={12} />Asked {ago(card.reviewSent)}</span> : null, <>
        {!card.reviewSent && <label className={"toggle" + (biz.reviewLink ? "" : " off")}><input type="checkbox" checked={review && biz.reviewLink} disabled={!biz.reviewLink} onChange={e => setReview(e.target.checked)} /><i /><span><b>Ask for a Google review</b><small>{!biz.reviewLink ? "Needs your Google review link. Ask Sam." : card.install ? `Goes out ${dateLabel(new Date(Date.parse(card.install + "T12:00:00") + 86400000).toLocaleDateString("en-CA"))}.` : "Set an install day."}</small></span></label>}
        {card.reviewSent ? <p className="fine">Sent by text with your Google review link.</p> : biz.reviewLink && <div className="acts-row end">
          <button type="button" className="btn" disabled={!!busy || !canText} onClick={() => arm === "rv" ? void act("review", { action: "reviewnow" }, `Review request sent to ${firstName}.`) : setArm("rv")}>{busy === "review" ? <Spinner /> : <><Icon name="star" size={14} />{arm === "rv" ? "Tap again to send it now" : "Job done, ask now"}</>}</button></div>}
      </>)}
    </>}

    {sec("Job details", null, <>
      <div className="fields">{jobFields(biz.trade).map(f => <label key={f.key} className={"field" + (f.key === "address" ? " full" : "")}><span>{f.label}</span>
        {f.kind === "choice" ? <select value={d[f.key] ?? ""} onChange={e => setD(x => ({ ...x, [f.key]: e.target.value }))}><option value="">–</option>{f.options!.map(o => <option key={o}>{o}</option>)}</select>
          : <span className="inwrap"><input inputMode={f.kind === "number" ? "decimal" : undefined} value={d[f.key] ?? ""} onChange={e => setD(x => ({ ...x, [f.key]: e.target.value }))} placeholder="Not set" />{f.unit && <em>{f.unit}</em>}</span>}</label>)}
        <label className="field"><span>Job value</span><span className="inwrap"><i>$</i><input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(/[^\d.,kK]/g, ""))} placeholder="What it's worth to you" /></span></label>
        <label className="field full"><span>Notes</span><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gate on the left side, dog in the yard, HOA needs drawings…" /></label>
      </div>
      <div className="acts-row end"><button type="button" className="btn ink" disabled={!dirty || !!busy} onClick={() => void act("save", { action: "card", details: d, value: value || null, notes, ...(card.stage === "won" ? { review } : {}) }, "Saved.")}>{busy === "save" ? <Spinner /> : "Save"}</button></div>
    </>)}
  </div>;
}

/** Won to paid, one step at a time. The owner ticks steps; the invoice steps tick themselves. */
function Steps({ card, trade, busy, tick }: { card: Card; trade: string; busy: string; tick: (step: string, done: boolean) => void }) {
  const steps = jobSteps(trade, card.details), p = jobProgress(trade, card);
  const inv = card.invoice, sent = !!inv && inv.status !== "draft" && inv.status !== "void", paid = inv?.status === "paid";
  const nextKey = steps.find(s => !card.job[s.key])?.key;
  return <section>
    <p className="sec">From won to paid<b>{p.next ? `${p.done} of ${p.total}` : "Paid in full"}</b></p>
    <div className="prog" style={{ marginBottom: 10 }}><b style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
    {steps.map(s => { const on = card.job[s.key]; return <button key={s.key} type="button" role="checkbox" aria-checked={!!on} disabled={!!busy} className={"step" + (on ? " done" : s.key === nextKey ? " next" : "")} onClick={() => tick(s.key, !on)} title={s.hint || undefined}>
      <i>{busy === "step:" + s.key ? <Spinner /> : on ? <Icon name="check" size={11} /> : null}</i>{s.label}<small>{on ? dateLabel(on) : s.key === nextKey && s.hint ? "next" : ""}</small></button>; })}
    <div className={"step auto" + (sent ? " done" : steps.every(s => card.job[s.key]) ? " next" : "")}><i>{sent ? <Icon name="check" size={11} /> : null}</i>Invoice sent<small>{sent && inv?.sent_at ? dateLabel(inv.sent_at) : "ticks itself"}</small></div>
    <div className={"step auto" + (paid ? " done" : sent ? " next" : "")}><i>{paid ? <Icon name="check" size={11} /> : null}</i>Paid<small>{paid && inv?.paid_at ? dateLabel(inv.paid_at) : inv?.due_on && sent ? `due ${dateLabel(inv.due_on)}` : "ticks itself"}</small></div>
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
  const f = (k: keyof typeof c, label: string) => <div className="money"><span>{label}</span><span className="inwrap" style={{ width: 110, height: 28 }}><i>$</i><input inputMode="decimal" placeholder="0" aria-label={label} value={c[k]} onChange={e => setC(x => ({ ...x, [k]: e.target.value.replace(/[^\d.,]/g, "") }))} style={{ textAlign: "right" }} /></span></div>;
  return <section className="card"><div className="hd"><h2>Costs and profit</h2>{pr && <span className={"tag " + (pr.profit >= 0 ? "green" : "red")} style={{ marginLeft: "auto" }}>{pr.margin}% margin</span>}</div>
    <div className="bd" style={{ paddingTop: 8, paddingBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
      {f("materials", "Materials")}{f("labor", "Labor")}{f("other", "Other")}
      {pr ? <div className="money sum"><span className="t-em">Profit <small>on {dollars(price!)}</small></span><b style={{ color: pr.profit >= 0 ? "var(--green-text)" : "var(--red-text)" }}>{dollars(pr.profit)}</b></div>
        : <p className="fine" style={{ marginTop: 6 }}>Add what you spent and you&rsquo;ll see what this job made.</p>}
      {dirty && <div className="acts-row end" style={{ marginTop: 6 }}><button type="button" className="btn ink sm" disabled={!!busy} onClick={() => save(now)}>{busy === "costs" ? <Spinner /> : "Save costs"}</button></div>}
    </div></section>;
}
