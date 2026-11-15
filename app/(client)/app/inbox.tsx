"use client";

// Inbox: every conversation, the ones waiting on the owner first, with the thread beside the list on a desk.
// The thread reads like Messages: the customer in grey on the left, Cinder and the owner in blue on the right.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReplyKit, SnippetEditor, suggestReply, tabTakes, useSnippets } from "./replies";
import { Avatar, Empty, Icon, Spinner, ago, clock, dayKey, dayName, first, fmtPhone, type Api, type Toast } from "./parts";
import { sourceLabel, type Conv, type Data, type Go, type Text, type Thread } from "./types";

const STATUS: Record<string, [string, string]> = { auto: ["Cinder replying", ""], paused: ["Your turn", "needs"], booked: ["Booked", "booked"], closed: ["Closed", ""], opted_out: ["Opted out", ""] };
const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); };

export function InboxScreen({ d, project, api, toast, reload, go, wide, push, onPush }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; wide: boolean; push: string; onPush: () => void }) {
  const [filter, setFilter] = useState<"all" | "needs" | "booked">("all");
  const [sel, setSel] = useState<string | null>(null);
  const [hidePush, setHidePush] = useState(true);
  useEffect(() => { try { setHidePush(localStorage.getItem("cinder-push-card") === "hide"); } catch { /* private mode */ } }, []);
  const L = d.live;
  const convs = useMemo(() => {
    const all = L.conversations;
    const list = filter === "needs" ? all.filter(c => c.status === "paused") : filter === "booked" ? all.filter(c => c.status === "booked") : all;
    // Your turn first, then newest.
    return [...list].sort((a, b) => Number(b.status === "paused") - Number(a.status === "paused") || (b.at ?? "").localeCompare(a.at ?? ""));
  }, [L.conversations, filter]);
  const groups = useMemo(() => {
    const g: { day: string; items: Conv[] }[] = [];
    for (const c of convs) { const k = c.status === "paused" && filter === "all" ? "Your turn" : c.at ? dayName(c.at) : "Earlier"; const last = g.at(-1); if (last && last.day === k) last.items.push(c); else g.push({ day: k, items: [c] }); }
    return g;
  }, [convs, filter]);
  useEffect(() => { if (wide && !sel && convs.length) setSel(convs[0].id); }, [wide, sel, convs]);
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
  const views = <div className="views" role="tablist" aria-label="Filter">{([["all", "All", L.conversations.length], ["needs", "Your turn", L.needs], ["booked", "Booked", L.conversations.filter(c => c.status === "booked").length]] as const).map(([k, l, n]) =>
    <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}{n ? <em>{n}</em> : null}</button>)}</div>;
  const current = convs.find(c => c.id === sel) ?? L.conversations.find(c => c.id === sel);
  return <>
    <header className="tb"><h1 className="h1">Inbox</h1><span className="sub">{L.needs ? `${L.needs} waiting on you` : "Cinder has every conversation covered"}</span>
      <div className="acts"><button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={14} />New lead{wide && <kbd>c</kbd>}</button></div></header>
    <div className="inbox">
      <div className="list">
        <div className="filt">{views}</div>
        {!hidePush && (push === "off" || push === "ios-install") && <div className="card box" style={{ margin: 12 }}>
          <b className="t-em">Turn on notifications</b><p className="fine" style={{ marginTop: 2 }}>{push === "off" ? "New leads, bookings and replies that need you." : "Tap Share, then “Add to Home Screen”, and open Cinder from there."}</p>
          <div className="acts-row" style={{ marginTop: 8 }}>{push === "off" && <button type="button" className="btn ink sm" onClick={onPush}>Turn on</button>}
            <button type="button" className="btn ghost sm" onClick={() => { setHidePush(true); try { localStorage.setItem("cinder-push-card", "hide"); } catch { /* private mode */ } }}>Not now</button></div></div>}
        {groups.length ? groups.map(g => <section key={g.day}><div className={"grp" + (g.day === "Your turn" ? " hot" : "")}><b>{g.day}</b><span>{g.items.length}</span></div>
          {g.items.map(c => { const st = STATUS[c.status] ?? STATUS.auto; return <button key={c.id} type="button" data-cv={c.id} className={"cv" + (sel === c.id ? " sel" : "")} aria-current={sel === c.id ? "true" : undefined} onClick={() => pick(c.id)}>
            <Avatar name={c.name} size="lg" />
            <span style={{ minWidth: 0 }}><span className="cv-top"><b>{c.status === "paused" && <i aria-label="Your turn" />}{c.name}</b><time>{ago(c.at)}</time></span><small>{c.last}</small><small className={"st " + st[1]}>{st[0]} · {sourceLabel(c.source)}</small></span>
          </button>; })}</section>)
          : <Empty title={filter === "all" ? "No leads yet" : filter === "needs" ? "Nothing waiting on you" : "No bookings yet"} text={filter === "all" ? "Calls, texts and form leads show up here the moment they come in." : undefined} />}
      </div>
      {wide && <aside className="conv" aria-label="Conversation">{sel
        ? <ThreadView key={sel} id={sel} project={project} canCall={d.canCall} api={api} toast={toast} onChange={() => void reload()} onRecord={() => go.record(sel)} embedded conv={current} />
        : <Empty title="No conversation open" text="Pick one on the left, or press j." />}</aside>}
    </div>
  </>;
}

