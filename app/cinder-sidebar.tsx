"use client";

import React from "react";

type Props = {
  activeKey: string;
  mode: "home" | "crm";
  pathname?: string;
  onNavigate?: (key: string) => void;
};

const primary = [
  ["home", "Home", "home", "/"],
  ["schedule", "My day", "grid", "/?view=schedule"],
  ["calendar", "Calendar", "calendar", "/crm/calendar"],
  ["needs-you", "Needs you", "list", "/crm/needs-you"],
  ["growth", "Growth", "growth", "/crm"],
  ["preparation", "Preparation", "edit", "/crm/preparation"],
  ["tasks", "Tasks", "check", "/crm/tasks"],
  ["projects", "Delivery", "delivery", "/crm/projects"],
  ["client-success", "Client success", "client", "/crm/client-success"],
  ["finance", "Money", "money", "/crm/finance"],
  ["workforce", "AI team", "spark", "/crm/workforce"],
] as const;
const secondary = [
  ["intelligence", "Intelligence", "spark", "/crm/intelligence"],
  ["strategy", "Strategy & memory", "strategy", "/crm/strategy"],
  ["settings", "Settings", "settings", "/crm/settings"],
] as const;

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 3v4M16.5 3v4M4 9.5h16"/></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
    growth: <><path d="M4 16 10 10l4 4 6-8"/><path d="M14 6h6v6"/></>,
    edit: <><path d="m14 5 5 5"/><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    delivery: <><path d="M3 7h18l-2 13H5L3 7Z"/><path d="M8 7V4h8v3"/></>,
    client: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6"/></>,
    money: <><path d="M12 2v20"/><path d="M17 6.5c-.8-1.3-2.3-2-4.5-2C9.8 4.5 8 6 8 8s1.7 3 4.5 3.5S17 13 17 15s-1.8 4-4.5 4c-2.2 0-4-.8-5-2.3"/></>,
    spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
    strategy: <><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 13.5 21 15l-2 3-2-.7-2 1v2h-4v-2l-2-1-2 .7-2-3 2-1.5v-3L5 9l2-3 2 .7 2-1V3h4v2l2 1 2-.7 2 3-2 1.5v3Z"/></>,
  };
  return <span className="glyph" aria-hidden="true"><svg className="glyph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.spark}</svg></span>;
}

export default function CinderSidebar({ activeKey, mode, pathname = "/", onNavigate }: Props) {
  const go = (key: string, href: string) => {
    if (mode === "home" && onNavigate) onNavigate(key);
    else window.location.assign(href);
  };
  const isActive = (key: string, href: string) => {
    if (key === "home") return mode === "home" ? activeKey === "home" : pathname === "/";
    if (key === "schedule") return mode === "home" ? activeKey === "schedule" : false;
    if (key === "growth") return pathname === "/crm" || pathname.startsWith("/crm/pipeline") || pathname.startsWith("/crm/outreach");
    if (key === "preparation") return pathname.startsWith("/crm/preparation");
    if (key === "projects") return pathname.startsWith("/crm/projects");
    if (key === "finance") return pathname.startsWith("/crm/finance");
    if (key === "workforce") return pathname.startsWith("/crm/workforce");
    if (key === "client-success") return pathname.startsWith("/crm/client-success");
    if (key === "needs-you") return pathname.startsWith("/crm/needs-you");
    if (key === "calendar") return pathname.startsWith("/crm/calendar");
    if (key === "tasks") return pathname.startsWith("/crm/tasks");
    if (key === "intelligence") return pathname.startsWith("/crm/intelligence");
    if (key === "strategy") return pathname.startsWith("/crm/strategy");
    if (key === "settings") return pathname.startsWith("/crm/settings");
    return activeKey === key;
  };
  return <aside id="cinder-sidebar-shared" className="sidebar">
    <button type="button" className="brand brand-button" onClick={() => go("home", "/")} aria-label="Go to Home">
      <span className="cinder-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z" fill="currentColor"/><circle cx="25.5" cy="16" r="3.1" fill="#bf542f"/></svg></span>
      <span className="brand-name cinder-wordmark">CINDER</span><span className="workspace-chevron">⌄</span>
    </button>
    <div className="nav-section-label">RUN THE AGENCY</div>
    <nav className="primary-nav" aria-label="Agency operations">
      {primary.map(([key, label, icon, href]) => <button key={key} type="button" className={"nav-item" + (isActive(key, href) ? " active" : "")} aria-current={isActive(key, href) ? "page" : undefined} onClick={() => go(key, href)}><Icon name={icon}/><span>{label}</span></button>)}
    </nav>
    <div className="sidebar-divider"/>
    <div className="nav-section-label">PLAN & CONFIGURE</div>
    <nav className="primary-nav" aria-label="Planning and settings">
      {secondary.map(([key, label, icon, href]) => <button key={key} type="button" className={"nav-item" + (isActive(key, href) ? " active" : "")} aria-current={isActive(key, href) ? "page" : undefined} onClick={() => go(key, href)}><Icon name={icon}/><span>{label}</span></button>)}
    </nav>
    <div className="sidebar-bottom">
      <div className="connection-card"><span className="connection-dot"/><div><strong>Agency workspace</strong><small>{mode === "crm" ? "Private CRM storage" : "CRM integrations not connected"}</small></div></div>
      <div className="profile-row"><span className="profile-avatar">F</span><span className="profile-copy"><strong>Founder</strong><small>{mode === "crm" ? "Agency operations" : "Agency workspace"}</small></span></div>
    </div>
  </aside>;
}
