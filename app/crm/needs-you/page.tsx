"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MyDayQueue from "../../my-day-queue";
import DailyPlanPanel from "../../daily-plan-panel";
import OpsAlerts from "./ops-alerts";
import ProspectQueue from "./prospect-queue";
import MissionStrip from "./mission-strip";
import "./today.css";
import { useWorkspace } from "../../use-workspace";

type Ev = { id: string; title: string; startsAt: string; endsAt: string; allDay: boolean; type: string; status: string; contactId: string | null; dealId: string | null; contactName: string };

/**
 * Today: one page for the whole day. Today's meetings, the shared server-built queue (one source of truth
 * with filters), and the founder's routine + notes. Call mode works through the call items from this list.
 */
export default function TodayPage() {
  const ws = useWorkspace();
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
  const until = (iso: string) => {
    const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
    if (mins <= 0) return "now";
    const h = Math.floor(mins / 60), m = mins % 60;
    return "in " + (h ? `${h}h ` : "") + (m || !h ? `${m}m` : "");
  };

  return <main className="td-page">
    <header className="td-head">
      <div>
        <div className="td-eyebrow">{dateLabel}</div>
        <h1 className="td-title">{greeting}, {ws.ownerFirstName}</h1>
        <p className="td-sub">Where you stand, then what to do next.</p>
      </div>
      <Link href="/crm/call" className="td-cta">Start calling →</Link>
    </header>

    <MissionStrip />

    <section className="td-next" aria-label="Next up">
      <div className="td-next-k">Next up</div>
      {events === null ? <p className="td-muted">Loading…</p> : upcoming.length === 0
        ? <p className="td-next-empty">Nothing booked for the rest of today. <Link href="/crm/call">Book one →</Link></p>
        : <div className="td-next-row">{upcoming.slice(0, 3).map((e, i) => <Link key={e.id} href={e.dealId ? `/crm/deals/${e.dealId}` : e.contactId ? `/crm?contact=${e.contactId}` : "/crm/calendar"} className={"td-next-ev" + (i === 0 ? " is-first" : "")}>
            <span className="td-next-time">{e.allDay ? "All day" : time(e.startsAt)}<em>{e.allDay ? "" : until(e.startsAt)}</em></span>
            <strong>{e.title}</strong>
            {e.contactName && <small>{e.contactName}</small>}
          </Link>)}</div>}
    </section>

    <OpsAlerts />

    <ProspectQueue />

    <MyDayQueue showFilters title="Your queue" />

    <DailyPlanPanel />
  </main>;
}
