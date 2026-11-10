"use client";

// "Find emails" on the Email page: checks each contact's own website for a business email and saves it,
// 20 sites at a time, until every site has been checked once.
import { useEffect, useRef, useState } from "react";

export default function FindEmails({ onDone }: { onDone?: () => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const [run, setRun] = useState<{ checked: number; found: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const stop = useRef(false);
  useEffect(() => { fetch("/api/contacts/find-emails", { cache: "no-store" }).then(r => r.json()).then(j => setLeft(j.left ?? 0)).catch(() => setLeft(null)); }, []);
  async function go() {
    setBusy(true); setErr(""); stop.current = false; let checked = 0, found = 0;
    try {
      for (;;) {
        const r = await fetch("/api/contacts/find-emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 20 }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Couldn't check websites.");
        checked += j.checked; found += j.found; setRun({ checked, found }); setLeft(j.left);
        if (!j.checked || !j.left || stop.current) break;
      }
      onDone?.();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't check websites. Try again."); }
    setBusy(false);
  }
  if (left === null || (left === 0 && !run)) return null;
  return <section className="u-sheet em-find" aria-label="Find emails">
    <div className="u-h2-row"><h2 className="u-h2">Find emails <span className="u-quiet">{left} websites to check</span></h2></div>
    <p className="u-note">Checks each contact's own website for a business email and saves it to the contact. Each site is checked once.</p>
    {run && <p className="u-note" role="status">Checked {run.checked} sites, found {run.found} emails{busy ? "…" : "."}</p>}
    {err && <p className="u-note" role="alert">{err}</p>}
    <div className="u-row">{busy ? <button type="button" className="u-btn u-btn-light" onClick={() => { stop.current = true; }}>Stop</button>
      : left > 0 && <button type="button" className="u-btn u-btn-go" onClick={() => void go()}>Find emails</button>}</div>
  </section>;
}
