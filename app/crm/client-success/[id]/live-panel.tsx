"use client";

// The client's live system: customer conversations (watch, step in, pause), quotes being chased,
// review requests, and a test box for the reply engine before go-live.
import { useCallback, useEffect, useState } from "react";
import "./ops-panel.css";
import "./live-panel.css";

type Thread = { id: string; customer_phone: string; customer_name: string; source: string; status: string; updated_at: string; last: { body: string; direction: string; at: string } | null };
type Text = { direction: string; author: string; body: string; ok: boolean; at: string };
type Quote = { id: string; customer_phone: string; customer_name: string; amount: string | null; sent_on: string; steps_sent: number; status: string; kind: string };
type Appt = { id: string; starts_at: string; status: string; reminded_at: string | null; customer_name: string; customer_phone: string };
type Data = { threads: Thread[]; quotes: Quote[]; reviews: number; chatKey: string; appointments?: Appt[]; customers?: Customer[]; calendar?: { connected: boolean; email: string }; ready: { live: boolean; missing: string[]; number: string } };
type Tab = "inbox" | "estimates" | "quotes" | "revive" | "repeat" | "reviews" | "chat" | "test";
type Customer = { id: string; customer_name: string; customer_phone: string; service: string; last_service: string | null; interval_days: number; next_due: string; due_steps: number; status: string };
const NB = { background: "transparent" };
const when = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const STATUS: Record<string, string> = { auto: "Handled for them", paused: "Needs a person", opted_out: "Opted out", booked: "Booked", closed: "Closed" };
const WHO: Record<string, string> = { customer: "Customer", ai: "Cinder", template: "Cinder", owner: "You", system: "" };

