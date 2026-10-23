"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ArtifactType = "prospect_research" | "call_brief" | "audit_prep" | "meeting_brief" | "follow_up_draft" | "proposal_draft";
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
const types:Record<ArtifactType,string>={prospect_research:"Prospect research",call_brief:"Call brief",audit_prep:"Free-audit prep",meeting_brief:"Meeting brief",follow_up_draft:"Follow-up draft",proposal_draft:"Proposal draft"};
const blank:Draft={contactId:"",dealId:"",calendarEventId:"",type:"prospect_research",title:"",sourceUrlsText:"",factsText:"",hypothesesText:"",confidence:"medium",content:"",status:"draft"};
const splitLines=(v:string)=>v.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const dayKey=(d:Date)=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const midnightIso=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString();
const dateLabel=(v:string|null|undefined)=>v?new Date(v).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"";
const inputStyle={width:"100%",padding:"10px 12px",border:"1px solid #dedbd4",borderRadius:9,background:"#fff",color:"#252522",font:"inherit",fontSize:13};
const fieldStyle={display:"grid",gap:6,fontSize:12,color:"#555",fontWeight:600} as const;
const buttonStyle={border:"1px solid #dedbd4",borderRadius:9,padding:"9px 12px",background:"#fff",color:"#292925",cursor:"pointer",font:"inherit",fontSize:12,fontWeight:600} as const;

