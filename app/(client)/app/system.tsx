"use client";

// Settings, three views. Connections: where leads come from and where they go, each with its real state, a test
// button and the log of what happened. Agent: what Cinder says and does, in plain words, with a preview that
// answers a made-up lead using the unsaved form. Account: the business, this device, sign out.
import { useState } from "react";
import { Icon, Spinner, ago, fmtPhone, typePhone, type Api, type Toast } from "./parts";
import { sourceLabel, type Biz, type Data, type Go } from "./types";

type View = "connections" | "agent" | "account";
type State = "on" | "todo" | "off" | "bad";
const WORD: Record<State, string> = { on: "Live", todo: "Needs setup", off: "Not used", bad: "Error" };

// ---------- Connections ----------
type Source = { key: string; name: string; what: string; steps: string[]; match: string[] };
const SOURCES: Source[] = [
  { key: "number", name: "Calls and texts", what: "Your Cinder number. A missed call gets a text back in seconds, and every text a lead sends starts a conversation.", match: ["missed_call", "text"],
    steps: ["Forward your main line to the Cinder number when busy or unanswered (your carrier's *72 or the setting in your phone app).", "Put the Cinder number on your site, Google profile and trucks, or keep your own and forward.", "Send a test from here and check your cell."] },
  { key: "web chat", name: "Website chat", what: "A small chat bubble on your site. The visitor leaves a name, cell and question. The reply comes by text.", match: ["web chat"],
    steps: ["Copy the snippet below.", "Paste it once on your site, before the closing body tag (or in your site builder's custom code box).", "Load your site and send a message through the bubble."] },
  { key: "web form", name: "Website form", what: "Any contact form, landing page or form tool posts to this address. Each submission gets a text back right away.", match: ["web form", "zapier"],
    steps: ["Copy the address below.", "In your form tool, add a webhook (sometimes called an integration or a notification URL) and paste it. JSON or a normal form post both work.", "Send a test here, then submit your real form once."] },
  { key: "angi", name: "Angi", what: "Angi leads hear back from you in seconds, before the other three pros do.", match: ["angi"],
    steps: ["In Angi Leads, open Lead delivery.", "Add a webhook: HTTP POST, JSON, to the address below.", "Send a test here, then wait for the next real lead."] },
  { key: "thumbtack", name: "Thumbtack", what: "Through Zapier or Make: a new Thumbtack lead posts here.", match: ["thumbtack"],
    steps: ["In Zapier or Make, start from New lead in Thumbtack.", "Add a Webhooks step, POST, to the address below, sending the lead as JSON.", "Turn it on and send a test here."] },
  { key: "facebook", name: "Facebook Lead Ads", what: "Through Zapier or Make: a new lead from your ad posts here. Facebook's field_data is read as-is.", match: ["facebook"],
    steps: ["In Zapier or Make, start from New lead in Facebook Lead Ads.", "Add a Webhooks step, POST, to the address below.", "Turn it on and send a test here."] },
];
const EVENT: Record<string, string> = { inbound_call: "Called", inbound_text: "Texted in", web_form: "Web form", paid_lead: "Lead", owner_import: "Imported", opt_out: "Opted out", opt_in: "Opted in", help: "Asked for help" };

function Code({ text, block, toast }: { text: string; block?: boolean; toast: Toast }) {
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast("Copied."); } catch { prompt("Copy:", text); } };
  if (block) return <div className="code block">{text}<div style={{ marginTop: 6 }}><button type="button" className="btn sm" onClick={() => void copy()}>Copy</button></div></div>;
  return <span className="code"><span title={text}>{text}</span><button type="button" onClick={() => void copy()} aria-label="Copy"><Icon name="link" size={13} /></button></span>;
}