/** One conversation: a Messages-style thread with the composer under it. */
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
      <div className="who"><b>{name || "Loading"}</b><small>{t ? <>{fmtPhone(t.customer_phone)} · {sourceLabel(t.source)}{st ? <> · <span className={st[1] === "needs" ? "ember-t" : ""}>{st[0]}</span></> : null}</> : " "}</small></div>
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
          const sep = dayKey(x.at) !== lastDay ? <p className="day" key={"d" + i}><span>{dayName(x.at)} · {clock(x.at)}</span></p> : null; lastDay = dayKey(x.at);
          if (x.author === "system") { lastWho = ""; return <div key={i}>{sep}<p className="event"><span>{x.body}</span></p></div>; }
          const who = x.direction === "in" ? "them" : x.author === "owner" ? "you" : "cinder";
          const prev = texts[i - 1], next = texts[i + 1];
          const nextWho = next && next.author !== "system" ? (next.direction === "in" ? "them" : next.author === "owner" ? "you" : "cinder") : "";
          const cont = !sep && lastWho === who && Date.parse(x.at) - Date.parse(prev!.at) < 5 * 60000;
          const tail = nextWho !== who || !next || Date.parse(next.at) - Date.parse(x.at) >= 5 * 60000;
          lastWho = who;
          const photos = (x.media ?? []).map((_, k) => `/api/app/media?id=${x.id}&i=${k}`);
          const words = photos.length && /^\(sent (a photo|\d+ photos)\)$/.test(x.body) ? "" : x.body;
          return <div key={i} style={{ display: "flex", flexDirection: "column" }}>{sep}<article className={"msg " + (who === "them" ? "in" : "out") + (cont ? " cont" : "") + (tail ? " tail" : "")}>
            {!cont && who !== "them" && <small className="from">{who === "cinder" ? "Cinder" : "You"}</small>}
            {photos.length > 0 && <div className="photos">{photos.map(src => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="Photo from the customer" loading="lazy" /></a>)}</div>}
            {words && <span className={"bubble" + (who === "them" ? "" : " out")}>{words}</span>}
            {tail && <small className="when">{clock(x.at)}</small>}
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
          <button type="button" className={"who" + (mine ? " on" : "")} disabled={!!busy || (!mine && t.status === "booked")} title={mine ? "Hand back to Cinder" : "Take over this conversation"} onClick={() => void (mine ? act("status", { status: "auto" }, "Cinder will handle replies again.") : act("status", { status: "paused" }, "Cinder stepped back. You've got this one."))}>
            <i aria-hidden="true" />{mine ? "You're replying" : "Cinder is replying"}</button>
                    <button type="submit" className="btn send msg-send" disabled={!!busy || !draft.trim()} title="Send (Enter)">{busy === "reply" ? <Spinner /> : <Icon name="send" size={14} />}</button>
        </div>
      </form>
    </div>}
    {t && t.status === "opted_out" && <p className="fine" style={{ padding: "8px 16px" }}>{first(name)} opted out of texts. Call instead.</p>}
  </section>;
}
