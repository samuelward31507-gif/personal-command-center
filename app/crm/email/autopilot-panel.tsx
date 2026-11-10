"use client";

// Autopilot on the Email page: on/off, intros per day, Run now, and what the last run did.
import { useEffect, useState } from "react";

type Run = { at: string; sent: { company: string; email: string; personal: boolean }[]; skipped: number; stopped?: string; replies?: number; note?: string };
type S = { enabled: boolean; perDay: number; lastRun: Run | null };

export default function AutopilotPanel({ room, onRan }: { room: number; onRan?: () => void }) {
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "run">("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { fetch("/api/autopilot", { cache: "no-store" }).then(r => r.json()).then(setS).catch(() => setS(null)); }, []);
  async function save(next: Partial<S>) {
    if (!s) return; setBusy("save"); setErr("");
    try { const r = await fetch("/api/autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next.enabled ?? s.enabled, perDay: next.perDay ?? s.perDay }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setS(j); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); }
    setBusy("");
  }
  async function run() {
    if (!s || !confirm(`Run Autopilot now? It checks replies, writes a personal first line for each business and sends up to ${Math.min(room, s.perDay)} intros from your inboxes. It takes a few minutes. Keep this tab open.`)) return;
    setBusy("run"); setErr("");
    try { const r = await fetch("/api/autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run: true }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setS(x => x && { ...x, lastRun: j }); setOpen(true); onRan?.(); }
    catch (e) { setErr(e instanceof Error ? e.message : "The run didn't finish. Check the queue; anything sent is logged."); }
    setBusy("");
  }
  if (!s) return null;
  const last = s.lastRun;
  return <section className="u-sheet em-auto" aria-label="Autopilot">
    <div className="u-h2-row">
      <h2 className="u-h2">Autopilot <span className="u-quiet">{s.enabled ? "on, weekdays 8am to 2pm" : "off"}</span></h2>
      <label className="em-auto-toggle"><input type="checkbox" checked={s.enabled} disabled={!!busy} onChange={e => void save({ enabled: e.target.checked })} /><span>{s.enabled ? "On" : "Off"}</span></label>
    </div>
    <p className="u-note">Four times every weekday it checks every inbox for replies, writes a personal first line from each business's website, and sends new intros across your inboxes until it reaches today's goal or your inboxes are full. Follow-ups go out each morning. It never emails anyone you've talked to, anyone who replied, booked or asked to stop, or anyone parked.</p>
    <div className="u-row em-auto-row">
      <label>Intros per day <input type="number" min={5} max={200} step={5} value={s.perDay} disabled={!!busy} onChange={e => setS({ ...s, perDay: Number(e.target.value) })} onBlur={() => void save({ perDay: s.perDay })} /></label>
      <button type="button" className="u-btn u-btn-light" disabled={!!busy || room === 0} onClick={() => void run()}>{busy === "run" ? "Running…" : "Run now"}</button>
    </div>
    {err && <p className="u-note" role="alert">{err}</p>}
    {last && <div className="em-auto-last">
      <p className="u-note">Last run {new Date(last.at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}: sent {last.sent.length}{last.sent.length ? ` (${last.sent.filter(x => x.personal).length} with a personal line)` : ""}{last.skipped ? `, skipped ${last.skipped}` : ""}.{last.stopped ? ` Stopped: ${last.stopped}` : ""}{last.note ? ` ${last.note}` : ""}
        {last.sent.length > 0 && <> <button type="button" className="em-disc" onClick={() => setOpen(o => !o)}>{open ? "Hide" : "Show who"}</button></>}</p>
      {open && <ul className="em-auto-list">{last.sent.map(x => <li key={x.email}>{x.company} <span className="u-quiet">{x.email}</span></li>)}</ul>}
    </div>}
  </section>;
}
