"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
type Signal={id:string;level:"urgent"|"watch"|"positive";title:string;detail:string;href:string;label:string};
type Snapshot={contacts:any[];deals:any[];outreach:any[];tasks:any[];projects:any[];finance:any;success:any;workforce:any};
const money=(v:unknown)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(v||0));
export default function IntelligencePage(){
 const [data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[filter,setFilter]=useState("all"),[nowMs,setNowMs]=useState(0);
 const load=useCallback(async()=>{setLoading(true);setError("");try{
  const urls=["/api/contacts","/api/deals","/api/outreach","/api/tasks","/api/projects","/api/finance","/api/client-success","/api/workforce"];
  const responses=await Promise.all(urls.map(url=>fetch(url,{cache:"no-store"})));
  if(responses.some(r=>r.status===401))throw new Error("Sign in to view workspace intelligence.");
  if(responses.some(r=>!r.ok))throw new Error("Some workspace data could not load. Open the relevant module to check its connection.");
  const [c,d,o,t,p,f,s,w]=await Promise.all(responses.map(r=>r.json()));
  setData({contacts:c.contacts||[],deals:d.deals||[],outreach:o.outreach||[],tasks:t.tasks||[],projects:p.projects||[],finance:f,success:s,workforce:w});setNowMs(Date.now());
 }catch(e){setError(e instanceof Error?e.message:"Unable to load business intelligence.");}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 const signals=useMemo(()=>{if(!data)return[] as Signal[];const out:Signal[]=[];const now=nowMs;const date=new Date(now);const todayEnd=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime()-1;
  const activeDeals=data.deals.filter(x=>!["won","lost"].includes(x.stage));const overdueDeals=activeDeals.filter(x=>x.expectedCloseDate&&new Date(x.expectedCloseDate+"T23:59:59").getTime()<=todayEnd);
  const urgentTasks=data.tasks.filter(x=>!["done","cancelled"].includes(x.status)&&(x.status==="blocked"||x.priority==="urgent"||(x.dueAt&&new Date(x.dueAt).getTime()<=now)));
  const blockedProjects=data.projects.filter(x=>x.status==="blocked");const overdueProjects=data.projects.filter(x=>!["completed","cancelled"].includes(x.status)&&x.targetDate&&new Date(x.targetDate+"T23:59:59").getTime()<=todayEnd);
  const activeOutreach=data.outreach.filter(x=>x.status==="active");const dueOutreach=activeOutreach.filter(x=>x.nextActionAt&&new Date(x.nextActionAt).getTime()<=now);
  const pending=(data.workforce.approvals||[]).filter((x:any)=>x.status==="pending");const failed=(data.workforce.runs||[]).filter((x:any)=>x.status==="failed");
  const atRisk=(data.success.accounts||[]).filter((x:any)=>["at_risk","renewal_due"].includes(x.status)||Number(x.health_score)<=2);
  const paid=Number(data.finance.summary?.paidRevenue||0),expenses=Number(data.finance.summary?.monthExpenses||0),net=Number(data.finance.summary?.monthNet??(paid-expenses));
  if(urgentTasks.length)out.push({id:"tasks",level:"urgent",title:urgentTasks.length+" tasks need attention",detail:"Blocked, urgent, or past-due tasks can slow delivery and sales.",href:"/crm/tasks",label:"Review tasks"});
  if(blockedProjects.length)out.push({id:"blocked-projects",level:"urgent",title:blockedProjects.length+" client projects are blocked",detail:"Unblock delivery before it affects launch dates or client confidence.",href:"/crm/projects",label:"Open projects"});
  if(pending.length)out.push({id:"approvals",level:"urgent",title:pending.length+" AI-workforce approvals are pending",detail:"These are recorded approval requests; no external action runs automatically from this page.",href:"/crm/workforce",label:"Review approvals"});
  if(atRisk.length)out.push({id:"retention",level:"urgent",title:atRisk.length+" client accounts may need retention attention",detail:"Accounts marked at-risk, renewal-due, or health score 2/5 and below.",href:"/crm/client-success",label:"Review clients"});
  if(overdueDeals.length)out.push({id:"deals",level:"watch",title:overdueDeals.length+" open deals have passed their expected close date",detail:"Update the next step, expected close date, or loss reason so the pipeline stays credible.",href:"/crm/pipeline",label:"Review pipeline"});
  if(overdueProjects.length)out.push({id:"project-dates",level:"watch",title:overdueProjects.length+" active projects are past target date",detail:"Check scope, dependencies, and client expectations.",href:"/crm/projects",label:"Review delivery"});
  if(dueOutreach.length)out.push({id:"outreach",level:"watch",title:dueOutreach.length+" prospect follow-ups are due",detail:"Consistent follow-through is the engine of customer acquisition.",href:"/crm/outreach",label:"Work outreach"});
  if(failed.length)out.push({id:"agent-failures",level:"watch",title:failed.length+" AI run records are marked failed",detail:"Review their summaries and results. Run history is manually recorded today.",href:"/crm/workforce",label:"Inspect run history"});
  if(net<0)out.push({id:"net",level:"watch",title:"Logged expenses exceed collected revenue this month",detail:money(net)+" net based on entries in the manual ledger; this is not a bank-reconciled figure.",href:"/crm/finance",label:"Review finances"});
  if(!out.length)out.push({id:"clear",level:"positive",title:"No high-priority signals found in the current records",detail:"Keep records current; intelligence is only as good as the information entered.",href:"/crm/needs-you",label:"Open action queue"});
  return out;
 },[data,nowMs]);
 const counts=useMemo(()=>({all:signals.length,urgent:signals.filter(s=>s.level==="urgent").length,watch:signals.filter(s=>s.level==="watch").length,positive:signals.filter(s=>s.level==="positive").length}),[signals]);
 const visible=filter==="all"?signals:signals.filter(s=>s.level===filter);
 const d=data;
 const closedDeals=d?.deals.filter(x=>x.stage==="won"||x.stage==="lost")||[];
 const wonDeals=closedDeals.filter(x=>x.stage==="won").length;
 const winRate=closedDeals.length?Math.round(wonDeals/closedDeals.length*100)+"%":"—";
 const activeProjects=d?.projects.filter(x=>!["completed","cancelled"].includes(x.status))||[];
 const milestoneTotal=activeProjects.reduce((n,x)=>n+Number(x.milestoneCount||0),0);
 const milestoneDone=activeProjects.reduce((n,x)=>n+Number(x.doneMilestones||0),0);
 const deliveryRate=milestoneTotal?Math.round(milestoneDone/milestoneTotal*100)+"%":"—";
 const figs:[string,string|number][]=[["Prospects",d?.contacts.length??"—"],["Win rate",d?winRate:"—"],["Open deals",d?d.deals.filter(x=>!["won","lost"].includes(x.stage)).length:"—"],["Active projects",d?activeProjects.length:"—"],["Outreach due",d?d.outreach.filter(x=>x.status==="active"&&x.nextActionAt&&new Date(x.nextActionAt).getTime()<=nowMs).length:"—"],["Collected this month",d?money(d.finance.summary?.paidRevenue):"—"]];
 const tone=(l:Signal["level"])=>l==="urgent"?"#d92d20":l==="watch"?"#dc8a12":"#1f9d55";
 return <main className="u-page">
  <div className="u-head">
   <h1 className="u-title">Signals<span className="u-dim">{loading?"":` ${signals.length} to look at`}</span></h1>
   <div className="u-head-actions"><button type="button" className="u-btn" onClick={()=>void load()} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button></div>
  </div>
  <p className="u-note" style={{marginTop:20}}>What needs to move across deals, outreach, clients and money. Read only: nothing here changes a record.</p>
  {error&&<p role="alert" className="u-flash is-bad" style={{marginTop:16}}>{error}</p>}
  <div className="u-figs" style={{marginTop:16}}>{figs.map(([k,v])=><div key={k} className="u-fig"><span className="u-fig-k">{k}</span><div className="u-fig-v">{loading?"—":v}</div></div>)}</div>
  <section className="u-block">
   <div className="u-h2-row"><h2 className="u-h2">Next steps<span className="u-quiet">{loading?"":signals.length}</span></h2>
    <div className="u-seg" role="group" aria-label="Show">{([["all","All"],["urgent","Urgent"],["watch","Watch"],["positive","Going well"]] as const).map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}<span className="u-quiet">{counts[id as keyof typeof counts]}</span></button>)}</div></div>
   {loading?<p className="u-note" role="status">Reading your workspace…</p>:visible.length===0?<div className="u-void"><h2>Nothing here</h2><p>No signals match this filter. Keep records current and they show up as they appear.</p></div>
   :<div className="u-rows">{visible.map(s=><a key={s.id} href={s.href} className="u-row"><span aria-hidden="true" style={{width:8,height:8,borderRadius:99,flexShrink:0,background:tone(s.level)}}/><div className="u-row-main"><strong>{s.title}</strong><span style={{whiteSpace:"normal"}}>{s.detail}</span></div><span className="u-row-end">{s.label}</span></a>)}</div>}
  </section>
 </main>;
}
