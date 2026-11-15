"use client";

// System: how leads reach Cinder and what happens to them. Every wire with its real status: the business number,
// missed-call text-back, the website chat and form, the paid lead sites, the calendar, the follow-ups. The keys
// and webhook addresses are the ones the backend actually answers to.
import { useState } from "react";
import { Icon, fmtPhone } from "./parts";
import type { Biz, Data, Go } from "./types";

type State = "on" | "off" | "todo";
function Wire({ state, title, st, children, acts }: { state: State; title: string; st: string; children?: React.ReactNode; acts?: React.ReactNode }) {
  return <div className={"wire " + state}><span className="dot" aria-hidden="true" /><div>
    <div className="wt"><b>{title}</b><span className="st">{st}</span></div>
    {children && <p>{children}</p>}
    {acts && <div className="wa">{acts}</div>}
  </div></div>;
}
function Code({ text, block, onCopied }: { text: string; block?: boolean; onCopied: () => void }) {
  const copy = async () => { try { await navigator.clipboard.writeText(text); onCopied(); } catch { prompt("Copy:", text); } };
  if (block) return <div className="code block">{text}<div style={{ marginTop: 6 }}><button type="button" className="btn sm" onClick={() => void copy()}><Icon name="link" size={12} />Copy</button></div></div>;
  return <span className="code"><span title={text}>{text}</span><button type="button" onClick={() => void copy()} aria-label="Copy"><Icon name="link" size={13} /></button></span>;
}

