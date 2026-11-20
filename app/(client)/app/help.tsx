"use client";

// Help: short answers to the questions owners ask in their first weeks, each pointing at the screen that does it.
// Only what this app does today. Anything not covered goes to Sam, who set the account up.
import { useMemo, useState } from "react";
import { Icon } from "./parts";
import type { Go, Tab } from "./types";

type Article = { id: string; group: string; q: string; a: string[]; to?: { tab: Tab; label: string } };

const ARTICLES: Article[] = [
  { id: "first-reply", group: "Leads", q: "What happens when a lead comes in?",
    a: ["A missed call, a text to your number, a website form or a lead email starts a conversation. Cinder texts back within seconds, asks the job questions you set, and offers estimate times from your calendar.",
      "You see every conversation in Inbox. Anything it can't answer, or any job over the limit you set, is handed to you and marked Your turn."], to: { tab: "inbox", label: "Open Inbox" } },
  { id: "take-over", group: "Leads", q: "How do I take over a conversation?",
    a: ["Open the conversation and type your reply. The moment you text, Cinder stops replying to that customer until you hand it back.", "Conversations waiting on you sit at the top of Inbox under Your turn."], to: { tab: "inbox", label: "Open Inbox" } },
  { id: "no-phone", group: "Leads", q: "A lead email came in with no phone number. What now?",
    a: ["Some lead emails (Angi, Thumbtack, website forms) don't include a phone. They wait on Today and in Inbox under Lead emails, no phone.", "Add the number from the email or the lead site and Cinder texts them right away."], to: { tab: "today", label: "Open Today" } },
  { id: "stop", group: "Leads", q: "What if someone replies STOP?",
    a: ["They're opted out on the spot and never texted again, by Cinder or by a group text. The conversation shows Opted out."] },
  { id: "hours", group: "Leads", q: "Does it text people at night?",
    a: ["Replies to someone who just reached out go any time, because that's when speed wins the job. Follow-ups and reminders wait for your quiet hours and go out in the morning."], to: { tab: "system", label: "Settings" } },
  { id: "booking", group: "Estimates", q: "How do estimates get booked?",
    a: ["Cinder offers times from the hours and limits you set in Settings (how far ahead, how many a day, the gap between visits). Connect Google Calendar and it only offers times you're free.", "Booked estimates land on Calendar. The customer gets a reminder before the visit."], to: { tab: "calendar", label: "Open Calendar" } },
  { id: "omw", group: "Estimates", q: "Can I tell a customer I'm on my way?",
    a: ["Yes. On Calendar, tap the visit and use On the way. It texts them that you're coming."], to: { tab: "calendar", label: "Open Calendar" } },
  { id: "measure", group: "Quotes", q: "How do I measure a fence from the office?",
    a: ["Open the job and use Measure. Draw the fence line on the satellite map, drop the gates, and the length and gates fill the quote lines."], to: { tab: "jobs", label: "Open Jobs" } },
  { id: "quote", group: "Quotes", q: "How do I send a quote?",
    a: ["Open the job and tap Quote. Add lines from your price list, offer good, better and best if you like, add extras they can tick, and set a deposit.", "Text it and the customer gets a link to see it, pick an option, sign and approve on their phone."], to: { tab: "quotes", label: "Open Quotes" } },
  { id: "chase", group: "Quotes", q: "Who follows up on quotes?",
    a: ["Cinder does. Every quote you text is followed up on day 2, 5 and 10, then once a month until they answer. It stops the moment they reply, approve or pass.", "You see the next follow-up on each quote and can pause it."], to: { tab: "quotes", label: "Open Quotes" } },
  { id: "signed", group: "Quotes", q: "Is an approved quote signed?",
    a: ["Yes. To approve, the customer types their name and draws a signature on their phone. The signature is kept with the quote and shows on it in Quotes."], to: { tab: "quotes", label: "Open Quotes" } },
  { id: "deposit", group: "Money", q: "How do customers pay a deposit?",
    a: ["Add your own pay link (Square, Stripe or PayPal) in Settings. When a customer approves a quote with a deposit, the next screen takes them to your payment page.", "The money goes straight to you. Cinder never holds it, so mark the deposit paid when it lands."], to: { tab: "invoices", label: "Open Money" } },
  { id: "invoice", group: "Money", q: "How do invoices and reminders work?",
    a: ["Bill a finished job from Money or from the job. Text it and the customer gets a link with your pay link on it.", "Unpaid invoices get friendly reminders on their own. Record a payment when it comes in, by card, cash or check, and the reminders stop."], to: { tab: "invoices", label: "Open Money" } },
  { id: "export", group: "Money", q: "Can my bookkeeper get the numbers?",
    a: ["Yes. On Money, Export gives invoices, payments and customers as CSV files that open in Excel, Google Sheets or QuickBooks."], to: { tab: "invoices", label: "Open Money" } },
  { id: "crew", group: "Team", q: "How do I add my crew?",
    a: ["In Settings, add each person with their cell. Crew see their schedule and jobs only. Office sees everything except settings.", "Assign a job by dragging it onto someone on Calendar, and they're texted the details."], to: { tab: "system", label: "Settings" } },
  { id: "import", group: "Getting set up", q: "How do I bring my customers over from Jobber?",
    a: ["In Jobber, export your clients as a CSV. Then use Move your business in and pick the file. Nobody gets texted, and you can undo an import for 7 days."], to: { tab: "switch", label: "Move your business in" } },
  { id: "plans", group: "Getting set up", q: "Can I run yearly service or maintenance?",
    a: ["Yes. Service plans repeat a visit on a schedule, like annual generator service or seasonal fence care. Each visit reminds the customer and can bill itself."], to: { tab: "plans", label: "Service plans" } },
  { id: "reviews", group: "Getting set up", q: "Does it ask for Google reviews?",
    a: ["Yes, once you add your review link in Settings. After a finished job it asks the customer the next day, once per customer."], to: { tab: "system", label: "Settings" } },
  { id: "data", group: "Your account", q: "Who owns my data?",
    a: ["You do. Export everything any time from Settings, see who changed what in the activity log, and payments always go straight to your own account."], to: { tab: "system", label: "Settings" } },
  { id: "phone-app", group: "Your account", q: "Is there a phone app?",
    a: ["Open this page on your phone and add it to your home screen. It works like an app, sends notifications, and keeps working without signal: changes you make offline are sent when you're back online."] },
];

