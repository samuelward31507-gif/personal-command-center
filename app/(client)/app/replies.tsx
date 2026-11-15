"use client";

// Help in the reply box, in the Superhuman spirit: the box always offers a reply worth sending, and the owner's own
// saved replies are one tap away. Nothing here sends anything; it only fills the draft for the owner to read and send.
import React, { useEffect, useState } from "react";
import { Icon, first } from "./parts";
import type { Text } from "./types";

/** The owner's saved replies, kept on this device per business. Starts with four that fit most trades. */
const DEFAULTS = ["On my way, be there in about 20 minutes.", "I'll call you in 10 minutes.", "Sending your quote over now.", "Can you text me a photo or two of the area?"];
const keyOf = (project: string) => `cinder.snips.${project || "demo"}`;
export function useSnippets(project: string) {
  const [list, setList] = useState<string[]>(DEFAULTS);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(keyOf(project)) || "null"); if (Array.isArray(v) && v.every(s => typeof s === "string")) setList(v); } catch { /* keep defaults */ } }, [project]);
  const save = (next: string[]) => { setList(next); try { localStorage.setItem(keyOf(project), JSON.stringify(next)); } catch { /* private mode */ } };
  return { list, save };
}

/** A reply that fits where the conversation stands: what they last asked, or the next step if nobody's said anything. */
export function suggestReply(name: string, texts: Text[] | null, opts: { stage?: string; owner?: string; quoteAmount?: number | null } = {}): string {
  const n = /^[A-Za-z]/.test((name || "").trim()) && first(name) !== "them" ? first(name) : "";
  const hi = n ? `Hi ${n}, ` : "Hi, ";
  const list = texts ?? [];
  const lastIn = [...list].reverse().find(t => t.direction === "in" || t.direction === "inbound");
  const lastAny = list.at(-1);
  const theirs = lastIn && lastAny && lastIn.id === lastAny.id ? (lastIn.body || "").toLowerCase() : "";
  const photo = !!lastIn?.media?.length && lastIn.id === lastAny?.id;

  if (photo) return `Thanks${n ? ` ${n}` : ""}, got the photos. That helps a lot. I'll have a number for you shortly.`;
  if (theirs) {
    if (/\b(how much|price|cost|estimate|quote|ballpark)\b/.test(theirs)) return `${hi}happy to get you a real number. Easiest is a quick look in person. I can come by tomorrow morning or afternoon, which works better?`;
    if (/\b(when|what time|available|availability|schedule|today|tomorrow)\b/.test(theirs)) return `${hi}I can do tomorrow morning or later this week. What day works best for you?`;
    if (/\b(paid|sent (the )?payment|venmo|zelle|check)\b/.test(theirs)) return `Thanks${n ? ` ${n}` : ""}! I'll confirm it came through and send a receipt.`;
    if (/\b(thanks|thank you|appreciate|great|sounds good|perfect|ok|okay)\b/.test(theirs)) return `You bet${n ? `, ${n}` : ""}. Text me here anytime if anything comes up.`;
    if (/\b(cancel|reschedule|move|push)\b/.test(theirs)) return `${hi}no problem at all. What day and time would work better?`;
    if (/\?\s*$/.test(theirs)) return `${hi}good question. Let me check and get right back to you.`;
    return `${hi}got it, thanks. I'll get back to you shortly.`;
  }
  // They haven't answered: the next step for where the job stands.
  if (opts.stage === "quoted") return `${hi}just checking you got the quote${opts.quoteAmount ? ` for $${Math.round(opts.quoteAmount).toLocaleString("en-US")}` : ""}. Any questions I can answer?`;
  if (opts.stage === "won") return `${hi}just confirming we're all set. I'll text you the day before we start.`;
  if (opts.stage === "booked") return `${hi}looking forward to seeing you. I'll text when I'm on the way.`;
  if (!list.length) return `${hi}this is ${opts.owner ? first(opts.owner) : "us"}. What can I help you with?`;
  return `${hi}just following up. Still want to get this on the calendar?`;
}

/** Sits above the textarea: the suggested reply, then the saved ones. */
export function ReplyKit({ suggestion, snippets, onUse, onEdit, hidden }: { suggestion: string; snippets: string[]; onUse: (s: string) => void; onEdit: () => void; hidden?: boolean }) {
  if (hidden) return null;
  return <div className="kit">
    {suggestion && <button type="button" className="kit-sug" onClick={() => onUse(suggestion)} title="Put this in the reply box">
      <Icon name="bolt" size={13} /><span>{suggestion}</span><kbd>Tab</kbd></button>}
    <div className="kit-snips" role="list" aria-label="Saved replies">
      {snippets.map(s => <button key={s} type="button" role="listitem" onClick={() => onUse(s)} title={s}>{s}</button>)}
      <button type="button" className="kit-edit" onClick={onEdit} aria-label="Edit saved replies"><Icon name="edit" size={12} />Edit</button>
    </div>
  </div>;
}

/** Edit saved replies: one per line. */
export function SnippetEditor({ list, onSave, onClose }: { list: string[]; onSave: (l: string[]) => void; onClose: () => void }) {
  const [text, setText] = useState(list.join("\n"));
  return <div className="snip-ed" role="dialog" aria-label="Saved replies">
    <header><b>Saved replies</b><small>One per line. They show above the reply box.</small></header>
    <textarea rows={6} value={text} onChange={e => setText(e.target.value)} autoFocus />
    <footer>
      <button type="button" className="btn sm" onClick={onClose}>Cancel</button>
      <button type="button" className="btn ink sm" onClick={() => { onSave(text.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 12)); onClose(); }}>Save</button>
    </footer>
  </div>;
}

/** Tab in an empty reply box takes the suggestion. */
export function tabTakes(e: React.KeyboardEvent<HTMLTextAreaElement>, draft: string, suggestion: string, set: (s: string) => void) {
  if (e.key === "Tab" && !e.shiftKey && !draft.trim() && suggestion) { e.preventDefault(); set(suggestion); return true; }
  return false;
}
