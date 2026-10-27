"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
type Item={id:string;kind:"task"|"outreach"|"followup"|"project"|"deal"|"support"|"approval"|"renewal"|"agent"|"client"|"preparation"|"meeting";title:string;detail:string;due:string|null;priority:number;href:string;action:string};
const dateLabel=(v:string|null)=>{if(!v)return "No due date";const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(v);const parsed=dateOnly?new Date(v+"T12:00:00"):new Date(v);return Number.isNaN(parsed.getTime())?"Date unavailable":parsed.toLocaleString(undefined,dateOnly?{month:"short",day:"numeric"}:{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});};
export default function NeedsYouPage(){
 const [items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[filter,setFilter]=useState("all");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const calendarStart=new Date();calendarStart.setHours(0,0,0,0);
   const calendarEnd=new Date(calendarStart);calendarEnd.setDate(calendarEnd.getDate()+8);
   const dateKey=(d:Date)=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
   const calendarUrl="/api/calendar-events?from="+dateKey(calendarStart)+"&to="+dateKey(calendarEnd)+"&fromAt="+encodeURIComponent(calendarStart.toISOString())+"&toAt="+encodeURIComponent(calendarEnd.toISOString());
   const [tr,or,cr,pr,dr,sr,wr,rr,er]=await Promise.all([
    fetch("/api/tasks",{cache:"no-store"}),fetch("/api/outreach",{cache:"no-store"}),fetch("/api/contacts",{cache:"no-store"}),fetch("/api/projects",{cache:"no-store"}),fetch("/api/deals",{cache:"no-store"}),fetch("/api/client-success",{cache:"no-store"}),fetch("/api/workforce",{cache:"no-store"}),fetch("/api/research-artifacts",{cache:"no-store"}),fetch(calendarUrl,{cache:"no-store"})
   ]);
   if([tr,or,cr,pr,dr,sr,wr,rr,er].some(r=>r.status===401))throw new Error("Sign in to view your action queue.");
   const [td,od,cd,pd,dd,sd,wd,rd,ed]=await Promise.all([tr.json(),or.json(),cr.json(),pr.json(),dr.json(),sr.json(),wr.json(),rr.json(),er.json()]);
   if(!tr.ok||!or.ok||!cr.ok||!pr.ok||!dr.ok||!sr.ok||!wr.ok||!rr.ok||!er.ok)throw new Error("Some workspace data could not load. Check the task, outreach, project, and workforce pages.");
   const now=Date.now();const todayEnd=new Date();todayEnd.setHours(23,59,59,999);const todayEndMs=todayEnd.getTime();const list:Item[]=[];
   for(const t of (td.tasks||[])){
    if(["done","cancelled"].includes(t.status))continue;
    const due=t.dueAt?new Date(t.dueAt).getTime():null;
    const needsAttention=t.status==="blocked"||t.priority==="urgent"||t.priority==="high"||(due!==null&&Number.isFinite(due)&&due<=todayEndMs);
    if(!needsAttention)continue;
    list.push({id:"task:"+t.id,kind:"task",title:t.title,detail:[t.status==="blocked"?"Blocked":t.priority==="urgent"?"Urgent":t.priority==="high"?"High priority":due!==null&&due<=now?"Overdue":"Due today",t.contactName,t.dealTitle].filter(Boolean).join(" · "),due:t.dueAt,priority:t.status==="blocked"?0:t.priority==="urgent"?1:t.priority==="high"?2:due!==null&&due<=now?2:3,href:"/crm/tasks",action:"Open task"});
   }
   for(const o of (od.outreach||[])){
    if(o.status!=="active"||!o.nextActionAt)continue;
    const due=new Date(o.nextActionAt).getTime();if(due>now)continue;
    list.push({id:"outreach:"+o.id,kind:"outreach",title:"Follow up with "+(o.name||o.company||"prospect"),detail:[o.company,o.niche,"Step "+o.currentStep+" of 6"].filter(Boolean).join(" · "),due:o.nextActionAt,priority:due<=now-86400000?1:2,href:"/crm/outreach",action:"Open outreach"});
   }
   const today=new Date();today.setHours(23,59,59,999);const todayKey=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
   const projectRows=Array.isArray(pd.projects)?pd.projects:[];
   const activeProjects=projectRows.filter((p: {id?:string;status?:string})=>p.id&&![ "completed","cancelled"].includes(p.status||""));const milestoneResults: {project:{id:string;name?:string;clientName?:string;contactName?:string};milestone:{id:string;title:string;status:string;dueAt:string|null}}[][]=[];for(let i=0;i<activeProjects.length;i+=8){const chunk=activeProjects.slice(i,i+8);milestoneResults.push(...await Promise.all(chunk.map(async(p: {id:string;name?:string;clientName?:string;contactName?:string})=>{const r=await fetch("/api/project-milestones?projectId="+encodeURIComponent(p.id),{cache:"no-store"});if(!r.ok)throw new Error("Project milestones could not load. Refresh the queue before relying on delivery alerts.");const data=await r.json();if(!Array.isArray(data.milestones))throw new Error("Project milestone data was incomplete. Refresh the queue before relying on delivery alerts.");return data.milestones.map((m:{id:string;title:string;status:string;dueAt:string|null})=>({project:p,milestone:m}));})));}
   for(const group of milestoneResults){for(const entry of group){const p=entry.project,m=entry.milestone;if(["done","cancelled"].includes(m.status))continue;const rawDue=m.dueAt||"";const utcMidnight=/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(rawDue);const dueDate=rawDue?new Date(rawDue):null;const dueDay=utcMidnight?rawDue.slice(0,10):dueDate&&!Number.isNaN(dueDate.getTime())?dueDate.getFullYear()+"-"+String(dueDate.getMonth()+1).padStart(2,"0")+"-"+String(dueDate.getDate()).padStart(2,"0"):null;const overdue=dueDay!==null&&dueDay<todayKey;const dueToday=dueDay===todayKey;if(m.status==="blocked"||overdue||dueToday)list.push({id:"milestone:"+m.id,kind:"project",title:(m.status==="blocked"?"Unblock milestone: ":overdue?"Overdue milestone: ":"Milestone due today: ")+m.title,detail:[p.name,p.clientName||p.contactName].filter(Boolean).join(" · "),due:dueDay,priority:m.status==="blocked"?0:overdue?1:2,href:"/crm/projects",action:"Open delivery"});}}
   // A contact with an active outreach sequence has one source of truth for its next touch.
   // Do not create a second generic follow-up item for that same contact.
   const activeOutreachContactIds = new Set((od.outreach||[])
    .filter((o:{status?:string;contactId?:string;nextActionAt?:string|null})=>o.status==="active"&&o.contactId&&o.nextActionAt)
    .map((o:{contactId:string})=>o.contactId));
   for(const c of (cd.contacts||[])){
    if(activeOutreachContactIds.has(c.id))continue;
    const due=c.nextFollowUp||c.next_follow_up;if(!due)continue;const dueDay=String(due).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDay)||dueDay>todayKey)continue;
    list.push({id:"contact:"+c.id,kind:"followup",title:"Contact follow-up: "+(c.name||[c.firstName,c.lastName].filter(Boolean).join(" ")||c.company||"contact"),detail:[c.company,c.status].filter(Boolean).join(" · "),due,priority:3,href:"/crm",action:"Open CRM"});
   }
   for(const p of (pd.projects||[])){
    if(["completed","cancelled"].includes(p.status))continue;
    if(p.status==="blocked")list.push({id:"project-blocked:"+p.id,kind:"project",title:"Unblock project: "+p.name,detail:p.clientName||p.contactName||"Client delivery",due:p.targetDate,priority:0,href:"/crm/projects",action:"Open project"});
    else if(p.targetDate&&new Date(p.targetDate+"T23:59:59").getTime()<=today.getTime())list.push({id:"project-due:"+p.id,kind:"project",title:"Review project deadline: "+p.name,detail:statusesLabel(p.status)+" · "+(p.clientName||p.contactName||"Client"),due:p.targetDate+"T12:00:00",priority:2,href:"/crm/projects",action:"Open project"});
   }
   for(const t of (sd.tickets||[])){if(["resolved","closed"].includes(t.status))continue;const due=t.due_date?new Date(t.due_date+"T23:59:59").getTime():null;if(t.priority!=="urgent"&&t.priority!=="high"&&(due===null||due>today.getTime()))continue;list.push({id:"support:"+t.id,kind:"support",title:"Support: "+t.title,detail:[t.client_name||t.contact_name,t.priority+" priority",t.status].filter(Boolean).join(" · "),due:t.due_date,priority:t.priority==="urgent"?0:t.priority==="high"?1:2,href:"/crm/client-success",action:"Open ticket"});}
   for(const a of (wd.approvals||[])){if(a.status!=="pending")continue;list.push({id:"approval:"+a.id,kind:"approval",title:"Approval needed: "+a.title,detail:[a.action_type,a.description].filter(Boolean).join(" · "),due:a.created_at||null,priority:1,href:"/crm/workforce",action:"Review approval"});}
   for(const run of (wd.runs||[])){if(run.status!=="failed")continue;list.push({id:"agent-run:"+run.id,kind:"agent",title:"Failed AI run: "+(run.task_title||"Untitled task"),detail:[run.agent_name,run.summary].filter(Boolean).join(" · "),due:run.updated_at||run.created_at||null,priority:1,href:"/crm/workforce",action:"Inspect run"});}
   for(const a of (sd.accounts||[])){if(a.status==="at_risk"||Number(a.health_score)<=2)list.push({id:"client-risk:"+a.id,kind:"client",title:"Client health needs attention: "+a.client_name,detail:[a.service_name,"Health "+a.health_score+"/5",a.risk_notes].filter(Boolean).join(" · "),due:a.next_review_date?a.next_review_date+"T12:00:00":null,priority:1,href:"/crm/client-success",action:"Review client"});if(["churned","paused"].includes(a.status)||!a.renewal_date)continue;const renewalMs=new Date(a.renewal_date+"T23:59:59").getTime();const days=(renewalMs-now)/86400000;if(days<=30)list.push({id:"renewal:"+a.id,kind:"renewal",title:(days<0?"Overdue renewal: ":"Renewal approaching: ")+a.client_name,detail:[a.service_name,a.status,"Health "+a.health_score+"/5"].filter(Boolean).join(" · "),due:a.renewal_date+"T12:00:00",priority:days<0?1:days<=7?2:3,href:"/crm/client-success",action:"Review client"});}
   for(const a of (rd.artifacts||[])){
    if(a.status!=="draft")continue;
    list.push({id:"preparation:"+a.id,kind:"preparation",title:"Review preparation: "+a.title,detail:[a.contactName,a.company,a.dealTitle,a.eventTitle,a.sourceUrls?.length?a.sourceUrls.length+" sources":"No source URLs"].filter(Boolean).join(" · "),due:a.updatedAt||null,priority:2,href:"/crm/preparation",action:"Review brief"});
   }
   for(const d of (dd.deals||[])){
    if(["won","lost"].includes(d.stage)||!d.expectedCloseDate)continue;
    const ms=new Date(d.expectedCloseDate+"T23:59:59").getTime();if(ms>today.getTime())continue;
    list.push({id:"deal:"+d.id,kind:"deal",title:"Review overdue deal: "+d.title,detail:[d.company,d.stage].filter(Boolean).join(" · "),due:d.expectedCloseDate+"T12:00:00",priority:3,href:"/crm/pipeline",action:"Open pipeline"});
   }
   for(const e of (ed.events||[])){
    if(e.status!=="scheduled"||!(e.type==="meeting"||e.type==="call"))continue;
    const startsAt=new Date(e.startsAt).getTime();
    if(!Number.isFinite(startsAt)||startsAt<now)continue;
    const hasMeetingBrief=(rd.artifacts||[]).some((a:{calendarEventId?:string;type?:string;status?:string})=>a.calendarEventId===e.id&&a.type==="meeting_brief"&&(a.status==="draft"||a.status==="reviewed"));
    if(hasMeetingBrief)continue;
    list.push({id:"meeting:"+e.id,kind:"meeting",title:"Prepare for "+(e.type==="call"?"call: ":"meeting: ")+e.title,detail:[e.contactName,e.dealTitle,new Date(e.startsAt).toLocaleString(undefined,{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})].filter(Boolean).join(" · "),due:e.startsAt,priority:startsAt<=now+86400000?1:2,href:"/crm/preparation?event="+encodeURIComponent(e.id)+"&type=meeting_brief",action:"Prepare meeting"});
   }
   list.sort((a,b)=>a.priority-b.priority||(a.due?new Date(a.due).getTime():Infinity)-(b.due?new Date(b.due).getTime():Infinity));
   setItems(list);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load action queue.");}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);
 const salesKinds=new Set(["outreach","followup","deal","preparation","meeting"]);
 const visible=useMemo(()=>filter==="all"?items:filter==="sales"?items.filter(x=>salesKinds.has(x.kind)):items.filter(x=>x.kind===filter),[items,filter]);
 const counts=useMemo(()=>({all:items.length,sales:items.filter(x=>salesKinds.has(x.kind)).length,task:items.filter(x=>x.kind==="task").length,outreach:items.filter(x=>x.kind==="outreach").length,followup:items.filter(x=>x.kind==="followup").length,project:items.filter(x=>x.kind==="project").length,deal:items.filter(x=>x.kind==="deal").length,support:items.filter(x=>x.kind==="support").length,approval:items.filter(x=>x.kind==="approval").length,renewal:items.filter(x=>x.kind==="renewal").length,agent:items.filter(x=>x.kind==="agent").length,client:items.filter(x=>x.kind==="client").length,preparation:items.filter(x=>x.kind==="preparation").length,meeting:items.filter(x=>x.kind==="meeting").length}),[items]);
 return <main className="needs-shell"><header className="needs-header"><Link href="/">← Cinder workspace</Link><button onClick={()=>void load()} disabled={loading}>↻ Refresh</button></header><section className="needs-content"><div className="needs-eyebrow">EXECUTION QUEUE</div><h1>Needs you<span>.</span></h1><p className="needs-subtitle">One queue for follow-ups, upcoming meeting preparation, blocked delivery, and work that needs a decision. Items are read from your workspace, not generated placeholders.</p>
 <div className="needs-stats"><div><small>NEEDS ATTENTION</small><strong>{loading?"—":items.length}</strong></div><div><small>SALES ACTIONS</small><strong>{loading?"—":counts.sales}</strong></div><div><small>OUTREACH DUE</small><strong>{loading?"—":counts.outreach}</strong></div><div><small>BLOCKED / URGENT</small><strong>{loading?"—":items.filter(x=>x.priority<=1).length}</strong></div></div>
 {error&&<div className="needs-error" role="alert">{error}</div>}
 <nav className="needs-filters" aria-label="Filter action queue">{[["all","All items"],["sales","Sales focus"],["task","Tasks"],["outreach","Outreach"],["followup","Contact follow-ups"],["project","Projects"],["deal","Deals"],["support","Support"],["approval","Approvals"],["renewal","Renewals"],["agent","AI failures"],["client","Client health"],["preparation","Preparation"],["meeting","Meeting prep"]].map(([id,label])=><button key={id} className={filter===id?"selected":""} onClick={()=>setFilter(id)}>{label}<span>{counts[id as keyof typeof counts]}</span></button>)}</nav>
 <section className="needs-list">{loading?<div className="needs-empty">Loading your live action queue…</div>:visible.length===0?<div className="needs-empty"><strong>You're all caught up.</strong><p>No items in this view currently need attention.</p></div>:visible.map(item=><article key={item.id} className="needs-item"><div className={"needs-kind kind-"+item.kind}>{({task:"✓",outreach:"↗",followup:"☎",project:"▱",deal:"$",support:"!",approval:"✓",renewal:"$",agent:"⚠",client:"♡",preparation:"✎",meeting:"◷"} as Record<string,string>)[item.kind]}</div><div className="needs-item-copy"><div className="needs-item-title">{item.title}</div><div className="needs-item-detail">{item.detail||item.kind}</div><div className="needs-item-due">{item.due?"Due "+dateLabel(item.due):"No due date"}</div></div><a className="needs-item-action" href={item.href}>{item.action} →</a></article>)}</section>
 <p className="needs-footnote">This queue is advisory: it highlights records with overdue dates or explicit blockers. It does not send messages, make calls, or change record status automatically.</p>
 </section></main>;
}
function statusesLabel(s:string){return ({planning:"Planning",onboarding:"Onboarding",in_progress:"In progress",blocked:"Blocked",review:"In review",on_hold:"On hold"} as Record<string,string>)[s]||s;}
