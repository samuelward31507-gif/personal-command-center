"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AskAction } from "@/lib/ask";
import { ActionCard, Markdown } from "./ask-answer";
import "./home-search.css";

type Turn = {
  id: number; query: string; status: string; draft: string;
  answer?: string; actions: AskAction[]; sources?: { url: string; title: string }[]; error?: string; done: boolean;
};

const SUGGESTIONS: { label: string; prompt: string; icon: "phone" | "chart" | "calendar" | "globe" }[] = [
  { label: "Who should I call today?", prompt: "Who should I call today?", icon: "phone" },
  { label: "What's my pipeline worth?", prompt: "What's my pipeline worth right now, and what's closest to closing?", icon: "chart" },
  { label: "My week", prompt: "What's on my calendar this week, and what do I need to prep?", icon: "calendar" },
  { label: "Research a market", prompt: "What do pool builders in Arizona usually charge for a new pool?", icon: "globe" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Up late, Samuel" : h < 12 ? "Good morning, Samuel" : h < 18 ? "Good afternoon, Samuel" : "Good evening, Samuel";
}

const Mark = ({ className = "" }: { className?: string }) =>
  <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z" /><circle cx="25.5" cy="16" r="3.1" /></svg>;

function Icon({ name }: { name: "up" | "stop" | "globe" | "copy" | "check" | "retry" | "new" | "phone" | "chart" | "calendar" }) {
  const p = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "up": return <svg {...p} strokeWidth={2.4}><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
    case "stop": return <svg {...p} fill="currentColor" stroke="none"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>;
    case "globe": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
    case "copy": return <svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>;
    case "check": return <svg {...p}><path d="M5 12l5 5 9-10" /></svg>;
    case "retry": return <svg {...p}><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" /></svg>;
    case "new": return <svg {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "phone": return <svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg>;
    case "chart": return <svg {...p}><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
  }
}

/** Ask Cinder — a chat over the whole business (and the web), styled like ChatGPT / Claude. */
export default function HomeSearch() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [web, setWeb] = useState(true);
  const [hello, setHello] = useState("Good evening, Samuel");
  const [copied, setCopied] = useState<number | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    setHello(greeting());
    try { if (localStorage.getItem("cinder.ask.web") === "off") setWeb(false); } catch { /* storage unavailable */ }
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); box.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    box.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const el = bottom.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { atBottom.current = e.isIntersecting; }, { rootMargin: "0px 0px 160px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [turns.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (atBottom.current) bottom.current?.scrollIntoView({ block: "end" }); }, [turns]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [input]);

  function toggleWeb() {
    setWeb(v => { try { localStorage.setItem("cinder.ask.web", v ? "off" : "on"); } catch { /* ignore */ } return !v; });
  }

  async function ask(text: string, base: Turn[] = turns) {
    const q = text.trim();
    if (!q || busy) return;
    const ctrl = new AbortController(); abort.current = ctrl;
    const id = Date.now();
    const history = base.filter(t => t.answer).flatMap(t => [{ role: "user", content: t.query }, { role: "assistant", content: t.answer! }]);
    setTurns([...base, { id, query: q, status: "Thinking", draft: "", actions: [], done: false }]);
    setInput(""); setBusy(true); atBottom.current = true;
    const update = (fn: (t: Turn) => Turn) => setTurns(old => old.map(t => (t.id === id ? fn(t) : t)));
    try {
      const now = new Date();
      const tomorrow = new Date(now); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/ask", {
        method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, history, web, today, dayEnd: tomorrow.toISOString(), windowEnd: dayAfter.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, tzOffsetMinutes: now.getTimezoneOffset() }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(res.status === 401 ? "Sign in to use Cinder." : data.error || "Cinder is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: { type: string; text?: string; error?: string; action?: AskAction; actions?: AskAction[]; sources?: Turn["sources"] };
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === "status") update(t => ({ ...t, status: ev.text ?? t.status }));
          else if (ev.type === "delta") update(t => ({ ...t, draft: t.draft + (ev.text ?? "") }));
          else if (ev.type === "reset") update(t => ({ ...t, draft: "" }));
          else if (ev.type === "action" && ev.action) update(t => ({ ...t, actions: [...t.actions, ev.action!] }));
          else if (ev.type === "answer") { finished = true; update(t => ({ ...t, answer: ev.text, actions: ev.actions ?? t.actions, sources: ev.sources, done: true })); }
          else if (ev.type === "error") { finished = true; update(t => ({ ...t, error: ev.error, done: true })); }
        }
      }
      if (!finished) update(t => ({ ...t, error: "The answer was cut off. Try again.", done: true }));
    } catch (e) {
      if ((e as Error).name === "AbortError") update(t => ({ ...t, answer: t.draft.trim() || undefined, error: t.draft.trim() ? undefined : "Stopped.", done: true }));
      else update(t => ({ ...t, error: e instanceof Error ? e.message : "Cinder is unavailable right now.", done: true }));
    } finally { setBusy(false); abort.current = null; }
  }

  function retry(id: number) {
    const i = turns.findIndex(t => t.id === id);
    if (i >= 0) void ask(turns[i].query, turns.slice(0, i));
  }
  function copy(t: Turn) {
    navigator.clipboard?.writeText(t.answer ?? "").then(() => { setCopied(t.id); setTimeout(() => setCopied(null), 1400); }).catch(() => {});
  }
  function reset() { abort.current?.abort(); setTurns([]); setInput(""); setTimeout(() => box.current?.focus(), 0); }
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(input); }
  }

  const chat = turns.length > 0;
  const composer = <div className="ask-composer-wrap">
    <form className={"ask-composer" + (busy ? " is-busy" : "")} onSubmit={e => { e.preventDefault(); void ask(input); }} onClick={() => box.current?.focus()}>
      <textarea
        ref={box} rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
        placeholder={chat ? "Reply to Cinder…" : "Ask anything, or tell Cinder what to do"} aria-label="Message Cinder" spellCheck={false}
      />
      <div className="ask-composer-row">
        <div className="ask-tools">
          <button type="button" className={"ask-tool" + (web ? " is-on" : "")} onClick={e => { e.stopPropagation(); toggleWeb(); }} aria-pressed={web} title={web ? "Web search on" : "Web search off"}>
            <Icon name="globe" /><span>Web</span>
          </button>
          {chat && <button type="button" className="ask-tool" onClick={e => { e.stopPropagation(); reset(); }} title="Start a new chat"><Icon name="new" /><span>New chat</span></button>}
        </div>
        {busy
          ? <button type="button" className="ask-send is-stop" onClick={e => { e.stopPropagation(); abort.current?.abort(); }} aria-label="Stop"><Icon name="stop" /></button>
          : <button type="submit" className="ask-send" disabled={!input.trim()} aria-label="Send"><Icon name="up" /></button>}
      </div>
    </form>
    {chat && <p className="ask-fineprint">Cinder can make mistakes. Nothing changes until you confirm it.</p>}
  </div>;

  if (!chat) return <div className="ask-root ask-root-empty">
    <div className="ask-hero">
      <h1 className="ask-hello"><Mark className="ask-hello-mark" />{hello}</h1>
      {composer}
      <div className="ask-suggest">
        {SUGGESTIONS.map(s => <button key={s.label} type="button" className="ask-pill" onClick={() => void ask(s.prompt)}><Icon name={s.icon} />{s.label}</button>)}
      </div>
    </div>
  </div>;

  return <div className="ask-root ask-root-chat">
    <div className="ask-thread">
      {turns.map(t => <div key={t.id} className="ask-exchange">
        <div className="ask-user"><div className="ask-bubble">{t.query}</div></div>
        <div className="ask-bot">
          <div className={"ask-avatar" + (!t.done ? " is-live" : "")}><Mark /></div>
          <div className="ask-body">
            {t.error && !t.answer && <div className="ask-err" role="alert">{t.error}</div>}
            {(t.answer ?? t.draft) ? <Markdown text={t.answer ?? t.draft} /> : !t.done && <div className="ask-think">{t.status}…</div>}
            {!t.done && (t.draft) && <div className="ask-think ask-think-inline">{t.status === "Writing" || t.status === "Thinking" ? "" : t.status + "…"}</div>}
            {t.actions.length > 0 && <div className="ask-actions">{t.actions.map((a, i) => <ActionCard key={i} action={a} />)}</div>}
            {!!t.sources?.length && <div className="ask-sources">{t.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer"><span>{hostOf(s.url)}</span>{s.title.slice(0, 70)}</a>)}</div>}
            {t.done && <div className="ask-tools-row">
              {t.answer && <button type="button" className="ask-icon-btn" onClick={() => copy(t)} title="Copy"><Icon name={copied === t.id ? "check" : "copy"} /></button>}
              <button type="button" className="ask-icon-btn" onClick={() => retry(t.id)} disabled={busy} title="Retry"><Icon name="retry" /></button>
            </div>}
          </div>
        </div>
      </div>)}
      <div ref={bottom} className="ask-bottom" />
    </div>
    {composer}
  </div>;
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
