"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import "./delivery.css";
type Status="planning"|"onboarding"|"in_progress"|"blocked"|"review"|"completed"|"on_hold"|"cancelled";
type Project={clock?:{state:string;label:string};id:string;name:string;clientName:string;serviceType:string;status:Status;startDate:string|null;targetDate:string|null;monthlyValue:number;setupValue:number;notes:string;contactId:string|null;dealId:string|null;contactName:string;dealTitle:string;milestoneCount:number;doneMilestones:number};
type Milestone={id:string;projectId:string;title:string;description:string;status:string;dueAt:string|null;sortOrder:number};
type Contact={id:string;name:string;company:string};
type Deal={id:string;title:string;company:string;contactName:string};
const statuses:Record<Status,string>={planning:"Planning",onboarding:"Onboarding",in_progress:"In progress",blocked:"Blocked",review:"In review",completed:"Completed",on_hold:"On hold",cancelled:"Cancelled"};
const services:Record<string,string>={tier1_speed_to_lead:"Never Miss a Lead",tier2_revenue_system:"Book & Close",ai_voice_agent:"AI voice agent",speed_to_lead:"Speed-to-lead",lead_follow_up:"Lead follow-up",appointment_booking:"Appointment booking",workflow_automation:"Workflow automation",custom_ai_implementation:"Custom AI implementation"};
const blank={name:"",clientName:"",serviceType:"custom_ai_implementation",status:"planning" as Status,startDate:"",targetDate:"",monthlyValue:"",setupValue:"",notes:"",contactId:"",dealId:""};
const dateLabel=(v:string|null)=>v?new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"No target date";
const milestoneDateLabel=(v:string|null)=>{if(!v)return "No due date";const utcMidnight=/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(v);const d=new Date(utcMidnight?v.slice(0,10)+"T12:00:00":v);return Number.isNaN(d.getTime())?"Date unavailable":d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});};
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n||0);
export default function ProjectsPage(){
 const [projects,setProjects]=useState<Project[]>([]),[contacts,setContacts]=useState<Contact[]>([]),[deals,setDeals]=useState<Deal[]>([]),[milestones,setMilestones]=useState<Milestone[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState("active");
 const [show,setShow]=useState(false),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState(blank),[selected,setSelected]=useState<string|null>(null);
 const [milestoneTitle,setMilestoneTitle]=useState(""),[milestoneDue,setMilestoneDue]=useState(""),[milestoneBusy,setMilestoneBusy]=useState(false),[handoffBusy,setHandoffBusy]=useState(false);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const [pr,cr,dr]=await Promise.all([fetch("/api/projects",{cache:"no-store"}),fetch("/api/contacts",{cache:"no-store"}),fetch("/api/deals",{cache:"no-store"})]);const pd=await pr.json().catch(()=>({}));if(!pr.ok)throw new Error(pd.error||"Could not load projects.");setProjects(Array.isArray(pd.projects)?pd.projects:[]);if(cr.ok){const d=await cr.json();setContacts(Array.isArray(d.contacts)?d.contacts:[])}if(dr.ok){const d=await dr.json();setDeals(Array.isArray(d.deals)?d.deals:[])}}catch(e){setError(e instanceof Error?e.message:"Could not load projects.")}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 const loadMilestones=useCallback(async(id:string)=>{const r=await fetch("/api/project-milestones?projectId="+encodeURIComponent(id),{cache:"no-store"});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not load milestones.");setMilestones(Array.isArray(d.milestones)?d.milestones:[])},[]);
 useEffect(()=>{if(selected){void loadMilestones(selected).catch(e=>setError(e instanceof Error?e.message:"Could not load milestones."))}else setMilestones([])},[selected,loadMilestones]);
 const active=projects.filter(p=>!["completed","cancelled"].includes(p.status)),blocked=projects.filter(p=>p.status==="blocked"),monthly=active.reduce((n,p)=>n+p.monthlyValue,0);
 const shown=useMemo(()=>projects.filter(p=>(filter==="all"||filter==="active"?!((filter==="active")&&["completed","cancelled"].includes(p.status)):filter==="blocked"?p.status==="blocked":p.status===filter)&&[p.name,p.clientName,p.contactName,p.dealTitle,services[p.serviceType]||p.serviceType].join(" ").toLowerCase().includes(query.trim().toLowerCase())),[projects,filter,query]);
 function newProject(){setDraft(blank);setEditing(null);setShow(true);setNotice("");}
 function editProject(p:Project){setDraft({name:p.name,clientName:p.clientName,serviceType:p.serviceType,status:p.status,startDate:p.startDate?.slice(0,10)||"",targetDate:p.targetDate?.slice(0,10)||"",monthlyValue:String(p.monthlyValue),setupValue:String(p.setupValue),notes:p.notes,contactId:p.contactId||"",dealId:p.dealId||""});setEditing(p.id);setShow(true);}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const body={...draft,startDate:draft.startDate||null,targetDate:draft.targetDate||null,monthlyValue:Number(draft.monthlyValue||0),setupValue:Number(draft.setupValue||0),contactId:draft.contactId||null,dealId:draft.dealId||null};const r=await fetch("/api/projects",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing?{...body,id:editing}:body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not save project.");setShow(false);setNotice(editing?"Project updated.":"Project created.");await load();if(!editing&&d.id)setSelected(d.id)}catch(e){setError(e instanceof Error?e.message:"Could not save project.")}finally{setBusy(false)}}
 async function updateStatus(p:Project,status:Status){const r=await fetch("/api/projects",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:p.id,name:p.name,status,serviceType:p.serviceType,monthlyValue:p.monthlyValue,setupValue:p.setupValue})});const d=await r.json().catch(()=>({}));if(!r.ok){setError(d.error||"Could not update status.");return}setProjects(old=>old.map(x=>x.id===p.id?{...x,status}:x));}
 async function remove(p:Project){if(!confirm("Delete this project and its milestones?"))return;const r=await fetch("/api/projects",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:p.id})});if(!r.ok){setError("Could not delete project.");return}setProjects(old=>old.filter(x=>x.id!==p.id));if(selected===p.id)setSelected(null);setNotice("Project deleted.");}
 async function addMilestone(e:React.FormEvent){e.preventDefault();if(!selected||!milestoneTitle.trim())return;setMilestoneBusy(true);try{const r=await fetch("/api/project-milestones",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:selected,title:milestoneTitle,dueAt:milestoneDue?new Date(milestoneDue+"T12:00:00").toISOString():null,sortOrder:milestones.length})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not add milestone.");setMilestoneTitle("");setMilestoneDue("");await Promise.all([loadMilestones(selected),load()])}catch(e){setError(e instanceof Error?e.message:"Could not add milestone.")}finally{setMilestoneBusy(false)}}
 async function milestoneStatus(m:Milestone,status:string){const r=await fetch("/api/project-milestones",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:m.id,status})});if(!r.ok){setError("Could not update milestone.");return}if(selected)await Promise.all([loadMilestones(selected),load()])}
 async function deleteMilestone(m:Milestone){const r=await fetch("/api/project-milestones",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:m.id})});if(!r.ok){setError("Could not delete milestone.");return}if(selected)await Promise.all([loadMilestones(selected),load()])}
 async function handoffMilestones(){if(!selected)return;setHandoffBusy(true);setError("");try{const r=await fetch("/api/projects/tasks-from-milestones",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:selected})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not create tasks from milestones.");setNotice("Task handoff complete: "+d.created+" created"+(d.skipped?", "+d.skipped+" already existed":"")+". Open Tasks to assign priorities and manage execution.");}catch(e){setError(e instanceof Error?e.message:"Could not create tasks.")}finally{setHandoffBusy(false)}}
 const chosen=projects.find(p=>p.id===selected);
 useEffect(()=>{if(!selected&&!loading){const first=projects.find(p=>!["completed","cancelled"].includes(p.status));if(first)setSelected(first.id)}},[selected,loading,projects]);
 const pctDone=(p:Project)=>p.milestoneCount?Math.round(p.doneMilestones/p.milestoneCount*100):0;
 const openSteps=milestones.filter(m=>!["done","cancelled"].includes(m.status));
 const nextStep=openSteps[0];
 return <div className="u-page dv-page" role="region" aria-label="Delivery">
  <div className="u-head">
   <h1 className="u-title">Delivery</h1>
   <div className="u-head-actions"><button className="u-btn u-btn-light" onClick={newProject}>New project</button></div>
  </div>
  {error&&<p className="u-flash is-bad" role="alert" style={{marginBottom:16}}>{error}<button className="u-btn u-btn-bare" style={{marginLeft:"auto"}} onClick={()=>setError("")}>Dismiss</button></p>}
  {notice&&<p className="u-flash" role="status" style={{marginBottom:16}}>{notice}</p>}

  <div className="u-figs">
   <div className="u-fig"><span className="u-fig-k">In delivery</span><div className="u-fig-v">{loading?"—":active.length}</div><div className="u-fig-sub">{projects.filter(p=>p.status==="completed").length} finished all time</div></div>
   <div className="u-fig"><span className="u-fig-k">Blocked</span><div className="u-fig-v">{blocked.length}</div><div className="u-fig-sub">{blocked.length?blocked.map(p=>p.clientName||p.name).slice(0,2).join(", "):"Nothing waiting on you or them"}</div></div>
   <div className="u-fig"><span className="u-fig-k">Monthly riding on these</span><div className="u-fig-v">{money(monthly)}<small>/mo</small></div><div className="u-fig-sub">Starts billing once each one goes live</div></div>
   <div className="u-fig"><span className="u-fig-k">Steps left</span><div className="u-fig-v">{active.reduce((n,p)=>n+Math.max(0,p.milestoneCount-p.doneMilestones),0)}</div><div className="u-fig-sub">across every active build</div></div>
  </div>

  {loading?<p className="u-note" role="status">Loading…</p>:projects.length===0?<div className="u-void"><h2>Nothing in delivery</h2><p>Mark a deal won in Pipeline and the build shows up here with a step-by-step plan from kickoff to live. You can also start one by hand.</p><div style={{display:"flex",gap:8}}><a className="u-btn u-btn-light" href="/crm/pipeline">Open pipeline</a><button className="u-btn" onClick={newProject}>New project</button></div></div>
  :<div className="dv-split">
   <div>
    <div className="dv-bar">
     <div className="u-seg" role="group" aria-label="Show">{([["active","Active"],["blocked","Blocked"],["completed","Finished"],["all","All"]] as const).map(([k,l])=><button key={k} type="button" aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l}</button>)}</div>
     <input className="u-field" type="search" aria-label="Search projects" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search"/>
    </div>
    {shown.length===0?<p className="u-note">Nothing in this view.</p>:<div className="u-rows">{shown.map(p=><button type="button" key={p.id} className={"u-row dv-proj"+(selected===p.id?" is-on":"")} onClick={()=>setSelected(p.id)}>
     <div className="u-row-main"><strong>{p.clientName||p.contactName||p.name}</strong><span>{services[p.serviceType]||p.serviceType}{p.targetDate?`, live by ${dateLabel(p.targetDate).replace(/, \d{4}$/,"")}`:""}</span></div>
     <div className="dv-proj-end">
      <span className={"u-mark"+(p.status==="blocked"?" is-bad":p.status==="completed"?" is-good":"")}>{statuses[p.status]}</span>
      <div className="dv-prog"><i style={{width:pctDone(p)+"%"}}/></div>
      <span className="u-note">{p.doneMilestones}/{p.milestoneCount}</span>
     </div>
    </button>)}</div>}
   </div>

   {chosen?<div className="dv-plan">
    <div className="dv-plan-head">
     <div>
      <h2 className="dv-name">{chosen.clientName||chosen.name}</h2>
      <p className="u-note" style={{marginTop:6}}>{chosen.name}{chosen.clock&&chosen.clock.state!=="live"?` · ${chosen.clock.label}`:""}</p>
     </div>
     <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      <select className="u-field dv-sel" aria-label="Project status" value={chosen.status} onChange={e=>void updateStatus(chosen,e.target.value as Status)}>{Object.entries(statuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <a className="u-btn" href={"/crm/client-success/"+chosen.id}>Client page</a>
      <button className="u-btn u-btn-bare" onClick={()=>editProject(chosen)}>Edit</button>
     </div>
    </div>
    <div className="dv-pct"><b className="u-num">{pctDone(chosen)}%</b><div className="dv-prog dv-prog-lg"><i style={{width:pctDone(chosen)+"%"}}/></div><span className="u-note">{nextStep?<>Next: <span style={{color:"var(--u-text)"}}>{nextStep.title}</span></>:milestones.length?"Every step is done":"No steps yet"}</span></div>
    <ol className="dv-steps">{milestones.map(m=>{const done=m.status==="done";return <li key={m.id} className={"dv-step is-"+m.status}>
     <button type="button" className="dv-check" aria-pressed={done} aria-label={(done?"Mark not done: ":"Mark done: ")+m.title} onClick={()=>void milestoneStatus(m,done?"todo":"done")}>{done&&<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</button>
     <div className="dv-step-main"><span className="dv-step-t">{m.title}</span><span className="u-note">{m.dueAt?"Due "+milestoneDateLabel(m.dueAt).replace(/, \d{4}$/,""):"No due date"}{m.status==="blocked"?" · Blocked":m.status==="in_progress"?" · In progress":""}</span></div>
     <select className="u-field dv-sel dv-sel-sm" aria-label={"Status for "+m.title} value={m.status} onChange={e=>void milestoneStatus(m,e.target.value)}>{["todo","in_progress","blocked","done","cancelled"].map(s=><option key={s} value={s}>{s==="todo"?"To do":s.replace("_"," ").replace(/^./,c=>c.toUpperCase())}</option>)}</select>
     <button type="button" className="u-btn u-btn-bare dv-del" onClick={()=>void deleteMilestone(m)} aria-label={"Delete "+m.title}>Remove</button>
    </li>})}</ol>
    <form className="dv-add" onSubmit={addMilestone}>
     <input className="u-field" required maxLength={240} value={milestoneTitle} onChange={e=>setMilestoneTitle(e.target.value)} placeholder="Add a step, like: connect the phone number and test a missed call" aria-label="New step"/>
     <input className="u-field" type="datetime-local" value={milestoneDue} onChange={e=>setMilestoneDue(e.target.value)} aria-label="Due"/>
     <button className="u-btn" disabled={milestoneBusy}>{milestoneBusy?"Adding…":"Add step"}</button>
    </form>
    <div className="dv-foot">
     <button className="u-btn u-btn-bare" onClick={()=>void handoffMilestones()} disabled={handoffBusy||milestones.every(m=>["done","cancelled"].includes(m.status))}>{handoffBusy?"Creating…":"Copy open steps to Follow-ups"}</button>
     <button className="u-btn u-btn-bare" onClick={()=>void remove(chosen)}>Delete project</button>
    </div>
   </div>:<div className="dv-plan"><p className="u-note">Pick a project to see its plan.</p></div>}
  </div>}

  {show&&<div className="u-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setShow(false)}}><form className="u-dialog" style={{width:"min(620px,100%)",maxHeight:"calc(100vh - 36px)",overflowY:"auto"}} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="dv-form-title">
   <h3 id="dv-form-title">{editing?"Edit project":"New project"}</h3>
   <div className="dv-form">
    <label className="u-lab dv-full">Project name<input className="u-field" required maxLength={240} autoFocus value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Summit Fence, Book & Close build"/></label>
    <label className="u-lab">Client<input className="u-field" maxLength={240} value={draft.clientName} onChange={e=>setDraft({...draft,clientName:e.target.value})} placeholder="Summit Fence & Gate"/></label>
    <label className="u-lab">What you're building<select className="u-field" value={draft.serviceType} onChange={e=>setDraft({...draft,serviceType:e.target.value})}>{Object.entries(services).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label className="u-lab">Status<select className="u-field" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Status})}>{Object.entries(statuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label className="u-lab">Start<input className="u-field" type="date" value={draft.startDate} onChange={e=>setDraft({...draft,startDate:e.target.value})}/></label>
    <label className="u-lab">Live by<input className="u-field" type="date" value={draft.targetDate} onChange={e=>setDraft({...draft,targetDate:e.target.value})}/></label>
    <label className="u-lab">Setup fee<input className="u-field" type="number" min="0" step="0.01" value={draft.setupValue} onChange={e=>setDraft({...draft,setupValue:e.target.value})}/></label>
    <label className="u-lab">Monthly<input className="u-field" type="number" min="0" step="0.01" value={draft.monthlyValue} onChange={e=>setDraft({...draft,monthlyValue:e.target.value})}/></label>
    <label className="u-lab">Contact<select className="u-field" value={draft.contactId} onChange={e=>setDraft({...draft,contactId:e.target.value})}><option value="">None</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.company||c.name}</option>)}</select></label>
    <label className="u-lab dv-full">Deal<select className="u-field" value={draft.dealId} onChange={e=>setDraft({...draft,dealId:e.target.value})}><option value="">None</option>{deals.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
    <label className="u-lab dv-full">Notes<textarea className="u-field" rows={3} maxLength={10000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Scope, logins you need, what success looks like"/></label>
   </div>
   <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}><button type="button" className="u-btn" onClick={()=>setShow(false)}>Cancel</button><button className="u-btn u-btn-light" disabled={busy}>{busy?"Saving…":editing?"Save changes":"Create project"}</button></div>
  </form></div>}
 </div>
}
