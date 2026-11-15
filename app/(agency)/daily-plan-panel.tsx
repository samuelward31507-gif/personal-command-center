"use client";

import { useEffect, useState } from "react";

// The founder's repeatable routine and daily notes (moved here from the old My day view). Saved by date.
export const ROUTINE = [
  { start: 5, time: "5:00–7:00 AM", title: "Gym", detail: "Training and personal health", category: "Personal" },
  { start: 7, time: "7:00–7:30 AM", title: "Reset & breakfast", detail: "Shower, eat, and get set up", category: "Personal" },
  { start: 7.5, time: "7:30–9:00 AM", title: "Trading", detail: "Protected trading block", category: "Focus" },
  { start: 9, time: "9:00–9:30 AM", title: "Founder review", detail: "Review priorities, pipeline, and today's plan", category: "Planning" },
  { start: 9.5, time: "9:30 AM–12:00 PM", title: "Customer acquisition", detail: "Prospecting, cold calls, meetings, and follow-ups", category: "Revenue" },
  { start: 12, time: "12:00–1:00 PM", title: "Lunch & reset", detail: "Take a proper break", category: "Personal" },
  { start: 13, time: "1:00–4:00 PM", title: "Client delivery & product", detail: "Build, improve, and deliver high-value work", category: "Execution" },
  { start: 16, time: "4:00–6:00 PM", title: "Sales & opportunities", detail: "Follow-ups, demos, proposals, and closing", category: "Revenue" },
  { start: 18, time: "6:00–8:00 PM", title: "High-value projects", detail: "Move the most important project forward", category: "Execution" },
  { start: 20, time: "8:00–9:00 PM", title: "Review & prepare", detail: "Log outcomes and set tomorrow's priorities", category: "Planning" },
] as const;

const localKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function DailyPlanPanel() {
  const [date] = useState(localKey);
  const [done, setDone] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/daily-plan?date=" + date, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (!live) return; setDone(Array.isArray(d.plan?.completedBlocks) ? d.plan.completedBlocks : []); setNotes(typeof d.plan?.notes === "string" ? d.plan.notes : ""); })
      .catch(() => live && setMsg("Daily plan couldn't load. Edits won't save until it does."));
    return () => { live = false; };
  }, [date]);

  async function save(nextDone = done, nextNotes = notes) {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/daily-plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, completedBlocks: nextDone, notes: nextNotes }) });
      if (!r.ok) throw new Error();
      setMsg("Saved");
      setTimeout(() => setMsg(""), 1500);
    } catch { setMsg("Couldn't save. Try again."); }
    finally { setSaving(false); }
  }
  function toggle(id: string) {
    const next = done.includes(id) ? done.filter(x => x !== id) : [...done, id];
    setDone(next); void save(next);
  }
  const count = done.filter(x => x.startsWith("routine:")).length;
  const now = new Date(), hour = now.getHours() + now.getMinutes() / 60;

  return <section className="td-plan">
    <div className="td-plan-grid">
      <div className="td-box">
        <button data-variant="primary" className="td-plan-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span><strong>Daily routine</strong><small>{count} / {ROUTINE.length} blocks done</small></span><span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        {open && <ul className="td-routine">{ROUTINE.map((b, i) => {
          const id = "routine:" + i, isDone = done.includes(id);
          const nextStart = ROUTINE[i + 1]?.start ?? 24, isNow = hour >= b.start && hour < nextStart;
          return <li key={id} className={(isDone ? "is-done " : "") + (isNow ? "is-now" : "")}>
            <button data-variant="primary" className="td-check" aria-label={isDone ? "Mark incomplete" : "Mark complete"} onClick={() => toggle(id)}>{isDone ? "✓" : ""}</button>
            <span className="td-time">{b.time}</span><span className="td-what"><strong>{b.title}</strong><small>{b.detail}</small></span>
          </li>;
        })}</ul>}
      </div>
      <div className="td-box">
        <label className="td-notes"><strong>Notes for today</strong>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => void save()} placeholder="What matters today? Who needs a follow-up? What did you learn?" />
        </label>
        <div className="td-notes-foot"><small>{saving ? "Saving…" : msg || "Saves when you click away."}</small></div>
      </div>
    </div>
  </section>;
}
