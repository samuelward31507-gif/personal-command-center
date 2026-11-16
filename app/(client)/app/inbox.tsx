"use client";

// Inbox: every conversation, the ones waiting on the owner first, with the thread beside the list on a desk.
// The thread reads like Messages: the customer in grey on the left, Cinder and the owner in blue on the right.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReplyKit, SnippetEditor, suggestReply, tabTakes, useSnippets } from "./replies";
import { Avatar, Empty, Icon, Spinner, ago, clock, dayKey, dayName, first, fmtPhone, type Api, type Toast } from "./parts";
import { mailWaiting, sourceLabel, type Conv, type Data, type Go, type Text, type Thread } from "./types";
import { MailWaiting } from "./system";
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
  const [filter, setFilter] = useState<"all" | "new" | "needs" | "waiting" | "booked">("all");
  const [sel, setSel] = useState<string | null>(null);
  const [hidePush, setHidePush] = useState(true);
  useEffect(() => { try { setHidePush(localStorage.getItem("cinder-push-card") === "hide"); } catch { /* private mode */ } }, []);
  const L = d.live;
  const convs = useMemo(() => {
    const all = L.conversations;
    const dayAgo = Date.now() - 86400000;
    const list = filter === "needs" ? all.filter(c => c.status === "paused") : filter === "booked" ? all.filter(c => leadState(c).tone === "green") : filter === "waiting" ? all.filter(c => leadState(c).text === "Waiting")
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
  return <>
    <header className="tb"><h1 className="h1 two">Inbox. <span>{L.leadsToday ? `${L.leadsToday} new today` : L.needs ? `${L.needs} waiting on you` : "Every lead answered"}{L.replySecWeek != null ? `, first reply in ${secText(L.replySecWeek)}` : ""}.</span></h1>
      <div className="acts"><button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={14} />New lead{wide && <kbd>c</kbd>}</button></div></header>
    <div className="inbox">
      <div className="list">
        <div className="filt">{views}</div>
        {!hidePush && (push === "off" || push === "ios-install") && <div className="card box" style={{ margin: 12 }}>
          <b className="t-em">Turn on notifications</b><p className="fine" style={{ marginTop: 2 }}>{push === "off" ? "New leads, bookings and replies that need you." : "Tap Share, then “Add to Home Screen”, and open the app from there."}</p>
          <div className="acts-row" style={{ marginTop: 8 }}>{push === "off" && <button type="button" className="btn ink sm" onClick={onPush}>Turn on</button>}
            <button type="button" className="btn ghost sm" onClick={() => { setHidePush(true); try { localStorage.setItem("cinder-push-card", "hide"); } catch { /* private mode */ } }}>Not now</button></div></div>}
        {showMails && <section><div className="grp hot"><b>Lead emails, no phone</b><span>{mails.length}</span></div>
          {mails.map(m => { const key = "mail:" + m.id, who = m.name || m.email || sourceLabel(m.source); return <Fragment key={m.id}>
            <button type="button" className={"cv lead" + (sel === key || openMail === m.id ? " sel" : "")} aria-current={sel === key ? "true" : undefined} aria-expanded={wide ? undefined : openMail === m.id}
              onClick={() => (wide ? setSel(key) : setOpenMail(o => (o === m.id ? null : m.id)))}>
              <span className="cv-dot on" aria-label="Your turn" />
              <span style={{ minWidth: 0 }}><span className="cv-top"><b>{who}</b><time>{ago(m.at)}</time></span>
                <small>No phone, {sourceLabel(m.source || "email")} by email. {m.message || m.subject}</small></span>
            </button>
            {!wide && openMail === m.id && <div className="mail-inline"><MailWaiting r={m} go={go} toast={toast} api={api} project={project} reload={reload} /></div>}
          </Fragment>; })}</section>}
        {groups.length ? groups.map(g => <section key={g.day}><div className={"grp" + (g.day === "Your turn" ? " hot" : "")}><b>{g.day}</b><span>{g.items.length}</span></div>
          {g.items.map(c => { const ls = leadState(c); return <button key={c.id} type="button" data-cv={c.id} className={"cv lead" + (sel === c.id ? " sel" : "")} aria-current={sel === c.id ? "true" : undefined} onClick={() => pick(c.id)}>
            <span className={"cv-dot" + (c.status === "paused" ? " on" : "")} aria-label={c.status === "paused" ? "Your turn" : undefined} />
            <span style={{ minWidth: 0 }}><span className="cv-top"><b>{c.name}</b><time>{ago(c.at)}</time></span>
              <small title={`${sourceLabel(c.source)}, ${ls.text}`}>{c.last}</small></span>
          </button>; })}</section>)
          : showMails ? null : <Empty title={filter === "all" ? "No leads yet" : filter === "needs" ? "Nothing waiting on you" : "No bookings yet"} text={filter === "all" ? "Calls, texts and form leads show up here the moment they come in." : undefined} />}
      </div>
      {wide && <aside className="conv" aria-label="Conversation">{selMail
        ? <div className="mail-pane">
            <header><b>{selMail.name || selMail.email || sourceLabel(selMail.source)}</b><small>{sourceLabel(selMail.source || "email")} by email, {ago(selMail.at)}</small></header>
            <dl><dt>From</dt><dd>{selMail.from}</dd><dt>Subject</dt><dd>{selMail.subject}</dd>{selMail.email && <><dt>Email</dt><dd>{selMail.email}</dd></>}</dl>
            <p className="fine">This lead came in by email without a phone number. Find it on the lead site or reply by email, then add the number to put them on the board. Nobody is texted until you do.</p>
            <MailWaiting bare r={selMail} go={go} toast={toast} api={api} project={project} reload={reload} />
          </div>
        : sel && !sel.startsWith("mail:")
        ? <ThreadView key={sel} id={sel} project={project} canCall={d.canCall} api={api} toast={toast} onChange={() => void reload()} onRecord={() => go.record(sel)} embedded conv={current} />
        : <Empty title="No conversation open" text="Pick one on the left, or press j." />}</aside>}
    </div>
  </>;
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
  const sug = suggestReply(name, texts, { stage: t?.status === "booked" ? "booked" : undefined });
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
        {t.status !== "opted_out" && t.status !== "booked" && <button type="button" className="btn sm" disabled={!!busy} onClick={() => void act("status", { status: "booked" }, "Marked booked.")}>Mark booked</button>}
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
