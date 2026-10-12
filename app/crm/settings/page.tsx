import Link from "next/link";
"use client";

import { useEffect, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";

const authClient = createAuthClient();

export default function SettingsPage() {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [databaseStatus, setDatabaseStatus] = useState("Checking…");
  const [hermesStatus, setHermesStatus] = useState("Checking…");

  useEffect(() => {
    let active = true;
    fetch("/api/contacts", { cache: "no-store" })
      .then((response) => {
        if (!active) return;
        setDatabaseStatus(response.ok ? "Connected" : response.status === 401 ? "Sign in required" : "Unavailable");
      })
      .catch(() => { if (active) setDatabaseStatus("Unavailable"); });
    fetch("/api/hermes/status", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) { setHermesStatus("Sign in required"); return; }
        if (!response.ok) { setHermesStatus("Unavailable"); return; }
        const data = await response.json();
        setHermesStatus(data.configured === true ? "Configured" : "Not configured");
      })
      .catch(() => { if (active) setHermesStatus("Unavailable"); });
    return () => { active = false; };
  }, []);

  const integrations = [
    { name: "Workspace database", detail: "Contacts, deals, tasks, projects, finance, and business memory", status: databaseStatus },
    { name: "Hermes read-only bridge", detail: "Read-only workspace context for Hermes; no external actions are executed", status: hermesStatus },
    { name: "External CRM integrations", detail: "Third-party CRM and messaging connections", status: "Not connected" },
  ];

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result?.error) throw new Error(result.error.message || "Unable to sign out.");
      window.location.assign("/sign-in");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 22px 60px", color: "#252522" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "#555", textDecoration: "none", fontSize: 13 }}>← Cinder workspace</Link>
        <span style={{ fontSize: 11, color: "#777", border: "1px solid #e4e4df", borderRadius: 20, padding: "6px 10px" }}>Workspace settings</span>
      </header>

      <section style={{ marginTop: 36, maxWidth: 720 }}>
        <p style={{ fontSize: 10, letterSpacing: 2, color: "#a95335", fontWeight: 700 }}>CINDER / CONFIGURATION</p>
        <h1 style={{ fontSize: 38, letterSpacing: -1.5, margin: "8px 0" }}>Settings<span style={{ color: "#a95335" }}>.</span></h1>
        <p style={{ color: "#666", lineHeight: 1.65, fontSize: 14 }}>Review the workspace foundation and connected capabilities. External integrations are shown honestly as disconnected until they are configured and verified.</p>
      </section>

      {error && <p role="alert" style={{ marginTop: 20, padding: 12, borderRadius: 8, background: "#fff1f0", color: "#9f2720", fontSize: 13 }}>{error}</p>}

      <section style={{ marginTop: 26, border: "1px solid #e4e4df", borderRadius: 14, background: "#fff", padding: 20 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Workspace connections</h2>
        <p style={{ color: "#777", fontSize: 13, margin: "6px 0 18px" }}>Current connection state, not a promise that future integrations are already active.</p>
        <div style={{ display: "grid", gap: 0 }}>
          {integrations.map((item, index) => (
            <article key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 0", borderTop: index === 0 ? "1px solid #eee" : "1px solid #eee" }}>
              <div>
                <h3 style={{ fontSize: 14, margin: 0 }}>{item.name}</h3>
                <p style={{ color: "#777", fontSize: 12, lineHeight: 1.5, margin: "5px 0 0" }}>{item.detail}</p>
              </div>
              <span style={{ flexShrink: 0, fontSize: 10, letterSpacing: .3, fontWeight: 700, color: item.status === "Connected" || item.status === "Configured" ? "#286749" : "#777", background: item.status === "Connected" || item.status === "Configured" ? "#edf7f0" : "#f3f3f0", borderRadius: 20, padding: "6px 9px" }}>{item.status}</span>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18, border: "1px solid #e4e4df", borderRadius: 14, background: "#fff", padding: 20 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Your workspace data</h2>
        <p style={{ color: "#666", fontSize: 13, lineHeight: 1.65, margin: "8px 0 16px" }}>Your signed-in workspace contains your CRM records, sales pipeline, tasks, client delivery, financial entries, AI workforce records, and business memory. The Hermes bridge is not active, so saved business memory is not automatically injected into an AI agent.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/crm" style={linkStyle}>Contacts</a>
          <a href="/crm/pipeline" style={linkStyle}>Sales pipeline</a>
          <a href="/crm/tasks" style={linkStyle}>Tasks</a>
          <a href="/crm/projects" style={linkStyle}>Projects</a>
          <a href="/crm/strategy" style={linkStyle}>Strategy & memory</a>
        </div>
      </section>

      <section style={{ marginTop: 18, border: "1px solid #e4e4df", borderRadius: 14, background: "#fff", padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>Account session</h2>
          <p style={{ color: "#777", fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>Sign out of this Cinder workspace on this browser.</p>
        </div>
        <button type="button" onClick={() => void signOut()} disabled={signingOut} style={{ border: "1px solid #d8d8d2", borderRadius: 8, padding: "10px 14px", background: "#fff", color: "#252522", fontWeight: 650, cursor: signingOut ? "wait" : "pointer" }}>{signingOut ? "Signing out…" : "Sign out"}</button>
      </section>
    </main>
  );
}

const linkStyle: React.CSSProperties = { color: "#343430", fontSize: 12, textDecoration: "none", border: "1px solid #e4e4df", borderRadius: 7, padding: "8px 10px", background: "#fafaf8" };
