"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEAL_STAGES, STAGE_LABELS, STAGE_PROBABILITY, weightedPipeline, type DealStage } from "@/lib/offers";
import { offersFrom } from "@/lib/workspace";
import { SOURCE_CHOICES } from "@/lib/lead-source";
import { useWorkspace } from "../../use-workspace";
import "./board.css";

type Stage=DealStage;
type Deal={id:string;contactId:string|null;title:string;serviceType:string;stage:Stage;setupFee:number;monthlyFee:number;expectedCloseDate:string;source:string;notes:string;lostReason:string;contactName:string;company:string;agreementStatus?:string;endedAt?:string|null;probability?:number|null};
type Contact={id:string;name:string;company:string};
type ExistingProject={id:string;dealId:string|null};
const stages:{id:Stage;label:string}[]=DEAL_STAGES.map(id=>({id,label:STAGE_LABELS[id]}));
const blank={title:"",contactId:"",serviceType:"tier1_speed_to_lead",stage:"new" as Stage,setupFee:"",monthlyFee:"",expectedCloseDate:"",probability:"",source:"",notes:"",lostReason:""};
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n||0);
export default function PipelinePage(){
 const wsp=useWorkspace();
 const offers=useMemo(()=>offersFrom(wsp),[wsp]);
 const services=[{id:offers.tier1.serviceType,label:offers.tier1.label},{id:offers.tier2.serviceType,label:offers.tier2.label},{id:"ai_voice_agent",label:"AI voice agent"},{id:"speed_to_lead",label:"Speed-to-lead"},{id:"lead_follow_up",label:"Lead follow-up"},{id:"appointment_booking",label:"Appointment booking"},{id:"workflow_automation",label:"Workflow automation"},{id:"custom_ai_implementation",label:"Custom AI implementation"}];
 const priced=(serviceType:string)=>{const o=Object.values(offers).find(x=>x.serviceType===serviceType);return o?{setupFee:String(o.setupFee),monthlyFee:String(o.monthlyFee)}:{}};
 const [deals,setDeals]=useState<Deal[]>([]),[contacts,setContacts]=useState<Contact[]>([]),[projects,setProjects]=useState<ExistingProject[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[show,setShow]=useState(false),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState(blank),[busy,setBusy]=useState(false),[creatingProject,setCreatingProject]=useState<string|null>(null),[filter,setFilter]=useState("open"),[view,setView]=useState<"board"|"list">("board"),[dragging,setDragging]=useState<string|null>(null),[over,setOver]=useState<Stage|null>(null);
 async function load(){setLoading(true);setError("");try{const [a,b,p]=await Promise.all([fetch("/api/deals",{cache:"no-store"}),fetch("/api/contacts",{cache:"no-store"}),fetch("/api/projects",{cache:"no-store"})]);if(!a.ok||!b.ok)throw new Error("Could not load pipeline. Make sure you're signed in.");const [ad,bd,pd]=await Promise.all([a.json(),b.json(),p.ok?p.json():Promise.resolve({projects:[]})]);setDeals(Array.isArray(ad.deals)?ad.deals:[]);setContacts(Array.isArray(bd.contacts)?bd.contacts:[]);setProjects(Array.isArray(pd.projects)?pd.projects:[])}catch(e){setError(e instanceof Error?e.message:"Could not load pipeline.")}finally{setLoading(false)}}
 useEffect(()=>{const dealParam=new URLSearchParams(window.location.search).get("deal");if(dealParam&&/^[0-9a-f-]{36}$/i.test(dealParam)){window.location.replace("/crm/deals/"+dealParam);return}void load();if(new URLSearchParams(window.location.search).get("new")==="1"){setDraft({...blank,...priced(blank.serviceType)});setEditing(null);setShow(true)}},[]);
 const shown=useMemo(()=>deals.filter(d=>filter==="all"||filter==="open"?!((filter==="open")&&(d.stage==="won"||d.stage==="lost")):d.stage===filter),[deals,filter]);
 const active=deals.filter(d=>!["won","lost"].includes(d.stage));
 const pipelineValue=active.reduce((s,d)=>s+d.setupFee,0),monthly=active.reduce((s,d)=>s+d.monthlyFee,0);
 const won=deals.filter(d=>d.stage==="won");
 function startNew(){setDraft({...blank,...priced(blank.serviceType)});setEditing(null);setShow(true)}
 function startEdit(d:Deal){setDraft({title:d.title,contactId:d.contactId||"",serviceType:d.serviceType,stage:d.stage,probability:d.probability==null?"":String(d.probability),setupFee:String(d.setupFee),monthlyFee:String(d.monthlyFee),expectedCloseDate:d.expectedCloseDate,source:d.source,notes:d.notes,lostReason:d.lostReason});setEditing(d.id);setShow(true)}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const body={...draft,setupFee:Number(draft.setupFee||0),monthlyFee:Number(draft.monthlyFee||0),contactId:draft.contactId||null};const r=await fetch("/api/deals",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing?{...body,id:editing}:body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Couldn't save deal.");if(draft.stage==="won"&&data.handoff)setNotice(data.handoff.ok?"Won! Onboarding project, delivery checklist and expected receivables are ready. No payment was recorded.":"Deal saved as won, but delivery setup failed: "+data.handoff.error);setShow(false);await load()}catch(e){setError(e instanceof Error?e.message:"Couldn't save deal.")}finally{setBusy(false)}}
 async function quickStage(d:Deal,stage:Stage){setNotice("");const r=await fetch("/api/deals",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...d,stage,contactId:d.contactId||null})});const data=await r.json().catch(()=>({}));if(!r.ok){setError(data.error||"Couldn't update deal stage.");return}if(stage==="won"&&data.handoff)setNotice(data.handoff.ok?"Won! Onboarding project, 9-step delivery checklist and expected receivables are ready in Delivery and Money. No payment was recorded.":"Deal marked won, but delivery setup failed: "+data.handoff.error);await load()}
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
   // The server owns the onboarding template; retries never duplicate projects, milestones or receivables.
   const r=await fetch("/api/deals/convert",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dealId:d.id})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(data.error||"Could not hand off the signed deal.");
   setNotice(existing?"Delivery project is up to date"+(data.milestonesAdded?" ("+data.milestonesAdded+" missing milestone(s) added).":"."):"Onboarding project, checklist and expected receivables created from "+d.title+". No payment was recorded.");
   await load();
   window.location.assign("/crm/projects");
  }catch(e){setError(e instanceof Error?e.message:"Could not start or resume delivery.");await load();}
  finally{setCreatingProject(null)}
 }
 const OPEN:Stage[]=DEAL_STAGES.filter(s=>!["won","lost","nurture"].includes(s)) as Stage[];
 const weighted=weightedPipeline(active.filter(d=>d.stage!=="nurture").map(d=>({stage:d.stage,setupFee:d.setupFee,monthlyFee:d.monthlyFee,probability:d.probability??null})));
 const live=won.filter(d=>d.agreementStatus==="active");
 const liveMrr=live.reduce((s,d)=>s+d.monthlyFee,0);
 const svc=(id:string)=>services.find(s=>s.id===id)?.label||"Service";
 const closeLabel=(d:Deal)=>d.expectedCloseDate&&/^\d{4}-\d{2}-\d{2}$/.test(d.expectedCloseDate)?new Date(d.expectedCloseDate+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"}):"";
 const late=(d:Deal)=>!!d.expectedCloseDate&&d.expectedCloseDate<new Date().toISOString().slice(0,10)&&!["won","lost"].includes(d.stage);
 const listRows=filter==="open"?deals.filter(d=>!["won","lost","nurture"].includes(d.stage)):deals.filter(d=>d.stage===filter);
 const card=(d:Deal)=><div key={d.id} className={"pb-deal"+(dragging===d.id?" is-drag":"")} draggable onDragStart={e=>{setDragging(d.id);e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",d.id)}} onDragEnd={()=>{setDragging(null);setOver(null)}}>
  <Link className="pb-deal-co" href={"/crm/deals/"+d.id}>{d.company||d.contactName||d.title}</Link>
  <span className="pb-deal-sub">{d.company||d.contactName?d.title.replace(new RegExp("^"+(d.company||d.contactName).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\s*[—–-]\\s*"),""):svc(d.serviceType)}</span>
  <div className="pb-deal-money"><b className="u-num">{money(d.monthlyFee)}</b><span>/mo</span><span className="pb-deal-setup">+ {money(d.setupFee)} setup</span></div>
  {(d.expectedCloseDate||d.probability!=null)&&<div className="pb-deal-meta">{d.expectedCloseDate&&<span className={late(d)?"is-late":""}>{late(d)?"Was due ":"Close "}{closeLabel(d)}</span>}<span>{Math.round(d.probability!=null?d.probability:(STAGE_PROBABILITY[d.stage]??0)*100)}%</span></div>}
 </div>;
 return <div className="u-page pb-page" role="region" aria-label="Pipeline">
  <div className="u-head">
   <h1 className="u-title">Pipeline</h1>
   <div className="u-head-actions">
    <div className="u-seg" role="group" aria-label="Layout"><button type="button" aria-pressed={view==="board"} onClick={()=>{setView("board");setFilter("open")}}>Board</button><button type="button" aria-pressed={view==="list"} onClick={()=>setView("list")}>List</button></div>
    <button className="u-btn u-btn-light" onClick={startNew}>New deal</button>
   </div>
  </div>
  {error&&<p className="u-flash is-bad" role="alert" style={{marginBottom:16}}>{error}<button className="u-btn u-btn-bare" style={{marginLeft:"auto"}} onClick={()=>setError("")}>Dismiss</button></p>}
  {notice&&<p className="u-flash" role="status" style={{marginBottom:16}}>{notice}</p>}

  <div className="u-figs">
   <div className="u-fig"><span className="u-fig-k">Open deals</span><div className="u-fig-v">{loading?"—":active.filter(d=>d.stage!=="nurture").length}</div><div className="u-fig-sub">{active.filter(d=>d.stage==="nurture").length} in nurture</div></div>
   <div className="u-fig"><span className="u-fig-k">If they all close</span><div className="u-fig-v">{money(monthly)}<small>/mo</small></div><div className="u-fig-sub">plus <b>{money(pipelineValue)}</b> in setup fees</div></div>
   <div className="u-fig"><span className="u-fig-k">Weighted by likelihood</span><div className="u-fig-v">{money(weighted.monthly)}<small>/mo</small></div><div className="u-fig-sub">plus <b>{money(weighted.setup)}</b> setup</div></div>
   <div className="u-fig"><span className="u-fig-k">Signed and live</span><div className="u-fig-v">{money(liveMrr)}<small>/mo</small></div><div className="u-fig-sub">{live.length} client{live.length===1?"":"s"}, {won.length} won all time</div></div>
  </div>

  {loading?<p className="u-note" role="status">Loading your pipeline…</p>
  :deals.length===0?<div className="u-void"><h2>No deals yet</h2><p>A deal starts when a call goes well. Book a meeting in Call mode and it shows up here, or add one by hand.</p><button className="u-btn u-btn-light" onClick={startNew}>New deal</button></div>
  :view==="board"?<>
   <div className={"pb-board"+(dragging?" is-dragging":"")}>{OPEN.map(st=>{const col=deals.filter(d=>d.stage===st);const sum=col.reduce((a,d)=>a+d.monthlyFee,0);return <div key={st} className={"pb-col"+(col.length?"":" is-empty")+(over===st?" is-over":"")} onDragOver={e=>{if(dragging){e.preventDefault();setOver(st)}}} onDragLeave={()=>setOver(o=>o===st?null:o)} onDrop={e=>{e.preventDefault();const d=deals.find(x=>x.id===(dragging||e.dataTransfer.getData("text/plain")));setDragging(null);setOver(null);if(d&&d.stage!==st){setDeals(ds=>ds.map(x=>x.id===d.id?{...x,stage:st}:x));void quickStage(d,st)}}}>
    <div className="pb-col-h"><span>{STAGE_LABELS[st]}</span><b>{col.length||""}</b></div>
    {col.length>0&&<div className="pb-col-sum u-num">{money(sum)}/mo</div>}
    <div className="pb-col-body">{col.map(card)}{!col.length&&<div className="pb-drop">Drop here</div>}</div>
   </div>})}
    <div className={"pb-col pb-col-end"+(over==="won"?" is-over":"")} onDragOver={e=>{if(dragging){e.preventDefault();setOver("won")}}} onDragLeave={()=>setOver(o=>o==="won"?null:o)} onDrop={e=>{e.preventDefault();const d=deals.find(x=>x.id===dragging);setDragging(null);setOver(null);if(d&&d.stage!=="won")void quickStage(d,"won")}}><div className="pb-col-h"><span>Won</span><b>{won.length||""}</b></div><div className="pb-drop">{dragging?"Drop to mark won":"Drag a deal here when they sign"}</div></div>
    <div className={"pb-col pb-col-end"+(over==="lost"?" is-over":"")} onDragOver={e=>{if(dragging){e.preventDefault();setOver("lost")}}} onDragLeave={()=>setOver(o=>o==="lost"?null:o)} onDrop={e=>{e.preventDefault();const d=deals.find(x=>x.id===dragging);setDragging(null);setOver(null);if(d&&d.stage!=="lost")void quickStage(d,"lost")}}><div className="pb-col-h"><span>Lost</span><b>{deals.filter(d=>d.stage==="lost").length||""}</b></div><div className="pb-drop">{dragging?"Drop to mark lost":"Dead deals land here"}</div></div>
   </div>
   <p className="u-note" style={{marginTop:14}}>Drag a deal to change its stage. Won, lost and nurture deals are in List.</p>
  </>:<>
   <div className="u-h2-row"><div className="u-seg" role="group" aria-label="Which deals">{([["open","Open"],["won","Won"],["lost","Lost"],["nurture","Nurture"]] as const).map(([k,l])=><button key={k} type="button" aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l} <span className="u-quiet">{k==="open"?active.filter(d=>d.stage!=="nurture").length:deals.filter(d=>d.stage===k).length}</span></button>)}</div></div>
   {listRows.length===0?<p className="u-note">Nothing here.</p>:<div className="u-tablewrap"><table className="u-table"><thead><tr><th>Business</th><th>Stage</th><th>Service</th><th>Close</th><th className="is-num">Monthly</th><th className="is-num">Setup</th><th/></tr></thead><tbody>
    {listRows.map(d=><tr key={d.id}>
     <td className="is-strong"><Link href={"/crm/deals/"+d.id}>{d.company||d.contactName||d.title}</Link></td>
     <td><select className="u-field pb-stage" aria-label={"Stage for "+d.title} value={d.stage} onChange={e=>void quickStage(d,e.target.value as Stage)}>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></td>
     <td>{svc(d.serviceType)}</td>
     <td className={late(d)?"pb-late":""}>{closeLabel(d)||"—"}</td>
     <td className="is-num is-strong">{money(d.monthlyFee)}</td><td className="is-num">{money(d.setupFee)}</td>
     <td style={{textAlign:"right",whiteSpace:"nowrap"}}>
      <button className="u-btn u-btn-bare" onClick={()=>startEdit(d)}>Edit</button>
      {d.stage==="won"&&<button className="u-btn" disabled={creatingProject===d.id} onClick={()=>void startDelivery(d)}>{creatingProject===d.id?"Checking…":projects.some(p=>p.dealId===d.id)?"Open delivery":"Start delivery"}</button>}
      {d.stage==="won"&&d.agreementStatus==="active"&&<button className="u-btn u-btn-bare" onClick={()=>void endAgreement(d)}>End agreement</button>}
     </td>
    </tr>)}
   </tbody></table></div>}
  </>}

  {show&&<div className="u-scrim" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShow(false)}}>
   <form className="u-dialog" style={{width:"min(620px,100%)",maxHeight:"calc(100vh - 36px)",overflowY:"auto"}} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="pb-form-title">
    <h3 id="pb-form-title">{editing?"Edit deal":"New deal"}</h3>
    <div className="pb-form">
     <label className="u-lab pb-full">Deal name<input className="u-field" required autoFocus maxLength={240} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Summit Fence, Book & Close"/></label>
     <label className="u-lab">Contact<select className="u-field" value={draft.contactId} onChange={e=>setDraft({...draft,contactId:e.target.value})}><option value="">None</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.company||c.name}{c.company?", "+c.name:""}</option>)}</select></label>
     <label className="u-lab">Offer<select className="u-field" value={draft.serviceType} onChange={e=>setDraft({...draft,serviceType:e.target.value,...(editing?{}:priced(e.target.value))})}>{services.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
     <label className="u-lab">Stage<select className="u-field" value={draft.stage} onChange={e=>setDraft({...draft,stage:e.target.value as Stage})}>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
     <label className="u-lab">Expected close<input className="u-field" type="date" value={draft.expectedCloseDate} onChange={e=>setDraft({...draft,expectedCloseDate:e.target.value})}/></label>
     <label className="u-lab">Setup fee<input className="u-field" type="number" min="0" step="0.01" value={draft.setupFee} onChange={e=>setDraft({...draft,setupFee:e.target.value})} placeholder="2500"/></label>
     <label className="u-lab">Monthly fee<input className="u-field" type="number" min="0" step="0.01" value={draft.monthlyFee} onChange={e=>setDraft({...draft,monthlyFee:e.target.value})} placeholder="1997"/></label>
     <label className="u-lab">Chance to close (%)<input className="u-field" type="number" min="0" max="100" step="1" placeholder={`Stage default ${Math.round((STAGE_PROBABILITY[draft.stage]??0)*100)}%`} value={draft.probability} onChange={e=>setDraft({...draft,probability:e.target.value})}/></label>
     <label className="u-lab">Where it came from<select className="u-field" value={draft.source} onChange={e=>setDraft({...draft,source:e.target.value})}><option value="">Choose</option>{(draft.source&&!SOURCE_CHOICES.includes(draft.source)?[draft.source,...SOURCE_CHOICES]:SOURCE_CHOICES).map(s=><option key={s} value={s}>{s}</option>)}</select></label>
     {draft.stage==="lost"&&<label className="u-lab pb-full">Why it was lost<input className="u-field" maxLength={1000} value={draft.lostReason} onChange={e=>setDraft({...draft,lostReason:e.target.value})} placeholder="Went with Angi, no budget until spring"/></label>}
     <label className="u-lab pb-full">Notes<textarea className="u-field" rows={3} maxLength={10000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Pain points, who decides, next step"/></label>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}><button type="button" className="u-btn" onClick={()=>setShow(false)}>Cancel</button><button type="submit" className="u-btn u-btn-light" disabled={busy}>{busy?"Saving…":editing?"Save changes":"Create deal"}</button></div>
   </form>
  </div>}
 </div>;
}
