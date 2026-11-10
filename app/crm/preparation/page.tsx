"use client";
import { reportSection } from "@/lib/business-audit";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./research.css";

type ArtifactType = "prospect_research" | "call_brief" | "audit_prep" | "meeting_brief" | "follow_up_draft" | "proposal";
type ArtifactStatus = "draft" | "reviewed" | "archived";
type Confidence = "low" | "medium" | "high";
type Artifact = {
  id:string; contactId:string|null; dealId:string|null; calendarEventId:string|null;
  type:ArtifactType; title:string; sourceUrls:string[]; verifiedFacts:string[]; hypotheses:string[];
  confidence:Confidence; content:string; status:ArtifactStatus; researchedAt:string|null;
  createdAt:string; updatedAt:string; contactName:string; company:string; dealTitle:string;
  eventTitle:string; eventStartsAt:string|null;
};
type Contact = {id:string;name:string;company:string};
type Deal = {id:string;title:string;contactName:string;company:string;stage:string};
type CalendarEvent = {id:string;title:string;startsAt:string;status:string;type:string;contactId:string|null;dealId:string|null};
type Draft = {contactId:string;dealId:string;calendarEventId:string;type:ArtifactType;title:string;sourceUrlsText:string;factsText:string;hypothesesText:string;confidence:Confidence;content:string;status:ArtifactStatus};
const types:Record<ArtifactType,string>={prospect_research:"Prospect research",call_brief:"Call brief",audit_prep:"Business audit",meeting_brief:"Meeting brief",follow_up_draft:"Follow-up draft",proposal:"Proposal"};
const blank:Draft={contactId:"",dealId:"",calendarEventId:"",type:"prospect_research",title:"",sourceUrlsText:"",factsText:"",hypothesesText:"",confidence:"medium",content:"",status:"draft"};
const splitLines=(v:string)=>v.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const dayKey=(d:Date)=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const midnightIso=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString();
const dateLabel=(v:string|null|undefined)=>v?new Date(v).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"";

