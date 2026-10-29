"use client";

import Link from "next/link";

import { useCallback, useEffect, useMemo, useState } from "react";

type Memory = { id:string; category:string; title:string; content:string; importance:number; source:string; created_at:string; updated_at:string };
const categories = ["priority","preference","decision","lesson","customer","strategy","general"];
const label = (value:string) => value.replaceAll("_"," ").replace(/\b\w/g, c=>c.toUpperCase());

export default function StrategyPage() {
  const [items,setItems] = useState<Memory[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("all");
  const [title,setTitle] = useState("");
  const [content,setContent] = useState("");
  const [kind,setKind] = useState("strategy");
  const [importance,setImportance] = useState("4");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/workforce",{cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (response.status===401 ? "Sign in to view your business memory." : "Unable to load business memory."));
      setItems(Array.isArray(data.memory)?data.memory:[]);
    } catch (e) { setError(e instanceof Error?e.message:"Unable to load business memory."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{void load()},[load]);

  const visible = useMemo(()=>items.filter(x=>(category==="all"||x.category===category)&&[x.title,x.content,x.category,x.source].join(" ").toLowerCase().includes(query.toLowerCase())),[items,category,query]);
  async function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workforce",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"memory",title,content,category:kind,importance:Number(importance),source:"manual"})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save memory.");
      setTitle("");setContent("");setNotice("Saved to your private business memory.");await load();
    } catch(e) {setError(e instanceof Error?e.message:"Unable to save memory.");}
    finally {setSaving(false);}
  }
  async function archive(id:string) {
    setError("");setNotice("");
    try {
      const response=await fetch("/api/workforce",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"memory",id,archived:true})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to archive memory.");
      setItems(old=>old.filter(x=>x.id!==id));setNotice("Memory archived.");
    } catch(e) {setError(e instanceof Error?e.message:"Unable to archive memory.");}
  }

  return <main style={{maxWidth:1080,margin:"0 auto",padding:"28px 22px 60px",color:"#e5e5e5"}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}><Link href="/">← Cinder workspace</Link><button onClick={()=>void load()} disabled={loading}>↻ Refresh</button></header>
    <div style={{marginTop:36}}><p style={{fontSize:10,letterSpacing:2,color:"#a95335",fontWeight:700}}>FOUNDER OPERATING SYSTEM</p><h1 style={{fontSize:38,letterSpacing:-1.5,margin:"8px 0"}}>Strategy & memory.</h1><p style={{color:"#a1a1a1",maxWidth:680}}>Keep durable context in one place: priorities, decisions, customer knowledge, lessons, and operating principles. These notes are saved to your workspace database.</p></div>
    {error&&<p role="alert" style={{background:"#2a1414",color:"#fca5a5",padding:12,borderRadius:8}}>{error}</p>}
    {notice&&<p role="status" style={{color:"#86efac",fontSize:13}}>{notice}</p>}
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.15fr) minmax(280px,.85fr)",gap:20,marginTop:24,alignItems:"start"}}>
      <section style={{border:"1px solid #303030",borderRadius:14,padding:18,background:"#171717"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h2 style={{fontSize:19,margin:0}}>Business memory</h2><p style={{fontSize:13,color:"#a1a1a1",margin:"5px 0 0"}}>{items.length} active records</p></div><input aria-label="Search memory" placeholder="Search memory…" value={query} onChange={e=>setQuery(e.target.value)} style={field}/></div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",margin:"16px 0"}}><button onClick={()=>setCategory("all")} style={chip(category==="all")}>All</button>{categories.map(c=><button key={c} onClick={()=>setCategory(c)} style={chip(category===c)}>{label(c)}</button>)}</div>
        {loading?<p style={{padding:20,color:"#a1a1a1"}}>Loading saved memory…</p>:visible.length===0?<p style={{padding:24,color:"#a1a1a1"}}>No matching memory yet. Add a decision, priority, or lesson to start building durable context.</p>:visible.map(item=><article key={item.id} style={{borderTop:"1px solid #303030",padding:"16px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"start"}}><div><span style={{fontSize:10,letterSpacing:1,color:"#a95335",fontWeight:700}}>{label(item.category)} · IMPORTANCE {item.importance}/5</span><h3 style={{fontSize:16,margin:"6px 0"}}>{item.title}</h3></div><button onClick={()=>void archive(item.id)} style={{...quietButton,flexShrink:0}}>Archive</button></div>
          <p style={{whiteSpace:"pre-wrap",lineHeight:1.6,fontSize:14,color:"#a1a1a1",margin:"6px 0"}}>{item.content}</p><small style={{color:"#999"}}>Source: {item.source||"manual"} · Updated {new Date(item.updated_at).toLocaleDateString()}</small>
        </article>)}
      </section>
      <section style={{border:"1px solid #303030",borderRadius:14,padding:20,background:"#171717"}}>
        <h2 style={{fontSize:19,margin:"0 0 6px"}}>Capture important context</h2><p style={{fontSize:13,color:"#a1a1a1",lineHeight:1.5,margin:"0 0 18px"}}>Record decisions and principles you want to remember across work sessions.</p>
        <form onSubmit={save} style={{display:"grid",gap:12}}>
          <label style={labelStyle}>Title<input required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Revenue is the first priority" style={field}/></label>
          <label style={labelStyle}>Category<select value={kind} onChange={e=>setKind(e.target.value)} style={field}>{categories.map(c=><option key={c} value={c}>{label(c)}</option>)}</select></label>
          <label style={labelStyle}>Importance<select value={importance} onChange={e=>setImportance(e.target.value)} style={field}><option value="5">5 — Critical</option><option value="4">4 — High</option><option value="3">3 — Normal</option><option value="2">2 — Low</option><option value="1">1 — Reference</option></select></label>
          <label style={labelStyle}>Context<textarea required maxLength={12000} rows={7} value={content} onChange={e=>setContent(e.target.value)} placeholder="What should Cinder remember, and why does it matter?" style={{...field,resize:"vertical"}}/></label>
          <button disabled={saving} type="submit" style={primaryButton}>{saving?"Saving…":"Save to business memory"}</button>
        </form>
        <p style={{fontSize:11,color:"#999",lineHeight:1.5,marginTop:16}}>This stores memory for your workspace. It does not yet automatically inject it into Hermes prompts or trigger agent actions.</p>
      </section>
    </div>
    <style jsx>{`@media(max-width:760px){main>div:nth-of-type(2){grid-template-columns:1fr!important}}`}</style>
  </main>;
}
const field:React.CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #303030",borderRadius:8,padding:"10px 11px",fontSize:13,background:"#171717",color:"#e5e5e5"};
const labelStyle:React.CSSProperties={display:"grid",gap:6,fontSize:12,fontWeight:650};
const primaryButton:React.CSSProperties={border:0,borderRadius:8,padding:"12px 14px",background:"#252522",color:"#fff",fontWeight:700,cursor:"pointer"};
const quietButton:React.CSSProperties={border:"1px solid #303030",borderRadius:7,padding:"6px 9px",background:"#171717",color:"#a1a1a1",cursor:"pointer",fontSize:12};
const chip=(active:boolean):React.CSSProperties=>({border:"1px solid "+(active?"#e5e5e5":"#303030"),borderRadius:20,padding:"6px 10px",background:active?"#e5e5e5":"#171717",color:active?"#111":"#a1a1a1",fontSize:11,cursor:"pointer"});
