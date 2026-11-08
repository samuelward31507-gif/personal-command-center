"use client";
import "./cinder-sidebar.css";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BrandWordmark, CinderMark, CINDER_MONO } from "./cinder-brand";
import CommandBar from "./command-bar";
import { applyAccent, useWorkspace } from "./use-workspace";

type Props = {
  activeKey: string;
  mode: "home" | "crm";
  pathname?: string;
  onNavigate?: (key: string) => void;
};

// The places you use every day; the rest lives under "More" so the sidebar stays calm.
const primary = [
  ["needs-you", "Dashboard", "chart", "/crm/needs-you"],
  ["call", "Call mode", "phone", "/crm/call"],
  ["email", "Email", "send", "/crm/email"],
  ["contacts", "Contacts", "users", "/crm"],
  ["pipeline", "Pipeline", "growth", "/crm/pipeline"],
  ["calendar", "Calendar", "calendar", "/crm/calendar"],
  ["finance", "Money", "money", "/crm/finance"],
] as const;
// Useful, not daily. Outreach, Operations, AI team and Signals stay reachable by URL but are off the sidebar.
const secondary = [
  ["client-success", "Clients", "briefcase", "/crm/client-success"],
  ["projects", "Delivery", "delivery", "/crm/projects"],
  ["reports", "Client reports", "doc", "/crm/reports"],
  ["preparation", "Research", "search", "/crm/preparation"],
  ["practice", "Practice", "mic", "/crm/practice"],
] as const;
const SECONDARY_PATHS = ["/crm/tasks", "/crm/outreach", "/crm/projects", "/crm/preparation", "/crm/practice", "/crm/client-success", "/crm/audit", "/crm/scoreboard", "/crm/reports", "/crm/operations", "/crm/workforce", "/crm/intelligence", "/crm/strategy"];

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    more: <><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 3v4M16.5 3v4M4 9.5h16"/></>,
    growth: <><path d="M4 16 10 10l4 4 6-8"/><path d="M14 6h6v6"/></>,
    edit: <><path d="m14 5 5 5"/><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/></>,
    check: <><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/></>,
    delivery: <><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/></>,
    client: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6"/></>,
    money: <><path d="M12 2v20"/><path d="M17 6.5c-.8-1.3-2.3-2-4.5-2C9.8 4.5 8 6 8 8s1.7 3 4.5 3.5S17 13 17 15s-1.8 4-4.5 4c-2.2 0-4-.8-5-2.3"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    spark: <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/>,
    bulb: <><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/></>,
    strategy: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>,
    chart: <><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
    chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>,
    users: <><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.4-3.6 2.6-5.5 6-5.5s5.6 1.9 6 5.5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.7c1.8.7 2.8 2.4 3 5.3"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2M3 12.5h18"/></>,
    send: <><path d="m21 3-9.5 9.5"/><path d="M21 3 14.5 21l-3-8.5L3 9.5 21 3Z"/></>,
    doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></>,
    clipboard: <><rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3.5h6v1M9 11h6M9 15h4"/></>,
    rail: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
  };
  return <svg className="cx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.spark}</svg>;
}


/**
 * Claude-style sidebar: always visible on desktop until collapsed with the toggle, then a slim
 * icon rail. The choice is remembered. On phones it is a drawer.
 */
