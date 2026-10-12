"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
type Item={id:string;kind:"task"|"outreach"|"followup"|"project"|"deal";title:string;detail:string;due:string|null;priority:number;href:string;action:string};
const dateLabel=(v:string|null)=>v?new Date(v).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"No due date";
export default function NeedsYouPage(){
 const [items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[filter,setFilter]=useState("all");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const [tr,or,cr,pr,dr]=await Promise.all([
    fetch("/api/tasks",{cache:"no-store"}),fetch("/api/outreach",{cache:"no-store"}),fetch("/api/contacts",{cache:"no-store"}),fetch("/api/projects",{cache:"no-store"}),fetch("/api/deals",{cache:"no-store"})
   ]);
   if([tr,or,cr,pr,dr].some(r=>r.status===401))throw new Error("Sign in to view your action queue.");
   const [td,od,cd,pd,dd]=await Promise.all([tr.json(),or.json(),cr.json(),pr.json(),dr.json()]);
   if(!tr.ok||!or.ok||!cr.ok||!pr.ok||!dr.ok)throw new Error("Some workspace data could not load. Check the task, outreach, and project pages.");
   const now=Date.now();const list:Item[]=[];
   for(const t of (td.tasks||[])){
    if(["done","cancelled"].includes(t.status))continue;
    const due=t.dueAt?new Date(t.dueAt).getTime():null;
    list.push({id:"task:"+t.id,kind:"task",title:t.title,detail:[t.status==="blocked"?"Blocked":t.priority==="urgent"?"Urgent":t.priority==="high"?"High priority":"Task",t.contactName,t.dealTitle].filter(Boolean).join(" · "),due:t.dueAt,priority:t.status==="blocked"?0:t.priority==="urgent"?1:due!==null&&due<=now?2:4,href:"/crm/tasks",action:"Open task"});
   }
   for(const o of (od.outreach||[])){
    if(o.status!=="active"||!o.nextActionAt)continue;
    const due=new Date(o.nextActionAt).getTime();if(due>now)continue;
    list.push({id:"outreach:"+o.id,kind:"outreach",title:"Follow up with "+(o.name||o.company||"prospect"),detail:[o.company,o.niche,"Step "+o.currentStep+" of 6"].filter(Boolean).join(" · "),due:o.nextActionAt,priority:2,href:"/crm/outreach",action:"Open outreach"});
   }
   const today=new Date();today.setHours(23,59,59,999);
   for(const c of (cd.contacts||[])){
    const due=c.nextFollowUp||c.next_follow_up;if(!due)continue;const ms=new Date(due).getTime();if(!Number.isFinite(ms)||ms>today.getTime())continue;
    list.push({id:"contact:"+c.id,kind:"followup",title:"Contact follow-up: "+(c.name||[c.firstName,c.lastName].filter(Boolean).join(" ")||c.company||"contact"),detail:[c.company,c.status].filter(Boolean).join(" · "),due,priority:3,href:"/crm",action:"Open CRM"});
   }
   for(const p of (pd.projects||[])){
    if(["completed","cancelled"].includes(p.status))continue;
    if(p.status==="blocked")list.push({id:"project-blocked:"+p.id,kind:"project",title:"Unblock project: "+p.name,detail:p.clientName||p.contactName||"Client delivery",due:p.targetDate,priority:0,href:"/crm/projects",action:"Open project"});
    else if(p.targetDate&&new Date(p.targetDate+"T23:59:59").getTime()<=today.getTime())list.push({id:"project-due:"+p.id,kind:"project",title:"Review project deadline: "+p.name,detail:statusesLabel(p.status)+" · "+(p.clientName||p.contactName||"Client"),due:p.targetDate+"T12:00:00",priority:2,href:"/crm/projects",action:"Open project"});
   }
   for(const d of (dd.deals||[])){
    if(["won","lost"].includes(d.stage)||!d.expectedCloseDate)continue;
    const ms=new Date(d.expectedCloseDate+"T23:59:59").getTime();if(ms>today.getTime())continue;
    list.push({id:"deal:"+d.id,kind:"deal",title:"Review overdue deal: "+d.title,detail:[d.company,d.stage].filter(Boolean).join(" · "),due:d.expectedCloseDate+"T12:00:00",priority:3,href:"/crm/pipeline",action:"Open pipeline"});
   }
   list.sort((a,b)=>a.priority-b.priority||(a.due?new Date(a.due).getTime():Infinity)-(b.due?new Date(b.due).getTime():Infinity));
   setItems(list);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load action queue.");}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);
 const visible=useMemo(()=>filter==="all"?items:items.filter(x=>x.kind===filter),[items,filter]);
 const counts=useMemo(()=>({all:items.length,task:items.filter(x=>x.kind==="task").length,outreach:items.filter(x=>x.kind==="outreach").length,followup:items.filter(x=>x.kind==="followup").length,project:items.filter(x=>x.kind==="project").length,deal:items.filter(x=>x.kind==="deal").length}),[items]);
 return <main className="needs-shell"><header className="needs-header"><a href="/">← Cinder workspace</a><button onClick={()=>void load()} disabled={loading}>↻ Refresh</button></header><section className="needs-content"><div className="needs-eyebrow">EXECUTION QUEUE</div><h1>Needs you<span>.</span></h1><p className="needs-subtitle">One queue for overdue follow-ups, blocked delivery, and work that needs a decision. Items are read from your workspace, not generated placeholders.</p>
 <div className="needs-stats"><div><small>NEEDS ATTENTION</small><strong>{loading?"—":items.length}</strong></div><div><small>OUTREACH DUE</small><strong>{loading?"—":counts.outreach}</strong></div><div><small>BLOCKED / URGENT</small><strong>{loading?"—":items.filter(x=>x.priority<=1).length}</strong></div></div>
 {error&&<div className="needs-error" role="alert">{error}</div>}
 <nav className="needs-filters" aria-label="Filter action queue">{[["all","All items"],["task","Tasks"],["outreach","Outreach"],["followup","Contact follow-ups"],["project","Projects"],["deal","Deals"]].map(([id,label])=><button key={id} className={filter===id?"selected":""} onClick={()=>setFilter(id)}>{label}<span>{counts[id as keyof typeof counts]}</span></button>)}</nav>
 <section className="needs-list">{loading?<div className="needs-empty">Loading your live action queue…</div>:visible.length===0?<div className="needs-empty"><strong>You're all caught up.</strong><p>No items in this view currently need attention.</p></div>:visible.map(item=><article key={item.id} className="needs-item"><div className={"needs-kind kind-"+item.kind}>{({task:"✓",outreach:"↗",followup:"☎",project:"▱",deal:"$"} as Record<string,string>)[item.kind]}</div><div className="needs-item-copy"><div className="needs-item-title">{item.title}</div><div className="needs-item-detail">{item.detail||item.kind}</div><div className="needs-item-due">{item.due?"Due "+dateLabel(item.due):"No due date"}</div></div><a className="needs-item-action" href={item.href}>{item.action} →</a></article>)}</section>
 <p className="needs-footnote">This queue is advisory: it highlights records with overdue dates or explicit blockers. It does not send messages, make calls, or change record status automatically.</p>
 </section></main>;
}
function statusesLabel(s:string){return ({planning:"Planning",onboarding:"Onboarding",in_progress:"In progress",blocked:"Blocked",review:"In review",on_hold:"On hold"} as Record<string,string>)[s]||s;}
