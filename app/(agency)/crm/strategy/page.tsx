"use client";


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
      if (!response.ok) throw new Error(data.error || (response.status===401 ? "Sign in to see your notes." : "Couldn’t load your notes. Try Refresh."));
      setItems(Array.isArray(data.memory)?data.memory:[]);
    } catch (e) { setError(e instanceof Error?e.message:"Couldn’t load your notes. Try Refresh."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{void load()},[load]);

  const visible = useMemo(()=>items.filter(x=>(category==="all"||x.category===category)&&[x.title,x.content,x.category,x.source].join(" ").toLowerCase().includes(query.toLowerCase())),[items,category,query]);
  async function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workforce",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"memory",title,content,category:kind,importance:Number(importance),source:"manual"})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t save the note. Try again.");
      setTitle("");setContent("");setNotice("Note saved.");await load();
    } catch(e) {setError(e instanceof Error?e.message:"Couldn’t save the note. Try again.");}
    finally {setSaving(false);}
  }
  async function archive(id:string) {
    setError("");setNotice("");
    try {
      const response=await fetch("/api/workforce",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"memory",id,archived:true})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Couldn’t archive the note. Try again.");
      setItems(old=>old.filter(x=>x.id!==id));setNotice("Note archived.");
    } catch(e) {setError(e instanceof Error?e.message:"Couldn’t archive the note. Try again.");}
  }

  const importanceLabel: Record<number,string> = {5:"Critical",4:"High",3:"Normal",2:"Low",1:"Reference"};
  return <main className="u-page">
    <div className="u-head">
      <h1 className="u-title">Strategy<span className="u-dim">{loading?"":` ${items.length} ${items.length===1?"note":"notes"}`}</span></h1>
      <div className="u-head-actions"><button type="button" className="u-btn" onClick={()=>void load()} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button></div>
    </div>
    <p className="u-note" style={{marginTop:20}}>Priorities, decisions, lessons and what you know about your customers, kept in one place so they don’t get lost between weeks.</p>
    {error&&<p role="alert" className="u-flash is-bad" style={{marginTop:16}}>{error}</p>}
    {notice&&<p role="status" className="u-flash" style={{marginTop:16}}>{notice}</p>}
    <div className="u-split u-split-2 u-block" style={{alignItems:"start"}}>
      <section>
        <div className="u-h2-row" style={{flexWrap:"wrap",gap:12}}>
          <h2 className="u-h2">Notes<span className="u-quiet">{loading?"":visible.length}</span></h2>
          <input className="u-field" aria-label="Search notes" placeholder="Search notes" value={query} onChange={e=>setQuery(e.target.value)} style={{maxWidth:240}}/>
        </div>
        <div className="u-seg" role="group" aria-label="Category" style={{marginBottom:12,flexWrap:"wrap"}}>
          <button type="button" aria-pressed={category==="all"} onClick={()=>setCategory("all")}>All</button>
          {categories.map(c=><button key={c} type="button" aria-pressed={category===c} onClick={()=>setCategory(c)}>{label(c)}</button>)}
        </div>
        {loading?<p className="u-note" role="status">Loading notes…</p>
        :visible.length===0?<div className="u-void"><h2>{items.length?"Nothing matches":"No notes yet"}</h2><p>{items.length?"Try another category or search.":"Write down a decision, a priority or a lesson the first time it matters. It will be here the next time it does."}</p></div>
        :<div className="u-rows">{visible.map(item=><div key={item.id} className="u-row" style={{alignItems:"flex-start",padding:"14px 14px 14px 16px"}}>
          <div className="u-row-main" style={{gap:4}}>
            <strong style={{whiteSpace:"normal"}}>{item.title}</strong>
            <p style={{margin:0,whiteSpace:"pre-wrap",fontSize:13.5,lineHeight:"21px",color:"var(--k-g1)"}}>{item.content}</p>
            <span>{label(item.category)} · {importanceLabel[item.importance]??item.importance} · Updated {new Date(item.updated_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
          </div>
          <button type="button" className="u-btn u-btn-bare" onClick={()=>void archive(item.id)}>Archive</button>
        </div>)}</div>}
      </section>
      <section>
        <div className="u-h2-row"><h2 className="u-h2">Add a note</h2></div>
        <form onSubmit={save} className="u-sheet u-sheet-pad" style={{display:"grid",gap:14}}>
          <label className="u-lab">Title<input className="u-field" required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Fence is the first niche"/></label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <label className="u-lab">Category<select className="u-field" value={kind} onChange={e=>setKind(e.target.value)}>{categories.map(c=><option key={c} value={c}>{label(c)}</option>)}</select></label>
            <label className="u-lab">Importance<select className="u-field" value={importance} onChange={e=>setImportance(e.target.value)}>{[5,4,3,2,1].map(n=><option key={n} value={String(n)}>{importanceLabel[n]}</option>)}</select></label>
          </div>
          <label className="u-lab">Details<textarea className="u-field" required maxLength={12000} rows={6} value={content} onChange={e=>setContent(e.target.value)} placeholder="What you decided, and why"/></label>
          <div><button disabled={saving} type="submit" className="u-btn u-btn-go">{saving?"Saving…":"Save note"}</button></div>
        </form>
      </section>
    </div>
  </main>;
}
