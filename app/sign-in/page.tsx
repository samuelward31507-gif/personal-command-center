"use client";

import { useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";

const authClient = createAuthClient();

/** Owner sign-in. Cinder is a single-owner workspace, so there is no public sign-up. */
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || "That email and password didn't match.");
      window.location.assign("/crm/needs-you");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f6f4", color: "#121417", fontFamily: "inherit" }}>
    <section style={{ width: "100%", maxWidth: 380, background: "#ffffff", border: "1px solid #f1f1ef", borderRadius: 14, padding: "32px 28px" }}>
      <div style={{ fontSize: 13, letterSpacing: ".02em", fontWeight: 600, color: "#535a65" }}>Cinder</div>
      <h1 style={{ fontSize: 24, fontWeight: 560, letterSpacing: "-0.02em", margin: "18px 0 6px", color: "#121417" }}>Sign in</h1>
      <div style={{ color: "#656e7b", fontSize: 14, marginBottom: 22 }}>Your agency workspace.</div>
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <label style={labelStyle}>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Password<input required minLength={8} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} /></label>
        {error && <div role="alert" style={{ color: "#2a2d32", fontSize: 13 }}>{error}</div>}
        <button disabled={busy} type="submit" data-variant="primary" style={{ border: 0, borderRadius: 9, padding: "11px 16px", background: "#121417", color: "#f6f6f4", fontWeight: 600, fontSize: 14, cursor: busy ? "wait" : "pointer", marginTop: 4 }}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      {process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" && <div style={{ fontSize: 12, color: "#828890", marginTop: 22 }}>Preview environment. Keep production data out of this workspace.</div>}
    </section>
  </div>;
}

const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, fontWeight: 500, color: "#535a65" };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #e7e7e4", borderRadius: 9, padding: "10px 12px", fontSize: 15, background: "#f6f6f4", color: "#121417", outlineOffset: 2 };
