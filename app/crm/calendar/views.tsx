"use client";

// Month grid and week/day time grid for the Calendar page. Presentational only: data and
// actions come from the page. Routine blocks (lib/routine) are drawn beside real events.

import { useEffect, useRef } from "react";
import { routineFor, blockTime, type RoutineKind } from "@/lib/routine";

export type EventType = "meeting" | "call" | "focus" | "personal" | "deadline" | "other";
export type EventStatus = "scheduled" | "completed" | "cancelled";
export type CalendarEvent = { id: string; title: string; description: string; startsAt: string; endsAt: string; allDay: boolean; type: EventType; status: EventStatus; contactId: string | null; dealId: string | null; contactName: string; dealTitle: string };

type Props = {
  view: "month" | "week" | "day";
  days: Date[];
  anchor: Date;
  eventsOn: (day: Date) => CalendarEvent[];
  followUpsOn: (day: Date) => number;
  onEdit: (e: CalendarEvent) => void;
  onNew: (at: Date) => void;
  onOpenDay: (day: Date) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const sameDay = (a: Date, b: Date) => keyOf(a) === keyOf(b);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "9am", "9:30am", "12:15pm" */
export function shortTime(d: Date): string {
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}${m ? ":" + pad(m) : ""}${h < 12 ? "am" : "pm"}`;
}

const ROUTINE_TONE: Record<RoutineKind, string> = { trading: "amber", dial: "green", outreach: "gray", followup: "blue", build: "violet", personal: "gray" };
const EVENT_TONE: Record<EventType, string> = { meeting: "blue", call: "green", focus: "violet", personal: "amber", deadline: "red", other: "gray" };

type Item = { id: string; title: string; start: Date; end: Date; tone: string; routine: boolean; event?: CalendarEvent; sub?: string };

function itemsFor(day: Date, events: CalendarEvent[], monthOnly: boolean): Item[] {
  const routine: Item[] = routineFor(day, monthOnly).map(b => ({ id: "r-" + b.start, title: b.title, start: b.startsAt, end: b.endsAt, tone: ROUTINE_TONE[b.kind], routine: true, sub: blockTime(b) }));
  const evs: Item[] = events.filter(e => !e.allDay).map(e => ({ id: e.id, title: e.title, start: new Date(e.startsAt), end: new Date(e.endsAt), tone: EVENT_TONE[e.type] ?? "gray", routine: false, event: e, sub: e.contactName || undefined }));
  return [...routine, ...evs].sort((a, b) => a.start.getTime() - b.start.getTime() || Number(a.routine) - Number(b.routine));
}

// ---------- Month ----------

function MonthView({ days, anchor, eventsOn, followUpsOn, onEdit, onNew, onOpenDay }: Props) {
  const today = new Date();
  const MAX = 4;
  return (
    <div className="cal-month" role="grid" aria-label="Month">
      <div className="cal-month-head" role="row">{WEEKDAYS.map(d => <div key={d} className="cal-month-dow" role="columnheader">{d}</div>)}</div>
      <div className="cal-month-body">
        {days.map(day => {
          const all = eventsOn(day);
          const allDay = all.filter(e => e.allDay);
          const items = itemsFor(day, all, true);
          const fu = followUpsOn(day);
          const shown = items.slice(0, MAX - Math.min(allDay.length, 2));
          const more = items.length - shown.length;
          const outside = day.getMonth() !== anchor.getMonth();
          const isToday = sameDay(day, today);
          return (
            <div key={keyOf(day)} role="gridcell" className={"cal-cell" + (outside ? " is-outside" : "") + (isToday ? " is-today" : "")} onDoubleClick={() => { const at = new Date(day); at.setHours(10, 0, 0, 0); onNew(at); }}>
              <button type="button" className="cal-cell-date" onClick={() => onOpenDay(day)} aria-label={"Open " + day.toDateString()}>{day.getDate() === 1 ? day.toLocaleDateString(undefined, { month: "short" }) + " 1" : day.getDate()}</button>
              <div className="cal-cell-items">
                {allDay.slice(0, 2).map(e => <button type="button" key={e.id} className={"cal-bar tone-" + (EVENT_TONE[e.type] ?? "gray") + (e.status === "cancelled" ? " is-cancelled" : "")} onClick={() => onEdit(e)}>{e.title}</button>)}
                {shown.map(it => it.event
                  ? <button type="button" key={it.id} className={"cal-chip tone-" + it.tone + (it.event.status === "cancelled" ? " is-cancelled" : "")} onClick={() => onEdit(it.event!)} title={it.title}><i className="cal-dot" /><span className="cal-chip-time">{shortTime(it.start)}</span><span className="cal-chip-title">{it.title}</span></button>
                  : <div key={it.id} className={"cal-chip is-routine tone-" + it.tone} title={it.title + " · " + it.sub}><i className="cal-dot" /><span className="cal-chip-time">{shortTime(it.start)}</span><span className="cal-chip-title">{it.title}</span></div>)}
                {more > 0 && <button type="button" className="cal-more" onClick={() => onOpenDay(day)}>{more} more</button>}
              </div>
              {fu > 0 && <a className="cal-followups" href="/crm/tasks" title="Open Tasks">{fu} follow-up{fu === 1 ? "" : "s"}</a>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Week / Day time grid ----------

const START_H = 6, END_H = 24, HOUR_PX = 52;

/** Side-by-side lanes for overlapping items (Google-Calendar style). */
function layout(items: Item[]): (Item & { lane: number; lanes: number })[] {
  const out: (Item & { lane: number; lanes: number })[] = [];
  let cluster: (Item & { lane: number; lanes: number })[] = [];
  let clusterEnd = 0;
  const flush = () => { const n = Math.max(1, ...cluster.map(c => c.lane + 1)); cluster.forEach(c => { c.lanes = n; out.push(c); }); cluster = []; };
  for (const it of items) {
    if (cluster.length && it.start.getTime() >= clusterEnd) flush();
    const used = new Set(cluster.filter(c => c.end.getTime() > it.start.getTime()).map(c => c.lane));
    let lane = 0; while (used.has(lane)) lane++;
    cluster.push({ ...it, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, it.end.getTime());
  }
  if (cluster.length) flush();
  return out;
}

function minutesFromStart(d: Date) { return (d.getHours() - START_H) * 60 + d.getMinutes(); }

function TimeGrid({ days, eventsOn, followUpsOn, onEdit, onNew, onOpenDay, view }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const today = new Date();
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = (7 - START_H) * HOUR_PX - 8; }, [view]);
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const cols = { gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` };
  const anyAllDay = days.some(d => eventsOn(d).some(e => e.allDay) || followUpsOn(d) > 0);
  return (
    <div className={"cal-tg" + (days.length === 1 ? " is-day" : "")}>
      <div className="cal-tg-head" style={cols}>
        <div className="cal-tg-gutter" />
        {days.map(d => {
          const isToday = sameDay(d, today);
          return (
            <button type="button" key={keyOf(d)} className={"cal-tg-dayhead" + (isToday ? " is-today" : "")} onClick={() => onOpenDay(d)}>
              <span className="cal-tg-dow">{WEEKDAYS[d.getDay()]}</span>
              <span className="cal-tg-num">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      {anyAllDay && (
        <div className="cal-tg-allday" style={cols}>
          <div className="cal-tg-gutter cal-tg-label">all day</div>
          {days.map(d => {
            const fu = followUpsOn(d);
            return (
              <div key={keyOf(d)} className="cal-tg-allday-col">
                {eventsOn(d).filter(e => e.allDay).map(e => <button type="button" key={e.id} className={"cal-bar tone-" + (EVENT_TONE[e.type] ?? "gray")} onClick={() => onEdit(e)}>{e.title}</button>)}
                {fu > 0 && <a className="cal-followups" href="/crm/tasks">{fu} follow-up{fu === 1 ? "" : "s"}</a>}
              </div>
            );
          })}
        </div>
      )}
      <div className="cal-tg-scroll" ref={scroller}>
        <div className="cal-tg-body" style={{ ...cols, height: hours.length * HOUR_PX }}>
          <div className="cal-tg-gutter cal-tg-hours">
            {hours.map(h => <div key={h} className="cal-tg-hour" style={{ top: (h - START_H) * HOUR_PX }}>{h === START_H ? "" : `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`}</div>)}
          </div>
          {days.map(d => {
            const visible = itemsFor(d, eventsOn(d), false).filter(it => it.end.getHours() * 60 + it.end.getMinutes() > START_H * 60 || it.end.getDate() !== it.start.getDate());
            const routineItems = visible.filter(it => it.routine);
            // Routine blocks are the backdrop; real events lay out among themselves and sit on top,
            // inset from the left when they cover a routine block so both stay readable.
            const items = [
              ...layout(routineItems).map(it => ({ ...it, inset: 0 })),
              ...layout(visible.filter(it => !it.routine)).map(it => ({ ...it, inset: routineItems.some(r => r.start < it.end && r.end > it.start) ? 18 : 0 })),
            ];
            const isToday = sameDay(d, today);
            const nowTop = minutesFromStart(today) / 60 * HOUR_PX;
            return (
              <div key={keyOf(d)} className={"cal-tg-col" + (isToday ? " is-today" : "")} onClick={e => {
                if (e.target !== e.currentTarget) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const mins = Math.max(0, Math.floor((e.clientY - rect.top) / HOUR_PX * 2) * 30);
                const at = new Date(d); at.setHours(START_H, 0, 0, 0); at.setMinutes(at.getMinutes() + mins); onNew(at);
              }}>
                {hours.map(h => <div key={h} className="cal-tg-line" style={{ top: (h - START_H) * HOUR_PX }} />)}
                {items.map(it => {
                  const startM = Math.max(0, minutesFromStart(it.start));
                  const endM = sameDay(it.end, d) ? minutesFromStart(it.end) : (END_H - START_H) * 60;
                  const top = startM / 60 * HOUR_PX + 1, height = Math.max(20, (endM - startM) / 60 * HOUR_PX - 3);
                  const width = (100 - it.inset) / it.lanes;
                  const style = { top, height, left: `calc(${it.inset + it.lane * width}% + 3px)`, width: `calc(${width}% - 7px)` };
                  const compact = height < 40;
                  const body = <><span className="cal-block-title">{it.title}</span>{!compact && <span className="cal-block-time">{shortTime(it.start)}–{shortTime(it.end)}{it.event && it.sub ? " · " + it.sub : ""}</span>}</>;
                  return it.event
                    ? <button type="button" key={it.id} className={"cal-block tone-" + it.tone + (compact ? " is-compact" : "") + (it.event.status === "cancelled" ? " is-cancelled" : "")} style={style} onClick={() => onEdit(it.event!)}>{body}</button>
                    : <div key={it.id} className={"cal-block is-routine tone-" + it.tone + (compact ? " is-compact" : "")} style={style} title={it.title}>{body}</div>;
                })}
                {isToday && nowTop > 0 && nowTop < hours.length * HOUR_PX && <div className="cal-now" style={{ top: nowTop }} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CalendarViews(props: Props) {
  return props.view === "month" ? <MonthView {...props} /> : <TimeGrid {...props} />;
}