export function HelpScreen({ go }: { go: Go }) {
  const [q, setQ] = useState(""), [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return t ? ARTICLES.filter(a => (a.q + " " + a.a.join(" ")).toLowerCase().includes(t)) : ARTICLES; }, [q]);
  const groups = [...new Set(shown.map(a => a.group))];
  return <>
    <header className="ph"><div className="ph-t"><h1><span>Help</span><em>Short answers, and the screen that does it.</em></h1></div></header>
    <div className="pad help">
      <label className="inwrap search help-find"><Icon name="search" size={14} /><span className="sr">Search help</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search, like deposit or crew" /></label>
      {groups.map(g => <section key={g} className="help-g"><h2>{g}</h2>
        {shown.filter(a => a.group === g).map(a => <div key={a.id} className={"help-a" + (open === a.id || q ? " on" : "")}>
          <button type="button" aria-expanded={open === a.id || !!q} onClick={() => setOpen(o => (o === a.id ? null : a.id))}><span>{a.q}</span><Icon name="down" size={14} /></button>
          {(open === a.id || q) && <div className="help-b">{a.a.map((p, i) => <p key={i}>{p}</p>)}{a.to && <button type="button" className="btn sm" onClick={() => go.tab(a.to!.tab)}>{a.to.label}</button>}</div>}
        </div>)}
      </section>)}
      {!shown.length && <p className="fine">Nothing matches that. Ask Sam below.</p>}
      <div className="help-sam"><b>Still stuck?</b><span>Sam set up your account and answers himself, usually the same day.</span><button type="button" className="btn ink" onClick={() => go.tab("sam")}>Message Sam</button></div>
    </div>
  </>;
}