function Row({ state, name, st, last, acts, open, onToggle, children }: { state: State; name: string; st: string; last?: string; acts?: React.ReactNode; open?: boolean; onToggle?: () => void; children?: React.ReactNode }) {
  return <div className={"conn " + state + (open ? " open" : "")}>
    <button type="button" className="conn-h" onClick={onToggle} aria-expanded={open} disabled={!onToggle}>
      <span className="dot" aria-hidden="true" /><b>{name}</b><span className="st">{st}</span><span className="last">{last}</span>{onToggle && <Icon name="fwd" size={13} className="chev" />}
    </button>
    {acts && <div className="conn-acts">{acts}</div>}
    {open && children && <div className="conn-bd">{children}</div>}
  </div>;
}

function Connections({ d, biz, go, push, onPush, toast, api, project, demo }: { d: Data; biz: Biz; go: Go; push: string; onPush: () => void; toast: Toast; api: Api; project: string; demo: boolean }) {
  const s = d.setup ?? {}, w = d.wires ?? { sources: [], failures: [], log: [] };
  const origin = d.origin || (typeof location !== "undefined" ? location.origin : "");
  const key = d.key || "";
  const intake = (src?: string) => `${origin}/api/intake?key=${key || "<your key>"}${src ? `&source=${src}` : ""}`;
  const snippet = `<script src="${origin}/chat.js" data-key="${key || "<your key>"}" async></script>`;
  const chosen = (s.lead_sources || "").toLowerCase();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const week = Date.now() - 7 * 86400000;

  const stat = (src: Source) => {
    const rows = w.sources.filter(r => src.match.includes(r.source));
    const last = rows.map(r => r.last || "").filter(Boolean).sort().pop() || "";
    const n30 = rows.reduce((a, r) => a + r.last30, 0);
    const failed = w.failures.some(f => src.match.includes(f.source) && Date.parse(f.at) > week);
    let state: State = "off";
    if (src.key === "number") state = d.number ? (failed ? "bad" : "on") : "todo";
    else if (!key) state = "todo";
    else if (rows.length) state = failed ? "bad" : "on";
    else if (src.key === "web form" || src.key === "web chat" || chosen.includes(src.key)) state = "todo";
    return { state, last, n30 };
  };
  const test = async (src: Source) => {
    setBusy(src.key);
    try {
      if (src.key === "number") { await api("/api/app/act", { p: project, action: "testtext" }); toast("Sent. Check your cell for a text from the business number."); return; }
      if (demo) { await new Promise(r => setTimeout(r, 500)); toast(`Test lead received from ${src.name}: Test Lead, (720) 555-0199. Nothing was saved.`); return; }
      const r = await fetch(`${intake(src.key === "web form" ? undefined : src.key)}&test=1`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Test Lead", phone: "7205550199", message: `Test from the Cinder app, ${src.name}` }) });
      const j = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; lead?: { name: string; phone: string; source: string } };
      if (!r.ok || !j.ok) throw new Error(j.error || `The address answered ${r.status}.`);
      toast(`Test lead received from ${sourceLabel(j.lead?.source || src.key)}: ${j.lead?.name}, ${fmtPhone(j.lead?.phone || "")}. Nothing was saved.`);
    } catch (e) { toast(e instanceof Error ? e.message : "The test didn't go through.", true); } finally { setBusy(null); }
  };
  const visible = SOURCES.filter(src => all || src.key === "number" || src.key === "web form" || src.key === "web chat" || chosen.includes(src.key) || stat(src).state === "on" || stat(src).state === "bad");
  const a2p = s.a2p_status || "";
  const a2pWord = a2p === "Approved" ? "Registered" : a2p === "Submitted" ? `Registration pending${s.a2p_submitted ? `, sent ${s.a2p_submitted}` : ""}` : a2p === "Rejected" ? "Registration rejected, Sam is on it" : "Registration not started";
  const cal = d.calendar;
  const log = [
    ...w.failures.map(f => ({ at: f.at, bad: true, what: "Text didn't send", who: f.name || fmtPhone(f.phone), detail: f.body, thread: f.thread })),
    ...w.log.map(l => ({ at: l.at, bad: l.event === "opt_out", what: l.event === "paid_lead" ? `Lead from ${sourceLabel(l.source)}` : EVENT[l.event] || l.event, who: fmtPhone(l.phone), detail: l.evidence, thread: "" })),
  ];
  const [more, setMore] = useState(false);
  const shown = more ? log : log.slice(0, 12);

  return <div className="pad wires">
    <section>
      <p className="sec">Leads in<small>{visible.filter(v => stat(v).state === "on").length} live</small></p>
      {visible.map(src => { const { state, last, n30 } = stat(src); const addr = src.key === "web chat" ? snippet : intake(src.key === "web form" || src.key === "number" ? undefined : src.key);
        return <Row key={src.key} state={state} name={src.name} st={state === "on" && src.key === "number" ? `Live, ${fmtPhone(d.number)}` : WORD[state]} last={last ? `Last lead ${ago(last)}${n30 ? `, ${n30} in 30 days` : ""}` : state === "on" ? "No leads yet" : ""}
          open={open === src.key} onToggle={() => setOpen(open === src.key ? null : src.key)}
          acts={<>
            {(state === "on" || state === "bad" || (state === "todo" && key && src.key !== "number")) && src.key !== "web chat" && <button type="button" className="btn sm" disabled={busy === src.key} onClick={() => void test(src)}>{busy === src.key ? <Spinner /> : null}Send a test</button>}
            {src.key !== "number" && key && <Code text={addr} toast={toast} />}
          </>}>
          <p>{src.what}</p>
          <ol>{src.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
          {src.key === "web chat" && key && <Code text={snippet} block toast={toast} />}
          {src.key === "number" && !s.has_cell && <p>Your cell isn&rsquo;t on file, so calls can&rsquo;t ring you and tests have nowhere to go. Ask Sam to add it.</p>}
        </Row>; })}
      {!all && visible.length < SOURCES.length && <button type="button" className="link" style={{ padding: "8px 0" }} onClick={() => setAll(true)}>Show {SOURCES.length - visible.length} more lead sites</button>}
    </section>

    <section>
      <p className="sec">Out</p>
      <Row state={d.number ? (a2p === "Rejected" ? "bad" : a2p === "Approved" ? "on" : "todo") : "todo"} name="Texting number" st={d.number ? `${fmtPhone(d.number)}, ${a2pWord}` : "Sam is connecting it"}
        acts={d.number && s.has_cell ? <button type="button" className="btn sm" disabled={busy === "number"} onClick={() => void test(SOURCES[0])}>Send me a test</button> : undefined}>
        <p>Every text a customer gets comes from this number, in your business&rsquo;s name. Carriers require a one-time registration of the business behind it (A2P 10DLC); until it&rsquo;s approved, texts can be slowed or filtered. Sam files it for you.</p>
      </Row>
      <Row state={cal?.connected ? "on" : "todo"} name="Google Calendar" st={cal?.connected ? `Connected, ${cal.email || "your calendar"}` : "Not connected"}
        acts={cal?.connected ? <button type="button" className="btn sm" onClick={() => go.tab("calendar")}>Open calendar</button> : <a className="btn sm ink" href={cal?.connectUrl || "#"} target="_blank" rel="noreferrer">Connect Google Calendar</a>} />
      <Row state={push === "on" ? "on" : push === "off" ? "todo" : "off"} name="Notifications on this device" st={push === "on" ? "On" : push === "off" ? "Off" : push === "blocked" ? "Blocked in your phone's settings" : push === "ios-install" ? "Add to Home Screen first" : "Not on this browser"}
        acts={push === "off" ? <button type="button" className="btn sm ink" onClick={onPush}>Turn on</button> : undefined} />
      <Row state={s.has_cell ? "on" : "todo"} name="Alerts to your cell" st={s.has_cell ? `On file${s.alert_email ? ", and email" : ""}` : "No cell on file"} />
      <Row state={biz.payLink ? "on" : "todo"} name="Pay link on invoices" st={biz.payLink ? "On file" : "Not added"} acts={<button type="button" className="btn sm" onClick={go.billing}>{biz.payLink ? "Edit" : "Add pay link"}</button>} />
      {d.jobber?.available && <Row state={d.jobber.connected ? (d.jobber.error ? "bad" : "on") : "off"} name="Jobber" st={d.jobber.connected ? (d.jobber.error ? `Connected, last push failed: ${d.jobber.error}` : `Connected${d.jobber.account ? `, ${d.jobber.account}` : ""}${d.jobber.lastPush ? `, last estimate sent ${ago(d.jobber.lastPush)}` : ""}`) : "Not connected"}
        open={open === "jobber"} onToggle={() => setOpen(open === "jobber" ? null : "jobber")}
        acts={<a className={"btn sm" + (d.jobber.connected ? "" : " ink")} href={d.jobber.connectUrl} target="_blank" rel="noreferrer">{d.jobber.connected ? "Reconnect" : "Connect Jobber"}</a>}>
        <p>Every estimate Cinder books also lands in Jobber as a request on the customer&rsquo;s record, so your schedule there stays whole. Your past customers come in the other way with Import.</p>
        <ol><li>Tap Connect Jobber and sign in to Jobber.</li><li>Tap Allow.</li><li>You land back here. The next booked estimate shows up in Jobber within a minute.</li></ol>
      </Row>}
      {s.has_webhook === "yes" && <Row state="on" name="Events to your own tools" st="Live, every lead, booking, quote and job posts to your webhook" />}
    </section>

    <section>
      <p className="sec">Connection log<small>{w.failures.length ? `${w.failures.length} failed` : "nothing failed"}</small></p>
      {log.length === 0 ? <p className="fine">Calls, texts, forms and opt-outs show here as they happen.</p> : <table className="tbl flush log"><tbody>
        {shown.map((l, i) => <tr key={i} className={l.bad ? "bad" : ""} onClick={l.thread ? () => go.record(l.thread) : undefined} style={{ cursor: l.thread ? "pointer" : "default" }}>
          <td className="mut nowrap">{ago(l.at)}</td><td className="nowrap"><span className="dot" />{l.what}</td><td className="nowrap">{l.who}</td><td className="mut ell">{l.detail}</td></tr>)}
      </tbody></table>}
      {log.length > 12 && !more && <button type="button" className="link" style={{ padding: "8px 0" }} onClick={() => setMore(true)}>Show all {log.length}</button>}
    </section>
  </div>;
}

// ---------- The agent ----------
const KEYS = ["hours", "service_area", "rules", "questions", "prices", "financing", "book_lead_hours", "book_per_day", "book_buffer_min", "quote_days", "nudge_hours", "handoff", "lang", "tone", "avoid", "dnt"] as const;
type Form = Record<(typeof KEYS)[number], string>;
function Field({ f, set, k, label, help, rows, type, width }: { f: Form; set: (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void; k: keyof Form; label: string; help?: string; rows?: number; type?: "number"; width?: number }) {
  return <label className="field" style={width ? { maxWidth: width } : undefined}>
    <span>{label}{help && <em>, {help}</em>}</span>
    {rows ? <textarea rows={rows} value={f[k]} onChange={set(k)} /> : <input type={type || "text"} inputMode={type === "number" ? "numeric" : undefined} value={f[k]} onChange={set(k)} />}
  </label>;
}
const TRY = ["How much for about 150 ft of 6 ft cedar with two gates?", "Do you guys work Saturdays?", "Can someone just call me instead?"];

function Agent({ d, go, toast, api, project, reload }: { d: Data; go: Go; toast: Toast; api: Api; project: string; reload: () => Promise<void> }) {
  const s = d.setup ?? {};
  const base = Object.fromEntries(KEYS.map(k => [k, s[k] ?? ""])) as Form;
  const [f, setF] = useState<Form>(base);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState(TRY[0]);
  const [prev, setPrev] = useState<{ reply: string; handoff: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const dirty = KEYS.filter(k => f[k] !== base[k]);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!dirty.length) return;
    setSaving(true);
    try { await api("/api/app/act", { p: project, action: "setup", setup: Object.fromEntries(dirty.map(k => [k, f[k]])) }); toast("Saved. Every text from now on follows it."); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setSaving(false); }
  };
  const ask = async () => {
    if (!q.trim()) return;
    setAsking(true); setPrev(null);
    try { setPrev(await api<{ reply: string; handoff: boolean }>("/api/app/act", { p: project, action: "preview", message: q, setup: Object.fromEntries(dirty.map(k => [k, f[k]])) })); }
    catch (e) { toast(e instanceof Error ? e.message : "No preview just now.", true); } finally { setAsking(false); }
  };
  const dntN = f.dnt.split(/[,\n;]+/).map(x => x.replace(/\D/g, "")).filter(x => x.length >= 10).length;

  return <div className="pad agent">
    <div className="agent-form">
      <section>
        <p className="sec">When and where</p>
        <Field f={f} set={set} k="hours" label="Hours" help="like Mon-Fri 7:00-18:00, Sat 8:00-12:00" />
        <p className="fine">Leads get an instant first reply at any hour. After hours it says so and promises the morning. Follow-ups, reminders and review asks wait for these hours.{s.timezone ? ` Times are ${s.timezone.replace(/_/g, " ")}.` : ""}</p>
        <Field f={f} set={set} k="service_area" label="Service area" help="towns, counties or a radius. Outside it, the agent says so politely" rows={2} />
      </section>
      <section>
        <p className="sec">Jobs</p>
        <Field f={f} set={set} k="rules" label="Jobs you don't take" help="repairs under $500, commercial, anything you'd rather pass on" rows={2} />
        <Field f={f} set={set} k="questions" label="What to ask first" help="the two or three things you need before a price" rows={3} />
        <Field f={f} set={set} k="prices" label="What it may say about price" help="usually a range, or 'depends on the project'" rows={2} />
        <Field f={f} set={set} k="financing" label="When they say it's too expensive" help="financing, or a smaller option you're happy to do" rows={2} />
        <div className="fine">Ballparks come from your price book.{s.price_book ? " " : " No prices on file yet. "}<button type="button" className="link" onClick={go.setup}>Edit price book</button></div>
      </section>
      <section>
        <p className="sec">Booking</p>
        <div className="three">
          <Field f={f} set={set} k="book_lead_hours" label="Soonest estimate" help="hours from now, 3 if blank" type="number" />
          <Field f={f} set={set} k="book_per_day" label="Times offered a day" help="2 if blank" type="number" />
          <Field f={f} set={set} k="book_buffer_min" label="Buffer around other events" help="minutes" type="number" />
        </div>
        <p className="fine">Times are offered only where your Google Calendar is free, inside your hours.</p>
      </section>
      <section>
        <p className="sec">Follow-ups</p>
        <div className="three">
          <Field f={f} set={set} k="quote_days" label="After a quote" help="days, 2, 5, 10, 21 if blank" />
          <Field f={f} set={set} k="nudge_hours" label="When a lead goes quiet" help="hours, 2, 20, 68 if blank" />
        </div>
        <p className="fine">Every sequence stops the moment they reply, book, or you mark the job won or lost. STOP always stops everything.</p>
      </section>
      <section>
        <p className="sec">Hand to you</p>
        <p className="fine">Always on: complaints, haggling over price, insurance or legal questions, anything it isn&rsquo;t sure about, or when they ask for a person. The customer is told you&rsquo;ll reach out, and you get an alert.</p>
        <Field f={f} set={set} k="handoff" label="Also hand to you when" help="like 'they mention a neighbor dispute' or 'the job is over $20,000'" rows={2} />
      </section>
      <section>
        <p className="sec">Voice</p>
        <label className="field" style={{ maxWidth: 320 }}><span>Language</span>
          <select value={f.lang} onChange={set("lang")}><option value="">English and Spanish, matching the customer</option><option value="en">English first</option><option value="es">Spanish first</option></select></label>
        <Field f={f} set={set} k="tone" label="How you sound" help="paste two or three real texts you've sent customers" rows={3} />
        <Field f={f} set={set} k="avoid" label="Never say" help="words, promises or topics to stay away from" rows={2} />
      </section>
      <section>
        <p className="sec">Do not text<small>{dntN ? `${dntN} number${dntN === 1 ? "" : "s"}` : ""}</small></p>
        <Field f={f} set={set} k="dnt" label="Numbers Cinder must never text" help="one per line. STOP replies are added on their own" rows={3} />
      </section>
      <div className="agent-save"><button type="button" className="btn ink" disabled={!dirty.length || saving} onClick={() => void save()}>{saving ? <Spinner /> : null}{dirty.length ? `Save ${dirty.length} change${dirty.length === 1 ? "" : "s"}` : "Saved"}</button>{dirty.length > 0 && <button type="button" className="btn ghost" onClick={() => setF(base)}>Undo</button>}</div>
    </div>

    <aside className="prev">
      <p className="sec">Preview<small>{dirty.length ? "with your unsaved changes" : "as it runs today"}</small></p>
      <div className="chips">{TRY.map(t => <button key={t} type="button" className={q === t ? "on" : ""} onClick={() => setQ(t)}>{t.length > 28 ? t.slice(0, 27) + "…" : t}</button>)}</div>
      <textarea className="input" rows={3} value={q} onChange={e => setQ(e.target.value)} placeholder="What a lead might text" aria-label="A lead's message" style={{ height: "auto", padding: "6px 8px", marginTop: 8 }} />
      <div className="prev-acts"><button type="button" className="btn ink sm" disabled={asking || !q.trim()} onClick={() => void ask()}>{asking ? <Spinner /> : null}See the reply</button><span className="fine">Nobody is texted.</span></div>
      {prev && <div className="prev-thread">
        <div className="msg in tail"><div className="bubble">{q}</div></div>
        <div className="msg out tail"><div className="bubble out">{prev.reply || "(no reply, it would hand this to you)"}</div></div>
        {prev.handoff && <p className="fine" style={{ textAlign: "right" }}>Hands this one to you and alerts your cell.</p>}
      </div>}
    </aside>
  </div>;
}

// ---------- Account ----------
type Member = { name: string; cell: string; role: "crew" | "owner" };
function Account({ d, biz, go, push, onPush, demo, onSignOut, api, project, reload, toast }: { d: Data; biz: Biz; go: Go; push: string; onPush: () => void; demo: boolean; onSignOut: () => void; api: Api; project: string; reload: () => Promise<void>; toast: Toast }) {
  const s = d.setup ?? {};
  const team: Member[] = (() => { try { const v = JSON.parse(s.team || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } })();
  const [adding, setAdding] = useState(false), [name, setName] = useState(""), [cell, setCell] = useState(""), [role, setRole] = useState<"crew" | "owner">("crew"), [busy, setBusy] = useState(false);
  const saveTeam = async (next: Member[]) => { setBusy(true); try { await api("/api/app/act", { p: project, action: "setup", setup: { team: next } }); toast("Saved."); setAdding(false); setName(""); setCell(""); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); } };
  const monthly = s.monthly_report !== "no";
  return <div className="pad" style={{ maxWidth: 640 }}>
    <p className="sec">Team<small>{team.length ? `${team.length} of 2` : "just you"}</small></p>
    <ul className="settings">
      {team.map(m => <li key={m.cell}><span><b style={{ color: "var(--ink)" }}>{m.name || fmtPhone(m.cell)}</b> {m.name ? <span className="mut">{fmtPhone(m.cell)}</span> : null}</span><span className="acts-row"><span className="mut">{m.role === "owner" ? "Owner, sees everything" : "Crew, schedule and jobs only"}</span><button type="button" className="btn sm" disabled={busy} onClick={() => void saveTeam(team.filter(x => x.cell !== m.cell))}>Remove</button></span></li>)}
      {adding ? <li style={{ height: "auto", padding: "8px 0" }}><form className="acts-row" style={{ width: "100%" }} onSubmit={e => { e.preventDefault(); if (cell.replace(/\D/g, "").length < 10) return toast("Enter a 10-digit cell.", true); void saveTeam([...team, { name: name.trim(), cell, role }]); }}>
        <input className="input" style={{ width: 140 }} placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <input className="input" style={{ width: 150 }} placeholder="Cell" inputMode="tel" value={cell} onChange={e => setCell(typePhone(e.target.value))} />
        <select className="input" style={{ width: 110 }} value={role} onChange={e => setRole(e.target.value as "crew" | "owner")}><option value="crew">Crew</option><option value="owner">Owner</option></select>
        <button type="submit" className="btn ink sm" disabled={busy}>{busy ? <Spinner /> : "Add"}</button><button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>Cancel</button></form></li>
      : team.length < 2 ? <li><span className="mut">They sign in with their own cell. Crew sees the calendar, the jobs and the texts, never the money or these settings.</span><button type="button" className="btn sm" onClick={() => setAdding(true)}>Add someone</button></li> : null}
    </ul>
    <p className="sec" style={{ marginTop: 20 }}>Account</p>
    <ul className="settings">
      <li><span>Business</span><b>{biz.business}</b></li>
      <li><span>Owner</span><b>{d.owner || "–"}</b></li>
      {d.number && <li><span>Cinder number</span><b>{fmtPhone(d.number)}</b></li>}
      {s.timezone && <li><span>Time zone</span><b>{s.timezone.replace(/_/g, " ")}</b></li>}
      <li><span>Business details and price book</span><button type="button" className="btn sm" onClick={go.setup}>Edit</button></li>
      <li><span>Invoices, tax and pay link</span><button type="button" className="btn sm" onClick={go.billing}>{biz.payLink ? "Edit" : "Add pay link"}</button></li>
      <li><span>Notifications on this device</span>{push === "on" ? <span className="dot good">On</span> : push === "off" ? <button type="button" className="btn sm" onClick={onPush}>Turn on</button> : <span className="mut">{push === "blocked" ? "Blocked in settings" : push === "ios-install" ? "Add to Home Screen first" : "Not on this browser"}</span>}</li>
      <li><span>Customers</span><span className="acts-row"><b>{d.customers?.length ?? 0}</b><button type="button" className="btn sm" onClick={go.importCustomers}>Import</button>{demo ? <button type="button" className="btn sm" onClick={() => toast("The example can't be exported. Your real customers download as a CSV.")}>Export CSV</button> : <a className="btn sm" href={`/api/app/export?p=${encodeURIComponent(project)}`}>Export CSV</a>}</span></li>
      <li><span>Monthly report by text</span><label className="toggle"><input type="checkbox" checked={monthly} onChange={e => void (async () => { try { await api("/api/app/act", { p: project, action: "setup", setup: { monthly_report: e.target.checked ? "yes" : "no" } }); await reload(); } catch { toast("Didn't save.", true); } })()} /><i /><span><small>On the first, last month's leads, after-hours leads, bookings and wins</small></span></label></li>
      <li><span>Your Cinder rep</span><button type="button" className="btn sm" onClick={() => go.tab("sam")}>Message Sam</button></li>
      <li><span /><button type="button" className="btn sm" onClick={onSignOut}><Icon name="out" size={13} />{demo ? "Leave the example" : "Sign out"}</button></li>
    </ul>
  </div>;
}

export function SystemScreen(p: { d: Data; biz: Biz; go: Go; push: string; onPush: () => void; toast: Toast; api: Api; project: string; reload: () => Promise<void>; demo: boolean; onSignOut: () => void; view?: View }) {
  const [view, setView] = useState<View>(p.view ?? "connections");
  const sub = view === "connections" ? "Where leads come from, where they go, and what happened" : view === "agent" ? "What Cinder says and does, in your words" : "The business and this device";
  return <>
    <header className="tb"><h1 className="h1">Settings</h1><span className="sub">{sub}</span>
      <div className="acts"><div className="seg" role="tablist">{(["connections", "agent", "account"] as View[]).map(v => <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v === "connections" ? "Connections" : v === "agent" ? "Agent" : "Account"}</button>)}</div></div></header>
    {view === "connections" ? <Connections {...p} /> : view === "agent" ? <Agent {...p} /> : <Account {...p} />}
  </>;
}
