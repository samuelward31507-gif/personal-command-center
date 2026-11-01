"use client";

import { useEffect, useState } from "react";
import { LAUNCH_STEPS, SETUP_FIELDS, type Launch, type Message } from "@/lib/client-ops";
import "./ops-panel.css";

type Ops = {
  setup: Record<string, string>; gaps: string[]; messages: Message[]; launch: Launch; tier2: boolean;
  launchState: { passed: number; total: number; failed: string[]; ready: boolean };
  clock: { state: string; day: number; of: number; deadline: string | null; label: string };
  approval: { link: string | null; sentAt: string | null; approvedAt: string | null; approvedBy: string; allApproved: boolean };
  portal: { link: string | null };
};
type Tab = "setup" | "messages" | "launch" | "share";
/** Inline background lets these buttons opt out of the app-wide button paint; the CSS sets the real colors. */
const NB = { background: "transparent" };
const fmt = (d: string | null) => (d ? new Date(d.length > 10 ? d : d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const GROUPS = [...new Set(SETUP_FIELDS.map(f => f.group))];

/** Build operations for one client: guarantee clock, setup sheet, message approval, launch test and the client portal link. */
export default function OpsPanel({ projectId }: { projectId: string }) {
  const [ops, setOps] = useState<Ops | null>(null);
  const [tab, setTab] = useState<Tab>("setup");
  const [setup, setSetup] = useState<Record<string, string>>({});
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [launch, setLaunch] = useState<Launch>({ steps: {} });
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState("");

  const take = (d: Ops) => { setOps(d); setSetup(d.setup); setMsgs(d.messages); setLaunch(d.launch); };
  useEffect(() => {
    fetch("/api/client-ops?project=" + encodeURIComponent(projectId), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null)).then(d => { if (d) take(d); }).catch(() => {});
  }, [projectId]);

  async function act(action: string, extra: Record<string, unknown>, done: string) {
    setBusy(action); setNote(null);
    try {
      const r = await fetch("/api/client-ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: projectId, action, ...extra }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save that.");
      take(d); setNote({ ok: true, text: done });
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't save that." }); }
    setBusy("");
  }
  async function copy(link: string) { try { await navigator.clipboard.writeText(link); setCopied(link); setTimeout(() => setCopied(""), 1600); } catch { window.prompt("Copy this link", link); } }

  if (!ops) return null;
  const c = ops.clock;
  const step = (k: string) => launch.steps[k] ?? {};
  const setStep = (k: string, v: Partial<Launch["steps"][string]>) => setLaunch(l => ({ ...l, steps: { ...l.steps, [k]: { ...l.steps[k], ...v, at: new Date().toISOString() } } }));
  const msgSummary = ops.approval.allApproved ? "All approved" : msgs.length ? `${msgs.filter(m => m.status === "approved").length} of ${msgs.length} approved` : "Not drafted";

  return <section className="op-card">
    <div className={"op-clock is-" + c.state}>
      <div><small>Go-live guarantee</small><strong>{c.label}</strong>{c.deadline && c.state !== "live" && <span>Deadline {fmt(c.deadline)}</span>}</div>
      {c.state !== "not_started" && c.state !== "live" && <div className="op-bar" aria-hidden="true"><i style={{ width: Math.min(100, (c.day / c.of) * 100) + "%" }} /></div>}
    </div>

    <div className="op-tabs" role="tablist" aria-label="Build operations">
      {([["setup", "Setup sheet", ops.gaps.length ? `${ops.gaps.length} missing` : "Complete"], ["messages", "Messages", msgSummary], ["launch", "Launch test", `${ops.launchState.passed} of ${ops.launchState.total}`], ["share", "Client portal", ops.portal.link ? "On" : "Off"]] as const).map(([k, label, sub]) =>
        <button key={k} type="button" role="tab" aria-selected={tab === k} style={{ background: tab === k ? "#262626" : "transparent" }} onClick={() => setTab(k)}><b>{label}</b><small>{sub}</small></button>)}
    </div>
    {note && <p className={"op-note " + (note.ok ? "ok" : "bad")} role="status">{note.text}</p>}

    {tab === "setup" && <div>
      {ops.gaps.length > 0 && <p className="op-hint">Still needed before the build: {ops.gaps.join(", ")}.</p>}
      {GROUPS.map(g => <fieldset key={g} className="op-group"><legend>{g}</legend><div className="op-fields">
        {SETUP_FIELDS.filter(f => f.group === g).map(f => <label key={f.key} className={f.long ? "wide" : ""}><span>{f.label}</span>
          {f.options ? <select value={setup[f.key] ?? ""} onChange={e => setSetup({ ...setup, [f.key]: e.target.value })}><option value="">Choose</option>{f.options.map(o => <option key={o}>{o}</option>)}</select>
            : f.long ? <textarea rows={2} value={setup[f.key] ?? ""} onChange={e => setSetup({ ...setup, [f.key]: e.target.value })} />
            : <input value={setup[f.key] ?? ""} onChange={e => setSetup({ ...setup, [f.key]: e.target.value })} />}
          {f.help && <small>{f.help}</small>}</label>)}
      </div></fieldset>)}
      <div className="op-acts"><button type="button" style={NB} className="op-primary" disabled={!!busy} onClick={() => act("setup", { setup }, "Setup sheet saved.")}>{busy === "setup" ? "Saving…" : "Save setup sheet"}</button></div>
    </div>}

    {tab === "messages" && <div>
      <p className="op-hint">Every text the system sends, in the client&apos;s voice. They approve each one on a private page; nothing launches without it. {"{first}"} and {"{time}"} fill in automatically.</p>
      {!msgs.length ? <button type="button" style={NB} className="op-primary" disabled={!!busy} onClick={() => act("draft-messages", {}, "Drafted from the setup sheet.")}>{busy ? "Drafting…" : "Draft messages from the setup sheet"}</button>
      : <>
        <ol className="op-msgs">{msgs.map((m, i) => <li key={m.key} className={"is-" + m.status}>
          <div className="op-msg-h"><b>{m.label}</b><span>{m.status === "approved" ? "Approved" : m.status === "changes" ? "Change requested" : "Draft"}</span></div>
          <textarea rows={3} value={m.body} onChange={e => setMsgs(msgs.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
          {m.clientNote && <p className="op-client-note">They said: {m.clientNote}</p>}
        </li>)}</ol>
        <div className="op-acts">
          <button type="button" style={NB} className="op-primary" disabled={!!busy} onClick={() => act("messages", { messages: msgs }, "Messages saved. Edited ones go back to draft.")}>{busy === "messages" ? "Saving…" : "Save wording"}</button>
          <button type="button" style={NB} disabled={!!busy} onClick={async () => { await act("approval-link", {}, "Approval link ready. Send it to the client."); }}>{ops.approval.link ? "Refresh approval link" : "Create approval link"}</button>
          {ops.approval.link && <button type="button" style={NB} onClick={() => copy(ops.approval.link!)}>{copied === ops.approval.link ? "Copied" : "Copy approval link"}</button>}
          <button type="button" style={NB} disabled={!!busy} onClick={() => { if (confirm("Replace all messages with fresh drafts from the setup sheet?")) void act("draft-messages", {}, "Redrafted."); }}>Redraft</button>
        </div>
        {ops.approval.approvedAt && <p className="op-ok">Approved by {ops.approval.approvedBy || "the client"} on {fmt(ops.approval.approvedAt)}.</p>}
      </>}
    </div>}

    {tab === "launch" && <div>
      <p className="op-hint">Run every path from your own phone. Timed replies over 60 seconds fail. Launch is ready when every step passes and the owner says go.</p>
      <ol className="op-steps">{LAUNCH_STEPS.filter(s => ops.tier2 || s.key !== "followups").map(s => {
        const v = step(s.key);
        return <li key={s.key} className={v.pass === true ? "pass" : v.pass === false ? "fail" : ""}>
          <span className="op-step-l">{s.label}</span>
          {s.timed && <label className="op-sec"><input type="number" min={0} placeholder="sec" value={v.seconds ?? ""} onChange={e => setStep(s.key, { seconds: e.target.value === "" ? null : Number(e.target.value) })} />s</label>}
          <div className="op-pf"><button type="button" style={NB} aria-pressed={v.pass === true} onClick={() => setStep(s.key, { pass: true })}>Pass</button><button type="button" style={NB} aria-pressed={v.pass === false} onClick={() => setStep(s.key, { pass: false })}>Fail</button></div>
        </li>;
      })}</ol>
      <label className="op-owner"><span>Owner&apos;s go-ahead (paste their message, e.g. &quot;approved, go live&quot;)</span><input value={launch.ownerOk ?? ""} onChange={e => setLaunch({ ...launch, ownerOk: e.target.value, ownerOkAt: new Date().toISOString() })} /></label>
      {ops.launchState.failed.length > 0 && <p className="op-bad">Fix before launch: {ops.launchState.failed.join("; ")}.</p>}
      <div className="op-acts"><button type="button" style={NB} className="op-primary" disabled={!!busy} onClick={() => act("launch", { launch }, "Launch test saved.")}>{busy === "launch" ? "Saving…" : "Save test results"}</button>
        {ops.launchState.ready && <span className="op-ok">Ready to launch. Mark &quot;Go live&quot; done in the delivery plan.</span>}</div>
    </div>}

    {tab === "share" && <div>
      <p className="op-hint">One private page for the client: where the build is, what&apos;s waiting on them, their reports and invoices. Fewer &quot;where are we at?&quot; messages.</p>
      <div className="op-acts">
        {!ops.portal.link ? <button type="button" style={NB} className="op-primary" disabled={!!busy} onClick={() => act("portal-link", {}, "Portal is on.")}>Turn on the client portal</button>
          : <><button type="button" style={NB} className="op-primary" onClick={() => copy(ops.portal.link!)}>{copied === ops.portal.link ? "Copied" : "Copy portal link"}</button><a className="op-link" href={ops.portal.link} target="_blank" rel="noreferrer">View as client</a></>}
      </div>
    </div>}
  </section>;
}
