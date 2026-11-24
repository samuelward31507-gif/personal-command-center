"use client";

// Inbox: every conversation, the ones waiting on the owner first, with the thread beside the list on a desk.
// The thread reads like Messages: the customer in grey on the left, Cinder and the owner in blue on the right.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReplyKit, SnippetEditor, suggestReply, tabTakes, useSnippets } from "./replies";
import { Avatar, Empty, Icon, Spinner, ago, clock, dayKey, dayName, first, fmtPhone, type Api, type Toast } from "./parts";
import { mailWaiting, sourceLabel, type Conv, type Data, type Go, type Text, type Thread } from "./types";
import dynamic from "next/dynamic";
const MailWaiting = dynamic(() => import("./system").then(m => m.MailWaiting), { ssr: false });
import { Chip, SourceMark, secText, type Tone } from "./sources";

/** What a lead's row says about where it stands, in the fixed colors: green booked or won, amber waiting on them, red your turn, grey new. */
export function leadState(c: Conv): { text: string; tone: Tone } {
  if (c.status === "booked" || c.stage === "booked") return { text: "Booked", tone: "green" };
  if (c.stage === "won") return { text: "Won", tone: "green" };
  if (c.stage === "lost" || c.status === "opted_out") return { text: c.status === "opted_out" ? "Opted out" : "Lost", tone: "grey" };
  if (c.status === "paused") return { text: "Your turn", tone: "red" };
  if (c.stage === "quoted") return { text: "Quoted", tone: "violet" };
  if (c.lastDir === "out") return { text: "Waiting", tone: "amber" };
  return { text: "New", tone: "grey" };
}

const STATUS: Record<string, [string, string]> = { auto: ["Replying for you", ""], paused: ["Your turn", "needs"], booked: ["Booked", "booked"], closed: ["Closed", ""], opted_out: ["Opted out", ""] };
const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); };

