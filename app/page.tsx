"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function I({ children }: { children: string }) {
 const paths: Record<string, React.ReactNode> = {
  "⌂": <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></>,
  "▦": <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
  "▤": <><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
  "↗": <><path d="M4 16 10 10l4 4 6-8"/><path d="M14 6h6v6"/></>,
  "✓": <path d="m5 12 4 4L19 6"/>,
  "♧": <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
  "▱": <><path d="M3 7h18l-2 13H5L3 7Z"/><path d="M8 7V4h8v3"/></>,
  "♙": <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6"/></>,
  "$": <><path d="M12 2v20"/><path d="M17 6.5c-.8-1.3-2.3-2-4.5-2C9.8 4.5 8 6 8 8s1.7 3 4.5 3.5S17 13 17 15s-1.8 4-4.5 4c-2.2 0-4-.8-5-2.3"/></>,
  "✳": <><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></>,
  "✧": <><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z"/></>,
  "⚙": <><circle cx="12" cy="12" r="3"/><path d="M19 13.5 21 15l-2 3-2-.7-2 1v2h-4v-2l-2-1-2 .7-2-3 2-1.5v-3L5 9l2-3 2 .7 2-1V3h4v2l2 1 2-.7 2 3-2 1.5v3Z"/></>
 };
 return <span className="glyph" aria-hidden="true"><svg className="glyph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[children] || paths["✳"]}</svg></span>;
}
type CalendarItem = {id:string;title:string;startsAt:string;endsAt:string;allDay:boolean;type:string;status:string;contactName?:string;dealTitle?:string};
type AgendaTask = {id:string;title:string;status:string;priority:string;dueAt:string|null};
const nav = [["⌂","Home","home"],["▦","My day","schedule"],["▦","Calendar","calendar"],["▤","Needs you","needs-you"],["↗","Growth","growth"],["✓","Tasks","tasks"],["♧","AI team","workforce"],["▱","Delivery","projects"],["♙","Client success","client-success"],["$","Money","finance"],["✳","Intelligence","intelligence"]];
const viewDetails: Record<string, { title: string; description: string; items: string[] }> = {
 "needs-you": { title: "Needs you", description: "A focused queue for decisions, approvals, blockers, and follow-ups.", items: ["Review urgent follow-ups", "Resolve blocked work", "Make pending decisions"] },
 growth: { title: "Growth", description: "The agency’s prospects, relationships, conversations, and next actions.", items: ["Contacts and companies", "Outreach and conversations", "Follow-up reminders"] },
 workforce: { title: "AI team", description: "Monitor specialist agents, their work, findings, and requests for approval.", items: ["Agent activity", "Research findings", "Approval requests"] },
 projects: { title: "Projects", description: "Track active projects, commitments, blockers, and next actions.", items: ["Active projects", "Milestones and commitments", "Blockers and next actions"] },
 intelligence: { title: "Intelligence", description: "Bring research, market signals, and business insights together so they lead to decisions.", items: ["Research briefs", "Market signals", "Business insights"] },
 strategy: { title: "Strategy & memory", description: "Your operating principles, long-term priorities, and important context for Cinder.", items: ["Founder priorities", "Operating principles", "Decisions and lessons"] },
 settings: { title: "Settings", description: "Manage Cinder connections and workspace preferences.", items: ["Connections and integrations", "Workspace preferences", "Permissions and approvals"] },
};
const localDateKey = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const localMidnightIso = (key:string) => { const [y,m,d]=key.split("-").map(Number); return new Date(y,m-1,d).toISOString(); };
const routine = [
 { time:"5:00–7:00 AM", title:"Gym", detail:"Training and personal health", category:"Personal" },
 { time:"7:00–7:30 AM", title:"Reset & breakfast", detail:"Shower, eat, and get set up", category:"Personal" },
 { time:"7:30–9:00 AM", title:"Trading", detail:"Protected trading block", category:"Focus" },
 { time:"9:00–9:30 AM", title:"Founder review", detail:"Review priorities, pipeline, and today's plan", category:"Planning" },
 { time:"9:30 AM–12:00 PM", title:"Customer acquisition", detail:"Prospecting, cold calls, meetings, and follow-ups", category:"Revenue" },
 { time:"12:00–1:00 PM", title:"Lunch & reset", detail:"Take a proper break", category:"Personal" },
 { time:"1:00–4:00 PM", title:"Client delivery & product", detail:"Build, improve, and deliver high-value work", category:"Execution" },
 { time:"4:00–6:00 PM", title:"Sales & opportunities", detail:"Follow-ups, demos, proposals, and closing", category:"Revenue" },
 { time:"6:00–8:00 PM", title:"High-value projects", detail:"Move the most important project forward", category:"Execution" },
 { time:"8:00–9:00 PM", title:"Review & prepare", detail:"Log outcomes and set tomorrow's priorities", category:"Planning" },
];
function HomeContent() {
 const searchParams = useSearchParams();
 const requestedView = searchParams.get("view");
 const [activeView, setActiveView] = useState("home");
 useEffect(() => {
  const allowed = ["schedule","needs-you","growth","tasks","workforce","projects","client-success","finance","intelligence","strategy","settings"];
  setActiveView(requestedView && allowed.includes(requestedView) ? requestedView : "home");
 }, [requestedView]);
 const [done, setDone] = useState<string[]>([]);
 const [dailyNotes, setDailyNotes] = useState("");
 const [planDate, setPlanDate] = useState("");
 const [planSaving, setPlanSaving] = useState(false);
 const [planMessage, setPlanMessage] = useState("");
 const [todayEvents, setTodayEvents] = useState<CalendarItem[]>([]);
 const [todayTasks, setTodayTasks] = useState<AgendaTask[]>([]);
 const [agendaError, setAgendaError] = useState("");
 const [businessSnapshot, setBusinessSnapshot] = useState<{contacts:number;leads:number;dueFollowUps:number;openDeals:number;monthlyPipeline:number;dueOutreach:number;openTasks:number;dueTasks:number;monthlyCollected:number;monthlyRetainer:number;monthExpenses:number;monthNet:number;activeProjects:number;blockedProjects:number;milestonesDone:number;milestonesTotal:number;loading:boolean;error:boolean}>({contacts:0,leads:0,dueFollowUps:0,openDeals:0,monthlyPipeline:0,dueOutreach:0,openTasks:0,dueTasks:0,monthlyCollected:0,monthlyRetainer:0,monthExpenses:0,monthNet:0,activeProjects:0,blockedProjects:0,milestonesDone:0,milestonesTotal:0,loading:true,error:false});
 useEffect(() => {
  const date = localDateKey();
  setPlanDate(date);
  let active = true;
  const tomorrow = new Date(); tomorrow.setHours(0,0,0,0); tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowKey = tomorrow.getFullYear()+"-"+String(tomorrow.getMonth()+1).padStart(2,"0")+"-"+String(tomorrow.getDate()).padStart(2,"0");
  fetch("/api/calendar-events?from="+date+"&to="+tomorrowKey+"&fromAt="+encodeURIComponent(localMidnightIso(date))+"&toAt="+encodeURIComponent(localMidnightIso(tomorrowKey)),{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Calendar unavailable");return r.json()}).then(data=>{if(active)setTodayEvents(Array.isArray(data.events)?data.events:[])}).catch(()=>{if(active)setAgendaError("Calendar events could not load.")});
  fetch("/api/daily-plan?date="+date,{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Could not load daily plan");return r.json()}).then(data=>{if(!active)return;setDone(Array.isArray(data.plan?.completedBlocks)?data.plan.completedBlocks:[]);setDailyNotes(typeof data.plan?.notes==="string"?data.plan.notes:"");setPlanMessage("")}).catch(()=>{if(active)setPlanMessage("Daily plan could not load. Your edits are not saved until you retry.")});
  return ()=>{active=false};
 }, []);
 useEffect(() => {
  let active = true;
  Promise.all([
   fetch("/api/contacts",{cache:"no-store"}),
   fetch("/api/deals",{cache:"no-store"}),
   fetch("/api/outreach",{cache:"no-store"}),
   fetch("/api/tasks",{cache:"no-store"}),
   fetch("/api/finance",{cache:"no-store"}),
   fetch("/api/projects",{cache:"no-store"})
  ]).then(async ([cr,dr,or,tr,fr,pr]) => {
   if (!cr.ok || !dr.ok || !or.ok || !tr.ok || !fr.ok || !pr.ok) throw new Error("Workspace data unavailable");
   const [cd,dd,od,td,fd,pd] = await Promise.all([cr.json(),dr.json(),or.json(),tr.json(),fr.json(),pr.json()]);
   if (!active) return;
   const contacts = Array.isArray(cd.contacts) ? cd.contacts : [];
   const deals = Array.isArray(dd.deals) ? dd.deals : [];
   const outreach = Array.isArray(od.outreach) ? od.outreach : [];
   const tasks = Array.isArray(td.tasks) ? td.tasks : [];
   setTodayTasks(tasks.filter((x:{status?:string;dueAt?:string|null})=>x.dueAt&&!["done","cancelled"].includes(x.status||"")&&new Date(x.dueAt).getFullYear()===new Date().getFullYear()&&new Date(x.dueAt).getMonth()===new Date().getMonth()&&new Date(x.dueAt).getDate()===new Date().getDate()));
   const projects = Array.isArray(pd.projects) ? pd.projects : [];
   const activeProjects = projects.filter((x:{status?:string})=>["onboarding","in_progress","blocked","review"].includes(x.status||""));
   const todayDate = new Date();
   const todayEnd = new Date(todayDate); todayEnd.setHours(23,59,59,999);
   const todayEndTime = todayEnd.getTime();
   const today = todayDate.getFullYear()+"-"+String(todayDate.getMonth()+1).padStart(2,"0")+"-"+String(todayDate.getDate()).padStart(2,"0");
   setBusinessSnapshot({
    contacts: contacts.length,
    leads: contacts.filter((x:{status?:string})=>x.status==="Lead").length,
    dueFollowUps: contacts.filter((x:{nextFollowUp?:string})=>x.nextFollowUp&&x.nextFollowUp<=today).length,
    openDeals: deals.filter((x:{stage?:string})=>x.stage!=="won"&&x.stage!=="lost").length,
    monthlyPipeline: deals.filter((x:{stage?:string})=>x.stage!=="won"&&x.stage!=="lost").reduce((s:number,x:{monthlyFee?:number})=>s+Number(x.monthlyFee||0),0),
    dueOutreach: outreach.filter((x:{status?:string;nextActionAt?:string})=>x.status==="active"&&x.nextActionAt&&new Date(x.nextActionAt).getTime()<=Date.now()).length,
    openTasks: tasks.filter((x:{status?:string})=>x.status!=="done"&&x.status!=="cancelled").length,
    dueTasks: tasks.filter((x:{status?:string;dueAt?:string|null})=>x.status!=="done"&&x.status!=="cancelled"&&x.dueAt&&new Date(x.dueAt).getTime()<=todayEndTime).length,
    monthlyCollected:Number(fd.summary?.paidRevenue||0),monthlyRetainer:Number(fd.summary?.mrr||0),monthExpenses:Number(fd.summary?.monthExpenses||0),monthNet:Number(fd.summary?.monthNet||0),
    activeProjects:activeProjects.length,blockedProjects:activeProjects.filter((x:{status?:string})=>x.status==="blocked").length,
    milestonesDone:activeProjects.reduce((n:number,x:{doneMilestones?:number})=>n+Number(x.doneMilestones||0),0),milestonesTotal:activeProjects.reduce((n:number,x:{milestoneCount?:number})=>n+Number(x.milestoneCount||0),0),
    loading:false,error:false
   });
  }).catch(()=>{if(active)setBusinessSnapshot(s=>({...s,loading:false,error:true}))});
  return ()=>{active=false};
 }, []);
 const saveDailyPlan = async () => {
  if (!planDate) return;
  setPlanSaving(true); setPlanMessage("");
  try {
   const response = await fetch("/api/daily-plan", {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:planDate,completedBlocks:done,notes:dailyNotes})});
   const data = await response.json().catch(()=>({}));
   if (!response.ok) throw new Error(data.error || "Could not save your daily plan.");
   setPlanMessage("Saved to your workspace · "+new Date(data.plan.updatedAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}));
  } catch(e) { setPlanMessage(e instanceof Error?e.message:"Could not save your daily plan."); }
  finally { setPlanSaving(false); }
 };
 const navigate = (view: string) => { if (view === "calendar") { window.location.assign("/crm/calendar"); return; } if (view === "growth") { window.location.assign("/crm"); return; } if (view === "tasks") { window.location.assign("/crm/tasks"); return; } if (view === "projects") { window.location.assign("/crm/projects"); return; } if (view === "finance") { window.location.assign("/crm/finance"); return; } if (view === "workforce") { window.location.assign("/crm/workforce"); return; } if (view === "client-success") { window.location.assign("/crm/client-success"); return; } if (view === "needs-you") { window.location.assign("/crm/needs-you"); return; } if (view === "strategy") { window.location.assign("/crm/strategy"); return; } if (view === "settings") { window.location.assign("/crm/settings"); return; } if (view === "intelligence") { window.location.assign("/crm/intelligence"); return; } setActiveView(view); };
 const completed = (id: string) => done.includes(id);
 const toggle = (id: string) => setDone(old => old.includes(id) ? old.filter(x=>x!==id) : [...old,id]);
 return <main className="app-shell" id="home">
  <aside className="sidebar">
   <button className="brand brand-button" onClick={() => navigate("home")} aria-label="Go to Home"><span className="cinder-mark" aria-hidden="true"><svg viewBox="0 0 32 32" role="img"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z" fill="currentColor"/><circle cx="25.5" cy="16" r="3.1" fill="#bf542f"/></svg></span><span className="brand-name cinder-wordmark">CINDER</span><span className="workspace-chevron">⌄</span></button>
   <div className="nav-section-label">WORKSPACE</div>
   <nav className="primary-nav" aria-label="Workspace">{nav.map(([icon,label,view])=><button key={view} type="button" className={activeView===view?"nav-item active":"nav-item"} onClick={() => navigate(view)}><I>{icon}</I><span>{label}</span></button>)}</nav>
   <div className="sidebar-divider"/><div className="nav-section-label">YOUR SPACE</div><nav className="primary-nav"><button type="button" className={activeView==="strategy"?"nav-item active":"nav-item"} onClick={() => navigate("strategy")}><I>✧</I><span>Strategy & memory</span></button><button type="button" className={activeView==="settings"?"nav-item active":"nav-item"} onClick={() => navigate("settings")}><I>⚙</I><span>Settings</span></button></nav>
   <div className="sidebar-bottom"><div className="connection-card"><span className="connection-dot"/><div><strong>Agency workspace</strong><small>CRM integrations not connected</small></div></div><div className="profile-row"><span className="profile-avatar">F</span><span className="profile-copy"><strong>Founder</strong><small>Agency workspace</small></span></div></div>
  </aside>
  <section className="main-panel"><header className="topbar"><div className="breadcrumbs"><span>Cinder</span><span className="breadcrumb-slash">/</span><strong>{activeView==="schedule"?"My day":activeView==="growth"?"Growth":activeView==="home"?"Home":viewDetails[activeView]?.title??"Home"}</strong></div><div className="topbar-actions"><span className="topbar-status"><span className="status-ring"/> Agency workspace</span><button className="quiet-button" disabled title="Cinder assistant is not connected yet">Ask Cinder <span className="coming-soon">SOON</span></button></div></header>
   {activeView==="schedule" ? <div className="page-content route-page">
    <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> DAILY OPERATING PLAN</div><h1>My day<span className="heading-period">.</span></h1><p className="page-subtitle">A repeatable founder routine, with revenue work protected and priorities visible.</p></div><span className="date-chip">Routine template · Central time</span></div>
    <section className="schedule-summary"><div><span className="summary-label">DAILY ROUTINE</span><strong>5:00 AM – 9:00 PM</strong></div><div><span className="summary-label">COMPLETED</span><strong>{done.filter(x=>x.startsWith("routine:")).length} / {routine.length} blocks</strong></div><div><span className="summary-label">TOP PRIORITY</span><strong>Revenue & acquisition</strong></div></section>
    <section className="surface-panel schedule-panel"><div className="panel-heading"><div><h2>Today’s agenda</h2><p>Real calendar events and task deadlines for today.</p></div><button className="text-action" onClick={()=>navigate("calendar")}>Open calendar →</button></div>{agendaError&&<p className="local-note" role="status">{agendaError}</p>}<div className="schedule-list">{[...todayEvents.filter(e=>e.status!=="cancelled").map(e=>({id:"event:"+e.id,title:e.title,time:e.allDay?"All day":new Date(e.startsAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}),sortAt:e.allDay?-1:new Date(e.startsAt).getTime(),detail:[e.contactName,e.dealTitle].filter(Boolean).join(" · "),kind:"Calendar event"})),...todayTasks.map(t=>({id:"task:"+t.id,title:t.title,time:t.dueAt?new Date(t.dueAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}):"Today",sortAt:t.dueAt?new Date(t.dueAt).getTime():Number.MAX_SAFE_INTEGER,detail:t.priority==="urgent"?"Urgent task":t.priority==="high"?"High priority task":"Task deadline",kind:"Task"}))].sort((a,b)=>a.sortAt-b.sortAt).map(item=><div className="schedule-row" key={item.id}><span className="schedule-time">{item.time}</span><div className="schedule-description"><strong>{item.title}</strong><small>{item.detail||item.kind}</small></div><span className="schedule-category">{item.kind}</span></div>)}{!agendaError&&todayEvents.filter(e=>e.status!=="cancelled").length===0&&todayTasks.length===0&&<p className="local-note">Nothing scheduled yet. Add a meeting or focus block in your calendar.</p>}</div></section>
    <section className="surface-panel schedule-panel"><div className="panel-heading"><div><h2>Daily schedule</h2><p>Check off blocks as you complete them. This is your editable starting routine.</p></div><button className="text-action" onClick={()=>setDone(old=>old.filter(x=>!x.startsWith("routine:")))}>Reset day</button></div><div className="schedule-list">{routine.map((block,i)=><div className={completed("routine:"+i)?"schedule-row is-done":"schedule-row"} key={block.title}><button className="check-button" aria-label={completed("routine:"+i)?"Mark incomplete":"Mark complete"} onClick={()=>toggle("routine:"+i)}>{completed("routine:"+i)?"✓":""}</button><span className="schedule-time">{block.time}</span><div className="schedule-description"><strong>{block.title}</strong><small>{block.detail}</small></div><span className="schedule-category">{block.category}</span></div>)}</div></section>
    <section className="surface-panel notes-panel"><div className="panel-heading"><div><h2>Daily notes</h2><p>Capture outcomes, reminders, and tomorrow's first move.</p></div></div><textarea value={dailyNotes} onChange={e=>setDailyNotes(e.target.value)} placeholder="What matters today? Who needs a follow-up? What did you learn?" rows={4}/><div className="daily-plan-save"><p className="local-note">Your notes and checked-off blocks are saved by date in your private workspace.</p><div className="daily-plan-save-row"><span role="status">{planMessage}</span><button className="text-action" onClick={()=>void saveDailyPlan()} disabled={planSaving}>{planSaving?"Saving…":"Save daily plan"}</button></div></div></section>
   </div> : activeView==="home" ? <div className="cal-home">
    <div className="cal-home-center">
     <div className="cal-home-title"><div className="cal-home-eyebrow"><span className="cinder-home-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z"/><circle cx="25.5" cy="16" r="3.1"/></svg></span> CINDER WORKSPACE</div><h1>Ask Cinder<span>AI</span></h1><p>Your business, one conversation away.</p></div>
     <form className="cal-command-bar" onSubmit={event=>{event.preventDefault(); const value=(event.currentTarget.elements.namedItem("cinderQuery") as HTMLInputElement).value.trim(); if(value){navigate("workforce");}}}>
      <span className="cal-command-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z"/></svg></span><input name="cinderQuery" aria-label="Ask Cinder" placeholder="Search contacts, deals, or ask Cinder anything…"/><button type="submit" aria-label="Open Cinder AI">↑</button>
     </form>
     <div className="cal-prompt-chips"><button onClick={()=>navigate("growth")} type="button">Find a prospect</button><button onClick={()=>navigate("needs-you")} type="button">Who needs a follow-up?</button><button onClick={()=>navigate("schedule")} type="button">What’s on my schedule?</button><button onClick={()=>navigate("workforce")} type="button">Put Hermes to work</button></div>
     <div className="cal-home-actions">
      <button onClick={()=>navigate("growth")}><span>↗</span><strong>Prospects & pipeline</strong><small>Research, contacts, and deals</small></button>
      <button onClick={()=>navigate("needs-you")}><span>✓</span><strong>Needs your attention</strong><small>Follow-ups and next actions</small></button>
      <button onClick={()=>navigate("workforce")}><span>✳</span><strong>Hermes & AI team</strong><small>Research and prepared work</small></button>
     </div>
    </div>
    <footer className="cal-home-footer"><span><i/> PRIVATE FOUNDER WORKSPACE</span><span>Search first. Move with intent.</span></footer>
   </div> : <div className="page-content route-page"><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> CINDER WORKSPACE</div><h1>{viewDetails[activeView]?.title??"Home"}<span className="heading-period">.</span></h1><p className="page-subtitle">{viewDetails[activeView]?.description}</p></div><button className="back-home-button" onClick={()=>navigate("home")}>← Back to home</button></div><section className="route-panel"><div className="route-panel-heading"><span className="section-kicker">WORKSPACE VIEW</span><span className="banner-status"><span className="status-dot amber"/> Not connected</span></div><div className="route-items">{(viewDetails[activeView]?.items??[]).map((item,index)=><div className="route-item" key={item}><span className="route-item-number">{String(index+1).padStart(2,"0")}</span><span>{item}</span><span className="route-item-status">Needs implementation</span></div>)}</div><p className="route-note">This section is a planned part of your agency workspace. It is not connected to a persistent database yet.</p></section></div>}</section></main>;
}


export default function Home() {
 return <Suspense fallback={<main className="page-content">Loading agency workspace…</main>}><HomeContent /></Suspense>;
}
