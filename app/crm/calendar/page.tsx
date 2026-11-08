"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./calendar.css";
import CalendarViews, { type CalendarEvent, type EventType, type EventStatus } from "./views";
import { routineFor, blockTime } from "@/lib/routine";

type Task = {id:string;title:string;status:string;priority:string;dueAt:string|null;contactName:string;dealTitle:string};
type Contact = {id:string;name:string;company:string};
type Deal = {id:string;title:string;company:string;contactName:string};
type View = "month" | "week" | "day";
type MeetingPrep = {event:{id:string;title:string;description:string;startsAt:string;endsAt:string;status:string};contact:{id:string;name:string;company:string;role:string;email:string;phone:string;website:string;location:string;status:string;source:string;notes:string;followUpAt:string|null}|null;linkedDeal:{title:string;stage:string;serviceType:string;setupFee:number;monthlyFee:number;expectedCloseDate:string|null;notes:string}|null;relatedDeals:{id:string;title:string;stage:string;serviceType:string;setupFee:number;monthlyFee:number;expectedCloseDate:string|null;notes:string}[];recentActivity:{channel:string;action:string;outcome:string;notes:string;occurredAt:string}[];openTasks:{id:string;title:string;description:string;status:string;priority:string;dueAt:string|null}[];checklist:string[];unlinked:boolean};
const typeLabels:Record<EventType,string>={meeting:"Meeting",call:"Call",focus:"Focus time",personal:"Personal",deadline:"Deadline",other:"Other"};
const blank={title:"",description:"",startsAt:"",endsAt:"",allDay:false,type:"meeting" as EventType,status:"scheduled" as EventStatus,contactId:"",dealId:""};
const pad=(n:number)=>String(n).padStart(2,"0");
function dateKey(d:Date){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function localMidnightIso(key:string){const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d).toISOString()}
function atLocalInput(d:Date){return dateKey(d)+"T"+pad(d.getHours())+":"+pad(d.getMinutes())}
function addDays(d:Date,n:number){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function startOfWeek(d:Date){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-x.getDay());return x}
function startOfMonth(d:Date){return new Date(d.getFullYear(),d.getMonth(),1)}
function endDate(d:Date){return dateKey(addDays(d,1))}
function eventTime(e:CalendarEvent){return e.allDay?"All day":new Date(e.startsAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}
function localInput(v:string){const d=new Date(v);return atLocalInput(d)}
function defaultDraft(day:Date,keepTime=false){const start=new Date(day);if(!keepTime)start.setHours(10,0,0,0);const end=new Date(start);end.setMinutes(end.getMinutes()+30);return {...blank,startsAt:atLocalInput(start),endsAt:atLocalInput(end)}}
export default function CalendarPage(){
 const [anchor,setAnchor]=useState(()=>new Date());
 const [view,setView]=useState<View>("week");
 const [events,setEvents]=useState<CalendarEvent[]>([]);
 const [tasks,setTasks]=useState<Task[]>([]);
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [deals,setDeals]=useState<Deal[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [show,setShow]=useState(false),[editing,setEditing]=useState<string|null>(null);
 const [draft,setDraft]=useState(blank);
 const [prep,setPrep]=useState<MeetingPrep|null>(null);
 const [prepLoading,setPrepLoading]=useState(false);
 const [prepError,setPrepError]=useState("");
 const range=useMemo(()=>{
  if(view==="month"){const first=startOfWeek(startOfMonth(anchor));return {from:dateKey(first),to:endDate(addDays(first,41))};}
  const first=view==="week"?startOfWeek(anchor):new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate());
  return {from:dateKey(first),to:endDate(addDays(first,view==="week"?6:0))};
 },[anchor,view]);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const [er,tr,cr,dr]=await Promise.all([
    fetch("/api/calendar-events?from="+range.from+"&to="+range.to+"&fromAt="+encodeURIComponent(localMidnightIso(range.from))+"&toAt="+encodeURIComponent(localMidnightIso(range.to)),{cache:"no-store"}),
    fetch("/api/tasks",{cache:"no-store"}),fetch("/api/contacts",{cache:"no-store"}),fetch("/api/deals",{cache:"no-store"})
   ]);
   if(!er.ok)throw new Error(er.status===401?"Sign in to use your calendar.":"Could not load calendar events. If this is a new environment, confirm the calendar migration has been applied.");
   const ed=await er.json();setEvents(Array.isArray(ed.events)?ed.events:[]);
   if(tr.ok){const td=await tr.json();setTasks(Array.isArray(td.tasks)?td.tasks:[])}
   if(cr.ok){const cd=await cr.json();setContacts(Array.isArray(cd.contacts)?cd.contacts:[])}
   if(dr.ok){const dd=await dr.json();setDeals(Array.isArray(dd.deals)?dd.deals:[])}
  }catch(e){setError(e instanceof Error?e.message:"Could not load calendar.")}finally{setLoading(false)}
 },[range.from,range.to]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(typeof window!=="undefined"&&window.innerWidth<700)setView("day")},[]);
 const days=useMemo(()=>{
  if(view==="month"){const first=startOfWeek(startOfMonth(anchor));return Array.from({length:42},(_,i)=>addDays(first,i))}
  const first=view==="week"?startOfWeek(anchor):new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate());
  return Array.from({length:view==="week"?7:1},(_,i)=>addDays(first,i));
 },[anchor,view]);
 const title=useMemo(()=>view==="day"?anchor.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"}):view==="week"?startOfWeek(anchor).toLocaleDateString(undefined,{month:"short",day:"numeric"})+" – "+addDays(startOfWeek(anchor),6).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):anchor.toLocaleDateString(undefined,{month:"long",year:"numeric"}),[anchor,view]);
 function eventsOn(day:Date){const start=new Date(day.getFullYear(),day.getMonth(),day.getDate()).getTime();const end=addDays(new Date(day.getFullYear(),day.getMonth(),day.getDate()),1).getTime();return events.filter(e=>new Date(e.startsAt).getTime()<end&&new Date(e.endsAt).getTime()>start).sort((a,b)=>Number(a.allDay===false)-Number(b.allDay===false)||a.startsAt.localeCompare(b.startsAt))}
 function tasksOn(day:Date){const key=dateKey(day);return tasks.filter(t=>t.dueAt&&dateKey(new Date(t.dueAt))===key&&!["done","cancelled"].includes(t.status))}
 function startNew(day:Date,keepTime=false){setDraft(defaultDraft(day,keepTime));setEditing(null);setShow(true);setError("");setNotice("")}
 function startEdit(e:CalendarEvent){setDraft({title:e.title,description:e.description,startsAt:localInput(e.startsAt),endsAt:localInput(e.endsAt),allDay:e.allDay,type:e.type,status:e.status,contactId:e.contactId||"",dealId:e.dealId||""});setEditing(e.id);setShow(true);setError("");setNotice("")}
 function navigate(direction:number){setAnchor(d=>{const x=new Date(d);if(view==="month")x.setMonth(x.getMonth()+direction,1);else x.setDate(x.getDate()+direction*(view==="week"?7:1));return x})}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{
  const body={...draft,startsAt:new Date(draft.startsAt).toISOString(),endsAt:new Date(draft.endsAt).toISOString(),contactId:draft.contactId||null,dealId:draft.dealId||null};
  const r=await fetch("/api/calendar-events",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing?{...body,id:editing}:body)});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Could not save event.");
  setShow(false);setNotice(editing?"Event updated.":"Event added to your calendar.");await load();
 }catch(e){setError(e instanceof Error?e.message:"Could not save event.")}finally{setBusy(false)}}
 async function remove(){if(!editing||!confirm("Delete this calendar event?"))return;setBusy(true);try{const r=await fetch("/api/calendar-events",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:editing})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Could not delete event.");setShow(false);setNotice("Event deleted.");await load()}catch(e){setError(e instanceof Error?e.message:"Could not delete event.")}finally{setBusy(false)}}
 async function changeStatus(e:CalendarEvent,status:EventStatus){const r=await fetch("/api/calendar-events",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:e.id,status})});if(!r.ok){setError("Could not update event status.");return}setEvents(old=>old.map(x=>x.id===e.id?{...x,status}:x))}
 async function openPrep(e:CalendarEvent){setPrep(null);setPrepError("");setPrepLoading(true);try{const r=await fetch("/api/meeting-prep?eventId="+encodeURIComponent(e.id),{cache:"no-store"});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Could not load meeting brief.");setPrep(data as MeetingPrep)}catch(err){setPrepError(err instanceof Error?err.message:"Could not load meeting brief.")}finally{setPrepLoading(false)}}
 return <main className="calendar-page">
  {error&&<div className="calendar-alert" role="alert">{error}<button onClick={()=>setError("")}>Dismiss</button></div>}{notice&&<p className="calendar-notice" role="status">{notice}</p>}
  <div className="cal-layout">
  <section className="cal-shell">
   <div className="cal-top">
    <div className="cal-top-left">
     <button type="button" className="cal-btn" onClick={()=>setAnchor(new Date())}>Today</button>
     <div className="cal-arrows"><button type="button" className="cal-icon-btn" onClick={()=>navigate(-1)} aria-label="Previous period"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><button type="button" className="cal-icon-btn" onClick={()=>navigate(1)} aria-label="Next period"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button></div>
     <h1 className="cal-title">{title}</h1>
     {loading&&<span className="cal-loading">Loading…</span>}
    </div>
    <div className="cal-top-right">
     <div className="cal-seg" role="group" aria-label="Calendar view">{(["day","week","month"] as View[]).map(v=><button type="button" aria-pressed={view===v} key={v} className={view===v?"is-on":""} onClick={()=>setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div>
     <button type="button" className="cal-btn cal-btn-primary" onClick={()=>startNew(anchor)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New event</button>
    </div>
   </div>
   <CalendarViews view={view} days={days} anchor={anchor} eventsOn={eventsOn} followUpsOn={d=>tasksOn(d).length} onEdit={startEdit} onNew={at=>startNew(at,true)} onOpenDay={d=>{setAnchor(d);setView("day")}}/>
  </section>
  <div className="cal-rail">
   {(()=>{
    const today=new Date();const monthStart=startOfMonth(anchor);const gridStart=startOfWeek(monthStart);const cells=Array.from({length:42},(_,k)=>addDays(gridStart,k));
    const wkStart=startOfWeek(anchor),wkEnd=addDays(wkStart,7);
    const inWeek=events.filter(e=>e.status!=="cancelled"&&new Date(e.startsAt)>=wkStart&&new Date(e.startsAt)<wkEnd);
    const meetings=inWeek.filter(e=>e.type==="meeting"||e.type==="call").length;
    const dialMins=Array.from({length:7},(_,k)=>routineFor(addDays(wkStart,k))).flat().filter(b=>b.kind==="dial").reduce((n,b)=>n+(b.endsAt.getTime()-b.startsAt.getTime())/60000,0);
    const dueFollowUps=tasks.filter(t=>t.dueAt&&!["done","cancelled"].includes(t.status)&&new Date(t.dueAt)>=wkStart&&new Date(t.dueAt)<wkEnd).length;
    const todayItems=[...routineFor(today).map(b=>({key:"r"+b.start,t:b.startsAt,end:b.endsAt,title:b.title,sub:blockTime(b),kind:"routine" as const,ev:null as CalendarEvent|null})),...eventsOn(today).filter(e=>e.status!=="cancelled"&&!e.allDay).map(e=>({key:e.id,t:new Date(e.startsAt),end:new Date(e.endsAt),title:e.title,sub:eventTime(e)+(e.contactName?", "+e.contactName:""),kind:"event" as const,ev:e as CalendarEvent|null}))].sort((a,b)=>a.t.getTime()-b.t.getTime());
    const nowMs=Date.now();
    const next=events.filter(e=>e.status!=="cancelled"&&new Date(e.endsAt).getTime()>nowMs).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).slice(0,5);
    const busyDay=(d:Date)=>eventsOn(d).some(e=>e.status!=="cancelled");
    return <>
     <div className="cr-block">
      <div className="cr-mhead"><b>{anchor.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</b><span><button type="button" className="cal-icon-btn" aria-label="Previous month" onClick={()=>setAnchor(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}>‹</button><button type="button" className="cal-icon-btn" aria-label="Next month" onClick={()=>setAnchor(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}>›</button></span></div>
      <div className="cr-month">{["S","M","T","W","T","F","S"].map((d,k)=><span key={"h"+k} className="cr-dow">{d}</span>)}{cells.map(d=>{const inWk=view!=="month"&&d>=wkStart&&d<wkEnd&&view==="week";const isSel=view==="day"&&dateKey(d)===dateKey(anchor);return <button type="button" key={dateKey(d)} className={"cr-day"+(d.getMonth()!==anchor.getMonth()?" is-out":"")+(dateKey(d)===dateKey(today)?" is-today":"")+(inWk?" in-week":"")+(isSel?" is-sel":"")} onClick={()=>{setAnchor(d);if(view==="month")setView("day")}} aria-label={d.toDateString()}>{d.getDate()}{busyDay(d)&&<i/>}</button>})}</div>
     </div>
     <div className="cr-block cr-nums">
      <div><span>Meetings this week</span><b>{meetings}<small> / 5</small></b></div>
      <div><span>Dialing planned</span><b>{Math.round(dialMins/60*10)/10}<small> hrs</small></b></div>
      <div><span>Follow-ups due</span><b>{dueFollowUps}</b></div>
     </div>
     <div className="cr-block">
      <h3 className="cr-h">Today</h3>
      {todayItems.length===0?<p className="cr-empty">Nothing on today. Weekends are off the routine.</p>:<ol className="cr-today">{todayItems.map(it=>{const st=it.end.getTime()<nowMs?"is-past":it.t.getTime()<=nowMs?"is-now":"";return <li key={it.key} className={st+(it.kind==="event"?" is-event":"")}><span className="cr-t">{it.t.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}</span><button type="button" onClick={()=>it.ev?startEdit(it.ev):setView("day")}><b>{it.title}</b><small>{it.sub}</small></button></li>})}</ol>}
     </div>
     <div className="cr-block">
      <h3 className="cr-h">Coming up</h3>
      {loading?<p className="cr-empty">Loading…</p>:next.length===0?<p className="cr-empty">No meetings booked in this view. They show up here as you book them from Call mode.</p>:<div className="cr-next">{next.map(e=><div key={e.id} className="cr-ev"><button type="button" className="cr-ev-main" onClick={()=>startEdit(e)}><b>{e.title}</b><small>{new Date(e.startsAt).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}, {eventTime(e)}{e.contactName?" · "+e.contactName:""}</small></button>{(e.type==="meeting"||e.type==="call")&&<button type="button" className="cr-prep" onClick={()=>void openPrep(e)}>Prep</button>}</div>)}</div>}
     </div>
    </>;
   })()}
  </div>
  </div>
  {(prepLoading||prepError||prep)&&<div className="calendar-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setPrep(null);setPrepError("")}}}><section className="calendar-modal meeting-prep-modal" role="dialog" aria-modal="true" aria-labelledby="meeting-prep-title"><header><div><div className="calendar-eyebrow">Meeting brief</div><h2 id="meeting-prep-title">Meeting brief</h2></div><button className="calendar-close" onClick={()=>{setPrep(null);setPrepError("")}} aria-label="Close">×</button></header>{prepLoading?<p className="calendar-empty-upcoming">Building your brief from the contact, pipeline, activity, and task records…</p>:prepError?<div className="calendar-alert" role="alert">{prepError}</div>:prep&&<div className="meeting-prep-content"><section><h3>{prep.event.title}</h3><p>{new Date(prep.event.startsAt).toLocaleString(undefined,{weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"})} – {new Date(prep.event.endsAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}</p>{prep.event.description&&<p>{prep.event.description}</p>}</section>{prep.unlinked||!prep.contact?<section className="meeting-prep-unlinked"><strong>Contact not linked yet</strong><p>This booking is still visible, but Cinder could not match it to a contact. Close this brief, edit the event, and select the right contact under “Related contact.”</p><button className="calendar-primary" onClick={()=>{const ev=events.find(x=>x.id===prep.event.id);setPrep(null);if(ev)startEdit(ev)}}>Link a contact</button></section>:<><section><h3>Prospect</h3><p><strong>{prep.contact.name||"Unnamed contact"}</strong>{prep.contact.company?" · "+prep.contact.company:""}{prep.contact.role?" · "+prep.contact.role:""}</p><p>{[prep.contact.email,prep.contact.phone,prep.contact.location].filter(Boolean).join(" · ")||"No contact details recorded"}</p>{prep.contact.website&&<p>{prep.contact.website}</p>}{prep.contact.notes&&<p>{prep.contact.notes}</p>}{prep.contact.followUpAt&&<p>Follow-up date: {prep.contact.followUpAt}</p>}</section><section><h3>Pipeline</h3>{prep.linkedDeal?<><p><strong>{prep.linkedDeal.title}</strong> · {prep.linkedDeal.stage}</p><p>Setup fee: {prep.linkedDeal.setupFee.toLocaleString(undefined,{style:"currency",currency:"USD"})} · Monthly: {prep.linkedDeal.monthlyFee.toLocaleString(undefined,{style:"currency",currency:"USD"})}</p>{prep.linkedDeal.notes&&<p>{prep.linkedDeal.notes}</p>}</>:prep.relatedDeals.length?prep.relatedDeals.map(d=><p key={d.id}><strong>{d.title}</strong> · {d.stage} · {d.monthlyFee.toLocaleString(undefined,{style:"currency",currency:"USD"})}/mo</p>):<p>No deal linked yet. Use the call to qualify the opportunity and define a next step.</p>}</section><section><h3>Recent activity</h3>{prep.recentActivity.length?prep.recentActivity.map((a,i)=><p key={i}><strong>{a.outcome.replaceAll("_"," ")}</strong> · {a.channel} · {new Date(a.occurredAt).toLocaleDateString()}{a.notes?" — "+a.notes:""}</p>):<p>No logged interactions yet.</p>}</section><section><h3>Open tasks</h3>{prep.openTasks.length?prep.openTasks.map(t=><p key={t.id}><strong>{t.title}</strong> · {t.priority}{t.dueAt?" · Due "+new Date(t.dueAt).toLocaleDateString():""}{t.description?" — "+t.description:""}</p>):<p>No open tasks tied to this contact.</p>}</section></> }<section><h3>Call checklist</h3><ol>{prep.checklist.map(item=><li key={item}>{item}</li>)}</ol></section></div>}</section></div>}
  {show&&<div className="calendar-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShow(false)}}><section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-form-title"><header><div><div className="calendar-eyebrow">{editing?"UPDATE EVENT":"ADD TO YOUR CALENDAR"}</div><h2 id="calendar-form-title">{editing?"Edit event":"New event"}</h2></div><button className="calendar-close" onClick={()=>setShow(false)} aria-label="Close">×</button></header><form onSubmit={save}><label className="calendar-field">Title *<input required maxLength={240} autoFocus value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="e.g. Discovery call with prospect"/></label><label className="calendar-field">Notes<textarea rows={3} maxLength={5000} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Agenda, context, or desired outcome"/></label><div className="calendar-form-grid"><label className="calendar-field">Type<select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value as EventType})}>{Object.entries(typeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="calendar-field">Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as EventStatus})}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label className="calendar-field">Starts *<input type="datetime-local" required value={draft.startsAt} onChange={e=>setDraft({...draft,startsAt:e.target.value})}/></label><label className="calendar-field">Ends *<input type="datetime-local" required min={draft.startsAt} value={draft.endsAt} onChange={e=>setDraft({...draft,endsAt:e.target.value})}/></label><label className="calendar-check"><input type="checkbox" checked={draft.allDay} onChange={e=>{const allDay=e.target.checked;if(allDay&&draft.startsAt){const start=new Date(draft.startsAt);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);setDraft({...draft,allDay,startsAt:atLocalInput(start),endsAt:atLocalInput(end)})}else setDraft({...draft,allDay})}}/> All-day event</label><label className="calendar-field calendar-field-wide">Related contact<select value={draft.contactId} onChange={e=>setDraft({...draft,contactId:e.target.value})}><option value="">No linked contact</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}{c.company?" — "+c.company:""}</option>)}</select></label><label className="calendar-field calendar-field-wide">Related deal<select value={draft.dealId} onChange={e=>setDraft({...draft,dealId:e.target.value})}><option value="">No linked deal</option>{deals.map(d=><option key={d.id} value={d.id}>{d.title}{d.company?" — "+d.company:""}</option>)}</select></label></div><footer>{editing&&<button type="button" className="calendar-delete" disabled={busy} onClick={()=>void remove()}>Delete event</button>}<span/><button type="button" className="calendar-secondary" onClick={()=>setShow(false)}>Cancel</button><button type="submit" className="calendar-primary" disabled={busy}>{busy?"Saving…":editing?"Save changes":"Create event"}</button></footer></form></section></div>}
 </main>;
}