export default function LivePanel({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<Tab>("inbox");
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [texts, setTexts] = useState<Text[]>([]);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState({ name: "", phone: "", amount: "", sentOn: new Date().toISOString().slice(0, 10) });
  const [rv, setRv] = useState({ name: "", phone: "" });
  const [sim, setSim] = useState<{ direction: string; body: string }[]>([]);
  const [simIn, setSimIn] = useState("");
  const [list, setList] = useState("");
  const [consent, setConsent] = useState(false);
  const [custList, setCustList] = useState(""), [custDays, setCustDays] = useState(""), [custOk, setCustOk] = useState(false);
  const [calLink, setCalLink] = useState("");
  async function getCalLink() {
    setNote(null);
    const r = await fetch("/api/client-calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) { setNote({ ok: false, text: x.error || "Couldn't make the link." }); return; }
    if (!x.configured) { setNote({ ok: false, text: "Google sign-in isn't set up in Vercel yet (the same keys Gmail uses)." }); return; }
    setCalLink(x.link); void navigator.clipboard?.writeText(x.link);
    setNote({ ok: true, text: "Link copied. Text it to the owner: one tap, sign in with Google, Allow. It works for 7 days." });
  }

  const load = useCallback(() => fetch("/api/client-threads?project=" + projectId, { cache: "no-store" }).then(r => r.json()).then(x => { if (!x.error) setD(x); }).catch(() => {}), [projectId]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (!open) return; fetch("/api/client-threads?thread=" + open, { cache: "no-store" }).then(r => r.json()).then(x => setTexts(x.texts ?? [])); }, [open, d]);

  async function act(action: string, extra: Record<string, unknown>, okText: string) {
    setBusy(action); setNote(null);
    const r = await fetch("/api/client-threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: projectId, action, ...extra }) });
    const x = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { setNote({ ok: false, text: x.error || "That didn't work." }); return null; }
    if (okText) setNote({ ok: true, text: okText });
    await load();
    return x;
  }
  async function test() {
    const hist = [...sim, { direction: "in", body: simIn.trim() }];
    if (!simIn.trim()) return;
    setSim(hist); setSimIn("");
    const x = await act("simulate", { history: hist }, "");
    if (x?.decision) setSim([...hist, { direction: "out", body: x.decision.handoff ? `[Hands off to the owner] ${x.decision.reply || ""}`.trim() : `${x.decision.reply}  (${x.decision.stage})` }]);
  }

  const needs = d?.threads.filter(t => t.status === "paused").length ?? 0;
  const openQ = d?.quotes.filter(x => x.status === "open" && x.kind !== "rehash").length ?? 0;
  const revive = d?.quotes.filter(x => x.kind === "rehash") ?? [];
  const cur = d?.threads.find(t => t.id === open) ?? null;

  return <section className="op-card lv">
    <div className="lv-head">
      <div><h2>Live system</h2><p>{d?.ready.live ? `Running on ${d.ready.number}` : d ? `Not live yet. Still needed: ${d.ready.missing.join(", ")}.` : "Loading…"}</p></div>
      {d?.ready.live && <span className="lv-on">Live</span>}
    </div>
    <div className="op-tabs" role="group" aria-label="Live system">
      {([["inbox", "Conversations", needs ? `${needs} need you` : `${d?.threads.length ?? 0} total`], ["estimates", "Estimates", d?.calendar?.connected ? `${(d.appointments ?? []).filter(a => a.status === "booked" && Date.parse(a.starts_at) > Date.now()).length} coming up` : "Connect calendar"], ["quotes", "Quotes", `${openQ} being chased`], ["revive", "Revive old leads", revive.length ? `${revive.filter(x => x.status === "replied").length} replied of ${revive.length}` : "Week-1 win"], ["repeat", "Repeat customers", d?.customers?.length ? `${d.customers.filter(x => x.status === "active" && x.next_due <= new Date().toISOString().slice(0, 10)).length} due now` : "Reactivation add-on"], ["reviews", "Reviews", `${d?.reviews ?? 0} asked`], ["chat", "Website chat", "Bubble for their site"], ["test", "Test replies", "Before go-live"]] as const).map(([k, label, sub]) =>
        <button key={k} type="button" aria-pressed={tab === k} style={{ background: tab === k ? "#e7e7e4" : "transparent" }} onClick={() => setTab(k)}><b>{label}</b><small>{sub}</small></button>)}
    </div>
    {note && <p className={"op-note " + (note.ok ? "ok" : "bad")} role="status">{note.text}</p>}

    {tab === "inbox" && <div className="lv-inbox">
      <ul className="lv-threads">
        {!d?.threads.length && <li className="lv-empty">No conversations yet. They show up here the moment a customer calls or texts {d?.ready.number || "the client's number"}.</li>}
        {d?.threads.map(t => <li key={t.id}><button type="button" style={NB} aria-pressed={open === t.id} onClick={() => setOpen(t.id)}>
          <b>{t.customer_name || t.customer_phone}</b><span className={"lv-st is-" + t.status}>{STATUS[t.status] ?? t.status}</span>
          <small>{t.last ? `${t.last.direction === "in" ? "" : "↳ "}${t.last.body.slice(0, 70)}` : ""}</small></button></li>)}
      </ul>
      {cur && <div className="lv-thread">
        <div className="lv-thread-h"><b>{cur.customer_name || cur.customer_phone}</b><span>{cur.customer_phone}</span>
          <div className="op-acts">
            {cur.status === "paused" ? <button type="button" style={NB} onClick={() => act("status", { thread: cur.id, status: "auto" }, "Cinder is handling this one again.")}>Hand back to Cinder</button>
              : cur.status === "auto" ? <button type="button" style={NB} onClick={() => act("status", { thread: cur.id, status: "paused" }, "Paused. Cinder won't reply until you hand it back.")}>Pause Cinder</button> : null}
            {cur.status !== "booked" && cur.status !== "opted_out" && <button type="button" style={NB} onClick={() => act("status", { thread: cur.id, status: "booked" }, "Marked booked.")}>Mark booked</button>}
            <button type="button" style={NB} onClick={() => { const n = prompt("Customer's name", cur.customer_name); if (n !== null) void act("name", { thread: cur.id, name: n }, "Saved."); }}>Name</button>
          </div></div>
        <ol className="lv-texts">{texts.map((x, i) => x.author === "system" ? <li key={i} className="lv-sys">{x.body} · {when(x.at)}</li> :
          <li key={i} className={x.direction === "in" ? "in" : "out"}><p>{x.body}</p><small>{WHO[x.author]} · {when(x.at)}{!x.ok ? " · not sent" : ""}</small></li>)}</ol>
        {cur.status !== "opted_out" && <form className="lv-reply" onSubmit={async e => { e.preventDefault(); if (await act("reply", { thread: cur.id, body: draft }, "Sent. Cinder is paused on this one so you can talk.")) setDraft(""); }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Text them as the business…" aria-label="Reply" />
          <button type="submit" className="op-primary" style={NB} disabled={!!busy || !draft.trim()}>Send</button></form>}
      </div>}
    </div>}

    {tab === "quotes" && <div>
      <p className="op-hint">Add a quote the day it goes out. It gets followed up on days 2, 5, 10 and 21 from the client&apos;s number, and stops the moment the customer replies or opts out.</p>
      <form className="op-fields lv-form" onSubmit={async e => { e.preventDefault(); if (await act("quote", q, "Quote added. The first follow-up goes out on day 2.")) setQ({ ...q, name: "", phone: "", amount: "" }); }}>
        <label><span>Customer</span><input value={q.name} onChange={e => setQ({ ...q, name: e.target.value })} /></label>
        <label><span>Cell</span><input value={q.phone} onChange={e => setQ({ ...q, phone: e.target.value })} required /></label>
        <label><span>Amount</span><input value={q.amount} onChange={e => setQ({ ...q, amount: e.target.value })} placeholder="$6,840" /></label>
        <label><span>Sent on</span><input type="date" value={q.sentOn} onChange={e => setQ({ ...q, sentOn: e.target.value })} /></label>
        <div className="op-acts"><button type="submit" className="op-primary" style={NB} disabled={!!busy}>Add quote</button></div>
      </form>
      <ul className="lv-quotes">{d?.quotes.filter(x => x.kind !== "rehash").map(x => <li key={x.id}>
        <b>{x.customer_name || x.customer_phone}</b><span>{x.amount ? "$" + Number(x.amount).toLocaleString() : ""}</span><span>Sent {x.sent_on.slice(0, 10)} · {x.steps_sent} of 4 follow-ups</span>
        <span className={"lv-st is-" + x.status}>{x.status}</span>
        {(x.status === "open" || x.status === "replied") && <span className="op-acts"><button type="button" style={NB} onClick={() => act("quote_status", { quote: x.id, status: "won" }, "Marked won.")}>Won</button><button type="button" style={NB} onClick={() => act("quote_status", { quote: x.id, status: "lost" }, "Marked lost.")}>Lost</button></span>}
      </li>)}</ul>
    </div>}

    {tab === "revive" && <div>
      <p className="op-hint">The fastest win for a new client: their leads from the last few months that never booked. Each gets 3 short texts from the client&apos;s number, and every reply is answered and booked for them. This is Book &amp; Close&apos;s launch revival. With the Reactivation add-on (set a repeat service in Setup), anyone who doesn&apos;t answer gets another round each quarter. Texts go out during the day.</p>
      <label className="op-owner"><span>One per line: name, then cell. Paste straight from their CRM or a spreadsheet.</span><textarea rows={6} value={list} onChange={e => setList(e.target.value)} placeholder={"Dana Ruiz, 720-555-0148\nMarcus Hill\t(303) 555-0192"} /></label>
      <label className="lv-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> These people contacted {d?.ready.number ? "this business" : "the business"} themselves (old inquiries or past quotes), not a bought list.</label>
      <div className="op-acts"><button type="button" className="op-primary" style={NB} disabled={!!busy || !list.trim() || !consent} onClick={async () => { const x = await act("rehash", { list, consent }, ""); if (x) { setNote({ ok: true, text: `${x.added} added${x.skipped ? `, ${x.skipped} skipped (already in a revive or opted out)` : ""}. The first texts go out in the next daytime run.` }); setList(""); } }}>Start the revive</button></div>
      <ul className="lv-quotes">{revive.map(x => <li key={x.id}><b>{x.customer_name || x.customer_phone}</b><span>{x.steps_sent} of 3 texts</span><span className={"lv-st is-" + x.status}>{x.status === "replied" ? "Replied" : x.status === "lost" ? "No reply" : x.status}</span></li>)}</ul>
    </div>}

    {tab === "repeat" && <div>
      <p className="op-hint">Reactivation add-on. The business&apos;s past customers and when they were last serviced. When each one is due, Cinder texts them from the business&apos;s number with two open times (if the calendar is connected), sends one reminder 4 days later if they don&apos;t answer, and books whoever replies. A booking resets their next due date. Texts go out 8 AM to 8 PM their time.</p>
      <label className="op-owner"><span>One per line: name, cell, last service date, and optionally the service. Paste from their booking app or a spreadsheet.</span><textarea rows={6} value={custList} onChange={e => setCustList(e.target.value)} placeholder={"Dana Ruiz, 720-555-0148, 8/14/2026, maintenance detail\nMarcus Hill\t(303) 555-0192\t2026-07-02"} /></label>
      <label className="op-owner" style={{ maxWidth: 260 }}><span>Days between visits</span><input inputMode="numeric" value={custDays} onChange={e => setCustDays(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="90" /></label>
      <label className="lv-check"><input type="checkbox" checked={custOk} onChange={e => setCustOk(e.target.checked)} /> These are the business&apos;s own past customers, not a bought list.</label>
      <div className="op-acts"><button type="button" className="op-primary" style={NB} disabled={!!busy || !custList.trim() || !custOk} onClick={async () => { const x = await act("customers", { list: custList, interval: custDays, consent: custOk }, ""); if (x) { setNote({ ok: true, text: `${x.added} added${x.updated ? `, ${x.updated} updated` : ""}${x.skipped ? `, ${x.skipped} skipped (opted out)` : ""}. Anyone already due gets a text in the next daytime run.` }); setCustList(""); } }}>Add customers</button></div>
      <ul className="lv-quotes">{(d?.customers ?? []).map(x => <li key={x.id}><b>{x.customer_name || x.customer_phone}</b>
        <span>{x.service ? x.service + " · " : ""}every {x.interval_days} days · due {new Date(x.next_due + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}{x.due_steps ? ` · ${x.due_steps} of 2 texts sent` : ""}</span>
        <span className={"lv-st is-" + (x.status === "active" ? "open" : x.status)}>{x.status === "opted_out" ? "Opted out" : x.status === "paused" ? "Paused" : "Active"}</span>
        {x.status !== "opted_out" && <span className="op-acts"><button type="button" style={NB} onClick={() => act("customer_status", { customer: x.id, status: x.status === "paused" ? "active" : "paused" }, x.status === "paused" ? "Resumed." : "Paused.")}>{x.status === "paused" ? "Resume" : "Pause"}</button></span>}
      </li>)}</ul>
    </div>}

    {tab === "reviews" && <div>
      <p className="op-hint">After a finished job, send one review request with the client&apos;s Google link. Each customer only ever gets one.</p>
      <form className="op-fields lv-form" onSubmit={async e => { e.preventDefault(); if (await act("review", rv, "Review request sent.")) setRv({ name: "", phone: "" }); }}>
        <label><span>Customer</span><input value={rv.name} onChange={e => setRv({ ...rv, name: e.target.value })} /></label>
        <label><span>Cell</span><input value={rv.phone} onChange={e => setRv({ ...rv, phone: e.target.value })} required /></label>
        <div className="op-acts"><button type="submit" className="op-primary" style={NB} disabled={!!busy}>Send review request</button></div>
      </form>
    </div>}

    {tab === "estimates" && <div>
      <div className="lv-cal">
        <div><b>{d?.calendar?.connected ? "Calendar connected" : "Calendar not connected"}</b>
          <p className="op-hint">{d?.calendar?.connected ? `Cinder offers open times from ${d.calendar.email || "their Google Calendar"} and puts every booked estimate on it. Customers get a reminder the day before.` : "Connect the owner's Google Calendar so Cinder offers real open times and books estimates straight onto it. Until then it sends their booking link."}</p></div>
        <button type="button" className="op-primary" style={NB} onClick={() => void getCalLink()}>{d?.calendar?.connected ? "New connect link" : "Get the connect link"}</button>
      </div>
      {calLink && <pre className="lv-code">{calLink}</pre>}
      <ul className="lv-appts">{(d?.appointments ?? []).length ? (d?.appointments ?? []).map(a => <li key={a.id} className={"is-" + a.status}>
        <span><b>{when(a.starts_at)}</b><small>{a.customer_name || a.customer_phone}{a.reminded_at ? " · reminded" : ""}</small></span>
        <em>{a.status === "booked" ? (Date.parse(a.starts_at) > Date.now() ? "Booked" : "Did they show?") : a.status === "no_show" ? "No-show, rebooking" : a.status === "done" ? "Done" : "Canceled"}</em>
        {a.status === "booked" && <span className="op-acts">
          {Date.parse(a.starts_at) < Date.now() && <button type="button" style={NB} disabled={!!busy} onClick={() => void act("done", { appointment: a.id }, "Marked done.")}>Showed</button>}
          <button type="button" style={NB} disabled={!!busy} onClick={() => void act("no_show", { appointment: a.id }, "Rebooking text sent.")}>No-show</button>
          <button type="button" style={NB} disabled={!!busy} onClick={() => void act("cancel", { appointment: a.id }, "Canceled.")}>Cancel</button>
        </span>}
      </li>) : <li className="lv-empty">No estimates booked by Cinder yet.</li>}</ul>
      <p className="op-hint"><b>Their web forms:</b> point any form or form tool at this address and every submission gets a text back in seconds: <code>{`${typeof location !== "undefined" ? location.origin : ""}/api/intake?key=${d?.chatKey ?? ""}`}</code>. A plain HTML form can add <code>&amp;next=https://their-thank-you-page</code>.</p>
      <p className="op-hint"><b>Paid leads</b> (the lead gets &ldquo;Got your request on Angi&hellip;&rdquo; from their number in seconds):</p>
      <ul className="op-hint" style={{ margin: "4px 0 0 18px", listStyle: "disc" }}>
        <li><b>Angi / HomeAdvisor:</b> in Angi Leads, Lead delivery &rarr; add a webhook (HTTP POST, JSON) to <code>{`${typeof location !== "undefined" ? location.origin : ""}/api/intake?key=${d?.chatKey ?? ""}`}&amp;source=angi</code>. No webhook on their plan? Use Zapier&rsquo;s Angi trigger with a Webhooks POST to the same address.</li>
        <li><b>Thumbtack:</b> Zapier &rarr; Thumbtack &ldquo;New lead&rdquo; &rarr; Webhooks POST to <code>&hellip;&amp;source=thumbtack</code>.</li>
        <li><b>Facebook Lead Ads:</b> Zapier or Make &rarr; Facebook Lead Ads &ldquo;New lead&rdquo; &rarr; Webhooks POST to <code>&hellip;&amp;source=facebook</code>. Send all fields; the form&rsquo;s questions come through as the job details.</li>
      </ul>
      <p className="op-hint"><b>Call forwarding</b> (they keep their number; only calls they miss come to Cinder). On the kickoff call, have them dial from their business phone, using their Cinder number <code>{d?.ready?.number || "+1…"}</code> without the +1:</p>
      <ul className="op-hint" style={{ margin: "4px 0 0 18px", listStyle: "disc" }}>
        <li><b>Verizon:</b> <code>*71</code> + the 10-digit Cinder number, then Call. Turn off: <code>*73</code>.</li>
        <li><b>AT&amp;T, T-Mobile and most others:</b> <code>**004*</code> + the 10-digit number + <code>#</code>, then Call. Turn off: <code>##004#</code>.</li>
        <li><b>Office lines (RingCentral, Google Voice, Grasshopper, Spectrum):</b> in the app&rsquo;s call settings, set &ldquo;forward when unanswered&rdquo; to the Cinder number after 4&ndash;5 rings.</li>
        <li>Then test it with them: call their number from another phone and don&rsquo;t answer. The caller gets the text in about 10 seconds. Set &ldquo;How calls reach Cinder&rdquo; in setup to the forwarding option.</li>
      </ul>
      <p className="op-hint"><b>Texting consent:</b> every caller, texter, form and lead is logged with what they sent, plus every opt-out. <a href={`/api/client-consent?project=${projectId}`}>Download the consent log (CSV)</a> for carrier registration or a complaint.</p>
    </div>}

    {tab === "chat" && <div>
      <p className="op-hint">Paste this one line into the client&apos;s website, just before the closing body tag (on Wix, Squarespace or WordPress it goes in &quot;custom code&quot;). Visitors leave a name, cell and question, and get a text back in seconds from the client&apos;s number. The conversation shows up in Conversations like any other lead.</p>
      <pre className="lv-code">{`<script src="${typeof location !== "undefined" ? location.origin : ""}/chat.js" data-key="${d?.chatKey ?? ""}" async></script>`}</pre>
      <div className="op-acts"><button type="button" style={NB} onClick={() => { void navigator.clipboard.writeText(`<script src="${location.origin}/chat.js" data-key="${d?.chatKey ?? ""}" async></script>`); setNote({ ok: true, text: "Copied. Send it to whoever manages their site." }); }}>Copy the code</button></div>
      <p className="op-hint">Add data-color=&quot;#1a5c3a&quot; to match their brand. The bubble hides itself until the texting number is set.</p>
    </div>}

    {tab === "test" && <div>
      <p className="op-hint">Play the customer. The replies come from the setup sheet and approved wording, exactly as a live text would. Nothing is sent.</p>
      <ol className="lv-texts">{sim.map((x, i) => <li key={i} className={x.direction === "in" ? "in" : "out"}><p>{x.body}</p></li>)}</ol>
      <form className="lv-reply" onSubmit={e => { e.preventDefault(); void test(); }}>
        <input value={simIn} onChange={e => setSimIn(e.target.value)} placeholder="e.g. need a quote on 120 ft of cedar fence" aria-label="Customer text" />
        <button type="submit" className="op-primary" style={NB} disabled={busy === "simulate"}>{busy === "simulate" ? "Thinking…" : "Send as customer"}</button>
        {sim.length > 0 && <button type="button" style={NB} onClick={() => setSim([])}>Start over</button>}
      </form>
    </div>}
  </section>;
}
