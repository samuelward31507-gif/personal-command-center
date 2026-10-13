"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import "./crm-shell.css";

const mainLinks = [
  { href: "/", icon: "⌂", label: "Home", match: (path: string) => path === "/" },
  { href: "/?view=schedule", icon: "▦", label: "My day", match: (_path: string, view: string) => view === "schedule" },
  { href: "/crm/calendar", icon: "▦", label: "Calendar", match: (path: string) => path.startsWith("/crm/calendar") },
  { href: "/?view=needs-you", icon: "▤", label: "Needs you", match: (_path: string, view: string) => view === "needs-you" },
  { href: "/crm", icon: "↗", label: "Growth", match: (path: string) => ["/crm", "/crm/pipeline", "/crm/outreach"].includes(path) },
  { href: "/crm/tasks", icon: "✓", label: "Tasks", match: (path: string) => path.startsWith("/crm/tasks") },
  { href: "/crm/projects", icon: "▱", label: "Delivery", match: (path: string) => path.startsWith("/crm/projects") },
  { href: "/crm/client-success", icon: "♙", label: "Client success", match: (path: string) => path.startsWith("/crm/client-success") },
  { href: "/crm/finance", icon: "$", label: "Money", match: (path: string) => path.startsWith("/crm/finance") },
  { href: "/?view=workforce", icon: "♧", label: "AI team", match: (_path: string, view: string) => view === "workforce" },
];

const secondaryLinks = [
  { href: "/?view=intelligence", icon: "✳", label: "Intelligence", match: (path: string, view: string) => path.startsWith("/crm/intelligence") || view === "intelligence" },
  { href: "/?view=strategy", icon: "✧", label: "Strategy & memory", match: (path: string, view: string) => path.startsWith("/crm/strategy") || view === "strategy" },
  { href: "/?view=settings", icon: "⚙", label: "Settings", match: (path: string, view: string) => path.startsWith("/crm/settings") || view === "settings" },
];

function pageTitle(pathname: string, view: string) {
  if (pathname.startsWith("/crm/calendar")) return "Calendar";
  if (pathname.startsWith("/crm/tasks")) return "Tasks";
  if (pathname.startsWith("/crm/projects")) return "Delivery";
  if (pathname.startsWith("/crm/client-success")) return "Client success";
  if (pathname.startsWith("/crm/finance")) return "Money";
  if (pathname.startsWith("/crm/pipeline")) return "Sales pipeline";
  if (pathname.startsWith("/crm/outreach")) return "Outreach";
  if (pathname.startsWith("/crm/workforce") || view === "workforce") return "AI team";
  if (pathname.startsWith("/crm/intelligence") || view === "intelligence") return "Intelligence";
  if (pathname.startsWith("/crm/strategy") || view === "strategy") return "Strategy & memory";
  if (pathname.startsWith("/crm/settings") || view === "settings") return "Settings";
  if (view === "schedule") return "My day";
  if (view === "needs-you") return "Needs you";
  if (pathname === "/crm") return "Growth";
  return "Home";
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "";
  const title = pageTitle(pathname, view);
  return (
    <div className="app-shell crm-app-shell">
      <aside className="sidebar">
        <Link className="brand crm-brand" href="/" aria-label="Cinder agency workspace home">
          <span className="cinder-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z" fill="currentColor"/><circle cx="25.5" cy="16" r="3.1" fill="#bf542f"/></svg></span>
          <span className="brand-name cinder-wordmark">CINDER</span><span className="workspace-chevron">⌄</span>
        </Link>
        <div className="nav-section-label">RUN THE AGENCY</div>
        <nav className="primary-nav" aria-label="Agency operations">
          {mainLinks.map(item => {
            const active = item.match(pathname, view);
            return <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={"nav-item" + (active ? " active" : "")}><span className="glyph" aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-divider"/>
        <div className="nav-section-label">PLAN & CONFIGURE</div>
        <nav className="primary-nav" aria-label="Planning and settings">
          {secondaryLinks.map(item => {
            const active = item.match(pathname, view);
            return <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={"nav-item" + (active ? " active" : "")}><span className="glyph" aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card"><span className="connection-dot"/><div><strong>Agency workspace</strong><small>Private CRM storage</small></div></div>
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
