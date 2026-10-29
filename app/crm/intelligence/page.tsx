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
 return <main style={{maxWidth:1100,margin:"0 auto",padding:"28px 22px 56px",color:"#e5e5e5",fontFamily:"inherit"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}><span/><button onClick={()=>void load()} disabled={loading}>↻ Refresh signals</button></header>
  <p style={{marginTop:34,fontSize:10,letterSpacing:2,color:"#a95335"}}>Signals</p><h1 style={{fontSize:"clamp(32px,5vw,48px)",letterSpacing:"-1.8px",margin:"8px 0"}}>See what needs to move</h1>
  <p style={{maxWidth:700,color:"#a1a1a1",lineHeight:1.6}}>A read-only view across sales, outreach, delivery, client health, finances, and AI-workforce records. Signals are based on saved workspace data—not predictions or external integrations.</p>
  {error&&<p role="alert" style={{padding:14,background:"#2a1414",borderRadius:10}}>{error}</p>}
  <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10,margin:"24px 0"}}>
   {[["CONTACTS",d?.contacts.length??"—"],["CLOSED-DEAL WIN RATE",d?winRate:"—"],["OPEN DEALS",d?d.deals.filter(x=>!["won","lost"].includes(x.stage)).length:"—"],["ACTIVE PROJECTS",d?activeProjects.length:"—"],["MILESTONES COMPLETE",d?deliveryRate:"—"],["OUTREACH DUE",d?d.outreach.filter(x=>x.status==="active"&&x.nextActionAt&&new Date(x.nextActionAt).getTime()<=nowMs).length:"—"],["COLLECTED THIS MONTH",d?money(d.finance.summary?.paidRevenue):"—"],["PENDING APPROVALS",d?(d.workforce.approvals||[]).filter((x:any)=>x.status==="pending").length:"—"]].map(([label,value])=><article key={label} style={{border:"1px solid #303030",borderRadius:12,padding:16,background:"#171717"}}><small style={{display:"block",fontSize:10,letterSpacing:1.1,color:"#a1a1a1"}}>{label}</small><strong style={{display:"block",fontSize:25,marginTop:10,fontWeight:600}}>{loading?"—":value}</strong></article>)}
  </section>
  <section style={{border:"1px solid #303030",borderRadius:14,padding:18,background:"#171717"}}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h2 style={{fontSize:21,margin:"0 0 4px"}}>Signals & recommended next steps</h2><p style={{margin:0,color:"#a1a1a1",fontSize:13}}>Sorted by urgency. Signals do not change records or trigger actions.</p></div><span style={{fontSize:12,color:"#a1a1a1"}}>{loading?"Loading…":signals.length+" signals"}</span></div>
   <nav style={{display:"flex",gap:8,flexWrap:"wrap",margin:"18px 0"}}>{[["all","All"],["urgent","Urgent"],["watch","Watch"],["positive","Positive"]].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} style={{border:"1px solid "+(filter===id?"#e5e5e5":"#303030"),background:filter===id?"#e5e5e5":"#171717",color:filter===id?"#111":"#a1a1a1",borderRadius:999,padding:"8px 13px",cursor:"pointer"}}>{label} · {counts[id as keyof typeof counts]}</button>)}</nav>
   {loading?<p style={{padding:20,color:"#a1a1a1"}}>Reading your workspace…</p>:visible.length===0?<p style={{padding:20,color:"#a1a1a1"}}>No signals in this filter.</p>:visible.map(s=><article key={s.id} style={{display:"flex",gap:14,alignItems:"flex-start",padding:"17px 0",borderTop:"1px solid #303030"}}><span aria-hidden="true" style={{width:9,height:9,marginTop:7,borderRadius:99,flexShrink:0,background:s.level==="urgent"?"#b94b34":s.level==="watch"?"#c28b36":"#56836c"}}/><div style={{flex:1,minWidth:0}}><strong>{s.title}</strong><p style={{margin:"6px 0 0",color:"#a1a1a1",fontSize:13,lineHeight:1.5}}>{s.detail}</p></div><a href={s.href} style={{whiteSpace:"nowrap",fontSize:13,color:"#a95335"}}>{s.label} →</a></article>)}
  </section>
  <p style={{fontSize:11,color:"#888",lineHeight:1.6,marginTop:18}}>Limits: this page only analyzes records currently stored in Cinder. It does not connect to email, phone, bank accounts, advertising platforms, or live Hermes agents. Finance numbers reflect manual entries and are not reconciled to a bank.</p>
 </main>;
}