export default function PreparationPage(){
 const searchParams=useSearchParams();
 const prefillHandled=useRef(false);
 const prefillEventId=searchParams.get("event")||"";
 const prefillContactId=searchParams.get("contact")||"";
 const prefillType=(searchParams.get("type")||"") as ArtifactType;
 const [artifacts,setArtifacts]=useState<Artifact[]>([]);
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [deals,setDeals]=useState<Deal[]>([]);
 const [events,setEvents]=useState<CalendarEvent[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [filter,setFilter]=useState<"all"|ArtifactStatus>("all"),[query,setQuery]=useState("");
 const [editing,setEditing]=useState<string|null>(null),[showEditor,setShowEditor]=useState(false),[draft,setDraft]=useState<Draft>(blank),[picked,setPicked]=useState<string|null>(null);

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const now=new Date(),from=dayKey(now),toDate=new Date(now);toDate.setDate(toDate.getDate()+90);const to=dayKey(toDate);
   const range="/api/calendar-events?from="+from+"&to="+to+"&fromAt="+encodeURIComponent(midnightIso(now))+"&toAt="+encodeURIComponent(midnightIso(toDate));
   const [ar,cr,dr,er]=await Promise.all([
    fetch("/api/research-artifacts",{cache:"no-store"}),fetch("/api/contacts",{cache:"no-store"}),
    fetch("/api/deals",{cache:"no-store"}),fetch(range,{cache:"no-store"})
   ]);
   if(ar.status===401||cr.status===401||dr.status===401)throw new Error("Sign in to use Preparation.");
   if(!ar.ok||!cr.ok||!dr.ok)throw new Error("Could not load preparation records. Check your workspace connection.");
   const [ad,cd,dd]=await Promise.all([ar.json(),cr.json(),dr.json()]);
   setArtifacts(Array.isArray(ad.artifacts)?ad.artifacts.filter((x:{type:string})=>x.type!=="agreement"&&x.type!=="proposal"):[]);
   setContacts(Array.isArray(cd.contacts)?cd.contacts:[]);
   setDeals(Array.isArray(dd.deals)?dd.deals:[]);
   if(er.ok){const ed=await er.json();setEvents(Array.isArray(ed.events)?ed.events.filter((e:CalendarEvent)=>e.status==="scheduled"):[])}else setEvents([]);
  }catch(e){setError(e instanceof Error?e.message:"Could not load preparation workspace.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{const art=new URLSearchParams(window.location.search).get("artifact");if(art&&/^[0-9a-f-]{36}$/i.test(art)){window.location.replace("/crm/audits/"+art);return}void load()},[load]);

 useEffect(()=>{
  if(prefillHandled.current||loading||(!prefillEventId&&!prefillContactId))return;
  const allowedTypes:ArtifactType[]=["prospect_research","call_brief","audit_prep","meeting_brief","follow_up_draft"];
  const type=allowedTypes.includes(prefillType)?prefillType:(prefillEventId?"meeting_brief":"call_brief");
  const event=events.find(e=>e.id===prefillEventId);
  const contact=contacts.find(c=>c.id===prefillContactId)||contacts.find(c=>c.id===event?.contactId);
  if(prefillEventId&&!event)return;
  prefillHandled.current=true;
  const title=type==="meeting_brief"&&event?"Meeting brief — "+event.title:type==="call_brief"&&contact?"Call brief — "+(contact.company||contact.name):type==="prospect_research"&&contact?"Prospect research — "+(contact.company||contact.name):"New preparation brief";
  const template=type==="meeting_brief"
   ? "MEETING OBJECTIVE\n- What outcome should this meeting produce?\n\nCONTEXT TO VERIFY\n- What do we know from saved, source-backed research?\n- What is still an assumption?\n\nAGENDA\n1. Confirm their current process and goals\n2. Quantify the business impact of the problem\n3. Explore fit, constraints, and decision process\n4. Agree on a clear next step\n\nDISCOVERY QUESTIONS\n- How are new leads handled today?\n- Where do opportunities get delayed or lost?\n- What would improving this be worth?\n- Who else is involved in the decision?\n\nNEXT STEP\n- Record owner, action, and date."
   : type==="call_brief"
   ? "CALL OBJECTIVE\n- Secure a relevant 20–30 minute meeting; do not try to close on the first cold call.\n\nOPENING\n- Introduce yourself and the reason for the call in one sentence.\n- Ask one relevant question tied to a verified fact.\n\nDISCOVERY\n- How do new inquiries get handled today?\n- What happens when a lead does not answer or book?\n- Is this an active priority?\n\nHYPOTHESES TO TEST\n- Keep unverified pain points labelled as hypotheses.\n\nNEXT STEP\n- Log the result and schedule a specific follow-up if needed."
   : "RESEARCH GOAL\n- Identify the decision maker, service focus, and relevant operational context.\n\nVERIFIED FACTS\n- Add only facts supported by the source URLs below.\n\nHYPOTHESES TO TEST\n- Label possible bottlenecks as hypotheses, not facts.\n\nNEXT ACTION\n- Define a relevant call opener and one clear meeting objective.";
  setEditing(null);
  setDraft({...blank,type,title,contactId:contact?.id||prefillContactId,dealId:event?.dealId||"",calendarEventId:event?.id||"",content:template});
  setShowEditor(true);
  setError("");
  setNotice("");
 },[loading,prefillEventId,prefillContactId,prefillType,events,contacts]);

 const visible=useMemo(()=>artifacts.filter(a=>(filter==="all"||a.status===filter)&&[a.title,a.content,a.contactName,a.company,a.dealTitle,a.eventTitle,a.type,...a.verifiedFacts,...a.hypotheses].join(" ").toLowerCase().includes(query.trim().toLowerCase())),[artifacts,filter,query]);
 const reviewed=artifacts.filter(a=>a.status==="reviewed").length;
 const drafts=artifacts.filter(a=>a.status==="draft").length;

 function newArtifact(type:ArtifactType="prospect_research"){
  setEditing(null);setDraft({...blank,type});setShowEditor(true);setError("");setNotice("");
 }
 function editArtifact(a:Artifact){
  setEditing(a.id);setDraft({contactId:a.contactId||"",dealId:a.dealId||"",calendarEventId:a.calendarEventId||"",type:a.type,title:a.title,sourceUrlsText:a.sourceUrls.join("\n"),factsText:a.verifiedFacts.join("\n"),hypothesesText:a.hypotheses.join("\n"),confidence:a.confidence,content:a.content,status:a.status});
  setShowEditor(true);setError("");setNotice("");
 }
 function payload(d:Draft){
  return {contactId:d.contactId||null,dealId:d.dealId||null,calendarEventId:d.calendarEventId||null,type:d.type,title:d.title.trim(),sourceUrls:splitLines(d.sourceUrlsText),verifiedFacts:splitLines(d.factsText),hypotheses:splitLines(d.hypothesesText),confidence:d.confidence,content:d.content,status:d.status};
 }
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!draft.title.trim())return;
  setSaving(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/research-artifacts",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload(draft),...(editing?{id:editing}:{})})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Could not save preparation record.");
   setNotice(editing?"Preparation record updated.":"Preparation record saved as a draft.");
   setShowEditor(false);setEditing(null);setDraft(blank);await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not save preparation record.");}
  finally{setSaving(false);}
 }
 async function changeStatus(a:Artifact,status:ArtifactStatus){
  setError("");setNotice("");
  try{
   const response=await fetch("/api/research-artifacts",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:a.id,contactId:a.contactId,dealId:a.dealId,calendarEventId:a.calendarEventId,type:a.type,title:a.title,sourceUrls:a.sourceUrls,verifiedFacts:a.verifiedFacts,hypotheses:a.hypotheses,confidence:a.confidence,content:a.content,status})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Could not update status.");
   setNotice(status==="reviewed"?"Marked reviewed.":"Moved to archive.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not update status.");}
 }
 async function createDealFromBrief(a:Artifact){
  if(!a.contactId){setError("Link a contact to this brief before creating a deal.");return;}
  setError("");setNotice("");
  try{
   const title=(a.company||a.contactName||a.title.replace(/^(Meeting brief|Call brief|Prospect research)\s*[—-]\s*/i,"")).trim().slice(0,240)||"New opportunity";
   const response=await fetch("/api/deals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,contactId:a.contactId,serviceType:"custom_ai_implementation",stage:"qualified",setupFee:0,monthlyFee:0,source:"Cinder meeting preparation",notes:"Created from preparation brief: "+a.title+"\n\n"+a.content.slice(0,8500)})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||typeof data.id!=="string")throw new Error(data.error||"Could not create a deal.");
   const linked=await fetch("/api/research-artifacts",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:a.id,contactId:a.contactId,dealId:data.id,calendarEventId:a.calendarEventId,type:a.type,title:a.title,sourceUrls:a.sourceUrls,verifiedFacts:a.verifiedFacts,hypotheses:a.hypotheses,confidence:a.confidence,content:a.content,status:a.status})});
   if(!linked.ok){const linkData=await linked.json().catch(()=>({}));setNotice("Deal created in Qualified. Brief link needs repair: "+(linkData.error||"open the brief and link the new deal manually."));await load();return;}
   setNotice("Deal created in Qualified and linked to this brief. Add real pricing after discovery; nothing was marked won.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not create a deal from this brief.");}
 }
 async function copyContent(a:Artifact){
  try{await navigator.clipboard.writeText(a.content);setNotice("Copied draft content. Nothing was sent.");}
  catch{setError("Clipboard access is unavailable. Open the artifact to copy its content manually.");}
 }

 const chosen=visible.find(a=>a.id===picked)??visible[0];
 const set=(k:keyof Draft)=>(e:{target:{value:string}})=>setDraft({...draft,[k]:e.target.value});
 const blocks=(text:string)=>text.replace(/\*\*|__|`/g,"").split(/\n{2,}/).map(b=>b.trim()).filter(Boolean);
 const isHead=(line:string)=>/^#{1,6}\s/.test(line)||(/^[A-Z][A-Z0-9 &/,'()-]{3,}$/.test(line.trim())&&line.trim().length<60);
 return <div className="u-page rs-page" role="region" aria-label="Research">
  <div className="u-head">
   <h1 className="u-title">Research</h1>
   <div className="u-head-actions"><button className="u-btn u-btn-bare" onClick={()=>newArtifact("call_brief")}>Write a brief</button><Link className="u-btn u-btn-light" href="/crm/audit">Research a business</Link></div>
  </div>
  {error&&<p className="u-flash is-bad" role="alert" style={{marginBottom:16}}>{error}</p>}
  {notice&&<p className="u-flash" role="status" style={{marginBottom:16}}>{notice}</p>}

  {loading?<p className="u-note" role="status">Loading…</p>:artifacts.length===0?<div className="u-void"><h2>Nothing researched yet</h2><p>Research a business before you call and Cinder reads their website, reviews and listings, then writes a one-page brief: where they lose jobs, how to open the call, what to watch for. It shows up in Call mode when you dial them.</p><Link className="u-btn u-btn-light" href="/crm/audit">Research a business</Link></div>
  :<div className="rs-split">
   <div>
    <div className="rs-bar">
     <div className="u-seg" role="group" aria-label="Show">{(["all","draft","reviewed","archived"] as const).map(x=><button key={x} type="button" aria-pressed={filter===x} onClick={()=>setFilter(x)}>{x==="all"?"All":x==="draft"?`To review ${drafts}`:x==="reviewed"?`Reviewed ${reviewed}`:"Archived"}</button>)}</div>
     <input className="u-field" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search" aria-label="Search research"/>
    </div>
    {visible.length===0?<p className="u-note">Nothing in this view.</p>:<div className="u-rows">{visible.map(a=><button key={a.id} type="button" className={"u-row rs-item"+(chosen?.id===a.id?" is-on":"")} onClick={()=>setPicked(a.id)}>
     <div className="u-row-main"><strong>{a.company||a.contactName||a.title}</strong><span>{types[a.type]??a.type}, {new Date(a.updatedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span></div>
     <span className={"u-mark"+(a.status==="reviewed"?" is-good":"")}>{a.status==="draft"?"To review":a.status==="reviewed"?"Reviewed":"Archived"}</span>
    </button>)}</div>}
   </div>

   {chosen&&<article className="rs-read">
    <p className="u-note">{types[chosen.type]??chosen.type}{chosen.confidence?`, ${chosen.confidence} confidence`:""}{chosen.type==="audit_prep"?", written by AI, verify before quoting":""}</p>
    <h2 className="rs-title">{chosen.company||chosen.contactName||chosen.title}</h2>
    <p className="rs-linked">{[chosen.company&&chosen.contactName?chosen.contactName:"",chosen.dealTitle,chosen.eventTitle?`${chosen.eventTitle}${chosen.eventStartsAt?", "+dateLabel(chosen.eventStartsAt):""}`:""].filter(Boolean).join(" · ")||chosen.title}</p>
    <div className="rs-acts">
     {chosen.type==="audit_prep"&&<Link className="u-btn u-btn-light" href={"/crm/audits/"+chosen.id}>Open full report</Link>}
     {chosen.contactId&&<Link className="u-btn" href={`/crm?contact=${chosen.contactId}`}>Open contact</Link>}
     {chosen.status==="draft"&&<button className="u-btn" onClick={()=>void changeStatus(chosen,"reviewed")}>Mark reviewed</button>}
     <button className="u-btn u-btn-bare" onClick={()=>editArtifact(chosen)}>Edit</button>
     <button className="u-btn u-btn-bare" onClick={()=>void copyContent(chosen)}>Copy</button>
     {chosen.contactId&&!chosen.dealId&&["meeting_brief","call_brief","follow_up_draft"].includes(chosen.type)&&<button className="u-btn u-btn-bare" onClick={()=>void createDealFromBrief(chosen)}>Create deal</button>}
     {chosen.status!=="archived"?<button className="u-btn u-btn-bare" onClick={()=>void changeStatus(chosen,"archived")}>Archive</button>:<button className="u-btn u-btn-bare" onClick={()=>void changeStatus(chosen,"draft")}>Restore</button>}
    </div>
    {chosen.type==="audit_prep"&&reportSection(chosen.content,"Verdict")?<>
     <p className="rs-verdict">{reportSection(chosen.content,"Verdict").replace(/\*\*/g,"").replace(/^[-*•]\s+/gm,"")}</p>
     {(["Call plan","Scorecard","Top opportunities","Red flags","Next CRM action"] as const).map(h=>{const v=reportSection(chosen.content,h);if(!v)return null;const lines=v.split("\n").map(l=>l.replace(/\*\*/g,"").replace(/^[-*•]\s+|^\d+[.)]\s+/,"").trim()).filter(Boolean);return <section key={h} className="rs-sec"><h3>{h==="Call plan"?"How to run the call":h==="Scorecard"?"Scorecard":h==="Top opportunities"?"Where they're losing jobs":h==="Red flags"?"Watch out for":"Next step"}</h3><ul>{lines.map((l,i)=><li key={i}>{l}</li>)}</ul></section>})}
    </>:<div className="rs-body">{blocks(chosen.content).map((b,i)=>{const lines=b.split("\n");return isHead(lines[0])?<section key={i} className="rs-sec"><h3>{lines[0].replace(/^#{1,6}\s+/,"").toLowerCase().replace(/^./,c=>c.toUpperCase())}</h3>{lines.length>1&&<ul>{lines.slice(1).map((l,j)=><li key={j}>{l.replace(/^\s*[-*•]\s+|^\d+[.)]\s+/,"")}</li>)}</ul>}</section>:<p key={i}>{b}</p>})}</div>}
    {(chosen.verifiedFacts.length>0||chosen.hypotheses.length>0)&&<div className="rs-two">
     {chosen.verifiedFacts.length>0&&<section className="rs-sec"><h3>Verified</h3><ul>{chosen.verifiedFacts.map((f,i)=><li key={i}>{f}</li>)}</ul></section>}
     {chosen.hypotheses.length>0&&<section className="rs-sec"><h3>Still a guess</h3><ul>{chosen.hypotheses.map((f,i)=><li key={i}>{f}</li>)}</ul></section>}
    </div>}
    {chosen.sourceUrls.length>0&&<section className="rs-sec"><h3>Sources</h3><ul className="rs-src">{chosen.sourceUrls.map(u=><li key={u}><a href={u} target="_blank" rel="noreferrer">{u.replace(/^https?:\/\/(www\.)?/,"")}</a></li>)}</ul></section>}
    <p className="u-note" style={{marginTop:22}}>Updated {dateLabel(chosen.updatedAt)}</p>
   </article>}
  </div>}

  {showEditor&&<div className="u-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setShowEditor(false)}}>
   <form className="u-dialog" style={{width:"min(720px,100%)",maxHeight:"calc(100vh - 36px)",overflowY:"auto"}} onSubmit={save} role="dialog" aria-modal="true" aria-label={editing?"Edit brief":"New brief"}>
    <h3>{editing?"Edit brief":"New brief"}</h3>
    <div className="rs-form">
     <label className="u-lab">Kind<select className="u-field" value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value as ArtifactType})}>{Object.entries(types).filter(([v])=>v!=="proposal").map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     <label className="u-lab">Title<input className="u-field" required maxLength={240} value={draft.title} onChange={set("title")} placeholder="Ridgeline Fence, first call"/></label>
     <label className="u-lab">Contact<select className="u-field" value={draft.contactId} onChange={set("contactId")}><option value="">None</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.company||c.name}</option>)}</select></label>
     <label className="u-lab">Deal<select className="u-field" value={draft.dealId} onChange={set("dealId")}><option value="">None</option>{deals.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
     <label className="u-lab">Meeting<select className="u-field" value={draft.calendarEventId} onChange={set("calendarEventId")}><option value="">None</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}, {dateLabel(e.startsAt)}</option>)}</select></label>
     <label className="u-lab">How sure are you<select className="u-field" value={draft.confidence} onChange={e=>setDraft({...draft,confidence:e.target.value as Confidence})}><option value="low">Low, little to go on</option><option value="medium">Medium, some evidence</option><option value="high">High, solid sources</option></select></label>
     <label className="u-lab rs-full">The brief<textarea className="u-field" rows={9} maxLength={20000} value={draft.content} onChange={set("content")} placeholder="Opener, questions to ask, what you know, next step"/></label>
     <label className="u-lab rs-full">Verified facts, one per line<textarea className="u-field" rows={3} value={draft.factsText} onChange={set("factsText")} placeholder="Only what a source backs up"/></label>
     <label className="u-lab rs-full">Guesses to test, one per line<textarea className="u-field" rows={3} value={draft.hypothesesText} onChange={set("hypothesesText")} placeholder="Probably misses calls on weekends"/></label>
     <label className="u-lab rs-full">Sources, one per line<textarea className="u-field" rows={2} value={draft.sourceUrlsText} onChange={set("sourceUrlsText")} placeholder="https://"/></label>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}><button type="button" className="u-btn" onClick={()=>setShowEditor(false)}>Cancel</button><button type="submit" className="u-btn u-btn-light" disabled={saving}>{saving?"Saving…":"Save"}</button></div>
   </form>
  </div>}
 </div>;
}