export function InboxScreen({ d, project, api, toast, reload, go, wide, push, onPush }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; wide: boolean; push: string; onPush: () => void }) {
  const [filter, setFilter] = useState<"all" | "new" | "needs" | "waiting" | "booked" | "auto">(() => (d.live.needs > 0 || mailWaiting(d).length > 0 ? "needs" : "all"));
  const [sel, setSel] = useState<string | null>(null);
  const [hidePush, setHidePush] = useState(true);
  useEffect(() => { try { setHidePush(localStorage.getItem("cinder-push-card") === "hide"); } catch { /* private mode */ } }, []);
  const L = d.live;
  const convs = useMemo(() => {
    const all = L.conversations;
    const dayAgo = Date.now() - 86400000;
    const list = filter === "needs" ? all.filter(c => c.status === "paused") : filter === "auto" ? all.filter(c => c.status === "auto") : filter === "booked" ? all.filter(c => leadState(c).tone === "green") : filter === "waiting" ? all.filter(c => leadState(c).text === "Waiting")
      : filter === "new" ? all.filter(c => c.created && Date.parse(c.created) > dayAgo) : all;
    // Your turn first, then newest.
    return [...list].sort((a, b) => Number(b.status === "paused") - Number(a.status === "paused") || (b.at ?? "").localeCompare(a.at ?? ""));
  }, [L.conversations, filter]);
  const groups = useMemo(() => {
    const g: { day: string; items: Conv[] }[] = [];
    for (const c of convs) { const k = c.status === "paused" && filter === "all" ? "Your turn" : c.at ? dayName(c.at) : "Earlier"; const last = g.at(-1); if (last && last.day === k) last.items.push(c); else g.push({ day: k, items: [c] }); }
    return g;
  }, [convs, filter]);
  const mails = useMemo(() => mailWaiting(d), [d]);
  const [openMail, setOpenMail] = useState<string | null>(null);
  const selMail = sel?.startsWith("mail:") ? mails.find(m => "mail:" + m.id === sel) : undefined;
  // An email that was just added or dismissed leaves the list: move on to the next thing.
  useEffect(() => { if (sel?.startsWith("mail:") && !selMail) setSel(null); }, [sel, selMail]);
  useEffect(() => { if (wide && !sel && (mails.length || convs.length)) setSel(mails.length && filter !== "booked" && filter !== "waiting" ? "mail:" + mails[0].id : convs[0]?.id ?? null); }, [wide, sel, convs, mails, filter]);
  const showMails = (filter === "all" || filter === "needs") && mails.length > 0;
  const pick = useCallback((id: string) => { if (wide) setSel(id); else go.thread(id); }, [wide, go]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || !wide) return;
      if (e.key === "j" || e.key === "k" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!convs.length) return; e.preventDefault();
        const idx = convs.findIndex(c => c.id === sel), dir = e.key === "j" || e.key === "ArrowDown" ? 1 : -1;
        const next = convs[Math.max(0, Math.min(convs.length - 1, idx < 0 ? 0 : idx + dir))]; setSel(next.id);
        document.querySelector(`[data-cv="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && sel) { e.preventDefault(); go.record(sel); }
      else if (e.key === "c") { e.preventDefault(); go.addLead(); }
    };
    addEventListener("keydown", h); return () => removeEventListener("keydown", h);
  }, [convs, sel, go, wide]);
  const views = <div className="views" role="tablist" aria-label="Filter">{([["all", "All", L.conversations.length], ["new", "New", L.conversations.filter(c => c.created && Date.parse(c.created) > Date.now() - 86400000).length], ["needs", "Your turn", L.needs + mails.length],
      ["waiting", "Waiting", L.conversations.filter(c => leadState(c).text === "Waiting").length], ["booked", "Booked", L.conversations.filter(c => leadState(c).tone === "green").length]] as const).map(([k, l, n]) =>
    <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}{n ? <em>{n}</em> : null}</button>)}</div>;
  const current = convs.find(c => c.id === sel) ?? L.conversations.find(c => c.id === sel);
  const yourTurn = L.needs + mails.length, auto = L.conversations.filter(c => c.status === "auto").length;
  const eyebrow = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).replace(",", " ·").toUpperCase();
  const pill = (c: Conv): [string, string] => c.status === "paused" ? ["Your turn", "acc"] : c.status === "opted_out" ? ["Opted out", ""] : c.stage === "won" ? ["Won", "good"] : c.stage === "lost" ? ["Lost", ""]
    : c.status === "booked" || c.stage === "booked" ? ["Booked", ""] : c.stage === "quoted" ? ["Quote out", ""] : ["Replying for you", ""];
  const ini = (s: string) => { const p = s.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean); return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "#"; };
  const when = (iso: string | null) => { if (!iso) return ""; const dd = new Date(iso), now = new Date(); const sameDay = dd.toDateString() === now.toDateString();
    return sameDay ? clock(iso) : Date.now() - dd.getTime() < 6 * 86400000 ? dd.toLocaleDateString("en-US", { weekday: "short" }) + " " + clock(iso) : dd.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  return <div className="v5 v5-inbox">
    <header className="v5-top">
      <div>
        <div className="v5-eyebrow"><span className="v5-lab" style={{ color: "var(--t2)" }}>{eyebrow}</span>{d.project === "demo" && <span className="v5-ex">Example business, sample data</span>}</div>
        <h1 className="v5-h1">Inbox</h1>
        <p className="v5-sub">Every text, call, form and lead site in one thread per customer. {yourTurn ? `${yourTurn} ${yourTurn === 1 ? "is" : "are"} your turn.` : "Nothing is waiting on you."}</p>
      </div>
      <div className="v5-acts"><button type="button" className="b5 pri" onClick={go.addLead}>New lead</button></div>
    </header>
    <div className="v5-body ib-grid">
      <section className="v5-card ib-list" aria-label="Conversations">
        <div className="ib-filt"><div className="v5-seg" role="tablist" aria-label="Filter">
          {([["needs", "Your turn", yourTurn], ["auto", "Replying for you", auto], ["all", "All", 0]] as const).map(([k, l, n]) =>
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}{n ? ` ${n}` : ""}</button>)}
        </div></div>
        {!hidePush && (push === "off" || push === "ios-install") && <div className="ib-push">
          <b>Turn on notifications</b><p>{push === "off" ? "New leads, bookings and replies that need you." : "Tap Share, then \u201cAdd to Home Screen\u201d, and open the app from there."}</p>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>{push === "off" && <button type="button" className="b5 sm pri" onClick={onPush}>Turn on</button>}
            <button type="button" className="b5 sm ghost" onClick={() => { setHidePush(true); try { localStorage.setItem("cinder-push-card", "hide"); } catch { /* private mode */ } }}>Not now</button></div></div>}
        <div className="ib-rows">
          {showMails && mails.map(m => { const key = "mail:" + m.id, who = m.name || m.email || sourceLabel(m.source); return <Fragment key={m.id}>
            <button type="button" className={"ib-row" + (sel === key || openMail === m.id ? " sel" : "")} aria-current={sel === key ? "true" : undefined} aria-expanded={wide ? undefined : openMail === m.id}
              onClick={() => (wide ? setSel(key) : setOpenMail(o => (o === m.id ? null : m.id)))}>
              <span className="v5-av" aria-hidden="true">{ini(who)}</span>
              <span className="ib-t"><span className="ib-top"><b>{who}</b><time>{when(m.at)}</time></span>
                <small>{sourceLabel(m.source || "email")} by email, no phone. {m.message || m.subject}</small><span className="v5-pill acc">Your turn</span></span>
            </button>
            {!wide && openMail === m.id && <div className="mail-inline"><MailWaiting r={m} go={go} toast={toast} api={api} project={project} reload={reload} /></div>}
          </Fragment>; })}
          {convs.map(c => { const [pl, tone] = pill(c); return <button key={c.id} type="button" data-cv={c.id} className={"ib-row" + (sel === c.id ? " sel" : "")} aria-current={sel === c.id ? "true" : undefined} onClick={() => pick(c.id)}>
            <span className="v5-av" aria-hidden="true">{ini(c.name)}</span>
            <span className="ib-t"><span className="ib-top"><b>{c.name}</b><time>{when(c.at)}</time></span>
              <small>{c.last}</small><span className={"v5-pill " + tone}>{pl}</span></span>
          </button>; })}
          {!convs.length && !showMails && <div className="v5-empty">{filter === "needs" ? "Nothing is waiting on you. New leads get answered for you." : filter === "auto" ? "No conversations are being answered for you right now." : "No leads yet. Calls, texts and form leads show up here the moment they come in."}</div>}
        </div>
      </section>
      {wide && <section className="v5-card ib-conv" aria-label="Conversation">{selMail
        ? <div className="mail-pane">
            <header><b>{selMail.name || selMail.email || sourceLabel(selMail.source)}</b><small>{sourceLabel(selMail.source || "email")} by email, {ago(selMail.at)}</small></header>
            <dl><dt>From</dt><dd>{selMail.from}</dd><dt>Subject</dt><dd>{selMail.subject}</dd>{selMail.email && <><dt>Email</dt><dd>{selMail.email}</dd></>}</dl>
            <p className="fine">This lead came in by email without a phone number. Find it on the lead site or reply by email, then add the number to put them on the board. Nobody is texted until you do.</p>
            <MailWaiting bare r={selMail} go={go} toast={toast} api={api} project={project} reload={reload} />
          </div>
        : sel && !sel.startsWith("mail:")
        ? <ThreadView key={sel} id={sel} project={project} canCall={d.canCall} api={api} toast={toast} onChange={() => void reload()} onRecord={() => go.record(sel)} embedded conv={current} />
        : <div className="v5-empty" style={{ margin: "auto" }}>Pick a conversation on the left, or press J.</div>}</section>}
      {wide && sel && !sel.startsWith("mail:") && current && <LeadCard d={d} conv={current} go={go} />}
    </div>
  </div>;
}

/** The lead card beside the thread: made from what came in, the source stamped on arrival. */
function LeadCard({ d, conv, go }: { d: Data; conv: Conv; go: Go }) {
  const c = (d.board ?? []).find(b => b.id === conv.id);
  const appt = d.appointments.filter(a => a.thread_id === conv.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).find(a => Date.parse(a.starts_at) > Date.now() - 12 * 3600000);
  const STAGE: Record<string, string> = { new: "New", booked: "Estimate booked", quoted: "Quoted", won: "Won", lost: "Lost" };
  const value = c ? c.value ?? c.quote?.amount ?? (c.ballpark ? c.ballpark.high : null) : null;
  const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
  const rows: [string, ReactNode][] = [
    ["Stage", <span key="s" className="v5-pill">{STAGE[c?.stage ?? ""] ?? (conv.status === "booked" ? "Estimate booked" : "New")}</span>],
    ["Source", sourceLabel(conv.source)],
    ["Job", c?.line || "Not known yet"],
    ["Address", String(c?.details.address ?? "") || "Not given yet"],
    ["Estimate", appt ? new Date(appt.starts_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not booked"],
    ["Likely value", value ? usd(value) : "Not priced yet"],
    ["Came in", conv.created ? new Date(conv.created).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "–"],
    ["First reply", conv.replySec != null ? `${conv.replySec}s` : "–"],
  ];
  return <aside className="v5-card ib-lead" aria-label="Lead card">
    <div className="v5-ct">Lead card</div>
    <p className="v5-dim" style={{ fontSize: 12, margin: "2px 0 8px" }}>Made automatically when the {sourceLabel(conv.source).toLowerCase()} came in</p>
    {rows.map(([k, v]) => <div key={k} className="ib-kv"><span className="v5-lab">{k}</span><span>{v}</span></div>)}
    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      <button type="button" className="b5 sm" onClick={() => go.record(conv.id, { view: "job" })}>Open job</button>
      {appt && <button type="button" className="b5 sm" onClick={() => go.tab("calendar")}>Move estimate</button>}
    </div>
  </aside>;
}

/** One conversation: a log of who said what, with the composer under it. */
export function ThreadView({ id, project, canCall, api, toast, onBack, onChange, onRecord, embedded, conv }: { id: string; project: string; canCall: boolean; api: Api; toast: Toast; onBack?: () => void; onChange: () => void; onRecord?: () => void; embedded?: boolean; conv?: Conv }) {
  const [t, setT] = useState<Thread | null>(null), [texts, setTexts] = useState<Text[] | null>(null);
  const [draft, setDraft] = useState(""), [busy, setBusy] = useState("");
  const end = useRef<HTMLDivElement>(null), ta = useRef<HTMLTextAreaElement>(null);
  const load = useCallback(() => api<{ thread: Thread; texts: Text[] }>(`/api/app/data?p=${project}&thread=${id}`).then(j => { setT(j.thread); setTexts(j.texts); }).catch(() => {}), [api, id, project]);
  useEffect(() => { void load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [texts?.length]);
  useEffect(() => { const el = ta.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(160, el.scrollHeight) + "px"; } }, [draft]);
  async function act(action: string, extra: Record<string, unknown>, done: string) {
    setBusy(action);
    try { await api("/api/app/act", { p: project, thread: id, action, ...extra }); toast(done); await load(); onChange(); return true; }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", true); return false; }
    finally { setBusy(""); }
  }
  const mine = t?.status === "paused";
  const name = t?.customer_name || conv?.name || (t ? fmtPhone(t.customer_phone) : "");
  const snips = useSnippets(project), [editSnips, setEditSnips] = useState(false);
  const stage = conv?.stage || (t?.status === "booked" ? "booked" : undefined), sug = suggestReply(name, texts, { stage });
  const st = t ? (STATUS[t.status] ?? STATUS.auto) : null;
  let lastDay = "", lastWho = "";
  const lastOut = texts ? [...texts].reverse().find(x => x.direction === "out" && x.author !== "system")?.id : undefined;
  const dlv = (x: Text) => x.status === "undelivered" || x.status === "failed" ? "Not delivered" : x.id === lastOut ? (x.status === "delivered" ? "Delivered" : x.status === "sent" || x.status === "queued" ? "Sent" : "") : "";
  return <section className="thread">
    <header className="th">
      {onBack && <button type="button" className="btn ghost ic" onClick={onBack} aria-label="Back"><Icon name="back" size={16} /></button>}
      {t && <Avatar name={name} size="lg" />}
      <div className="who"><b>{name || "Loading"}</b><small>{t ? <>{fmtPhone(t.customer_phone)}, {sourceLabel(t.source)}{st ? <>, <span className={st[1] === "needs" ? "ember-t" : ""}>{st[0]}</span></> : null}</> : " "}</small></div>
      {t && <div className="acts-row" style={{ flexWrap: "nowrap" }}>
        {t.status !== "opted_out" && t.status !== "booked" && !["booked", "quoted", "won", "lost"].includes(stage ?? "") && <button type="button" className="btn sm" disabled={!!busy} onClick={() => void act("status", { status: "booked" }, "Marked booked.")}>Mark booked</button>}
        {canCall ? <button type="button" className="btn sm" disabled={!!busy} onClick={() => void act("call", {}, "Calling your cell. Pick up and we'll connect them.")}><Icon name="phone" size={13} />Call</button>
          : <a className="btn sm" href={`tel:${t.customer_phone}`}><Icon name="phone" size={13} />Call</a>}
        {onRecord && <button type="button" className="btn sm" onClick={onRecord}>{embedded ? "Open record" : "Record"}{embedded && <kbd>↵</kbd>}</button>}
      </div>}
    </header>
    <div className="texts">
      {texts === null ? <div className="skel-rows" style={{ padding: "12px 0" }}><i className="skel" /><i className="skel" /><i className="skel" /></div>
        : texts.length === 0 ? <Empty title="No texts yet" text="Anything you send goes from your business number." />
        : texts.map((x, i) => {
          const sep = dayKey(x.at) !== lastDay ? <p className="day" key={"d" + i}><span>{dayName(x.at)} {clock(x.at)}</span></p> : null; lastDay = dayKey(x.at);
          if (x.author === "system") { lastWho = ""; return <div key={i}>{sep}<p className="event"><span>{x.body}</span></p></div>; }
          const who = x.direction === "in" ? "them" : x.author === "owner" ? "you" : "cinder";
          const prev = texts[i - 1], next = texts[i + 1];
          const nextWho = next && next.author !== "system" ? (next.direction === "in" ? "them" : next.author === "owner" ? "you" : "cinder") : "";
          const cont = !sep && lastWho === who && Date.parse(x.at) - Date.parse(prev!.at) < 5 * 60000;
          const tail = nextWho !== who || !next || Date.parse(next.at) - Date.parse(x.at) >= 5 * 60000;
          lastWho = who;
          const photos = (x.media ?? []).map((_, k) => `/api/app/media?id=${x.id}&i=${k}`);
          const words = photos.length && /^\(sent (a photo|\d+ photos)\)$/.test(x.body) ? "" : x.body;
          void tail;
          return <div key={i}>{sep}<article className={"lgx " + who + (cont ? " cont" : "")}>
            {!cont && <header><b>{who === "them" ? first(name) : who === "cinder" ? "Cinder" : "You"}</b><time>{clock(x.at)}</time></header>}
            {photos.length > 0 && <div className="photos">{photos.map(src => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="Photo from the customer" loading="lazy" /></a>)}</div>}
            {words && <p title={cont ? clock(x.at) : undefined}>{words}</p>}
            {who !== "them" && dlv(x) && <small className={"dlv" + (dlv(x) === "Not delivered" ? " bad" : "")}>{dlv(x)}</small>}
          </article></div>;
        })}
      <div ref={end} />
    </div>
    {mine && <p className="ib-handoff"><i aria-hidden="true" /><span><b>Handed to you.</b> Replies on this thread are paused until you answer or turn them back on.</span></p>}
    {t && t.status !== "opted_out" && <div className="compose">
      {editSnips && <SnippetEditor list={snips.list} onSave={snips.save} onClose={() => setEditSnips(false)} />}
      <form className="box" onSubmit={async e => { e.preventDefault(); if (draft.trim() && await act("reply", { body: draft }, "Sent from your business number.")) setDraft(""); }}>
        <ReplyKit hidden={!!draft.trim()} suggestion={sug} snippets={snips.list} onUse={x => { setDraft(x); ta.current?.focus(); }} onEdit={() => setEditSnips(true)} />
        <textarea ref={ta} rows={1} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (tabTakes(e, draft, sug, setDraft)) return; if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement)?.requestSubmit(); } }} placeholder={`Text ${first(name)}`} aria-label="Reply" />
        <div className="tools">
          <button type="button" className={"who" + (mine ? " on" : "")} disabled={!!busy || (!mine && t.status === "booked")} title={mine ? "Turn auto-reply back on" : "Take over this conversation"} onClick={() => void (mine ? act("status", { status: "auto" }, "Auto-reply is back on.") : act("status", { status: "paused" }, "Auto-reply is off for this one. You've got it."))}>
            <i aria-hidden="true" />{mine ? "You're replying" : "Replying for you"}</button>
                    <button type="submit" className="btn send msg-send" disabled={!!busy || !draft.trim()} title="Send (Enter)">{busy === "reply" ? <Spinner /> : <Icon name="send" size={14} />}</button>
        </div>
      </form>
    </div>}
    {t && t.status === "opted_out" && <p className="fine" style={{ padding: "8px 16px" }}>{first(name)} opted out of texts. Call instead.</p>}
  </section>;
}
