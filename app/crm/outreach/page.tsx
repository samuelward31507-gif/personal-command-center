"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./outreach.css";

type Contact={id:string;name:string;company:string;phone:string;notes:string;status:string};
type Outreach={id:string;contactId:string;status:string;currentStep:number;nextActionAt:string;niche:string;painPoint:string;researchNotes:string;name:string;company:string;role:string;phone:string;contactNotes:string};
const steps=[
 {day:"DAY 1",label:"First call",channel:"call",goal:"Introduce yourself and find the owner"},
 {day:"DAY 2",label:"Second call",channel:"call",goal:"Try a different time of day"},
 {day:"DAY 3",label:"Follow-up text",channel:"text",goal:"Short, relevant follow-up"},
 {day:"DAY 5",label:"Third call",channel:"call",goal:"Ask one specific question"},
 {day:"DAY 7",label:"Final text",channel:"text",goal:"Give them an easy out"},
 {day:"DAY 8",label:"Final call",channel:"call",goal:"Close the loop, then park"},
];
function humanDate(v:string){return v?new Date(v).toLocaleDateString(undefined,{month:"short",day:"numeric"}):"Today"}
function textScript(p:Outreach,final=false){
 const niche=p.niche||"your business";
 const pain=p.painPoint||"making sure new leads get followed up with quickly";
 return final
 ? `Hey ${p.name.split(" ")[0]||"there"}, I don't want to keep bugging you. I work with ${niche} businesses on ${pain}. If improving that ever becomes a priority, happy to share a couple ideas. Otherwise I'll leave it here.`
 : `Hey ${p.name.split(" ")[0]||"there"}, quick question — how are you currently handling ${pain.toLowerCase()} at ${p.company||"your company"}? I help ${niche} businesses tighten that up without adding more admin work. Worth a quick conversation?`;
}
export default function OutreachPage(){
 const [items,setItems]=useState<Outreach[]>([]);
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [loading,setLoading]=useState(true);
 const [selected,setSelected]=useState("");
 const [niche,setNiche]=useState("HVAC");
 const [pain,setPain]=useState("responding to new leads quickly and following up until they book");
 const [notes,setNotes]=useState("");
 const [showAdd,setShowAdd]=useState(false);
 const [filter,setFilter]=useState("due");
 const [busy,setBusy]=useState<string|null>(null);
 const [message,setMessage]=useState("");
 const [outcomeFor,setOutcomeFor]=useState<Outreach|null>(null);
 const [outcome,setOutcome]=useState("no_answer");
 const [outcomeNotes,setOutcomeNotes]=useState("");
 async function load(){
  setLoading(true);
  try{
   const [a,b]=await Promise.all([fetch("/api/outreach",{cache:"no-store"}),fetch("/api/contacts",{cache:"no-store"})]);
   if(!a.ok||!b.ok)throw new Error("Unable to load");
   const ad=await a.json(),bd=await b.json();
   setItems(Array.isArray(ad.outreach)?ad.outreach:[]);
   setContacts(Array.isArray(bd.contacts)?bd.contacts:[]);
  }catch{setMessage("Couldn't load outreach. Make sure you're signed in and try again.")}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 const active=items.filter(x=>x.status==="active");
 const due=active.filter(x=>new Date(x.nextActionAt).getTime()<=Date.now());
 const shown=useMemo(()=>items.filter(x=>filter==="all"?x.status==="active":filter==="due"?x.status==="active"&&new Date(x.nextActionAt).getTime()<=Date.now():filter==="parked"?x.status==="parked":x.status!=="active"&&x.status!=="parked"),[items,filter]);
 const dueCount=due.length;
 async function enroll(){
  if(!selected)return;
  setBusy("add");setMessage("");
  try{
   const r=await fetch("/api/outreach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contactId:selected,niche,painPoint:pain,researchNotes:notes})});
   if(!r.ok)throw new Error();
   setShowAdd(false);setSelected("");setNotes("");await load();
  }catch{setMessage("Couldn't add that prospect to outreach.")}finally{setBusy(null)}
 }
 function complete(p:Outreach){
  setOutcomeFor(p);setOutcome("no_answer");setOutcomeNotes("");setMessage("");
 }
 async function saveOutcome(e:React.FormEvent){
  e.preventDefault();if(!outcomeFor)return;
  setBusy(outcomeFor.id);setMessage("");
  try{
   const r=await fetch("/api/outreach",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:outcomeFor.id,outcome,notes:outcomeNotes})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(data.error||"Could not save outcome.");
   setOutcomeFor(null);await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Could not save this outcome. Please try again.")}finally{setBusy(null)}
 }
 async function setStatus(p:Outreach,status:string){
  setBusy(p.id);setMessage("");
  try{const r=await fetch("/api/outreach",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:p.id,status})});if(!r.ok)throw new Error();await load()}catch{setMessage("Couldn't update this prospect.")}finally{setBusy(null)}
 }
 function call(p:Outreach){if(!p.phone){setMessage("Add a phone number to this contact first.");return}void fetch("/api/call-logs",{method:"POST",keepalive:true,headers:{"Content-Type":"application/json"},body:JSON.stringify({contactId:p.contactId,channel:"call",action:"outbound_call",outcome:"initiated",sequenceStep:p.currentStep,notes:"Outbound call launched from Cinder outreach."})}).catch(()=>{});window.location.href="tel:"+p.phone.replace(/[^+\d]/g,"")}
 function copy(p:Outreach){const s=textScript(p,p.currentStep===5);void navigator.clipboard.writeText(s).then(()=>setMessage("Text copied for "+p.name)).catch(()=>setMessage("Clipboard unavailable — open this page in Safari and allow clipboard access."))}
 return <main className="outreach-page">
  <header className="outreach-header"><div><div className="outreach-eyebrow">CINDER / SALES & GROWTH</div><h1>Today's outreach<span>.</span></h1><p>A clear next action for every prospect. Calls open your normal phone app; texts are copied for you to send manually.</p></div><div className="outreach-head-actions"><Link href="/crm" className="outreach-link">← Contacts</Link><button className="outreach-primary" onClick={()=>setShowAdd(v=>!v)}>＋ Add prospect</button></div></header>
  <section className="outreach-stats"><article><span>DUE NOW</span><strong>{dueCount}</strong><small>Ready for your next touch</small></article><article><span>ACTIVE SEQUENCES</span><strong>{active.length}</strong><small>Prospects being worked</small></article><article><span>PARKED</span><strong>{items.filter(x=>x.status==="parked").length}</strong><small>Sequence finished, no response</small></article><article><span>CONTACTS</span><strong>{contacts.length}</strong><small>In your workspace</small></article></section>
  {message&&<div className="outreach-message" role="status">{message}<button onClick={()=>setMessage("")}>Dismiss</button></div>}
  {showAdd&&<section className="outreach-add"><div><h2>Add a prospect to outreach</h2><p>Choose an existing contact and personalize the sequence. No calls or texts are sent automatically.</p></div><div className="outreach-form"><label>Contact<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a contact…</option>{contacts.filter(c=>!items.some(i=>i.contactId===c.id&&(i.status==="active"||i.status==="do_not_contact"||i.status==="interested"||i.status==="meeting_booked"))).map(c=><option key={c.id} value={c.id}>{c.name}{c.company?" — "+c.company:""}</option>)}</select></label><label>Niche<input value={niche} onChange={e=>setNiche(e.target.value)} placeholder="HVAC, garage doors…"/></label><label className="outreach-wide">Pain point / reason to call<input value={pain} onChange={e=>setPain(e.target.value)} placeholder="e.g. missed calls and slow lead follow-up"/></label><label className="outreach-wide">Research notes (optional)<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Website observations, current tools, likely bottleneck…"/></label></div><div className="outreach-add-actions"><button className="outreach-secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button className="outreach-primary" disabled={!selected||busy==="add"} onClick={()=>void enroll()}>{busy==="add"?"Adding…":"Start sequence"}</button></div></section>}
  <section className="outreach-board"><div className="outreach-board-head"><div><h2>Prospect queue</h2><p>{filter==="due"?"Prioritized actions due today or overdue":filter==="all"?"All active sequences":filter==="parked"?"Finished sequences with no response":"Prospects with a status change"}</p></div><div className="outreach-tabs">{[{id:"due",label:"Due now"},{id:"all",label:"Active"},{id:"parked",label:"Parked"},{id:"other",label:"Responded / stopped"}].map(t=><button key={t.id} className={filter===t.id?"selected":""} onClick={()=>setFilter(t.id)}>{t.label}</button>)}</div></div>
   {loading?<div className="outreach-empty">Loading your queue…</div>:shown.length===0?<div className="outreach-empty"><div>✓</div><h3>{filter==="due"?"You're all caught up.":"No prospects in this view yet."}</h3><p>{filter==="due"?"Add a prospect or switch to Active to review upcoming steps.":"Add a contact to start a follow-up sequence."}</p><button className="outreach-primary" onClick={()=>setShowAdd(true)}>＋ Add prospect</button></div>:<div className="outreach-list">{shown.map(p=>{const step=steps[Math.max(0,Math.min(5,p.currentStep-1))];const isDue=new Date(p.nextActionAt).getTime()<=Date.now();return <article className="outreach-card" key={p.id}><div className="outreach-card-main"><div className="outreach-card-title"><div className="outreach-avatar">{p.name.split(/\s+/).map(v=>v[0]).slice(0,2).join("").toUpperCase()}</div><div><h3>{p.name}</h3><p>{[p.role,p.company].filter(Boolean).join(" · ")||p.niche||"Prospect"}</p></div><span className={"outreach-status status-"+p.status}>{p.status.replaceAll("_"," ")}</span></div><div className="outreach-next"><span className={isDue&&p.status==="active"?"outreach-due":""}>{p.status==="active"?(isDue?"DUE NOW":"NEXT · "+humanDate(p.nextActionAt)):p.status.toUpperCase()}</span><strong>{p.status==="active"?step.label:p.status==="parked"?"Sequence complete":p.status==="meeting_booked"?"Meeting booked":"Outreach stopped"}</strong><small>{p.status==="active"?step.day+" · STEP "+p.currentStep+" OF 6":p.status==="parked"?"No response after six touches":"Update status when the prospect responds"}</small><p>{p.painPoint||"Personalize the reason for reaching out before contacting this prospect."}</p></div><div className="outreach-progress">{steps.map((s,i)=><span key={s.label} className={i<p.currentStep-1?"done":i===p.currentStep-1&&p.status==="active"?"current":""} title={s.label}/>)}</div></div><div className="outreach-card-actions">{p.status==="active"&&<>{step.channel==="call"?<button className="outreach-primary" onClick={()=>call(p)} disabled={!p.phone}>☎ Call</button>:<button className="outreach-primary" onClick={()=>copy(p)}>Copy text</button>}<button className="outreach-secondary" disabled={busy===p.id} onClick={()=>void complete(p)}>{busy===p.id?"Saving…":"Log outcome & next step"}</button><button className="outreach-quiet" disabled={busy===p.id} onClick={()=>void setStatus(p,"parked")}>Park</button><button className="outreach-quiet danger" disabled={busy===p.id} onClick={()=>void setStatus(p,"do_not_contact")}>Do not contact</button></>}{p.status==="parked"&&<button className="outreach-secondary" onClick={()=>void setStatus(p,"active")}>Restart sequence</button>}{p.status==="active"&&<button className="outreach-quiet" disabled={busy===p.id} onClick={()=>void setStatus(p,"meeting_booked")}>Meeting booked</button>}</div></article>})}</div>}
  </section>
  <section className="outreach-sequence"><h2>Sequence at a glance</h2><p>Manual outreach cadence. Mark each touch complete to schedule the next step. Replies, meetings, and opt-outs should stop the sequence.</p><div className="outreach-step-grid">{steps.map((s,i)=><article key={s.label}><span>{s.day}</span><strong>{s.label}</strong><small>{s.goal}</small></article>)}</div><small className="outreach-compliance">Use relevant, individualized outreach. Follow applicable calling/texting rules, respect opt-outs immediately, and don't treat a publicly listed number as consent for marketing texts.</small></section>
  {outcomeFor&&<div className="outcome-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOutcomeFor(null)}}><section className="outcome-modal" role="dialog" aria-modal="true" aria-labelledby="outcome-title"><header><div><span>LOG OUTREACH RESULT</span><h2 id="outcome-title">{outcomeFor.name}</h2><p>{outcomeFor.company} · {steps[Math.max(0,Math.min(5,outcomeFor.currentStep-1))].label}</p></div><button type="button" onClick={()=>setOutcomeFor(null)} aria-label="Close">×</button></header><form onSubmit={saveOutcome}><label>What happened?<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="no_answer">No answer</option><option value="voicemail">Left voicemail</option><option value="answered">Spoke with prospect</option><option value="meeting_booked">Meeting booked</option><option value="reply_received">Got a reply</option><option value="completed">Completed touch</option><option value="other">Other</option></select></label><label>Notes and next step<textarea rows={4} maxLength={3000} value={outcomeNotes} onChange={e=>setOutcomeNotes(e.target.value)} placeholder="Who did you speak with? What did they say? What happens next?"/></label>{(outcome==="meeting_booked"||outcome==="reply_received")&&<p className="outcome-stop-note">This result will stop the current sequence so you do not keep sending routine follow-ups.</p>}<footer><button type="button" onClick={()=>setOutcomeFor(null)}>Cancel</button><button type="submit" disabled={busy===outcomeFor.id}>{busy===outcomeFor.id?"Saving…":"Save result & next step"}</button></footer></form></section></div>}
 </main>
}
