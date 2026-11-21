"use client";

// Coming from Jobber or Housecall Pro: their words, the same thing here, and a button to it. Only what this app does.
import { useState } from "react";
import { PageHead } from "./charts";
import type { Go, Tab } from "./types";

type Row = { theirs: string; here: string; how: string; tab: Tab };
const JOBBER: Row[] = [
  { theirs: "Requests", here: "Inbox", how: "Every lead lands here and gets a text back from your number in seconds, day or night.", tab: "inbox" },
  { theirs: "Clients", here: "Customers", how: "One record per person: texts, calls, quotes, jobs, invoices, photos and notes together.", tab: "customers" },
  { theirs: "Properties", here: "On the customer", how: "Each customer keeps every address, with its gate code and notes.", tab: "customers" },
  { theirs: "Quotes", here: "Quotes", how: "Follow-ups go out on their own until it's a yes or a no, and stop when they reply.", tab: "quotes" },
  { theirs: "Jobs and visits", here: "Jobs", how: "One board from new lead to won, with the next step on every job.", tab: "jobs" },
  { theirs: "Schedule", here: "Calendar", how: "Estimates and installs, with who's on each.", tab: "calendar" },
  { theirs: "Invoices and payments", here: "Money", how: "Invoices with reminders. Customers pay through your own pay link; payments are recorded here.", tab: "invoices" },
  { theirs: "Recurring jobs", here: "Service plans", how: "Service plans that schedule the next visit and bill it.", tab: "plans" },
  { theirs: "Client hub", here: "The customer's quote page", how: "They read it, approve and sign from a link you text them. Approving tells you right away.", tab: "quotes" },
  { theirs: "Online booking", here: "Your booking page", how: "Open times come from your hours and calendar. The link is in Settings.", tab: "system" },
  { theirs: "Products and services", here: "Price list", how: "In Settings. Quote lines and the fence measure use it.", tab: "system" },
  { theirs: "Timesheets", here: "Clock in, on the crew's phone", how: "Hours land on the job's labor cost. Export them as a timesheet from Settings.", tab: "system" },
  { theirs: "Reports", here: "Numbers", how: "Leads, booked, won, collected, and where leads came from.", tab: "numbers" },
];
const HCP: Row[] = [
  { theirs: "Leads and pipeline", here: "Inbox and Jobs", how: "Every lead gets a text back from your number in seconds, then moves along one board.", tab: "inbox" },
  { theirs: "Customers", here: "Customers", how: "One record per person: texts, calls, quotes, jobs, invoices, photos and notes together.", tab: "customers" },
  { theirs: "Estimates and options", here: "Quotes", how: "Good, better and best from your fence types, with follow-ups until it's a yes or a no.", tab: "quotes" },
  { theirs: "Jobs", here: "Jobs", how: "One board from new lead to won, with the next step on every job.", tab: "jobs" },
  { theirs: "Schedule and dispatch", here: "Calendar", how: "Estimates and installs, and who's on each.", tab: "calendar" },
  { theirs: "Invoices", here: "Money", how: "Invoices with reminders. Customers pay through your own pay link; payments are recorded here.", tab: "invoices" },
  { theirs: "Service plans", here: "Service plans", how: "Plans that schedule the next visit and bill it.", tab: "plans" },
  { theirs: "Price book", here: "Price list", how: "In Settings. Quote lines and the fence measure use it.", tab: "system" },
  { theirs: "Online booking", here: "Your booking page", how: "Open times come from your hours and calendar. The link is in Settings.", tab: "system" },
  { theirs: "Customer portal", here: "The customer's quote page", how: "They read it, approve and sign from a link you text them. Approving tells you right away.", tab: "quotes" },
  { theirs: "Time tracking", here: "Clock in, on the crew's phone", how: "Hours land on the job's labor cost. Export them as a timesheet from Settings.", tab: "system" },
  { theirs: "Reporting", here: "Numbers", how: "Leads, booked, won, collected, and where leads came from.", tab: "numbers" },
];
const ONLY_HERE: { what: string; how: string; tab: Tab }[] = [
  { what: "Measure on the map", how: "Draw the fence on a satellite view of the yard; feet, posts, materials and a good, better, best quote come out of it.", tab: "jobs" },
  { what: "811 and permit paperwork on the job", how: "The locate ticket, permit, HOA and pins, with a warning before you book an install that isn't clear to dig.", tab: "jobs" },
  { what: "Nothing texts anyone while you move", how: "Open quotes and unpaid invoices come in with follow-ups and reminders off until you turn them on.", tab: "switch" },
];

export function ComingFromScreen({ go, from: from0 }: { go: Go; from?: "jobber" | "housecall" }) {
  const [from, setFrom] = useState<"jobber" | "housecall">(from0 ?? "jobber");
  const rows = from === "jobber" ? JOBBER : HCP, name = from === "jobber" ? "Jobber" : "Housecall Pro";
  return <>
    <PageHead title={`Coming from ${name}`} sub="What each thing is called here, and where to find it."
      actions={<div className="seg" role="tablist" aria-label="Coming from">{(["jobber", "housecall"] as const).map(k =>
        <button key={k} type="button" role="tab" aria-selected={from === k} className={from === k ? "on" : ""} onClick={() => setFrom(k)}>{k === "jobber" ? "Jobber" : "Housecall Pro"}</button>)}</div>} />
    <div className="dash">
      <section className="panel flat"><div className="panel-b">
        <table className="tbl cf-map"><thead><tr><th scope="col">In {name}</th><th scope="col">Here</th><th scope="col" className="cf-how">How it works</th><th scope="col" aria-label="Open" /></tr></thead>
          <tbody>{rows.map(r => <tr key={r.theirs}><td className="mut">{r.theirs}</td><td><b>{r.here}</b></td><td className="cf-how">{r.how}</td>
            <td className="r"><button type="button" className="btn sm ghost" onClick={() => go.tab(r.tab)} aria-label={`Open ${r.here}`}>Open</button></td></tr>)}</tbody></table>
      </div></section>
      <section className="panel flat"><div className="panel-h"><h2>Not in {name}</h2></div><div className="panel-b">
        <ul className="cf-only">{ONLY_HERE.map(o => <li key={o.what}><b>{o.what}</b><span>{o.how}</span></li>)}</ul>
      </div></section>
      <section className="panel flat"><div className="panel-b cf-move"><span>{from === "jobber" ? "Connect Jobber and your clients, properties, requests, quotes, jobs, invoices, notes and photos come over, with a preview first and an undo for 7 days." : "Add Housecall Pro's customer, job and invoice exports and they come over, with a preview first and an undo for 7 days."}</span>
        <button type="button" className="btn ink" onClick={() => go.tab("switch")}>Move my business in</button></div></section>
    </div>
  </>;
}