export default function CinderSidebar({ activeKey, mode, pathname = "/", onNavigate }: Props) {
  const ws = useWorkspace();
  const custom = !!ws.logoUrl || !/^cinder\b/i.test(ws.businessName.trim());
  // White-label: the workspace's accent replaces the ember, and the tab title carries their name.
  useEffect(() => { applyAccent(ws.accentColor); if (custom) document.title = ws.shortName || ws.businessName; }, [ws.accentColor, ws.shortName, ws.businessName, custom]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let on = true;
    fetch("/api/projects", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => {
      if (!on || !d?.projects) return;
      setClients((d.projects as { id: string; name: string; clientName: string; contactName: string; status: string }[])
        .filter(p => !["completed", "cancelled"].includes(p.status)).slice(0, 5)
        .map(p => ({ id: p.id, name: p.clientName || p.contactName || p.name })));
    }).catch(() => {});
    return () => { on = false; };
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const inSecondary = SECONDARY_PATHS.some(p => pathname.startsWith(p));
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    try { setMoreOpen(inSecondary || localStorage.getItem("cinder.sidebar.more") === "1"); } catch { setMoreOpen(inSecondary); }
  }, [inSecondary]);
  const toggleMore = () => setMoreOpen(o => { try { localStorage.setItem("cinder.sidebar.more", o ? "0" : "1"); } catch { /* ignore */ } return !o; });
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("cinder.sidebar.collapsed") === "1"); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("cx-rail-mode", collapsed);
  }, [collapsed]);
  const toggle = () => setCollapsed(c => {
    try { localStorage.setItem("cinder.sidebar.collapsed", c ? "0" : "1"); } catch { /* ignore */ }
    return !c;
  });

  const go = (e: React.MouseEvent, key: string, href: string) => {
    setMobileOpen(false);
    // Home and My day are in-page views on the Home route; everything else is a normal link.
    if (mode === "home" && onNavigate && (key === "home" || key === "schedule")) { e.preventDefault(); onNavigate(key); }
  };
  const isActive = (key: string) => {
    if (key === "home") return mode === "home" ? activeKey === "home" : false;
    if (key === "schedule") return mode === "home" && activeKey === "schedule";
    if (key === "ask") return pathname.startsWith("/crm/ask");
    if (key === "client-success") return pathname.startsWith("/crm/client-success");
    if (key === "contacts") return pathname === "/crm";
    if (key === "workforce") return pathname.startsWith("/crm/workforce") || pathname.startsWith("/crm/strategy");
    if (key === "pipeline") return pathname.startsWith("/crm/pipeline") || pathname.startsWith("/crm/deals");
    if (key === "preparation") return pathname.startsWith("/crm/preparation") || pathname.startsWith("/crm/audit");
    const map: Record<string, string> = { preparation: "/crm/preparation", projects: "/crm/projects", finance: "/crm/finance", workforce: "/crm/workforce",
      "client-success": "/crm/client-success", "needs-you": "/crm/needs-you", call: "/crm/call", email: "/crm/email", practice: "/crm/practice", outreach: "/crm/outreach", reports: "/crm/reports", scoreboard: "/crm/scoreboard", operations: "/crm/operations", calendar: "/crm/calendar", tasks: "/crm/tasks", audit: "/crm/audit",
      intelligence: "/crm/intelligence", strategy: "/crm/strategy", settings: "/crm/settings" };
    return map[key] ? pathname.startsWith(map[key]) : activeKey === key;
  };
  const item = ([key, label, icon, href]: readonly [string, string, string, string]) =>
    <Link key={key} href={href} className={"cx-item" + (isActive(key) ? " is-active" : "")} aria-current={isActive(key) ? "page" : undefined}
      onClick={e => go(e, key, href)} title={collapsed ? label : undefined}>
      <Icon name={icon} /><span className="cx-label">{label}</span>
    </Link>;

  return <>
    <CommandBar />
    <button type="button" data-variant="primary" className="cx-mobile-toggle" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(o => !o)}>
      <Icon name="rail" />
    </button>
    {mobileOpen && <button type="button" data-variant="primary" className="cx-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={"cx-side" + (collapsed ? " is-collapsed" : "") + (mobileOpen ? " is-open" : "")} aria-label="Cinder navigation">
      <div className="cx-top">
        <Link href="/crm/needs-you" className="cx-brand" onClick={() => setMobileOpen(false)} title="Dashboard">
          {collapsed ? (custom ? <span className="cx-mark cx-mark-text" aria-label={ws.businessName}>{(ws.shortName || ws.businessName).trim().charAt(0).toUpperCase()}</span> : <CinderMark className="cx-mark" ring={CINDER_MONO} ember={CINDER_MONO} />) : <BrandWordmark name={ws.businessName} logoUrl={ws.logoUrl} className="cx-logo" mono fallbackTitle="Cinder" />}
        </Link>
        <button type="button" data-variant="primary" className="cx-collapse" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name="rail" />
        </button>
      </div>

      <Link href="/crm/ask" className={"cx-new" + (isActive("ask") ? " is-active" : "")} onClick={() => setMobileOpen(false)} title={collapsed ? "Ask Cinder" : undefined}>
        <span className="cx-new-icon"><Icon name="chat" /></span><span className="cx-label">Ask Cinder</span>
      </Link>
      <button type="button" data-variant="primary" className="cx-item cx-search" onClick={() => { setMobileOpen(false); window.dispatchEvent(new Event("cinder:command")); }} title={collapsed ? "Search (⌘K)" : undefined}>
        <Icon name="search" /><span className="cx-label">Search</span><kbd className="cx-kbd">⌘K</kbd>
      </button>

      <nav className="cx-nav" aria-label="Agency">
        {primary.map(item)}
        <button type="button" data-variant="primary" className="cx-item cx-more" aria-expanded={moreOpen} onClick={toggleMore} title={collapsed ? "More" : undefined}>
          <Icon name="more" /><span className="cx-label">More</span><span className={"cx-chev" + (moreOpen ? " is-open" : "")} aria-hidden="true">›</span>
        </button>
        {moreOpen && <div className="cx-sub">{secondary.map(item)}</div>}
        {!collapsed && clients.length > 0 && <>
          <div className="cx-group">Clients</div>
          {clients.map(c => <Link key={c.id} href={`/crm/client-success/${c.id}`} className={"cx-item cx-client" + (pathname === `/crm/client-success/${c.id}` ? " is-active" : "")} onClick={() => setMobileOpen(false)}>
            <span className="cx-dot" aria-hidden="true">{c.name.slice(0, 1).toUpperCase()}</span><span className="cx-label">{c.name}</span>
          </Link>)}
        </>}
      </nav>

      <div className="cx-foot">
        {item(["settings", "Settings", "settings", "/crm/settings"])}
        <div className="cx-profile" title={collapsed ? `${ws.ownerFirstName} · ${ws.businessName}` : undefined}>
          <span className="cx-avatar">{ws.ownerFirstName.slice(0, 1).toUpperCase()}</span>
          <span className="cx-label cx-profile-copy"><strong>{ws.ownerFirstName}</strong><small>{ws.businessName}</small></span>
        </div>
      </div>
    </aside>
  </>;
}
