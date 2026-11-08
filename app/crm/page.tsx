"use client";
import ContactDeals from "./contact-deals";
import ProspectReportCard from "./prospect-report-card";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { reportSection } from "@/lib/business-audit";
import { CALL_MODE_GROUPS, OUTCOME_LABELS, type CallOutcome } from "@/lib/call-outcomes";
import SuggestedDeal, { type SuggestedDealData } from "../suggested-deal";
import "./crm.css";
import "./contacts.css";
import ImportModal from "./import-modal";
import InfoKit from "./info-kit";
import DiscoveryPanel from "./discovery-panel";
import TextDraft, { type TextContext } from "./text-draft";
type Contact={id:string;name:string;company:string;role:string;email:string;phone:string;website:string;instagram:string;facebook:string;linkedin?:string;niche?:string;location:string;timeZone:string;status:"Lead"|"Contact"|"Customer"|"Partner";source:string;lastContact:string;lastTouchAt?:string;lastTouchOutcome?:string;nextFollowUp:string;notes:string;createdAt:string};
type Activity={id:string;contact_id:string;channel:"call"|"text"|"note";action:string;outcome:string;notes:string;sequence_step:number|null;occurred_at:string};
const KEY="cinder.crm.contacts.v1";
const blank={name:"",company:"",role:"",email:"",phone:"",website:"",instagram:"",facebook:"",linkedin:"",location:"",timeZone:"",status:"Lead" as Contact["status"],source:"",lastContact:"",nextFollowUp:"",notes:""};
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const localDay=(iso:string)=>{const d=new Date(iso);return Number.isNaN(d.getTime())?"":d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const touchedToday=(c:Contact)=>!!c.lastTouchAt&&localDay(c.lastTouchAt)===today();
const outcomeText=(o?:string)=>{const t=String(o||"").replaceAll("_"," ").trim();return t?t.charAt(0).toUpperCase()+t.slice(1):"Logged";};
const timeText=(iso:string)=>{const d=new Date(iso);return Number.isNaN(d.getTime())?"":d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});};
const dateLabel=(v:string)=>v?new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?v+"T12:00:00":v).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"—";

