"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MyDayQueue from "../../my-day-queue";
import DailyPlanPanel from "../../daily-plan-panel";
import "./today.css";

type Ev = { id: string; title: string; startsAt: string; endsAt: string; allDay: boolean; type: string; status: string; contactId: string | null; dealId: string | null; contactName: string };

/**
 * Today: one page for the whole day. Today's meetings, the shared server-built queue (one source of truth
 * with filters), and the founder's routine + notes. Call mode works through the call items from this list.
 */
export default function TodayPage() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Morning" : now.getHours() < 18 ? "Afternoon" : "Evening";
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    fetch(`/api/calendar-events?fromAt=${encodeURIComponent(start.toISOString())}&toAt=${encodeURIComponent(end.toISOString())}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : { events: [] })).then(d => setEvents((d.events ?? []).filter((e: Ev) => e.status !== "cancelled")))
      .catch(() => setEvents([]));
  }, []);

  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const upcoming = (events ?? []).filter(e => new Date(e.endsAt).getTime() > Date.now());

  return <main className="td-page">
    <header className="td-head">
      <div>
        <div className="td-eyebrow">{dateLabel}</div>
        <h1 className="td-title">{greeting}, Samuel.</h1>
        <p className="td-sub">Everything waiting on you today, revenue first. Calls go through Call mode; nothing is sent or dialed for you.</p>
      </div>
      <Link href="/crm/call" className="td-cta">Start calling →</Link>
    </header>

    <section className="td-meetings" aria-label="Today's meetings">
      <div className="td-label">On the calendar</div>
      {events === null ? <p className="td-muted">Loading…</p> : upcoming.length === 0 ? <p className="td-muted">No more meetings today. <Link href="/crm/calendar">Calendar</Link></p> :
        <div className="td-ev-row">{upcoming.map(e => <Link key={e.id} href={e.dealId ? `/crm/deals/${e.dealId}` : e.contactId ? `/crm?contact=${e.contactId}` : "/crm/calendar"} className="td-ev">
          <span className="td-ev-time">{e.allDay ? "All day" : `${time(e.startsAt)} – ${time(e.endsAt)}`}</span>
          <strong>{e.title}</strong>
          {e.contactName && <small>{e.contactName}</small>}
        </Link>)}</div>}
    </section>

    <MyDayQueue showFilters title="Your queue" />

    <DailyPlanPanel />
  </main>;
}
