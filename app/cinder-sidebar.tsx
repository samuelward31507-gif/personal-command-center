"use client";
import "./cinder-sidebar.css";

import React, { useEffect, useState } from "react";

type Props = {
  activeKey: string;
  mode: "home" | "crm";
  pathname?: string;
  onNavigate?: (key: string) => void;
};

const primary = [
  ["schedule", "My day", "sun", "/?view=schedule"],
  ["needs-you", "Needs you", "inbox", "/crm/needs-you"],
  ["calendar", "Calendar", "calendar", "/crm/calendar"],
  ["growth", "Contacts & pipeline", "growth", "/crm"],
  ["preparation", "Preparation", "edit", "/crm/preparation"],
  ["tasks", "Tasks", "check", "/crm/tasks"],
  ["projects", "Delivery", "delivery", "/crm/projects"],
  ["client-success", "Clients", "client", "/crm/client-success"],
  ["finance", "Money", "money", "/crm/finance"],
] as const;
const secondary = [
  ["audit", "Business audit", "search", "/crm/audit"],
  ["workforce", "AI team", "spark", "/crm/workforce"],
  ["intelligence", "Intelligence", "bulb", "/crm/intelligence"],
  ["strategy", "Strategy & memory", "strategy", "/crm/strategy"],
] as const;

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
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
    chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>,
    rail: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></>,
  };
  return <svg className="cx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.spark}</svg>;
}

const Mark = () => <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z" fill="currentColor"/><circle cx="25.5" cy="16" r="3.1" fill="#d6a98c"/></svg>;

/**
 * Claude-style sidebar: always visible on desktop until collapsed with the toggle, then a slim
 * icon rail. The choice is remembered. On phones it is a drawer.
 */
export default function CinderSidebar({ activeKey, mode, pathname = "/", onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
    if (key === "growth") return pathname === "/crm" || pathname.startsWith("/crm/pipeline") || pathname.startsWith("/crm/outreach");
    const map: Record<string, string> = { preparation: "/crm/preparation", projects: "/crm/projects", finance: "/crm/finance", workforce: "/crm/workforce",
      "client-success": "/crm/client-success", "needs-you": "/crm/needs-you", calendar: "/crm/calendar", tasks: "/crm/tasks", audit: "/crm/audit",
      intelligence: "/crm/intelligence", strategy: "/crm/strategy", settings: "/crm/settings" };
    return map[key] ? pathname.startsWith(map[key]) : activeKey === key;
  };
  const item = ([key, label, icon, href]: readonly [string, string, string, string]) =>
    <a key={key} href={href} className={"cx-item" + (isActive(key) ? " is-active" : "")} aria-current={isActive(key) ? "page" : undefined}
      onClick={e => go(e, key, href)} title={collapsed ? label : undefined}>
      <Icon name={icon} /><span className="cx-label">{label}</span>
    </a>;

  return <>
    <button type="button" data-variant="primary" className="cx-mobile-toggle" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(o => !o)}>
      <Icon name="rail" />
    </button>
    {mobileOpen && <button type="button" data-variant="primary" className="cx-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={"cx-side" + (collapsed ? " is-collapsed" : "") + (mobileOpen ? " is-open" : "")} aria-label="Cinder navigation">
      <div className="cx-top">
        <a href="/" className="cx-brand" onClick={e => go(e, "home", "/")} title="Cinder home">
          <span className="cx-mark"><Mark /></span><span className="cx-wordmark">Cinder</span>
        </a>
        <button type="button" data-variant="primary" className="cx-collapse" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name="rail" />
        </button>
      </div>

      <a href="/" className={"cx-new" + (isActive("home") ? " is-active" : "")} onClick={e => go(e, "home", "/")} title={collapsed ? "Ask Cinder" : undefined}>
        <span className="cx-new-icon"><Icon name="chat" /></span><span className="cx-label">Ask Cinder</span>
      </a>

      <nav className="cx-nav" aria-label="Agency">
        <div className="cx-group">Agency</div>
        {primary.map(item)}
        <div className="cx-group">Plan</div>
        {secondary.map(item)}
      </nav>

      <div className="cx-foot">
        {item(["settings", "Settings", "settings", "/crm/settings"])}
        <div className="cx-profile" title={collapsed ? "Samuel · Contractor Growth Co" : undefined}>
          <span className="cx-avatar">S</span>
          <span className="cx-label cx-profile-copy"><strong>Samuel</strong><small>Contractor Growth Co</small></span>
        </div>
      </div>
    </aside>
  </>;
}