export default function ContactsPage(){
 const [contacts,setContacts]=useState<Contact[]>([]),[loaded,setLoaded]=useState(false),[query,setQuery]=useState(""),[filter,setFilter]=useState("Not called today"),[show,setShow]=useState(false),[selected,setSelected]=useState<string|null>(null),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState(blank),[saved,setSaved]=useState(true),[activities,setActivities]=useState<Activity[]>([]),[activityLoading,setActivityLoading]=useState(false),[showImport,setShowImport]=useState(false),[sheet,setSheet]=useState(false),[sortBy,setSortBy]=useState<"list"|"followup"|"name">("list");
 useEffect(()=>{const p=new URLSearchParams(window.location.search);const q=p.get("q");if(q)setQuery(q.slice(0,200));const c=p.get("contact");if(c&&/^[0-9a-f-]{36}$/i.test(c)){setSelected(c);setSheet(true)}if(p.get("new")==="1"){setDraft(blank);setEditing(null);setShow(true)}},[]);
 useEffect(()=>{let active=true;fetch("/api/contacts",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Could not load contacts");return r.json()}).then(data=>{if(active)setContacts(Array.isArray(data.contacts)?data.contacts:[]);if(active)setSaved(true)}).catch(()=>{if(active)setSaved(false)}).finally(()=>{if(active)setLoaded(true)});return()=>{active=false}},[]);
 const [outcomeNote,setOutcomeNote]=useState(""),[outcomeBusy,setOutcomeBusy]=useState<CallOutcome|null>(null),[outcomeResult,setOutcomeResult]=useState<{ok:boolean;text:string;deal?:SuggestedDealData|null;textCtx?:TextContext|null;contactId?:string;who?:string}|null>(null),[callFor,setCallFor]=useState<string|null>(null);
 useEffect(()=>{setOutcomeNote("");setOutcomeResult(null)},[selected]);
 async function logOutcome(contact:Contact,outcome:CallOutcome){
  if(outcome==="do_not_contact"&&!confirm("Mark "+contact.name+" do not contact? This stops all outreach and suppresses the number and email."))return;
  setOutcomeBusy(outcome);setOutcomeResult(null);
  try{
   const r=await fetch("/api/contacts/outcome",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contactId:contact.id,outcome,notes:outcomeNote})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(data.error||"Could not log this outcome.");
   const parts=["Logged: "+data.label];
   parts.push(data.nextFollowUp?"follow-up "+dateLabel(data.nextFollowUp):"follow-up cleared");
   if(data.sequenceStopped)parts.push("sequence stopped");
   if(data.suppressed)parts.push("suppressed");
   for(const d of data.deals||[])parts.push("“"+d.title+"” → "+d.to);
   setOutcomeResult({ok:true,text:parts.join(" · "),deal:data.suggestedDeal||null,textCtx:data.text&&(data.text.template||data.text.notice||data.text.tasks?.length||data.text.closed)?data.text:null,contactId:contact.id,who:contact.company||contact.name});setOutcomeNote("");setCallFor(null);
   if(data.activity)setActivities(old=>[data.activity,...old.filter(a=>a.id!==data.activity.id)].slice(0,100));
   setContacts(old=>old.map(c=>c.id===contact.id?{...c,nextFollowUp:data.nextFollowUp||"",lastContact:new Date().toISOString(),lastTouchAt:new Date().toISOString(),lastTouchOutcome:outcome}:c));
  }catch(e){setOutcomeResult({ok:false,text:e instanceof Error?e.message:"Could not log this outcome."})}
  finally{setOutcomeBusy(null)}
 }
 const [latestAudit,setLatestAudit]=useState<{id:string;title:string;content:string;confidence:string;createdAt:string}|null>(null),[auditLoading,setAuditLoading]=useState(false);
 useEffect(()=>{if(!selected){setLatestAudit(null);return}let active=true;setAuditLoading(true);fetch("/api/research-artifacts?type=audit_prep&contactId="+encodeURIComponent(selected),{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Could not load audits");return r.json()}).then(data=>{const list=Array.isArray(data.artifacts)?data.artifacts.filter((a:{status:string})=>a.status!=="archived"):[];list.sort((a:{createdAt:string},b:{createdAt:string})=>String(b.createdAt).localeCompare(String(a.createdAt)));if(active)setLatestAudit(list[0]??null)}).catch(()=>{if(active)setLatestAudit(null)}).finally(()=>{if(active)setAuditLoading(false)});return()=>{active=false}},[selected]);
 useEffect(()=>{if(!selected){setActivities([]);return}let active=true;setActivityLoading(true);fetch("/api/call-logs?contactId="+encodeURIComponent(selected),{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Could not load activity");return r.json()}).then(data=>{if(active)setActivities(Array.isArray(data.activities)?data.activities:[])}).catch(()=>{if(active)setActivities([])}).finally(()=>{if(active)setActivityLoading(false)});return()=>{active=false}},[selected]);
 async function logActivity(contact:Contact){try{const response=await fetch("/api/call-logs",{method:"POST",keepalive:true,headers:{"Content-Type":"application/json"},body:JSON.stringify({contactId:contact.id,channel:"call",action:"outbound_call",outcome:"initiated",notes:"Call launched from Cinder CRM."})});if(!response.ok)return;const data=await response.json();if(selected===contact.id&&data.activity)setActivities(old=>[data.activity,...old].slice(0,100))}catch{/* Call launch should not be blocked by activity logging. */}}
 function callContact(contact:Contact){if(!contact.phone)return;if(touchedToday(contact)&&!confirm("You already called "+contact.name+" today at "+timeText(contact.lastTouchAt||"")+" ("+outcomeText(contact.lastTouchOutcome).toLowerCase()+"). Call again?"))return;void logActivity(contact);setSelected(contact.id);setCallFor(contact.id);window.location.href="tel:"+contact.phone.replace(/[^+\d]/g,"")}
 const visible=useMemo(()=>contacts.filter(c=>(filter==="All contacts"||c.status===filter||(filter==="Not called today"&&(!touchedToday(c)||c.id===selected))||(filter==="Called today"&&touchedToday(c))||(filter==="Missing phone & email"&&!c.phone&&!c.email))&&[c.name,c.company,c.role,c.email,c.phone,c.notes].join(" ").toLowerCase().includes(query.toLowerCase().trim())).sort((a,b)=>sortBy==="followup"?((a.nextFollowUp||"9999").localeCompare(b.nextFollowUp||"9999")||a.createdAt.localeCompare(b.createdAt)):sortBy==="name"?a.name.localeCompare(b.name):(a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))),[contacts,filter,query,sortBy,selected]);
 const current=contacts.find(c=>c.id===selected);
 const idx=current?visible.findIndex(c=>c.id===current.id):-1,nextContact=idx>=0?visible[idx+1]:undefined,prevContact=idx>0?visible[idx-1]:undefined;
 const go=(c?:Contact)=>{if(!c)return;setSelected(c.id);setSheet(true);setTimeout(()=>{document.querySelector(".ct-table tr.is-on")?.scrollIntoView({block:"nearest"});document.querySelector(".ct-drawer")?.scrollTo({top:0})},0)};
 useEffect(()=>{if(!sheet)return;const k=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!(e.target as HTMLElement)?.closest?.("input,textarea,select"))setSheet(false)};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[sheet]);
 const calledToday=contacts.filter(touchedToday).length;
 const due=contacts.filter(c=>c.nextFollowUp&&c.nextFollowUp<=today()).length;
 function add(){setDraft(blank);setEditing(null);setShow(true)}
 function edit(c:Contact){const {id,createdAt,...fields}=c;setDraft({...fields,linkedin:fields.linkedin??""});setEditing(id);setShow(true)}
 async function save(e:React.FormEvent){e.preventDefault();if(!draft.name.trim())return;setSaved(false);try{const send=(allowDuplicate:boolean)=>fetch("/api/contacts",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,name:draft.name.trim(),...(editing?{id:editing}:{}),...(allowDuplicate?{allowDuplicate:true}:{})})});let response=await send(false);if(response.status===409&&!editing){const dup=await response.json().catch(()=>({}));if(dup.duplicateId){if(confirm(`${dup.duplicateName||"This person"} is already in Cinder (same ${dup.matchedOn||"email or phone"}). Open that contact instead?\n\nCancel adds a separate contact anyway.`)){setSelected(dup.duplicateId);setShow(false);return}response=await send(true)}}if(!response.ok)throw new Error("Save failed");const result=await response.json();const id=editing||result.id;const listResponse=await fetch("/api/contacts",{cache:"no-store"});if(!listResponse.ok)throw new Error("Could not refresh contacts");const data=await listResponse.json();setContacts(data.contacts||[]);setSelected(id||null);setSaved(true);setShow(false)}catch{setSaved(false);alert("Could not save this contact. Check that you are signed in and try again.")}}
 function exportCsv(){const cols:(keyof Contact)[]=["name","company","role","email","phone","website","instagram","facebook","location","status","source","lastContact","nextFollowUp","notes","createdAt"];const q=(v:unknown)=>'"'+String(v??"").replaceAll('"','""')+'"';const csv=[cols.join(","),...contacts.map(c=>cols.map(k=>q(c[k])).join(","))].join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="cinder-contacts.csv";a.click();URL.revokeObjectURL(url)}

 const counts={todo:contacts.filter(c=>!touchedToday(c)).length,called:calledToday,due,all:contacts.length};
 const FILTERS:[string,string,number|null][]=[["Not called today","To call",counts.todo],["Follow-ups due","Follow-ups due",counts.due],["Called today","Called today",counts.called],["All contacts","Everyone",counts.all]];
 const rows=filter==="Follow-ups due"?contacts.filter(c=>c.nextFollowUp&&c.nextFollowUp<=today()&&[c.name,c.company,c.role,c.email,c.phone,c.notes].join(" ").toLowerCase().includes(query.toLowerCase().trim())).sort((a,b)=>a.nextFollowUp.localeCompare(b.nextFollowUp)):visible;
 const open=(c:Contact)=>{setSelected(c.id);setSheet(true)};
 const href=(v:string,base="")=>v.startsWith("http")?v:"https://"+base+v.replace(/^@/,"");
 return <div className="u-page ct-page" role="region" aria-label="Contacts">
  <div className="u-head">
   <h1 className="u-title">Contacts</h1>
   <div className="u-head-actions">
    <button className="u-btn u-btn-bare" onClick={exportCsv} disabled={!contacts.length}>Export</button>
    <button className="u-btn" onClick={()=>setShowImport(true)}>Import</button>
    <button className="u-btn u-btn-light" onClick={add}>Add contact</button>
   </div>
  </div>
  {loaded&&!saved&&<p className="u-flash is-bad" role="alert" style={{marginBottom:18}}>Couldn&apos;t reach your workspace. Changes may not save. Refresh to retry.</p>}

  <div className="ct-bar">
   <div className="u-seg" role="group" aria-label="Show">{FILTERS.map(([v,l,n])=><button key={v} type="button" aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}{n!=null&&<span className="ct-n">{n}</span>}</button>)}</div>
   <input className="u-field ct-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, company, phone, notes" aria-label="Search contacts"/>
   <select className="u-field ct-sort" value={["Lead","Contact","Customer","Partner","Missing phone & email"].includes(filter)?filter:""} onChange={e=>setFilter(e.target.value||"All contacts")} aria-label="Status"><option value="">Any status</option><option>Lead</option><option>Contact</option><option>Customer</option><option>Partner</option><option value="Missing phone & email">No phone or email</option></select>
   <select className="u-field ct-sort" value={sortBy} onChange={e=>setSortBy(e.target.value as "list"|"followup"|"name")} aria-label="Sort"><option value="list">List order</option><option value="followup">Follow-up date</option><option value="name">Name A–Z</option></select>
  </div>

  {!loaded?<p className="u-note" role="status">Loading contacts…</p>
  :!saved&&!contacts.length?<div className="u-void"><h2>Couldn&apos;t load your contacts</h2><p>Check your connection and refresh the page.</p></div>
  :!contacts.length?<div className="u-void"><h2>No contacts yet</h2><p>Import a list of prospects or add the first one by hand. Everyone you add shows up in Call mode.</p><div style={{display:"flex",gap:8}}><button className="u-btn u-btn-light" onClick={()=>setShowImport(true)}>Import a list</button><button className="u-btn" onClick={add}>Add contact</button></div></div>
  :!rows.length?<div className="u-void"><h2>{filter==="Not called today"&&!query?"Everyone's been called today":"Nothing matches"}</h2><p>{query?"Try another search.":"Switch the view above to see more people."}</p></div>
  :<div className="u-tablewrap"><table className="u-table ct-table">
   <thead><tr><th>Business</th><th>Phone</th><th>Location</th><th>Status</th><th>Last touch</th><th>Follow-up</th><th/></tr></thead>
   <tbody>{rows.map(c=>{const isDue=!!c.nextFollowUp&&c.nextFollowUp<=today();return <tr key={c.id} className={"is-link"+(selected===c.id&&sheet?" is-on":"")} onClick={()=>open(c)} tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();open(c)}}}>
    <td><div className="ct-who"><strong>{c.company||c.name}</strong><span>{c.company?[c.name,c.role].filter(Boolean).join(", "):c.role||""}</span></div></td>
    <td className="u-num ct-phone">{c.phone||<span className="u-quiet">No phone</span>}</td>
    <td>{c.location||<span className="u-quiet">—</span>}</td>
    <td><span className={"u-mark"+(c.status==="Customer"?" is-good":"")}>{c.status}</span></td>
    <td>{touchedToday(c)?<span style={{color:"var(--u-text)"}}>Today, {outcomeText(c.lastTouchOutcome).toLowerCase()}</span>:c.lastTouchAt?<>{dateLabel(localDay(c.lastTouchAt)).replace(/, \d{4}$/,"")}, {outcomeText(c.lastTouchOutcome).toLowerCase()}</>:<span className="u-quiet">Never</span>}</td>
    <td>{c.nextFollowUp?<span style={isDue?{color:"var(--u-text)"}:undefined}>{isDue&&<i className="u-dot is-ember" style={{display:"inline-block",marginRight:7,verticalAlign:"middle"}}/>}{dateLabel(c.nextFollowUp).replace(/, \d{4}$/,"")}</span>:<span className="u-quiet">—</span>}</td>
    <td style={{textAlign:"right"}}>{c.phone&&<button type="button" className="u-btn u-btn-bare" onClick={e=>{e.stopPropagation();callContact(c)}}>Call</button>}</td>
   </tr>})}</tbody>
  </table></div>}
  {loaded&&rows.length>0&&<p className="u-note" style={{marginTop:14}}>{rows.length} {rows.length===1?"person":"people"}{calledToday?`, ${calledToday} called today`:""}</p>}

  {sheet&&current&&<div className="ct-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setSheet(false)}}>
   <div className="ct-drawer" role="dialog" aria-modal="true" aria-label={current.company||current.name}>
    <div className="ct-dtop">
     <span className="u-note">{idx>=0?`${idx+1} of ${visible.length}`:""}</span>
     <div style={{display:"flex",gap:4}}>
      <button type="button" className="u-btn u-btn-bare" disabled={!prevContact} onClick={()=>go(prevContact)} aria-label="Previous contact">Previous</button>
      <button type="button" className="u-btn u-btn-bare" disabled={!nextContact} onClick={()=>go(nextContact)} aria-label="Next contact">Next</button>
      <button type="button" className="u-btn u-btn-bare" onClick={()=>setSheet(false)} aria-label="Close">Close</button>
     </div>
    </div>
    <h2 className="ct-name">{current.company||current.name}</h2>
    <p className="ct-sub">{[current.company?current.name:"",current.role].filter(Boolean).join(", ")||"No role on file"}<span className={"u-mark"+(current.status==="Customer"?" is-good":"")} style={{marginLeft:10}}>{current.status}</span>{current.source&&<span className="u-quiet" style={{marginLeft:10}}>from {current.source}</span>}</p>
    <div className="ct-actions">
     {current.phone&&<button type="button" className="u-btn u-btn-light" onClick={()=>callContact(current)}>Call {current.phone}</button>}
     {current.email&&<a className="u-btn" href={"mailto:"+current.email}>Email</a>}
     <button type="button" className="u-btn" onClick={()=>edit(current)}>Edit</button>
    </div>
    {touchedToday(current)?<p className="u-flash" role="status" style={{marginTop:16}}>Called today at {timeText(current.lastTouchAt||"")}, {outcomeText(current.lastTouchOutcome).toLowerCase()}. Don&apos;t call again unless they asked.</p>:null}

    <dl className="ct-facts">
     <div><dt>Phone</dt><dd>{current.phone?<a href={"tel:"+current.phone}>{current.phone}</a>:"—"}</dd></div>
     <div><dt>Email</dt><dd>{current.email?<a href={"mailto:"+current.email}>{current.email}</a>:"—"}</dd></div>
     <div><dt>Website</dt><dd>{current.website?<a href={href(current.website)} target="_blank" rel="noreferrer">{current.website.replace(/^https?:\/\//,"")}</a>:"—"}</dd></div>
     <div><dt>Location</dt><dd>{current.location||"—"}</dd></div>
     <div><dt>Instagram</dt><dd>{current.instagram?<a href={href(current.instagram,"instagram.com/")} target="_blank" rel="noreferrer">{current.instagram}</a>:"—"}</dd></div>
     <div><dt>Facebook</dt><dd>{current.facebook?<a href={href(current.facebook,"facebook.com/")} target="_blank" rel="noreferrer">Page</a>:"—"}</dd></div>
     <div><dt>LinkedIn</dt><dd>{current.linkedin?<a href={href(current.linkedin,"linkedin.com/in/")} target="_blank" rel="noreferrer">Profile</a>:"—"}</dd></div>
     <div><dt>Last call</dt><dd>{current.lastTouchAt?`${dateLabel(localDay(current.lastTouchAt))}, ${outcomeText(current.lastTouchOutcome).toLowerCase()}`:"Never"}</dd></div>
     <div><dt>Next follow-up</dt><dd>{dateLabel(current.nextFollowUp)}</dd></div>
    </dl>
    {current.notes&&<div className="ct-sec"><h3 className="u-h2">Notes</h3><p className="ct-notes">{current.notes}</p></div>}

    <div className="ct-sec">
     <h3 className="u-h2">{callFor===current.id?"How did the call go?":"Log a call"}</h3>
     <div className="ct-outs">{CALL_MODE_GROUPS.flatMap(g=>g.outcomes).map(o=><button key={o} type="button" disabled={outcomeBusy!==null} className={"ct-out"+(o==="meeting_booked"?" is-win":o==="do_not_contact"?" is-stop":"")} onClick={()=>logOutcome(current,o)}>{outcomeBusy===o?"Saving…":OUTCOME_LABELS[o]}</button>)}</div>
     <textarea className="u-field" value={outcomeNote} onChange={e=>setOutcomeNote(e.target.value)} maxLength={3000} rows={2} placeholder="Note, saved with the outcome (optional)" style={{marginTop:10}}/>
     {outcomeResult&&<p className={"u-flash"+(outcomeResult.ok?"":" is-bad")} role="status" style={{marginTop:10}}>{outcomeResult.text}</p>}
     {outcomeResult?.deal&&<SuggestedDeal key={outcomeResult.text} deal={outcomeResult.deal}/>}
     {outcomeResult?.textCtx&&outcomeResult.contactId&&<TextDraft key={outcomeResult.contactId+outcomeResult.textCtx.callAt} ctx={outcomeResult.textCtx} contactId={outcomeResult.contactId} who={outcomeResult.who||""} primaryClass="u-btn u-btn-light" quietClass="u-btn"/>}
     {outcomeResult?.ok&&nextContact&&<button type="button" className="u-btn" style={{marginTop:10}} onClick={()=>go(nextContact)}>Next: {nextContact.company||nextContact.name}</button>}
    </div>

    <div className="ct-sec ct-legacy">
     {(()=>{if(auditLoading)return <><h3 className="u-h2">Research</h3><p className="u-note">Loading…</p></>;if(!latestAudit)return <><h3 className="u-h2">Research</h3><p className="u-note">No research yet. <Link href={`/crm/audit?contact=${current.id}`} style={{textDecoration:"underline"}}>Research this business</Link></p></>;const plain=(t:string)=>t.replace(/\*\*/g,"").replace(/^[-*•]\s+/gm,"- ").trim();const verdict=plain(reportSection(latestAudit.content,"Verdict")).replace(/^- /,""),next=plain(reportSection(latestAudit.content,"Next CRM action")).replace(/^- /,"");return <><div className="u-h2-row"><h3 className="u-h2">Research</h3><Link className="u-note" href={`/crm/audits/${latestAudit.id}`} style={{textDecoration:"underline"}}>Full report</Link></div>{verdict&&<p className="ct-notes">{verdict}</p>}{next&&<p className="ct-notes" style={{marginTop:8}}><span className="u-quiet">Next step: </span>{next}</p>}<p className="u-note" style={{marginTop:8}}>{new Date(latestAudit.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}, {latestAudit.confidence} confidence. Written by AI, verify before quoting.</p></>})()}
    </div>

    <div className="ct-legacy"><ContactDeals contactId={current.id} name={current.name} company={current.company}/></div>
    <div className="ct-legacy"><InfoKit key={current.id} id={current.id} name={current.name} company={current.company||""} notes={current.notes||""} onReply={a=>{setActivities(old=>[a,...old].slice(0,100))}}/></div>
    <details className="ct-more"><summary>Discovery notes and report card</summary><div className="ct-legacy"><div className="crm-detail-section"><DiscoveryPanel key={"disc-"+current.id} contactId={current.id}/></div><ProspectReportCard contactId={current.id} company={current.company||current.name}/></div></details>

    <div className="ct-sec">
     <h3 className="u-h2">Activity</h3>
     {activityLoading?<p className="u-note">Loading…</p>:activities.length?<ol className="ct-log">{activities.map(a=><li key={a.id}><span className="ct-log-t">{new Date(a.occurred_at).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span><div><strong>{a.action==="outbound_call"?"Call":a.action==="outbound_text"?"Text sent":a.action==="inbound_text"?"They replied":"Note"}<span className="u-quiet">, {a.outcome.replaceAll("_"," ")}</span></strong>{a.notes&&<p>{a.notes}</p>}</div></li>)}</ol>:<p className="u-note">Nothing logged yet.</p>}
    </div>

    <div className="ct-foot"><span className="u-note">Added {dateLabel(current.createdAt.slice(0,10))}</span><button className="u-btn u-btn-bare" onClick={()=>{if(confirm("Archive this contact? They leave your lists but nothing is deleted.")){fetch("/api/contacts?id="+encodeURIComponent(current.id),{method:"DELETE"}).then(response=>{if(response.ok){setContacts(old=>old.filter(c=>c.id!==current.id));setSelected(null);setSheet(false)}else alert("Could not archive this contact. Please try again.")}).catch(()=>alert("Could not archive this contact. Please try again."))}}}>Archive</button></div>
   </div>
  </div>}

  {showImport&&<div className="crm-page" style={{display:"contents"}}><ImportModal existingContacts={contacts.map(c=>({email:c.email,phone:c.phone}))} onClose={()=>setShowImport(false)} onImported={()=>{fetch("/api/contacts",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(data)setContacts(data.contacts||[])})}}/></div>}

  {show&&<div className="u-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setShow(false)}}>
   <form className="u-dialog" style={{width:"min(640px,100%)",maxHeight:"calc(100vh - 36px)",overflowY:"auto"}} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="ct-form-title">
    <h3 id="ct-form-title">{editing?"Edit contact":"Add contact"}</h3>
    <div className="ct-form">
     <label className="u-lab ct-full">Full name<input className="u-field" required autoFocus maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Jordan Smith"/></label>
     <label className="u-lab">Company<input className="u-field" maxLength={160} value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})} placeholder="Ridgeline Fence Co."/></label>
     <label className="u-lab">Role<input className="u-field" maxLength={120} value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})} placeholder="Owner"/></label>
     <label className="u-lab">Phone<input className="u-field" type="tel" maxLength={40} value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="(720) 555-0148"/></label>
     <label className="u-lab">Email<input className="u-field" type="email" maxLength={254} value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="name@company.com"/></label>
     <label className="u-lab">Website<input className="u-field" maxLength={500} value={draft.website} onChange={e=>setDraft({...draft,website:e.target.value})} placeholder="company.com"/></label>
     <label className="u-lab">Location<input className="u-field" maxLength={300} value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})} placeholder="Denver, CO"/></label>
     <label className="u-lab">Instagram<input className="u-field" maxLength={500} value={draft.instagram} onChange={e=>setDraft({...draft,instagram:e.target.value})} placeholder="instagram.com/handle"/></label>
     <label className="u-lab">Facebook<input className="u-field" maxLength={500} value={draft.facebook} onChange={e=>setDraft({...draft,facebook:e.target.value})} placeholder="facebook.com/page"/></label>
     <label className="u-lab">LinkedIn<input className="u-field" maxLength={500} value={draft.linkedin??""} onChange={e=>setDraft({...draft,linkedin:e.target.value})} placeholder="linkedin.com/in/name"/></label>
     <label className="u-lab">Status<select className="u-field" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Contact["status"]})}><option>Lead</option><option>Contact</option><option>Customer</option><option>Partner</option></select></label>
     <label className="u-lab">Time zone<select className="u-field" value={draft.timeZone||""} onChange={e=>setDraft({...draft,timeZone:e.target.value})}><option value="">Auto, from state or area code</option><option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option><option value="America/Denver">Mountain</option><option value="America/Phoenix">Arizona</option><option value="America/Los_Angeles">Pacific</option><option value="America/Anchorage">Alaska</option><option value="Pacific/Honolulu">Hawaii</option></select></label>
     <label className="u-lab">Source<input className="u-field" maxLength={100} value={draft.source} onChange={e=>setDraft({...draft,source:e.target.value})} placeholder="Cold call, referral"/></label>
     <label className="u-lab">Next follow-up<input className="u-field" type="date" value={draft.nextFollowUp} onChange={e=>setDraft({...draft,nextFollowUp:e.target.value})}/></label>
     <label className="u-lab ct-full">Notes<textarea className="u-field" rows={4} maxLength={5000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Context, last conversation, next step"/></label>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}><button type="button" className="u-btn" onClick={()=>setShow(false)}>Cancel</button><button type="submit" className="u-btn u-btn-light">{editing?"Save changes":"Add contact"}</button></div>
   </form>
  </div>}
 </div>;
}
