"use client";

// Launch-control strip for Today: the handful of numbers that decide whether the plan is on track.
import { useEffect, useState } from "react";
import Link from "next/link";
import { MOVE_OUT_MRR, WEEKLY_MEETING_TARGET, pctOf } from "@/lib/scoreboard";

type Board = {
  today: { calls: number; connects: number; meetings: number };
  week: { calls: number; connects: number; meetings: number };
  days: { date: string; calls: number; connects: number; meetings: number }[];
  streak: number;
  recurring: { clients: number; mrr: number };
  goal: { goal: number; collected: number; daysLeft: number; progressPct: number };
  targets: { dailyCalls: number; goalLabel: string };
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const pad = (n: number) => String(n).padStart(2, "0");

export default function MissionStrip() {
  const [b, setB] = useState<Board | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    fetch(`/api/scoreboard?today=${today}&tz=${d.getTimezoneOffset()}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject())).then(setB).catch(() => setErr(true));
  }, []);
  if (err) return null;
  const target = b?.targets.dailyCalls ?? 100;
  const max = Math.max(target, ...(b?.days.map(x => x.calls) ?? [0]));
  const tiles = [
    { k: "Dials today", v: b ? `${b.today.calls}` : "—", of: `/ ${target}`, pct: b ? pctOf(b.today.calls, target) : 0, note: b ? (b.today.calls >= target ? "Target hit" : `${target - b.today.calls} to go`) : "", href: "/crm/call" },
    { k: "Conversations", v: b ? `${b.today.connects}` : "—", of: "today", pct: -1, note: b ? `${b.today.meetings} meeting${b.today.meetings === 1 ? "" : "s"} booked today` : "", href: "/crm/scoreboard" },
    { k: "Meetings · 7 days", v: b ? `${b.week.meetings}` : "—", of: `/ ${WEEKLY_MEETING_TARGET}`, pct: b ? pctOf(b.week.meetings, WEEKLY_MEETING_TARGET) : 0, note: "The number that matters", href: "/crm/calendar" },
    { k: "MRR", v: b ? money(b.recurring.mrr) : "—", of: `/ ${money(MOVE_OUT_MRR)}`, pct: b ? pctOf(b.recurring.mrr, MOVE_OUT_MRR) : 0, note: b ? (b.recurring.mrr >= MOVE_OUT_MRR ? "Move-out line cleared" : `${money(MOVE_OUT_MRR - b.recurring.mrr)} to move out · ${b.recurring.clients} client${b.recurring.clients === 1 ? "" : "s"}`) : "", href: "/crm/client-success" },
    { k: b?.targets.goalLabel ?? "Goal", v: b ? money(b.goal.collected) : "—", of: b ? `/ ${money(b.goal.goal)}` : "", pct: b ? b.goal.progressPct : 0, note: b ? `${b.goal.daysLeft} days left` : "", href: "/crm/finance" },
    { k: "Streak", v: b ? `${b.streak}` : "—", of: b?.streak === 1 ? "day" : "days", pct: -1, note: "Days in a row with dials", href: "/crm/scoreboard" },
  ];
  return (
    <section className="ms" aria-label="Mission status">
      <div className="ms-grid">
        {tiles.map(t => (
          <Link key={t.k} href={t.href} className="ms-tile">
            <span className="ms-k">{t.k}</span>
            <span className="ms-v">{t.v}<small>{t.of}</small></span>
            {t.pct >= 0 && <span className="ms-bar" aria-hidden="true"><i style={{ width: `${t.pct}%` }} /></span>}
            <span className="ms-note">{t.note}</span>
          </Link>
        ))}
      </div>
      <div className="ms-hist" aria-label="Dials, last 14 days">
        <span className="ms-k">Dials · last 14 days</span>
        <div className="ms-bars">
          {(b?.days ?? Array.from({ length: 14 }, (_, i) => ({ date: String(i), calls: 0, connects: 0, meetings: 0 }))).map((d, i, arr) => (
            <div key={d.date} className={"ms-col" + (i === arr.length - 1 ? " is-today" : "")} title={`${d.date}: ${d.calls} dials, ${d.connects} conversations, ${d.meetings} meetings`}>
              <i style={{ height: `${max > 0 ? Math.max(3, (d.calls / max) * 100) : 3}%` }} />
              {d.meetings > 0 && <b aria-label={`${d.meetings} meetings`} />}
            </div>
          ))}
          <span className="ms-target" style={{ bottom: `${max > 0 ? (target / max) * 100 : 0}%` }}><em>{target}</em></span>
        </div>
      </div>
    </section>
  );
}
