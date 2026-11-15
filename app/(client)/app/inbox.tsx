"use client";

// Inbox: every conversation, newest first, with the ones waiting on the owner marked. On a desk the list sits
// beside the open conversation; on a phone a tap opens it full screen. One conversation = ThreadView, also used
// inside a customer's record.
import { ReplyKit, SnippetEditor, suggestReply, tabTakes, useSnippets } from "./replies";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Empty, Icon, Spinner, ago, clock, dayKey, dayName, first, fmtPhone, type Api, type Toast } from "./parts";
import { sourceLabel, type Conv, type Data, type Go, type Text, type Thread } from "./types";

const STATUS: Record<string, [string, string]> = { auto: ["Cinder replying", "auto"], paused: ["Your turn", "needs"], booked: ["Booked", "booked"], closed: ["Closed", "done"], opted_out: ["Opted out", "done"] };

export function InboxScreen({ d, project, api, toast, reload, go, wide, push, onPush }: { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void>; go: Go; wide: boolean; push: string; onPush: () => void }) {
  const [filter, setFilter] = useState<"all" | "needs" | "booked">("all");
  const [sel, setSel] = useState<string | null>(null);
  const [hidePush, setHidePush] = useState(true);
  useEffect(() => { try { setHidePush(localStorage.getItem("cinder-push-card") === "hide"); } catch { /* private mode */ } }, []);
  const L = d.live;
  const convs = useMemo(() => { const all = L.conversations; return filter === "needs" ? all.filter(c => c.status === "paused") : filter === "booked" ? all.filter(c => c.status === "booked") : all; }, [L.conversations, filter]);
  const groups = useMemo(() => { const g: { day: string; items: Conv[] }[] = []; for (const c of convs) { const k = c.at ? dayName(c.at) : "Earlier"; const last = g.at(-1); if (last && last.day === k) last.items.push(c); else g.push({ day: k, items: [c] }); } return g; }, [convs]);
  const pick = (id: string) => { if (wide) setSel(id); else go.thread(id); };
  return <>
    <header className="ph"><h1>Inbox</h1><span className="sub">{L.needs ? `${L.needs} waiting on you` : "Cinder has every conversation covered"}</span>
      <div className="acts"><button type="button" className="btn ink" onClick={go.addLead}><Icon name="plus" size={15} />Add lead</button></div></header>
    <div className="inbox">
      <div className="list">
        <div className="filt"><div className="seg" role="tablist" aria-label="Filter">{([["all", "All", 0], ["needs", "Your turn", L.needs], ["booked", "Booked", 0]] as const).map(([k, l, n]) =>
          <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}{n ? <em>{n}</em> : null}</button>)}</div></div>
        {!hidePush && (push === "off" || push === "ios-install") && <div className="card warn" style={{ margin: 12 }}><div className="bd" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span className="ic ember" style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="bell" size={14} /></span>
          <div style={{ flex: 1 }}><b className="t-em">Turn on notifications</b><p className="fine" style={{ marginTop: 2 }}>{push === "off" ? "New leads, bookings and replies that need you." : "Tap Share, then “Add to Home Screen”, and open Cinder from there."}</p>
            <div className="acts-row" style={{ marginTop: 10 }}>{push === "off" && <button type="button" className="btn ink sm" onClick={onPush}>Turn on</button>}
              <button type="button" className="btn ghost sm" onClick={() => { setHidePush(true); try { localStorage.setItem("cinder-push-card", "hide"); } catch { /* private mode */ } }}>Not now</button></div></div></div></div>}
        {groups.length ? groups.map(g => <section key={g.day}><div className="grp padx"><b>{g.day}</b><span>{g.items.length}</span></div>
          {g.items.map(c => { const st = STATUS[c.status] ?? STATUS.auto; return <button key={c.id} type="button" className={"cv" + (sel === c.id ? " sel" : "")} aria-current={sel === c.id ? "true" : undefined} onClick={() => pick(c.id)}>
            <Avatar name={c.name} size="lg" />
            <span style={{ minWidth: 0 }}><b>{c.status === "paused" && <i aria-label="Your turn" />}{c.name}</b><small>{c.last}</small><small className={"st " + st[1]}>{st[0]} · {sourceLabel(c.source)}</small></span>
            <time>{ago(c.at)}</time>
          </button>; })}</section>)
          : <Empty icon="chat" title={filter === "all" ? "No leads yet" : filter === "needs" ? "Nothing waiting on you" : "No bookings yet"} text={filter === "all" ? "Calls, texts and form leads show up here the moment they come in." : undefined} />}
      </div>
      {wide && <aside className="conv" aria-label="Conversation">{sel
        ? <ThreadView key={sel} id={sel} project={project} canCall={d.canCall} api={api} toast={toast} onChange={() => void reload()} onRecord={() => go.record(sel)} embedded />
        : <Empty icon="chat" title="No conversation open" text="Pick a lead on the left." />}</aside>}
    </div>
  </>;
}

