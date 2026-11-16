"use client";

// Settings, three views. Connections: where leads come from and where they go, each with its real state, a test
// button and the log of what happened. Agent: what Cinder says and does, in plain words, with a preview that
// answers a made-up lead using the unsaved form. Account: the business, this device, sign out.
import { useState, useRef } from "react";
import { Icon, Spinner, ago, fmtPhone, typePhone, type Api, type Toast } from "./parts";
import { ChecklistsSheet } from "./parity";
import { contrastOnWhite, dominantColor, readableAccent } from "@/lib/brand";
import { sourceLabel, type Biz, type Data, type Go, type LeadMail } from "./types";
import { PageHead } from "./charts";

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

function Connections({ d, biz, go, push, onPush, toast, api, project, demo, reload }: { d: Data; biz: Biz; go: Go; push: string; onPush: () => void; toast: Toast; api: Api; project: string; demo: boolean; reload: () => Promise<void> }) {
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
      <AgentRow d={d} api={api} project={project} toast={toast} reload={reload} open={open === "agent"} onToggle={() => setOpen(open === "agent" ? null : "agent")} />
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
      <MailConn d={d} go={go} toast={toast} api={api} project={project} reload={reload} open={open === "mail"} onToggle={() => setOpen(open === "mail" ? null : "mail")} />
      {key && <Row state={s.booking_page === "no" ? "off" : "on"} name="Your booking page" st={s.booking_page === "no" ? "Off" : d.calendar?.connected ? "Live, times from your Google Calendar" : "Live, customers ask for a time"}
        open={open === "bookpage"} onToggle={() => setOpen(open === "bookpage" ? null : "bookpage")}
        acts={<><Code text={`${origin}/b/${key}`} toast={toast} /><a className="btn sm" href={`/b/${demo ? "example" : key}`} target="_blank" rel="noreferrer">Open</a></>}>
        <p>Customers pick an estimate time from your real calendar, leave their address and what they need, and get a confirmation text. You get the alert. Put the link on your website, your Google profile and in your email signature.</p>
        <ol><li>Copy the link.</li><li>Add a &ldquo;Book an estimate&rdquo; button on your site that opens it.</li><li>Add it to your Google Business Profile as the booking link.</li></ol>
      </Row>}
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
      {(d.quickbooks?.available || d.quickbooks?.connected) && <QboRow d={d} open={open === "qbo"} onToggle={() => setOpen(open === "qbo" ? null : "qbo")} api={api} project={project} toast={toast} reload={reload} />}
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

// ---------- The agent's switch ----------
function AgentRow({ d, api, project, toast, reload, open, onToggle }: { d: Data; api: Api; project: string; toast: Toast; reload: () => Promise<void>; open: boolean; onToggle: () => void }) {
  const s = d.setup ?? {}, on = s.agent_paused !== "yes", [busy, setBusy] = useState(false);
  const sec = d.live?.replySecWeek;
  const set = async (paused: boolean) => {
    setBusy(true);
    try { await api("/api/app/act", { p: project, action: "setup", setup: { agent_paused: paused ? "yes" : "" } }); toast(paused ? "Paused. New leads still get the first text; every reply comes to you." : "Cinder is answering again."); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't change it.", true); } finally { setBusy(false); }
  };
  return <Row state={!d.number ? "todo" : on ? "on" : "off"} name="Speed-to-lead agent" st={!d.number ? "Waiting on your texting number" : on ? `On${sec != null ? `, first reply in ${sec < 60 ? sec + "s" : Math.round(sec / 60) + "m"} this week` : ""}` : "Paused, replies go to you"}
    open={open} onToggle={onToggle}
    acts={d.number ? <button type="button" className={"btn sm" + (on ? "" : " ink")} disabled={busy} onClick={() => void set(on)}>{busy ? <Spinner /> : on ? "Pause" : "Turn on"}</button> : undefined}>
    <p>Cinder texts every new lead in seconds, answers their questions in your words, gives a ballpark if you allow it, and books the estimate on your calendar. Anything it can&rsquo;t answer comes to you.</p>
    <p>Paused: new leads still get the first &ldquo;got your message&rdquo; text, so nobody waits. After that every reply comes to you, and no follow-up nudges go out. Use it on a day off or when you&rsquo;d rather talk to everyone yourself.</p>
  </Row>;
}

// ---------- Leads by email ----------
const MAIL_WORD: Record<string, string> = { lead: "Lead", added: "Added by you", no_phone: "No phone", confirm: "Forwarding code", ignored: "Not a lead", new: "Couldn't add" };
function MailConn({ d, go, toast, api, project, reload, open, onToggle }: { d: Data; go: Go; toast: Toast; api: Api; project: string; reload: () => Promise<void>; open: boolean; onToggle: () => void }) {
  const m = d.mail ?? { address: "", recent: [] };
  const waiting = m.recent.filter(r => r.status === "no_phone" || r.status === "new");
  const confirm = m.recent.find(r => r.status === "confirm" && Date.now() - Date.parse(r.at) < 3 * 86400000);
  const leads = m.recent.filter(r => r.status === "lead" || r.status === "added");
  const lastLead = leads[0]?.at;
  const state: State = !m.address ? "todo" : leads.length || confirm || waiting.length ? "on" : "todo";
  const st = !m.address ? "Sam is setting it up" : leads.length ? "Live" : confirm ? "Waiting on one click" : "Ready, nothing forwarded yet";
  return <>
    <Row state={state} name="Lead emails" st={st} last={lastLead ? `Last lead ${ago(lastLead)}${waiting.length ? `, ${waiting.length} need a phone` : ""}` : waiting.length ? `${waiting.length} need a phone` : ""}
      open={open} onToggle={onToggle} acts={m.address ? <Code text={m.address} toast={toast} /> : undefined}>
      <p>Forward lead emails here: Angi, Thumbtack, Google, Yelp, Houzz, your website form, or a customer writing in. Each one becomes a lead in seconds. Lead sites and website forms get the same instant text a webhook lead gets. A customer who emailed you directly is saved and you&rsquo;re alerted, and Cinder doesn&rsquo;t text them first.</p>
      <ol>
        <li>Best: in each lead site&rsquo;s settings, add this address as a lead notification email, next to yours.</li>
        <li>Or in Gmail: Settings, Forwarding, Add a forwarding address, paste it. Gmail sends a code; it shows up right here. Then make a filter (from: angi.com OR thumbtack.com OR your form&rsquo;s sender) that forwards to it.</li>
        <li>Outlook: Settings, Mail, Rules, a rule that forwards those senders to this address.</li>
      </ol>
      <p>An email without a phone number waits below so you can add it. Nothing is ever emailed back to anyone.</p>
      {m.recent.length > 0 && <table className="tbl flush log"><tbody>
        {m.recent.slice(0, 10).map(r => <tr key={r.id} className={r.status === "new" ? "bad" : ""} onClick={r.thread ? () => go.record(r.thread) : undefined} style={{ cursor: r.thread ? "pointer" : "default" }}>
          <td className="mut nowrap">{ago(r.at)}</td><td className="nowrap"><span className="dot" />{MAIL_WORD[r.status] ?? r.status}</td>
          <td className="nowrap">{r.name || (r.phone ? fmtPhone(r.phone) : "") || r.email || (r.source ? sourceLabel(r.source) : "")}</td><td className="mut ell">{r.subject || r.why}</td></tr>)}
      </tbody></table>}
    </Row>
    {confirm && <div className="mail-note">
      <Icon name="send" size={14} />
      <div><b>Your email forwarding needs one click to finish.</b><span>{confirm.code ? <>Confirmation code <code>{confirm.code}</code>. </> : null}Open the link, or type the code where your email asked for it.</span></div>
      {confirm.link && <a className="btn sm ink" href={confirm.link} target="_blank" rel="noreferrer">Confirm forwarding</a>}
      <button type="button" className="btn sm" onClick={async () => { try { await api("/api/app/act", { p: project, action: "maildismiss", thread: confirm.id }); await reload(); } catch { /* stays */ } }}>Done</button>
    </div>}
    {waiting.map(r => <MailWaiting key={r.id} r={r} go={go} toast={toast} api={api} project={project} reload={reload} />)}
  </>;
}

export function MailWaiting({ r, go, toast, api, project, reload, bare }: { r: LeadMail; go: Go; toast: Toast; api: Api; project: string; reload: () => Promise<void>; bare?: boolean }) {
  const [phone, setPhone] = useState(""), [busy, setBusy] = useState(false);
  const who = r.name || r.email || sourceLabel(r.source);
  const add = async () => {
    setBusy(true);
    try { const j = await api<{ id?: string }>("/api/app/act", { p: project, action: "mailadd", thread: r.id, phone }); toast(`${who} is on the board.`); await reload(); if (j.id) go.record(j.id); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't add it.", true); } finally { setBusy(false); }
  };
  const dismiss = async () => { try { await api("/api/app/act", { p: project, action: "maildismiss", thread: r.id }); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't dismiss it.", true); } };
  const reply = r.email ? `mailto:${r.email}?subject=${encodeURIComponent("Re: " + (r.subject || "your request"))}` : "";
  return <div className="mail-wait">
    {!bare && <div className="mw-t"><b>{who}</b><span>{sourceLabel(r.source)} by email, {ago(r.at)}{r.status === "new" ? ", couldn't be added on its own" : ", no phone in it"}</span></div>}
    {r.message && <p>{r.message}</p>}
    <div className="mw-a">
      <input className="input sm" inputMode="tel" placeholder="(720) 555-0100" aria-label={`Phone for ${who}`} value={phone} onChange={e => setPhone(typePhone(e.target.value))} onKeyDown={e => { if (e.key === "Enter" && phone) void add(); }} />
      <button type="button" className="btn sm ink" disabled={busy || phone.replace(/\D/g, "").length !== 10} onClick={() => void add()}>{busy ? <Spinner /> : null}Add lead</button>
      {reply && <a className="btn sm" href={reply}>Reply</a>}
      <button type="button" className="btn sm ghost" onClick={() => void dismiss()}>Dismiss</button>
    </div>
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
          <Field f={f} set={set} k="quote_days" label="After a quote" help="days, 2, 5, 10 if blank, then monthly" />
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
type Member = { name: string; cell: string; role: "crew" | "office" | "owner"; rate?: number };
function Account({ d, biz, go, push, onPush, demo, onSignOut, api, project, reload, toast }: { d: Data; biz: Biz; go: Go; push: string; onPush: () => void; demo: boolean; onSignOut: () => void; api: Api; project: string; reload: () => Promise<void>; toast: Toast }) {
  const s = d.setup ?? {};
  const team: Member[] = (() => { try { const v = JSON.parse(s.team || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } })();
  const [adding, setAdding] = useState(false), [name, setName] = useState(""), [cell, setCell] = useState(""), [role, setRole] = useState<"crew" | "office" | "owner">("crew"), [rate, setRate] = useState(""), [busy, setBusy] = useState(false);
  const saveTeam = async (next: Member[]) => { setBusy(true); try { await api("/api/app/act", { p: project, action: "setup", setup: { team: next } }); toast("Saved."); setAdding(false); setName(""); setCell(""); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); } };
  const monthly = s.monthly_report !== "no";
  const [lists, setLists] = useState(false);
  return <div className="pad" style={{ maxWidth: 640 }}>
    {lists && <ChecklistsSheet d={d} project={project} api={api} toast={toast} reload={reload} onClose={() => setLists(false)} />}
    <p className="sec">Team<small>{team.length ? `${team.length} of 10` : "just you"}</small></p>
    <ul className="settings">
      {team.map(m => <li key={m.cell}><span><b style={{ color: "var(--ink)" }}>{m.name || fmtPhone(m.cell)}</b> {m.name ? <span className="mut">{fmtPhone(m.cell)}</span> : null}</span><span className="acts-row"><span className="mut">{m.role === "owner" ? "Owner, sees everything" : m.role === "office" ? "Office, everything but settings" : "Crew, schedule and jobs only"}</span>
        <label className="inwrap rate" title="What an hour of their time costs you"><i>$</i><input inputMode="decimal" aria-label={`${m.name || "Their"} hourly rate`} defaultValue={m.rate ? String(m.rate) : ""} placeholder="rate" onBlur={e => { const v = Number(e.target.value.replace(/[^\d.]/g, "")) || 0; if (v !== (m.rate ?? 0)) void saveTeam(team.map(x => x.cell === m.cell ? { ...x, rate: v || undefined } : x)); }} /><em>/hr</em></label><button type="button" className="btn sm" disabled={busy} onClick={() => void saveTeam(team.filter(x => x.cell !== m.cell))}>Remove</button></span></li>)}
      {adding ? <li style={{ height: "auto", padding: "8px 0" }}><form className="acts-row" style={{ width: "100%" }} onSubmit={e => { e.preventDefault(); if (cell.replace(/\D/g, "").length < 10) return toast("Enter a 10-digit cell.", true); void saveTeam([...team, { name: name.trim(), cell, role, ...(Number(rate) > 0 ? { rate: Number(rate) } : {}) }]); setRate(""); }}>
        <input className="input" style={{ width: 140 }} placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <input className="input" style={{ width: 150 }} placeholder="Cell" inputMode="tel" value={cell} onChange={e => setCell(typePhone(e.target.value))} />
        <select className="input" style={{ width: 110 }} value={role} onChange={e => setRole(e.target.value as "crew" | "office" | "owner")}><option value="crew">Crew</option><option value="office">Office</option><option value="owner">Owner</option></select>
        <span className="inwrap" style={{ width: 96 }}><i>$</i><input inputMode="decimal" aria-label="Hourly rate" placeholder="rate" value={rate} onChange={e => setRate(e.target.value.replace(/[^\d.]/g, ""))} /><em>/hr</em></span>
        <button type="submit" className="btn ink sm" disabled={busy}>{busy ? <Spinner /> : "Add"}</button><button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>Cancel</button></form></li>
      : team.length < 10 ? <li><span className="mut">They sign in with their own cell. Crew sees the calendar, the jobs and the texts, never the money. Office sees everything but these settings.</span><button type="button" className="btn sm" onClick={() => setAdding(true)}>Add someone</button></li> : null}
    </ul>
    <p className="sec" style={{ marginTop: 20 }}>Account</p>
    <ul className="settings">
      <li><span>Business</span><b>{biz.business}</b></li>
      <li><span>Owner</span><b>{d.owner || "–"}</b></li>
      {d.number && <li><span>Cinder number</span><b>{fmtPhone(d.number)}</b></li>}
      {s.timezone && <li><span>Time zone</span><b>{s.timezone.replace(/_/g, " ")}</b></li>}
      <li><span>Business details and price book</span><button type="button" className="btn sm" onClick={go.setup}>Edit</button></li>
      <ReviewLink d={d} api={api} project={project} toast={toast} reload={reload} />
      <li><span>Invoices, tax and pay link</span><button type="button" className="btn sm" onClick={go.billing}>{biz.payLink ? "Edit" : "Add pay link"}</button></li>
      <li><span>Notifications on this device</span>{push === "on" ? <span className="dot good">On</span> : push === "off" ? <button type="button" className="btn sm" onClick={onPush}>Turn on</button> : <span className="mut">{push === "blocked" ? "Blocked in settings" : push === "ios-install" ? "Add to Home Screen first" : "Not on this browser"}</span>}</li>
      <li className="brand-li"><span>Your logo and color</span><span className="acts-row"><BrandEdit d={d} api={api} project={project} toast={toast} reload={reload} /></span></li>
      <li><span>Show &ldquo;Powered by Cinder&rdquo;</span><span className="acts-row"><span className="mut">{s.show_powered === "yes" ? "Shown at the bottom of the menu" : "Hidden: the app shows only your business"}</span><button type="button" className="btn sm" disabled={busy} onClick={async () => { setBusy(true); try { await api("/api/app/act", { p: project, action: "setup", setup: { show_powered: s.show_powered === "yes" ? "no" : "yes" } }); toast("Saved."); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); } }}>{s.show_powered === "yes" ? "Hide" : "Show"}</button></span></li>
      <li><span>Job checklists</span><span className="acts-row"><span className="mut">Fence install, repair, your own</span><button type="button" className="btn sm" onClick={() => setLists(true)}>Edit</button></span></li>
      <li><span>Crew sees prices</span><span className="acts-row"><span className="mut">{s.crew_prices === "yes" ? "Quotes and invoice totals, never your costs" : "No money at all"}</span><button type="button" className="btn sm" disabled={busy} onClick={async () => { setBusy(true); try { await api("/api/app/act", { p: project, action: "setup", setup: { crew_prices: s.crew_prices === "yes" ? "no" : "yes" } }); toast("Saved."); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); } }}>{s.crew_prices === "yes" ? "Hide prices" : "Show prices"}</button></span></li>
      <li><span>Move your business in</span><span className="acts-row"><span className="mut">Jobber, QuickBooks, Housecall Pro, ServiceTitan, a spreadsheet</span><button type="button" className="btn sm" onClick={() => go.tab("switch")}>Open</button></span></li>
      <li><span>Export everything</span><span className="acts-row"><span className="mut">Every record as a CSV, and your photos, in one zip</span>{demo ? <button type="button" className="btn sm" onClick={() => toast("The example can't be exported. Your real business downloads as one zip.")}>Download</button> : <a className="btn sm" href={`/api/app/export?p=${encodeURIComponent(project)}&what=all`}>Download</a>}</span></li>
      <li><span>Customers</span><span className="acts-row"><b>{d.customers?.length ?? 0}</b><button type="button" className="btn sm" onClick={go.importCustomers}>Import</button>{demo ? <button type="button" className="btn sm" onClick={() => toast("The example can't be exported. Your real customers download as a CSV.")}>Export CSV</button> : <a className="btn sm" href={`/api/app/export?p=${encodeURIComponent(project)}`}>Export CSV</a>}</span></li>
      <li><span>Monthly report by text</span><label className="toggle"><input type="checkbox" checked={monthly} onChange={e => void (async () => { try { await api("/api/app/act", { p: project, action: "setup", setup: { monthly_report: e.target.checked ? "yes" : "no" } }); await reload(); } catch { toast("Didn't save.", true); } })()} /><i /><span><small>On the first, last month's leads, after-hours leads, bookings and wins</small></span></label></li>
      <li><span>Your Cinder rep</span><button type="button" className="btn sm" onClick={() => go.tab("sam")}>Message Sam</button></li>
      <li><span /><button type="button" className="btn sm" onClick={onSignOut}><Icon name="out" size={13} />{demo ? "Leave the example" : "Sign out"}</button></li>
    </ul>
  </div>;
}

export function SystemScreen(p: { d: Data; biz: Biz; go: Go; push: string; onPush: () => void; toast: Toast; api: Api; project: string; reload: () => Promise<void>; demo: boolean; onSignOut: () => void; view?: View }) {
  const [view, setView] = useState<View>(p.view ?? "connections");
  const sub = view === "connections" ? "Where leads come from, where they go, and what happened." : view === "agent" ? "What Cinder says and does, in your words." : "The business, your team and this device.";
  return <>
    <PageHead title="Settings" sub={sub}
      actions={<div className="seg" role="tablist">{(["connections", "agent", "account"] as View[]).map(v => <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v === "connections" ? "Connections" : v === "agent" ? "Agent" : "Account"}</button>)}</div>} />
    <div className="set-body">{view === "connections" ? <Connections {...p} /> : view === "agent" ? <Agent {...p} /> : <Account {...p} />}</div>
  </>;
}

/** QuickBooks Online: connect once, then invoices and payments land in the books. Sync now catches up anything missed. */
function QboRow({ d, open, onToggle, api, project, toast, reload }: { d: Data; open: boolean; onToggle: () => void; api: Api; project: string; toast: Toast; reload: () => Promise<void> }) {
  const q = d.quickbooks!, [busy, setBusy] = useState(false);
  const sync = async () => { setBusy(true); try { const r = await api<{ invoices: number; payments: number }>("/api/app/act", { p: project, action: "qbosync" }); toast(r.invoices || r.payments ? `Sent ${r.invoices} ${r.invoices === 1 ? "invoice" : "invoices"} and ${r.payments} ${r.payments === 1 ? "payment" : "payments"} to QuickBooks.` : "QuickBooks is up to date."); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Sync didn't finish.", true); } finally { setBusy(false); } };
  return <Row state={q.connected ? (q.error ? "bad" : "on") : "off"} name="QuickBooks Online" st={q.connected ? (q.error ? `Connected, last sync failed: ${q.error}` : `Connected${q.company ? `, ${q.company}` : ""}${q.lastPush ? `, last sync ${ago(q.lastPush)}` : ""}`) : "Not connected"}
    open={open} onToggle={onToggle}
    acts={<>{q.connected && <button type="button" className="btn sm" disabled={busy} onClick={() => void sync()}>{busy ? <Spinner /> : "Sync now"}</button>}{q.connectUrl && <a className={"btn sm" + (q.connected ? "" : " ink")} href={q.connectUrl} target="_blank" rel="noreferrer">{q.connected ? "Reconnect" : "Connect QuickBooks"}</a>}</>}>
    <p>Every invoice you send and every payment you record lands in QuickBooks on the right customer, so your books match without typing anything twice. Lines book to your Services item; sales tax rides as its own line so totals match.</p>
    <ol><li>Tap Connect QuickBooks and sign in to Intuit.</li><li>Pick your company and tap Connect.</li><li>You land back here. Tap Sync now to send the last 120 days.</li></ol>
  </Row>;
}

/** The owner's Google review link: where review requests send happy customers. */
function ReviewLink({ d, api, project, toast, reload }: { d: Data; api: Api; project: string; toast: Toast; reload: () => Promise<void> }) {
  const cur = d.setup?.review_link || "", [v, setV] = useState(cur), [busy, setBusy] = useState(false);
  const save = async () => {
    const u = v.trim(); if (u && !/^https:\/\/\S+$/.test(u)) { toast("Paste the full link, starting with https://", true); return; }
    setBusy(true); try { await api("/api/app/act", { p: project, action: "setup", setup: { review_link: u } }); toast(u ? "Review link saved. Review requests use it now." : "Review link removed."); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save it.", true); } finally { setBusy(false); }
  };
  return <li className="rv-li"><span>Google review link<small className="mut" style={{ display: "block" }}>In Google Business Profile: Ask for reviews, then copy the link.</small></span>
    <span className="acts-row"><input className="input" style={{ width: 260 }} placeholder="https://g.page/r/..." value={v} onChange={e => setV(e.target.value)} aria-label="Google review link" />
      <button type="button" className="btn sm" disabled={busy || v.trim() === cur} onClick={() => void save()}>{busy ? <Spinner /> : "Save"}</button></span></li>;
}

/** The logo (resized to 256px; its main color picked for the accent) and the accent itself, kept readable on white. */
function BrandEdit({ d, api, project, toast, reload }: { d: Data; api: Api; project: string; toast: Toast; reload: () => Promise<void> }) {
  const s = d.setup ?? {}, [busy, setBusy] = useState(false), [color, setColor] = useState(s.brand_color || "#d0663f");
  const file = useRef<HTMLInputElement>(null);
  const save = async (patch: Record<string, string>, done: string) => { setBusy(true); try { await api("/api/app/act", { p: project, action: "setup", setup: patch }); toast(done); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); } };
  async function pick(f: File) {
    const bmp = await createImageBitmap(f), k = Math.min(1, 256 / Math.max(bmp.width, bmp.height)), cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k));
    const g = cv.getContext("2d")!; g.drawImage(bmp, 0, 0, cv.width, cv.height);
    const found = dominantColor(g.getImageData(0, 0, cv.width, cv.height).data);
    const accent = found ? readableAccent(found) : color;
    setColor(accent);
    await save({ brand_logo: cv.toDataURL("image/png"), ...(found ? { brand_color: accent } : {}) }, found ? `Logo saved. Accent set from it${accent !== found ? ", darkened a little so it reads on white" : ""}.` : "Logo saved.");
  }
  const ratio = contrastOnWhite(readableAccent(color));
  return <>
    {s.brand_logo ? <img src={s.brand_logo} alt="Your logo" className="brand-thumb" /> : null}
    <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
    <button type="button" className="btn sm" disabled={busy} onClick={() => file.current?.click()}>{s.brand_logo ? "Change logo" : "Add logo"}</button>
    <label className="brand-color" title={`${ratio.toFixed(1)}:1 on white`}><input type="color" value={color} onChange={e => setColor(e.target.value)} onBlur={() => { if (color !== s.brand_color) void save({ brand_color: color }, readableAccent(color) !== color.toLowerCase() ? "Color saved, darkened a little so it reads on white." : "Color saved."); }} aria-label="Accent color" /><span>{readableAccent(color)}</span></label>
  </>;
}
