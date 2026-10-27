"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import "./crm-shell.css";

type NavLink = { href: string; icon: string; label: string; match: (path: string, view: string) => boolean };

const mainLinks: NavLink[] = [
  { href: "/", icon: "⌂", label: "Today", match: (path: string) => path === "/" },
  { href: "/crm", icon: "↗", label: "Prospects & pipeline", match: (path: string) => ["/crm", "/crm/pipeline", "/crm/outreach", "/crm/preparation"].includes(path) },
  { href: "/crm/needs-you", icon: "✓", label: "Follow-ups & tasks", match: (path: string) => path.startsWith("/crm/needs-you") || path.startsWith("/crm/tasks") },
  { href: "/crm/calendar", icon: "▦", label: "Calendar", match: (path: string) => path.startsWith("/crm/calendar") },
  { href: "/crm/client-success", icon: "♙", label: "Clients & delivery", match: (path: string) => path.startsWith("/crm/client-success") || path.startsWith("/crm/projects") },
  { href: "/crm/finance", icon: "$", label: "Revenue", match: (path: string) => path.startsWith("/crm/finance") },
  { href: "/crm/workforce", icon: "◈", label: "Hermes", match: (path: string) => path.startsWith("/crm/workforce") },
];

const secondaryLinks: NavLink[] = [
  { href: "/crm/intelligence", icon: "⌕", label: "Research", match: (path: string) => path.startsWith("/crm/intelligence") },
  { href: "/crm/settings", icon: "⚙", label: "Settings", match: (path: string) => path.startsWith("/crm/settings") },
];

function pageTitle(pathname: string, view: string) {
  if (pathname.startsWith("/crm/calendar")) return "Calendar";
  if (pathname.startsWith("/crm/needs-you")) return "Follow-ups";
  if (pathname.startsWith("/crm/tasks")) return "Tasks & follow-ups";
  if (pathname.startsWith("/crm/projects")) return "Client delivery";
  if (pathname.startsWith("/crm/client-success")) return "Clients";
  if (pathname.startsWith("/crm/finance")) return "Revenue";
  if (pathname.startsWith("/crm/pipeline")) return "Sales pipeline";
  if (pathname.startsWith("/crm/outreach")) return "Outreach";
  if (pathname.startsWith("/crm/preparation")) return "Preparation";
  if (pathname.startsWith("/crm/workforce") || view === "workforce") return "Hermes";
  if (pathname.startsWith("/crm/intelligence") || view === "intelligence") return "Research";
  if (pathname.startsWith("/crm/strategy") || view === "strategy") return "Strategy & memory";
  if (pathname.startsWith("/crm/settings") || view === "settings") return "Settings";
  if (view === "schedule") return "My day";
  if (view === "needs-you") return "Needs you";
  if (pathname === "/crm") return "Growth";
  return "Home";
}

function CrmLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "";
  const title = pageTitle(pathname, view);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="app-shell crm-app-shell">
      <aside className="sidebar">
        <Link className="brand crm-brand" href="/" aria-label="Cinder agency workspace home">
          <span className="cinder-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z" fill="currentColor"/><circle cx="25.5" cy="16" r="3.1" fill="#bf542f"/></svg></span>
          <span className="brand-name cinder-wordmark">CINDER</span><span className="workspace-chevron">⌄</span>
        </Link>
        <div className="nav-section-label">AGENCY</div>
        <nav className="primary-nav" aria-label="Agency operations">
          {mainLinks.map(item => {
            const active = item.match(pathname, view);
            return <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMobileNavOpen(false)} className={"nav-item" + (active ? " active" : "")}><span className="glyph" aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-divider"/>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Planning and settings">
          {secondaryLinks.map(item => {
            const active = item.match(pathname, view);
            return <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={"nav-item" + (active ? " active" : "")}><span className="glyph" aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card"><span className="connection-dot"/><div><strong>Agency workspace</strong><small>Private founder workspace</small></div></div>
          <div className="profile-row"><span className="profile-avatar">F</span><span className="profile-copy"><strong>Founder</strong><small>Agency operations</small></span></div>
        </div>
      </aside>
      <section className="main-panel crm-shell-main">
        <header className="topbar">
          <div className="breadcrumbs"><Link href="/">Cinder</Link><span className="breadcrumb-slash">/</span><strong>{title}</strong></div>
          <div className="topbar-actions"><span className="topbar-status"><span className="status-ring"/> Agency workspace</span><Link className="quiet-button crm-back-home" href="/">Home</Link></div>
        </header>
        {children}
      </section>
    </div>
  );
}


export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="crm-layout-loading">Loading agency workspace…</div>}><CrmLayoutContent>{children}</CrmLayoutContent></Suspense>;
}