/** One conversation: what Cinder said, what they said, and a composer that texts from the business number. */
export function ThreadView({ id, project, canCall, api, toast, onBack, onChange, onRecord, embedded }: { id: string; project: string; canCall: boolean; api: Api; toast: Toast; onBack?: () => void; onChange: () => void; onRecord?: () => void; embedded?: boolean }) {
  const [t, setT] = useState<Thread | null>(null), [texts, setTexts] = useState<Text[] | null>(null);
  const [draft, setDraft] = useState(""), [busy, setBusy] = useState("");
  const end = useRef<HTMLDivElement>(null), ta = useRef<HTMLTextAreaElement>(null);
  const snips = useSnippets(project), [editSnips, setEditSnips] = useState(false);
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
  const name = t?.customer_name || (t ? fmtPhone(t.customer_phone) : "");
  const sug = suggestReply(name, texts, { stage: t?.status === "booked" ? "booked" : undefined });
  let lastDay = "";
  return <section className="thread">
    <header className="th">
      {onBack && <button type="button" className="btn ghost ic" onClick={onBack} aria-label="Back"><Icon name="back" size={18} /></button>}
      {t && <Avatar name={name} size="lg" />}
      <div className="who"><b>{name || "Loading…"}</b><small>{t ? <>{fmtPhone(t.customer_phone)} · {sourceLabel(t.source)}{t.status === "booked" ? " · Booked" : t.status === "opted_out" ? " · Opted out" : ""}</> : " "}</small></div>
      {t && <div className="acts-row" style={{ flexWrap: "nowrap" }}>
        {onRecord && <button type="button" className="btn sm" onClick={onRecord}><Icon name="jobs" size={14} />{embedded ? "Open record" : "Record"}</button>}
        {t.status !== "opted_out" && t.status !== "booked" && <button type="button" className="btn sm" disabled={!!busy} onClick={() => void act("status", { status: "booked" }, "Marked booked.")}>Mark booked</button>}
        {canCall ? <button type="button" className="btn sm ic" title="Call" aria-label="Call" disabled={!!busy} onClick={() => void act("call", {}, "Calling your cell. Pick up and we'll connect them.")}><Icon name="phone" size={14} /></button>
          : <a className="btn sm ic" title="Call" aria-label="Call" href={`tel:${t.customer_phone}`}><Icon name="phone" size={14} /></a>}
      </div>}
    </header>
    <div className="texts">
      {texts === null ? <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12 }}><i className="skel" style={{ height: 36, width: "60%" }} /><i className="skel" style={{ height: 36, width: "70%", alignSelf: "flex-end" }} /><i className="skel" style={{ height: 36, width: "50%" }} /></div>
        : texts.length === 0 ? <Empty icon="chat" title="No texts yet" text="Anything you send goes from your business number." />
        : texts.map((x, i) => {
          const sep = dayKey(x.at) !== lastDay ? <p className="day" key={"d" + i}><span>{dayName(x.at)}</span></p> : null; lastDay = dayKey(x.at);
          if (x.author === "system") return <div key={i}>{sep}<p className="event"><span>{x.body}</span><time>{clock(x.at)}</time></p></div>;
          const who = x.direction === "in" ? "them" : x.author === "owner" ? "you" : "cinder";
          const prev = texts[i - 1];
          const prevWho = prev && prev.author !== "system" ? (prev.direction === "in" ? "them" : prev.author === "owner" ? "you" : "cinder") : "";
          const cont = !sep && prevWho === who && Date.parse(x.at) - Date.parse(prev!.at) < 5 * 60000;
          const photos = (x.media ?? []).map((_, k) => `/api/app/media?id=${x.id}&i=${k}`);
          const words = photos.length && /^\(sent (a photo|\d+ photos)\)$/.test(x.body) ? "" : x.body;
          return <div key={i} style={{ display: "flex", flexDirection: "column" }}>{sep}<article className={"msg " + (who === "them" ? "in" : "out") + (cont ? " cont" : "")}>
            {photos.length > 0 && <div className="photos">{photos.map(src => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="Photo from the customer" loading="lazy" /></a>)}</div>}
            {words && <span className={"bubble" + (who === "them" ? "" : who === "you" ? " out" : " cinder")}>{words}</span>}
            <small>{who === "them" ? first(name) : who === "cinder" ? "Cinder" : "You"} · {clock(x.at)}</small>
          </article></div>;
        })}
      <div ref={end} />
    </div>
    {t && t.status !== "opted_out" && <div className="compose">
      {editSnips && <SnippetEditor list={snips.list} onSave={snips.save} onClose={() => setEditSnips(false)} />}
      <form className="box" onSubmit={async e => { e.preventDefault(); if (draft.trim() && await act("reply", { body: draft }, "Sent from your business number.")) setDraft(""); }}>
        <ReplyKit hidden={!!draft.trim()} suggestion={sug} snippets={snips.list} onUse={x => { setDraft(x); ta.current?.focus(); }} onEdit={() => setEditSnips(true)} />
        <textarea ref={ta} rows={1} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (tabTakes(e, draft, sug, setDraft)) return; if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement)?.requestSubmit(); }} placeholder={`Text ${first(name)} from your business number`} aria-label="Reply" />
        <div className="tools">
          <button type="button" className={"who" + (mine ? " on" : "")} disabled={!!busy || (!mine && t.status === "booked")} onClick={() => void (mine ? act("status", { status: "auto" }, "Cinder will handle replies again.") : act("status", { status: "paused" }, "Cinder stepped back. You've got this one."))}>
            <i aria-hidden="true" />{mine ? "You're replying" : "Cinder is replying"}</button>
          <button type="submit" className="btn ink sm send" disabled={!!busy || !draft.trim()} aria-label="Send">{busy === "reply" ? <Spinner /> : <><Icon name="send" size={14} />Send</>}</button>
        </div>
      </form>
    </div>}
  </section>;
}
