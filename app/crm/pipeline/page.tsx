"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./pipeline.css";

type Stage="new"|"qualified"|"discovery"|"proposal"|"negotiation"|"won"|"lost";
type Deal={id:string;contactId:string|null;title:string;serviceType:string;stage:Stage;setupFee:number;monthlyFee:number;expectedCloseDate:string;source:string;notes:string;lostReason:string;contactName:string;company:string;agreementStatus?:string;endedAt?:string|null};
type Contact={id:string;name:string;company:string};
type ExistingProject={id:string;dealId:string|null};
const stages:{id:Stage;label:string}[]=[{id:"new",label:"New"},{id:"qualified",label:"Qualified"},{id:"discovery",label:"Discovery"},{id:"proposal",label:"Proposal"},{id:"negotiation",label:"Negotiation"},{id:"won",label:"Won"},{id:"lost",label:"Lost"}];
const services=[{id:"ai_voice_agent",label:"AI voice agent"},{id:"speed_to_lead",label:"Speed-to-lead"},{id:"lead_follow_up",label:"Lead follow-up"},{id:"appointment_booking",label:"Appointment booking"},{id:"workflow_automation",label:"Workflow automation"},{id:"custom_ai_implementation",label:"Custom AI implementation"}];
const blank={title:"",contactId:"",serviceType:"custom_ai_implementation",stage:"new" as Stage,setupFee:"",monthlyFee:"",expectedCloseDate:"",source:"",notes:"",lostReason:""};
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n||0);
export default function PipelinePage(){
 const [deals,setDeals]=useState<Deal[]>([]),[contacts,setContacts]=useState<Contact[]>([]),[projects,setProjects]=useState<ExistingProject[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[show,setShow]=useState(false),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState(blank),[busy,setBusy]=useState(false),[creatingProject,setCreatingProject]=useState<string|null>(null),[filter,setFilter]=useState("open");
 async function load(){setLoading(true);setError("");try{const [a,b,p]=await Promise.all([fetch("/api/deals",{cache:"no-store"}),fetch("/api/contacts",{cache:"no-store"}),fetch("/api/projects",{cache:"no-store"})]);if(!a.ok||!b.ok)throw new Error("Could not load pipeline. Make sure you're signed in.");const [ad,bd,pd]=await Promise.all([a.json(),b.json(),p.ok?p.json():Promise.resolve({projects:[]})]);setDeals(Array.isArray(ad.deals)?ad.deals:[]);setContacts(Array.isArray(bd.contacts)?bd.contacts:[]);setProjects(Array.isArray(pd.projects)?pd.projects:[])}catch(e){setError(e instanceof Error?e.message:"Could not load pipeline.")}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 const shown=useMemo(()=>deals.filter(d=>filter==="all"||filter==="open"?!((filter==="open")&&(d.stage==="won"||d.stage==="lost")):d.stage===filter),[deals,filter]);
 const active=deals.filter(d=>!["won","lost"].includes(d.stage));
 const pipelineValue=active.reduce((s,d)=>s+d.setupFee,0),monthly=active.reduce((s,d)=>s+d.monthlyFee,0);
 const won=deals.filter(d=>d.stage==="won");
 function startNew(){setDraft(blank);setEditing(null);setShow(true)}
 function startEdit(d:Deal){setDraft({title:d.title,contactId:d.contactId||"",serviceType:d.serviceType,stage:d.stage,setupFee:String(d.setupFee),monthlyFee:String(d.monthlyFee),expectedCloseDate:d.expectedCloseDate,source:d.source,notes:d.notes,lostReason:d.lostReason});setEditing(d.id);setShow(true)}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const body={...draft,setupFee:Number(draft.setupFee||0),monthlyFee:Number(draft.monthlyFee||0),contactId:draft.contactId||null};const r=await fetch("/api/deals",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing?{...body,id:editing}:body)});if(!r.ok){const data=await r.json().catch(()=>({}));throw new Error(data.error||"Couldn't save deal.")}setShow(false);await load()}catch(e){setError(e instanceof Error?e.message:"Couldn't save deal.")}finally{setBusy(false)}}
 async function quickStage(d:Deal,stage:Stage){const r=await fetch("/api/deals",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...d,stage,contactId:d.contactId||null})});if(!r.ok){setError("Couldn't update deal stage.");return}await load()}
 async function endAgreement(d:Deal){
  if(!window.confirm("End the recurring agreement for "+d.title+"? This removes it from contracted MRR and records today's end date."))return;
  setError("");setNotice("");
  try{
   const r=await fetch("/api/deals",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...d,stage:d.stage,contactId:d.contactId||null,agreementStatus:"ended",endedAt:new Date().toISOString().slice(0,10)})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(data.error||"Could not end agreement.");
   setNotice("Agreement ended. Contracted MRR has been updated; historical deal and delivery records remain.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not end agreement.");}
 }
 async function startDelivery(d:Deal){
  const existing=projects.find(p=>p.dealId===d.id);
  setCreatingProject(d.id);setError("");setNotice("");
  try{
   const handoff=await fetch("/api/deals/convert",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dealId:d.id})});
   const handoffData=await handoff.json().catch(()=>({}));
   if(!handoff.ok)throw new Error(handoffData.error||"Could not hand off the signed deal.");
   let projectId=typeof handoffData.projectId==="string"?handoffData.projectId:existing?.id||"";
   if(!projectId)throw new Error("The deal handoff completed without returning a project ID. Check Projects before retrying.");
   const checklist:[string,string][]=[["Kickoff and confirm scope","Confirm goals, stakeholders, communication channel, and definition of success."],["Collect access and requirements","Gather required accounts, phone numbers, integrations, FAQs, and permissions."],["Configure the agreed solution","Build the service and connect the required systems."],["Test end-to-end scenarios","Run realistic test cases and resolve launch-blocking issues."],["Client approval and launch","Get client sign-off, confirm launch timing, and document support expectations."]];
   const existingResponse=await fetch("/api/project-milestones?projectId="+encodeURIComponent(projectId),{cache:"no-store"});
   const existingData=await existingResponse.json().catch(()=>({}));
   if(!existingResponse.ok)throw new Error(existingData.error||"The project exists, but its onboarding checklist could not be checked. Retry without creating another project.");
   const knownTitles=new Set((Array.isArray(existingData.milestones)?existingData.milestones:[]).map((m:{title?:string})=>(m.title||"").trim().toLowerCase()));
   let failed=0,created=0;
   for(let i=0;i<checklist.length;i++){
    const [title,description]=checklist[i];
    if(knownTitles.has(title.toLowerCase()))continue;
    const mr=await fetch("/api/project-milestones",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId,title,description,sortOrder:i})});
    if(mr.ok){created++;knownTitles.add(title.toLowerCase());}else failed++;
   }
   if(failed){
    setNotice("Project is saved. "+created+" missing onboarding milestone(s) added; "+failed+" could not be created. Use Finish checklist to safely retry.");
    await load();
    return;
   }
   setNotice(existing?"Existing project and onboarding checklist are ready.":"Project and onboarding checklist created from "+d.title+".");
   await load();
   window.location.assign("/crm/projects");
  }catch(e){setError(e instanceof Error?e.message:"Could not start or resume delivery.");await load();}
  finally{setCreatingProject(null)}
 }
 const columns=stages.filter(s=>filter==="open"? !["won","lost"].includes(s.id):filter==="all"||filter===s.id);
 return <main className="pipeline-page">
  <header className="pipeline-header"><div><div className="pipeline-eyebrow">CINDER / SALES</div><h1>Sales <span>pipeline</span></h1><p>Track every opportunity from first conversation to signed client—and see the setup revenue and monthly revenue behind it.</p></div><div className="pipeline-header-actions"><Link href="/crm/outreach" className="pipeline-link">Outreach queue ↗</Link><button className="pipeline-primary" onClick={startNew}>＋ New deal</button></div></header>
  {error&&<div className="pipeline-error" role="alert">{error}<button onClick={()=>setError("")}>Dismiss</button></div>}{notice&&<div className="pipeline-error" role="status">{notice}</div>}
  <section className="pipeline-metrics"><article><span>OPEN OPPORTUNITIES</span><strong>{active.length}</strong><small>Deals not yet won or lost</small></article><article><span>OPEN SETUP VALUE</span><strong>{money(pipelineValue)}</strong><small>Potential one-time revenue</small></article><article><span>OPEN MONTHLY REVENUE</span><strong>{money(monthly)}</strong><small>Potential recurring revenue / month</small></article><article><span>WON DEALS</span><strong>{won.length}</strong><small>{money(won.reduce((s,d)=>s+d.setupFee,0))} setup · {money(won.reduce((s,d)=>s+d.monthlyFee,0))}/mo</small></article></section>
  <section className="pipeline-board"><div className="pipeline-board-head"><div><h2>Opportunities</h2><p>Keep next steps and deal value visible.</p></div><div className="pipeline-filters"><label htmlFor="pipeline-filter">View</label><select id="pipeline-filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="open">Open deals</option><option value="all">All deals</option>{stages.filter(s=>s.id==="won"||s.id==="lost").map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div></div>
  {loading?<div className="pipeline-empty">Loading your pipeline…</div>:deals.length===0?<div className="pipeline-empty"><strong>No deals yet</strong><p>Add your first opportunity to start tracking setup fees, monthly revenue, and progress.</p><button className="pipeline-primary" onClick={startNew}>＋ Add your first deal</button></div>:<div className="pipeline-columns">{columns.map(col=>{const rows=shown.filter(d=>d.stage===col.id);return <section className="pipeline-column" key={col.id}><header><span>{col.label}</span><b>{rows.length}</b></header>{rows.length===0?<div className="pipeline-column-empty">No deals</div>:rows.map(d=><article className="pipeline-deal" key={d.id}><button className="pipeline-deal-title" onClick={()=>startEdit(d)}>{d.title}</button><p className="pipeline-deal-company">{d.company||d.contactName||"No linked contact"}</p><div className="pipeline-deal-value"><strong>{money(d.setupFee)}</strong><span>setup</span></div><div className="pipeline-deal-monthly">{money(d.monthlyFee)} / month</div><div className="pipeline-deal-meta">{services.find(s=>s.id===d.serviceType)?.label||"AI service"}{d.expectedCloseDate?<> · Close {new Date(d.expectedCloseDate+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}</>:null}</div><footer><button onClick={()=>startEdit(d)}>Edit</button><select aria-label={"Move "+d.title+" to stage"} value={d.stage} onChange={e=>void quickStage(d,e.target.value as Stage)}>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>{d.stage==="won"&&(<><button className="pipeline-primary" disabled={creatingProject===d.id} onClick={()=>void startDelivery(d)}>{creatingProject===d.id?"Checking checklist…":projects.some(p=>p.dealId===d.id)?"Finish checklist →":"Start delivery →"}</button>{d.agreementStatus==="active"&&<button onClick={()=>void endAgreement(d)}>End agreement</button>}</>)}</footer></article>)}</section>})}</div>}
  </section>
  {show&&<div className="pipeline-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShow(false)}}><section className="pipeline-modal" role="dialog" aria-modal="true" aria-labelledby="pipeline-form-title"><header><div><h2 id="pipeline-form-title">{editing?"Edit deal":"New deal"}</h2><p>Record the opportunity and the revenue model.</p></div><button className="pipeline-close" onClick={()=>setShow(false)} aria-label="Close">×</button></header><form onSubmit={save}><label className="pipeline-field pipeline-span">Deal name<input required maxLength={240} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="e.g. ABC HVAC — speed-to-lead"/></label><label className="pipeline-field">Linked contact<select value={draft.contactId} onChange={e=>setDraft({...draft,contactId:e.target.value})}><option value="">No contact linked</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}{c.company?" — "+c.company:""}</option>)}</select></label><label className="pipeline-field">Service<select value={draft.serviceType} onChange={e=>setDraft({...draft,serviceType:e.target.value})}>{services.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label className="pipeline-field">Stage<select value={draft.stage} onChange={e=>setDraft({...draft,stage:e.target.value as Stage})}>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label className="pipeline-field">Expected close date<input type="date" value={draft.expectedCloseDate} onChange={e=>setDraft({...draft,expectedCloseDate:e.target.value})}/></label><label className="pipeline-field">Setup fee ($)<input type="number" min="0" step="0.01" value={draft.setupFee} onChange={e=>setDraft({...draft,setupFee:e.target.value})} placeholder="2500"/></label><label className="pipeline-field">Monthly fee ($)<input type="number" min="0" step="0.01" value={draft.monthlyFee} onChange={e=>setDraft({...draft,monthlyFee:e.target.value})} placeholder="1497"/></label><label className="pipeline-field">Lead source<input maxLength={200} value={draft.source} onChange={e=>setDraft({...draft,source:e.target.value})} placeholder="Cold call, referral, inbound…"/></label><label className="pipeline-field">Lost reason<input maxLength={1000} value={draft.lostReason} onChange={e=>setDraft({...draft,lostReason:e.target.value})} placeholder="Optional"/></label><label className="pipeline-field pipeline-span">Notes<textarea rows={3} maxLength={10000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Pain points, decision maker, next step…"/></label><footer className="pipeline-form-actions"><button type="button" className="pipeline-secondary" onClick={()=>setShow(false)}>Cancel</button><button type="submit" className="pipeline-primary" disabled={busy}>{busy?"Saving…":editing?"Save changes":"Create deal"}</button></footer></form></section></div>}
 </main>
}