export default function PreparationPage(){
 const [artifacts,setArtifacts]=useState<Artifact[]>([]);
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [deals,setDeals]=useState<Deal[]>([]);
 const [events,setEvents]=useState<CalendarEvent[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [filter,setFilter]=useState<"all"|ArtifactStatus>("all"),[query,setQuery]=useState("");
 const [editing,setEditing]=useState<string|null>(null),[showEditor,setShowEditor]=useState(false),[draft,setDraft]=useState<Draft>(blank);

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
   setArtifacts(Array.isArray(ad.artifacts)?ad.artifacts:[]);
   setContacts(Array.isArray(cd.contacts)?cd.contacts:[]);
   setDeals(Array.isArray(dd.deals)?dd.deals:[]);
   if(er.ok){const ed=await er.json();setEvents(Array.isArray(ed.events)?ed.events.filter((e:CalendarEvent)=>e.status==="scheduled"):[])}else setEvents([]);
  }catch(e){setError(e instanceof Error?e.message:"Could not load preparation workspace.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.get("proposal")!=="1"||deals.length===0)return;
  const dealId=params.get("dealId");
  const deal=deals.find(d=>d.id===dealId);
  if(!deal){setError("The selected deal could not be found in your pipeline.");return;}
  const content="PROPOSAL DRAFT — REVIEW BEFORE SHARING\\n\\nClient objective\\n[Describe the outcome the client wants. Confirm with the client.]\\n\\nCurrent gap / opportunity\\n[Document observed facts; distinguish assumptions.]\\n\\nRecommended scope\\n- [Deliverable 1]\\n- [Deliverable 2]\\n- [Deliverable 3]\\n\\nImplementation and timeline\\n[Milestones, dependencies, and client responsibilities.]\\n\\nInvestment\\nSetup fee: $"+deal.setupFee+"\\nRecurring fee: $"+deal.monthlyFee+" / month\\nTerms and exclusions: [Specify clearly.]\\n\\nSuccess measures\\n[Define how the result will be measured.]\\n\\nOpen questions / assumptions\\n[List anything not yet confirmed.]\\n\\nNext step\\n[Proposed review meeting or decision date.]\\n\\nThis is an internal draft. Pricing, scope, claims, and terms require human review. Nothing has been sent or accepted.";
  setEditing(null);setDraft({...blank,type:"proposal_draft",dealId:deal.id,contactId:deal.contactId||"",title:"Proposal draft — "+deal.title,content});setShowEditor(true);setError("");setNotice("Proposal draft started from "+deal.title+". Review all scope and pricing before sharing.");
  window.history.replaceState({},"",window.location.pathname);
 },[deals]);

 const visible=useMemo(()=>artifacts.filter(a=>(filter==="all"||a.status===filter)&&[a.title,a.content,a.contactName,a.company,a.dealTitle,a.eventTitle,a.type,...a.verifiedFacts,...a.hypotheses].join(" ").toLowerCase().includes(query.trim().toLowerCase())),[artifacts,filter,query]);
 const reviewed=artifacts.filter(a=>a.status==="reviewed").length;
 const drafts=artifacts.filter(a=>a.status==="draft").length;

 function newArtifact(type:ArtifactType="prospect_research"){
  setEditing(null);
  const proposalContent = type === "proposal_draft" ? "PROPOSAL DRAFT — REVIEW BEFORE SHARING\n\nClient objective\n[Describe the outcome the client wants. Confirm with the client.]\n\nCurrent gap / opportunity\n[Document observed facts; distinguish assumptions.]\n\nRecommended scope\n- [Deliverable 1]\n- [Deliverable 2]\n- [Deliverable 3]\n\nImplementation and timeline\n[Milestones, dependencies, and client responsibilities.]\n\nInvestment\nSetup fee: $[amount]\nRecurring fee: $[amount] / month\nTerms and exclusions: [Specify clearly.]\n\nSuccess measures\n[Define how the result will be measured.]\n\nOpen questions / assumptions\n[List anything not yet confirmed.]\n\nNext step\n[Proposed review meeting or decision date.]\n\nThis is an internal draft. Pricing, scope, claims, and terms require human review. Nothing has been sent or accepted." : "";
  setDraft({...blank,type,title:type==="proposal_draft"?"Proposal draft — ":"",content:proposalContent});setShowEditor(true);setError("");setNotice("");
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
 async function copyContent(a:Artifact){
  try{await navigator.clipboard.writeText(a.content);setNotice("Copied draft content. Nothing was sent.");}
  catch{setError("Clipboard access is unavailable. Open the artifact to copy its content manually.");}
 }

 return <main style={{maxWidth:1180,margin:"0 auto",padding:"28px 22px 56px",color:"#252522"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:18,flexWrap:"wrap"}}>
   <div><div style={{fontSize:10,letterSpacing:2,color:"#a95335",fontWeight:700}}>CINDER / PREPARATION</div><h1 style={{fontSize:"clamp(32px,5vw,46px)",letterSpacing:"-1.6px",margin:"8px 0"}}>Research & preparation<span style={{color:"#bd5a36"}}>.</span></h1><p style={{maxWidth:720,color:"#777",lineHeight:1.6,margin:0}}>Keep source-backed research, call briefs, meeting briefs, follow-up drafts, and reviewable proposal drafts connected to the right prospect, deal, or calendar event.</p></div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link href="/crm/outreach" style={{...buttonStyle,textDecoration:"none"}}>Outreach queue ↗</Link><Link href="/crm/calendar" style={{...buttonStyle,textDecoration:"none"}}>Calendar ↗</Link><button onClick={()=>newArtifact("proposal_draft")} style={buttonStyle}>＋ Proposal draft</button><button onClick={()=>newArtifact()} style={{...buttonStyle,background:"#282824",color:"#fff",borderColor:"#282824"}}>＋ New preparation</button></div>
  </header>
  <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,margin:"24px 0"}}>
   {[["TOTAL ARTIFACTS",artifacts.length,"Research and prep records"],["NEEDS REVIEW",drafts,"Drafts awaiting your review"],["REVIEWED",reviewed,"Approved for your own use"],["UPCOMING MEETINGS",events.filter(e=>e.type==="meeting").length,"Scheduled in the next 90 days"]].map(([label,value,sub])=><article key={String(label)} style={{border:"1px solid #e9e7e2",borderRadius:12,padding:16,background:"#fff"}}><small style={{display:"block",fontSize:10,letterSpacing:1.1,color:"#777"}}>{label}</small><strong style={{display:"block",fontSize:26,marginTop:10,fontWeight:600}}>{loading?"—":value}</strong><small style={{display:"block",marginTop:5,color:"#777"}}>{sub}</small></article>)}
  </section>
  <section style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
   <label style={{...fieldStyle,flex:"1 1 260px"}}><span>Search preparation</span><input style={inputStyle} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search titles, prospects, facts, or briefs…"/></label>
   <div style={{display:"flex",gap:6,flexWrap:"wrap",alignSelf:"end"}}>{(["all","draft","reviewed","archived"] as const).map(x=><button key={x} onClick={()=>setFilter(x)} style={{...buttonStyle,background:filter===x?"#282824":"#fff",color:filter===x?"#fff":"#444",borderColor:filter===x?"#282824":"#dedbd4"}}>{x==="all"?"All records":x.charAt(0).toUpperCase()+x.slice(1)}</button>)}</div>
  </section>
  {error&&<p role="alert" style={{padding:12,background:"#fff0ed",borderRadius:9,color:"#9b3526"}}>{error}</p>}
  {notice&&<p role="status" style={{padding:12,background:"#f3f5f0",borderRadius:9,color:"#3e6146"}}>{notice}</p>}
  {showEditor&&<section style={{border:"1px solid #d9d5cc",borderRadius:14,padding:18,background:"#fff",marginBottom:20}}>
   <header style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><h2 style={{fontSize:21,margin:"0 0 4px"}}>{editing?"Edit preparation record":"Create preparation record"}</h2><p style={{margin:0,fontSize:12,color:"#777"}}>Save as a draft first. Mark reviewed only after you verify the facts and sources.</p></div><button style={buttonStyle} type="button" onClick={()=>setShowEditor(false)}>Close</button></header>
   <form onSubmit={save} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14,marginTop:18}}>
    <label style={fieldStyle}>Artifact type<select style={inputStyle} value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value as ArtifactType})}>{Object.entries(types).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label style={fieldStyle}>Title<input required maxLength={240} style={inputStyle} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="e.g. Garage door company — first call brief"/></label>
    <label style={fieldStyle}>Linked contact<select style={inputStyle} value={draft.contactId} onChange={e=>setDraft({...draft,contactId:e.target.value})}><option value="">No linked contact</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}{c.company?" — "+c.company:""}</option>)}</select></label>
    <label style={fieldStyle}>Linked deal<select style={inputStyle} value={draft.dealId} onChange={e=>setDraft({...draft,dealId:e.target.value})}><option value="">No linked deal</option>{deals.map(d=><option key={d.id} value={d.id}>{d.title}{d.company?" — "+d.company:""}</option>)}</select></label>
    <label style={fieldStyle}>Linked upcoming calendar event<select style={inputStyle} value={draft.calendarEventId} onChange={e=>setDraft({...draft,calendarEventId:e.target.value})}><option value="">No linked event</option>{events.map(e=><option key={e.id} value={e.id}>{e.title} · {dateLabel(e.startsAt)}</option>)}</select></label>
    <label style={fieldStyle}>Confidence<select style={inputStyle} value={draft.confidence} onChange={e=>setDraft({...draft,confidence:e.target.value as Confidence})}><option value="low">Low — limited evidence</option><option value="medium">Medium — some evidence</option><option value="high">High — strong source evidence</option></select></label>
    <label style={{...fieldStyle,gridColumn:"1 / -1"}}>Source URLs (one per line)<textarea rows={3} style={inputStyle} value={draft.sourceUrlsText} onChange={e=>setDraft({...draft,sourceUrlsText:e.target.value})} placeholder="https://company.example/about"/></label>
    <label style={{...fieldStyle,gridColumn:"1 / -1"}}>Verified facts (one per line)<textarea rows={3} style={inputStyle} value={draft.factsText} onChange={e=>setDraft({...draft,factsText:e.target.value})} placeholder="Only facts directly supported by the sources above"/></label>
    <label style={{...fieldStyle,gridColumn:"1 / -1"}}>Hypotheses to test (one per line)<textarea rows={3} style={inputStyle} value={draft.hypothesesText} onChange={e=>setDraft({...draft,hypothesesText:e.target.value})} placeholder="Potential bottlenecks or angles — clearly label these as hypotheses"/></label>
    <label style={{...fieldStyle,gridColumn:"1 / -1"}}>Brief / draft content<textarea rows={7} maxLength={20000} style={{...inputStyle,resize:"vertical"}} value={draft.content} onChange={e=>setDraft({...draft,content:e.target.value})} placeholder="Opening, discovery questions, evidence, objections, agenda, next step, or draft follow-up. Keep it factual and editable."/></label>
    <div style={{gridColumn:"1 / -1",display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><small style={{color:"#777",maxWidth:650}}>Preparation only: this workspace never sends messages or places calls. Text outreach remains subject to the separate SMS-consent gate.</small><div style={{display:"flex",gap:8}}><button type="button" style={buttonStyle} onClick={()=>setShowEditor(false)}>Cancel</button><button disabled={saving} type="submit" style={{...buttonStyle,background:"#282824",color:"#fff",borderColor:"#282824",opacity:saving ? 0.65 : 1}}>{saving?"Saving…":"Save draft"}</button></div></div>
   </form>
  </section>}
  {loading?<p style={{padding:24,color:"#777"}}>Loading research and preparation…</p>:visible.length===0?<section style={{border:"1px dashed #d9d5cc",borderRadius:14,padding:30,textAlign:"center",background:"#fff"}}><h2 style={{marginTop:0}}>Nothing in this view yet</h2><p style={{color:"#777"}}>Create a research record, call brief, meeting brief, or internal proposal draft. Keep verified facts separate from hypotheses.</p><button style={{...buttonStyle,background:"#282824",color:"#fff"}} onClick={()=>newArtifact()}>＋ Create first record</button></section>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:12}}>
   {visible.map(a=><article key={a.id} style={{border:"1px solid #e9e7e2",borderRadius:13,padding:16,background:"#fff",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}><div><small style={{color:"#a95335",fontWeight:700,letterSpacing:1}}>{types[a.type].toUpperCase()}</small><h2 style={{fontSize:18,lineHeight:1.3,margin:"7px 0"}}>{a.title}</h2><p style={{fontSize:12,color:"#777",margin:0}}>{[a.contactName,a.company,a.dealTitle,a.eventTitle].filter(Boolean).join(" · ")||"Not linked to a CRM record"}</p></div><span style={{fontSize:10,border:"1px solid #e1ded7",borderRadius:999,padding:"5px 8px",whiteSpace:"nowrap"}}>{a.status}</span></div>
    {a.content&&<p style={{fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap",margin:0,color:"#444"}}>{a.content.length>700?a.content.slice(0,700)+"…":a.content}</p>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div style={{background:"#f7f6f2",borderRadius:9,padding:10}}><small style={{display:"block",color:"#777",fontSize:10,letterSpacing:.8}}>VERIFIED FACTS</small><strong style={{fontSize:18}}>{a.verifiedFacts.length}</strong><small style={{display:"block",color:"#777"}}>Recorded</small></div><div style={{background:"#f7f6f2",borderRadius:9,padding:10}}><small style={{display:"block",color:"#777",fontSize:10,letterSpacing:.8}}>SOURCES / CONFIDENCE</small><strong style={{fontSize:18}}>{a.sourceUrls.length} · {a.confidence}</strong><small style={{display:"block",color:"#777"}}>{a.hypotheses.length} hypotheses</small></div></div>
    {a.sourceUrls.length>0&&<div style={{display:"grid",gap:4}}><small style={{fontWeight:700,color:"#777",fontSize:10,letterSpacing:1}}>SOURCES</small>{a.sourceUrls.slice(0,3).map(url=><a key={url} href={url} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#8b4b33",overflowWrap:"anywhere"}}>{url}</a>)}{a.sourceUrls.length>3&&<small style={{color:"#777"}}>+{a.sourceUrls.length-3} more sources</small>}</div>}
    {a.verifiedFacts.length>0&&<div style={{display:"grid",gap:5}}><small style={{fontWeight:700,color:"#477252",fontSize:10,letterSpacing:1}}>VERIFIED FACTS</small><ul style={{margin:0,paddingLeft:18,fontSize:12,lineHeight:1.5,color:"#444"}}>{a.verifiedFacts.slice(0,3).map((fact,i)=><li key={i}>{fact}</li>)}</ul></div>}
    {a.hypotheses.length>0&&<div style={{display:"grid",gap:5}}><small style={{fontWeight:700,color:"#986c28",fontSize:10,letterSpacing:1}}>HYPOTHESES TO TEST</small><ul style={{margin:0,paddingLeft:18,fontSize:12,lineHeight:1.5,color:"#555"}}>{a.hypotheses.slice(0,3).map((hypothesis,i)=><li key={i}>{hypothesis}</li>)}</ul></div>}
    <div style={{fontSize:11,color:"#888"}}>Updated {dateLabel(a.updatedAt)}{a.researchedAt?" · Sources recorded "+dateLabel(a.researchedAt):" · No source URLs recorded yet"}</div>
    <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:"auto"}}><button style={buttonStyle} onClick={()=>editArtifact(a)}>Edit</button><button style={buttonStyle} onClick={()=>void copyContent(a)}>Copy content</button>{a.status==="draft"&&<button style={buttonStyle} onClick={()=>void changeStatus(a,"reviewed")}>Mark reviewed</button>}{a.status!=="archived"&&<button style={buttonStyle} onClick={()=>void changeStatus(a,"archived")}>Archive</button>}{a.status==="archived"&&<button style={buttonStyle} onClick={()=>void changeStatus(a,"draft")}>Restore draft</button>}</div>
   </article>)}
  </div>}
 </main>;
}