export function SystemScreen({ d, biz, go, push, onPush, toast }: { d: Data; biz: Biz; go: Go; push: string; onPush: () => void; toast: (t: string, bad?: boolean) => void }) {
  const s = d.setup ?? {};
  const origin = d.origin || (typeof location !== "undefined" ? location.origin : "");
  const key = d.key || "";
  const intake = (src?: string) => `${origin}/api/intake?key=${key || "<your key>"}${src ? `&source=${src}` : ""}`;
  const snippet = `<script src="${origin}/chat.js" data-key="${key || "<your key>"}" async></script>`;
  const copied = () => toast("Copied.");
  const chosen = (s.lead_sources || "").toLowerCase();
  const number = d.number ? fmtPhone(d.number) : "";
  const cal = d.calendar;
  const [showAll, setShowAll] = useState(false);
  const paid: [string, string, string][] = [["angi", "Angi", "In Angi Leads: Lead delivery, add a webhook (HTTP POST, JSON) to this address."], ["thumbtack", "Thumbtack", "Through Zapier or Make: a new Thumbtack lead posts to this address."], ["facebook", "Facebook Lead Ads", "Through Zapier or Make: a new lead posts to this address. Facebook's field_data is read as-is."]];
  const sites = paid.filter(([k]) => showAll || chosen.includes(k));
  const wired = [d.number, s.has_cell, biz.calendar, biz.reviewLink, biz.payLink, push === "on"].filter(Boolean).length;

  return <>
    <header className="tb"><h1 className="h1">Settings</h1><span className="sub">How leads reach Cinder and what happens next, {wired} of 6 wires live</span>
      <div className="acts"><button type="button" className="btn" onClick={() => go.tab("sam")}>Ask Sam</button></div></header>
    <div className="pad wires">
      <section>
        <p className="sec">Leads in</p>
        <Wire state={d.number ? "on" : "todo"} title="Your Cinder number" st={number ? `Live, ${number}` : "Sam is connecting it"}>
          Calls and texts to this number reach Cinder. Every text a lead gets comes from it, in your business&rsquo;s name.
        </Wire>
        <Wire state={d.number ? "on" : "off"} title="Missed-call text-back" st={d.number ? "Live" : "Needs your number"}>
          {s.has_cell ? "A call rings your cell first. " : ""}When nobody picks up, the caller gets a text within seconds and Cinder keeps the conversation going.
          To cover your main business line too, forward it to your Cinder number when busy or unanswered.
        </Wire>
        <Wire state={s.has_cell ? "on" : "todo"} title="Your cell" st={s.has_cell ? "On file" : "Not on file"}>
          Calls to the Cinder number ring your cell, and alerts that need you go there by text.{!s.has_cell && " Ask Sam to add it."}
        </Wire>
        <Wire state={key ? "on" : "off"} title="Website chat" st={key ? "Ready for your site" : "Sam is setting it up"} acts={key ? <Code text={snippet} block onCopied={copied} /> : null}>
          A small chat bubble on your website. The visitor leaves a name, cell and question, and the reply comes by text in seconds. Paste this once, before the closing body tag.
        </Wire>
        <Wire state={key ? "on" : "off"} title="Website form" st={key ? "Ready" : "Sam is setting it up"} acts={key ? <Code text={intake()} onCopied={copied} /> : null}>
          Point any form, landing page or form tool&rsquo;s webhook at this address. JSON or a normal form post both work. Each submission gets a text back right away.
        </Wire>
        {sites.map(([k, label, how]) => <Wire key={k} state={key ? "on" : "off"} title={label} st={chosen.includes(k) ? "In your setup" : "Available"} acts={key ? <Code text={intake(k)} onCopied={copied} /> : null}>{how} The lead hears back from you on {label} in seconds.</Wire>)}
        {!showAll && sites.length < paid.length && <div className="wire"><span className="dot" style={{ background: "transparent" }} /><button type="button" className="link" onClick={() => setShowAll(true)}>Show {paid.length - sites.length} more lead sites</button></div>}
      </section>

      <section>
        <p className="sec">Booking</p>
        <Wire state={cal?.connected ? "on" : "todo"} title="Google Calendar" st={cal?.connected ? `Connected, ${cal.email || "your calendar"}` : "Not connected"}
          acts={cal?.connected ? <button type="button" className="btn sm" onClick={() => go.tab("calendar")}>Open calendar</button> : <a className="btn sm ink" href={cal?.connectUrl || "#"} target="_blank" rel="noreferrer">Connect Google Calendar</a>}>
          Cinder offers estimate times only where you&rsquo;re free, and puts each booking and install on your calendar.
        </Wire>
        <Wire state={s.hours ? "on" : "off"} title="Texting hours" st={s.hours ? s.hours : "Default hours"}>
          Leads get an instant first reply any time. Follow-ups, reminders and review asks wait for these hours so nobody hears from you at 2 AM.
        </Wire>
        <Wire state={s.has_booking_link ? "on" : "off"} title="Booking link" st={s.has_booking_link ? "On file" : "Not used"}>
          When set, a lead can pick their own time from a link in the text instead of going back and forth.
        </Wire>
      </section>

      <section>
        <p className="sec">After the yes</p>
        <Wire state="on" title="Quote follow-ups" st={`${d.quoteSteps || 4} texts`}>
          After you send a quote, Cinder follows up until they answer, and stops the moment they reply or you mark it won or lost.
        </Wire>
        <Wire state={biz.reviewLink ? "on" : "todo"} title="Google review link" st={biz.reviewLink ? "On file" : "Not on file"}>
          The morning after an install, the customer gets one text asking for a review with your link.{!biz.reviewLink && " Ask Sam to add it and this turns on."}
        </Wire>
        <Wire state={biz.payLink ? "on" : "todo"} title="Invoices and payments" st={biz.payLink ? "Pay link on file" : "No pay link yet"} acts={<button type="button" className="btn sm" onClick={go.billing}>{biz.payLink ? "Edit pay link and tax" : "Add pay link"}</button>}>
          Invoices go by text with a Pay button that opens your own payment page. Up to 3 reminders after the due date. Cinder never touches the money.
        </Wire>
      </section>

      <section>
        <p className="sec">You</p>
        <Wire state={push === "on" ? "on" : push === "off" ? "todo" : "off"} title="Notifications" st={push === "on" ? "On" : push === "off" ? "Off" : push === "blocked" ? "Blocked in settings" : push === "ios-install" ? "Add to Home Screen first" : "Not on this browser"}
          acts={push === "off" ? <button type="button" className="btn sm ink" onClick={onPush}>Turn on</button> : null}>
          New leads, bookings, replies that need you and payments, on this device.
        </Wire>
        <Wire state="on" title="Prices and business details" st={s.trade ? `${s.trade}, ${s.price_book ? "prices on file" : "no prices yet"}` : "Not set"} acts={<button type="button" className="btn sm" onClick={go.setup}>Edit setup</button>}>
          What Cinder knows about your work: the questions it asks, the ballpark it can give, the name it texts as.
        </Wire>
        <Wire state="on" title="Your customers" st={`${d.customers?.length ?? 0} people`} acts={<button type="button" className="btn sm" onClick={go.importCustomers}>Import from Jobber or CSV</button>}>
          Bring in past customers so they&rsquo;re on file, and so win-back texts can reach the ones who opted in.
        </Wire>
      </section>
    </div>
  </>;
}
