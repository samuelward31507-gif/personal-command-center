"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KINDS } from "@/lib/compliance";
import { TIER1_PLAYBOOK, TIER2_EXTRAS } from "@/lib/deal-handoff";
import { LAUNCH_STEPS } from "@/lib/client-ops";
import "./operations.css";

type Item = { id: string; title: string; kind: string; dueDate: string | null; status: string; repeatMonths: number | null; note: string; state: string };
type Data = { today: string; items: Item[]; texting: { projectId: string; name: string; status: string; submitted: string | null }[]; suggestions: { title: string; kind: string; repeatMonths: number | null; note: string; dueDate: string | null }[] };
const NB = { background: "transparent" };
const fmt = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "No date");
const STATE: Record<string, string> = { overdue: "Overdue", due_soon: "Due soon", upcoming: "Upcoming", no_date: "Add a date", done: "Done" };
const MONTHLY = ["Monday: check every lead got its first reply in under 60 seconds", "Monday: read 5 real conversations per client and fix anything off", "1st of the month: send each client's report (Clients → Monthly report)", "1st of the month: bill retainers (Money → Bill this month)", "Quarterly: 20-minute review call and the right upsell"];

/** Operations: deadlines that keep the business legal and running, each client's texting registration, and the playbook. */
export default function OperationsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", kind: "other", dueDate: "", repeatMonths: "", note: "" });
  const [tab, setTab] = useState<"deadlines" | "playbook">("deadlines");
  const load = () => fetch("/api/compliance", { cache: "no-store" }).then(r => (r.ok ? r.json() : Promise.reject())).then(setD).catch(() => setError("Couldn't load operations."));
  useEffect(() => { void load(); }, []);

  async function post(body: Record<string, unknown>) {
    setError("");
    const r = await fetch("/api/compliance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || "Couldn't save that."); return false; }
    setD(j); return true;
  }

  const open = d?.items.filter(i => i.status === "open") ?? [];
  const done = d?.items.filter(i => i.status === "done").slice(0, 8) ?? [];
  return <main className="ops-page">
    <h1>Operations</h1>
    <p className="ops-sub">Deadlines, registrations and the playbook that keep the business running.</p>
    <div className="ops-tabs" role="tablist">{(["deadlines", "playbook"] as const).map(k => <button key={k} type="button" role="tab" aria-selected={tab === k} style={{ background: tab === k ? "#2c2c2c" : "transparent" }} onClick={() => setTab(k)}>{k === "deadlines" ? "Deadlines" : "Playbook"}</button>)}</div>
    {error && <p className="ops-err" role="alert">{error}</p>}

    {tab === "deadlines" && <>
      <section className="ops-card">
        <h2>Coming up</h2>
        {!d ? <p className="ops-muted">Loading…</p> : open.length === 0 ? <p className="ops-muted">Nothing tracked yet. Add the common items below.</p>
        : <ul className="ops-list">{open.map(i => <li key={i.id} className={"is-" + i.state}>
            <div><strong>{i.title}</strong><small>{[i.kind, i.repeatMonths ? `every ${i.repeatMonths === 12 ? "year" : i.repeatMonths === 1 ? "month" : i.repeatMonths + " months"}` : "", i.note].filter(Boolean).join(" · ")}</small></div>
            <input type="date" value={i.dueDate ?? ""} aria-label={"Due date for " + i.title} onChange={e => void post({ action: "update", id: i.id, title: i.title, kind: i.kind, dueDate: e.target.value, repeatMonths: i.repeatMonths, note: i.note })} />
            <em>{STATE[i.state]}</em>
            <div className="ops-acts"><button type="button" style={NB} onClick={() => void post({ action: "done", id: i.id })}>Done</button><button type="button" style={NB} className="ops-x" aria-label={"Remove " + i.title} onClick={() => { if (confirm(`Remove "${i.title}"?`)) void post({ action: "remove", id: i.id }); }}>×</button></div>
          </li>)}</ul>}
        {d && d.suggestions.length > 0 && <div className="ops-sugg"><h3>Common items</h3><div>{d.suggestions.map(s => <button key={s.title} type="button" style={NB} onClick={() => void post({ action: "add", ...s })}>+ {s.title}</button>)}</div></div>}
        <form className="ops-add" onSubmit={async e => { e.preventDefault(); if (await post({ action: "add", ...form, repeatMonths: form.repeatMonths ? Number(form.repeatMonths) : null })) setForm({ title: "", kind: "other", dueDate: "", repeatMonths: "", note: "" }); }}>
          <input placeholder="Something else to track" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{KINDS.map(k => <option key={k}>{k}</option>)}</select>
          <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          <select value={form.repeatMonths} onChange={e => setForm({ ...form, repeatMonths: e.target.value })}><option value="">One time</option><option value="1">Monthly</option><option value="3">Quarterly</option><option value="12">Yearly</option></select>
          <button type="submit" className="ops-primary" disabled={!form.title.trim()}>Add</button>
        </form>
        {done.length > 0 && <details className="ops-done"><summary>Recently done</summary><ul>{done.map(i => <li key={i.id}>{i.title} · {fmt(i.dueDate)}</li>)}</ul></details>}
      </section>

      <section className="ops-card">
        <h2>Texting registration by client</h2>
        <p className="ops-muted">No live texts until a client&apos;s registration is approved. Update the status on each client&apos;s setup sheet.</p>
        {!d ? null : d.texting.length === 0 ? <p className="ops-muted">No active clients with a setup sheet yet.</p>
        : <ul className="ops-list">{d.texting.map(t => <li key={t.projectId} className={t.status === "Approved" ? "is-done" : t.status === "Rejected" ? "is-overdue" : ""}>
            <div><strong><Link href={`/crm/client-success/${t.projectId}`}>{t.name}</Link></strong><small>{t.submitted ? `Submitted ${t.submitted}` : "Not submitted"}</small></div><em>{t.status}</em></li>)}</ul>}
      </section>
    </>}

    {tab === "playbook" && <>
      <section className="ops-card">
        <h2>Tier 1 build</h2>
        <p className="ops-muted">Created automatically as the delivery plan when a Tier 1 or Tier 2 deal is won. Days count from the agreement date.</p>
        <ol className="ops-steps">{TIER1_PLAYBOOK.map(s => <li key={s.title}><span>Day {s.dueInDays}</span><div><strong>{s.title}</strong><small>{s.description}</small></div></li>)}</ol>
      </section>
      <section className="ops-card"><h2>Tier 2 additions</h2>
        <ol className="ops-steps">{TIER2_EXTRAS.map(s => <li key={s.title}><span>Day {s.dueInDays}</span><div><strong>{s.title}</strong><small>{s.description}</small></div></li>)}</ol></section>
      <section className="ops-card"><h2>Launch test</h2><p className="ops-muted">Run it on each client&apos;s page under Launch test.</p>
        <ol className="ops-steps">{LAUNCH_STEPS.map((s, i) => <li key={s.key}><span>{i + 1}</span><div><strong>{s.label}</strong></div></li>)}</ol></section>
      <section className="ops-card"><h2>Every week and month</h2>
        <ul className="ops-steps">{MONTHLY.map(m => <li key={m}><span>•</span><div><strong>{m}</strong></div></li>)}</ul></section>
    </>}
  </main>;
}
