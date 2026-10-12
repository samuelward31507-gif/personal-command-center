"use client";

import { useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import Link from "next/link";

const authClient = createAuthClient();

export default function SignInPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || "Authentication failed.");
      window.location.assign("/crm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#f5f6f8",color:"#20232a"}}>
    <section style={{width:"100%",maxWidth:420,background:"#fff",border:"1px solid #e4e7ec",borderRadius:18,padding:32,boxShadow:"0 12px 40px #20232a0a"}}>
      <Link href="/" style={{fontSize:12,letterSpacing:3,fontWeight:800,color:"#20232a",textDecoration:"none"}}>CINDER</Link>
      <h1 style={{fontSize:30,margin:"28px 0 8px",letterSpacing:-1}}>{mode === "sign-in" ? "Welcome back." : "Create your workspace."}</h1>
      <p style={{color:"#667085",fontSize:14,marginBottom:24}}>Sign in to securely access your personal CRM.</p>
      <form onSubmit={submit} style={{display:"grid",gap:14}}>
        {mode === "sign-up" && <label style={{display:"grid",gap:6,fontSize:13,fontWeight:600}}>Name<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={inputStyle}/></label>}
        <label style={{display:"grid",gap:6,fontSize:13,fontWeight:600}}>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle}/></label>
        <label style={{display:"grid",gap:6,fontSize:13,fontWeight:600}}>Password<input required minLength={8} type="password" autoComplete={mode==="sign-in"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle}/></label>
        {error && <p role="alert" style={{color:"#b42318",fontSize:13}}>{error}</p>}
        <button disabled={busy} type="submit" style={{border:0,borderRadius:9,padding:"12px 16px",background:"#20232a",color:"#fff",fontWeight:700,cursor:busy?"wait":"pointer",marginTop:4}}>{busy?"Please wait…":mode==="sign-in"?"Sign in":"Create account"}</button>
      </form>
      <p style={{fontSize:13,color:"#667085",marginTop:20}}>{mode==="sign-in"?"New to Cinder?":"Already have an account?"} <button onClick={()=>{setMode(mode==="sign-in"?"sign-up":"sign-in");setError("");}} style={{border:0,padding:0,background:"transparent",color:"#344054",fontWeight:700,cursor:"pointer"}}>{mode==="sign-in"?"Create account":"Sign in"}</button></p>
      <p style={{fontSize:11,color:"#98a2b3",marginTop:24}}>Preview environment only. Keep production data out of this test workspace.</p>
    </section>
  </main>;
}

const inputStyle: React.CSSProperties = {width:"100%",boxSizing:"border-box",border:"1px solid #d0d5dd",borderRadius:9,padding:"11px 12px",fontSize:14,outlineOffset:2,background:"#fff",color:"#20232a"};
