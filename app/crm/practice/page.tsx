"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PERSONAS, type Persona, type Turn, type Scorecard } from "@/lib/practice";
import "./practice.css";

const NB = { background: "transparent" } as const;

/** Practice calls: Claude plays a fence or pool owner. Rep openers and objections before the real dials. Nothing is sent anywhere. */
export default function PracticePage() {
  const [persona, setPersona] = useState<Persona>("fence_busy");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"" | "reply" | "score">("");
  const [error, setError] = useState("");
  const [card, setCard] = useState<Scorecard | null>(null);
  const [reps, setReps] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [turns, card]);
  useEffect(() => { try { setReps(Number(localStorage.getItem("cinder.practice.reps." + new Date().toISOString().slice(0, 10)) || 0)); } catch { /* storage unavailable */ } }, []);

  async function call(action: "reply" | "score", next: Turn[]) {
    setBusy(action); setError("");
    try {
      const r = await fetch("/api/practice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona, turns: next, action }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong. Try again.");
      if (action === "score") {
        setCard(d.score);
        const n = reps + 1; setReps(n);
        try { localStorage.setItem("cinder.practice.reps." + new Date().toISOString().slice(0, 10), String(n)); } catch { /* ignore */ }
      } else setTurns([...next, { who: "owner", text: String(d.owner || "…") }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(""); box.current?.focus(); }
  }
  function start() { setTurns([]); setCard(null); void call("reply", []); }
  function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const next = [...turns, { who: "you" as const, text }];
    setTurns(next); setDraft("");
    void call("reply", next);
  }
  const live = turns.length > 0 && !card;

  return <div className="pr-page">
    <header className="pr-head">
      <h1>Practice calls</h1>
      <p>Cinder plays a contractor who doesn't want to talk to you. Get through the opener, handle the objections, ask for the meeting. Then get scored.</p>
      <div className="pr-reps">{reps} rep{reps === 1 ? "" : "s"} today · aim for 10</div>
    </header>

    {!live && <section className="pr-pick">
      <div className="pr-label">Who's picking up</div>
      <div className="pr-personas">{(Object.keys(PERSONAS) as Persona[]).map(k =>
        <button key={k} type="button" style={NB} className={"pr-persona" + (persona === k ? " is-on" : "")} aria-pressed={persona === k} onClick={() => setPersona(k)}>
          <b>{PERSONAS[k].label}</b><span>{PERSONAS[k].brief}</span>
        </button>)}</div>
      <button type="button" data-variant="primary" className="pr-start" disabled={!!busy} onClick={start}>{busy === "reply" ? "Dialing…" : card ? "Call again" : "Start the call"}</button>
    </section>}

    {turns.length > 0 && <section className="pr-call" aria-live="polite">
      <div className="pr-call-head"><b>{PERSONAS[persona].label}</b>{live && <button type="button" style={NB} className="pr-end" disabled={!!busy || !turns.some(t => t.who === "you")} onClick={() => void call("score", turns)}>{busy === "score" ? "Scoring…" : "End call and score"}</button>}</div>
      <div className="pr-thread">
        {turns.map((t, i) => <div key={i} className={"pr-msg " + (t.who === "you" ? "pr-you" : "pr-owner")}><small>{t.who === "you" ? "You" : "Owner"}</small>{t.text}</div>)}
        {busy === "reply" && <div className="pr-msg pr-owner pr-typing" aria-hidden="true"><i /><i /><i /></div>}
        <div ref={end} />
      </div>
      {live && <form className="pr-input" onSubmit={send}>
        <textarea ref={box} rows={2} value={draft} placeholder="Say it the way you would on the phone…" onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e as unknown as FormEvent); } }} autoFocus />
        <button type="submit" data-variant="primary" disabled={!draft.trim() || !!busy}>Say it</button>
      </form>}
    </section>}

    {error && <p className="pr-err" role="alert">{error}</p>}

    {card && <section className="pr-card">
      <div className="pr-score"><b>{card.score}</b><span>/100</span></div>
      <p className="pr-verdict">{card.verdict}</p>
      {card.wins.length > 0 && <><div className="pr-label">What worked</div><ul>{card.wins.map((w, i) => <li key={i}>{w}</li>)}</ul></>}
      {card.fixes.length > 0 && <><div className="pr-label">Fix next time</div><ul>{card.fixes.map((w, i) => <li key={i}>{w}</li>)}</ul></>}
      {card.betterLine && <><div className="pr-label">Say this instead</div><p className="pr-better">“{card.betterLine}”</p></>}
      <div className="pr-ai">Scored by AI. Use it as a sparring partner, not a verdict.</div>
    </section>}
    <div ref={end} />
  </div>;
}
