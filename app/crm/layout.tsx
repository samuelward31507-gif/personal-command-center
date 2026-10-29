"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import "./crm-shell.css";
import CinderSidebar from "../cinder-sidebar";

type NavLink = { href: string; icon: string; label: string; match: (path: string, view: string) => boolean };

function NavIcon({ name }: { name: string }) {
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
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 13.5 21 15l-2 3-2-.7-2 1v2h-4v-2l-2-1-2 .7-2-3 2-1.5v-3L5 9l2-3 2 .7 2-1V3h4v2l2 1 2-.7 2 3-2 1.5v3Z"/></>,
    strategy: <><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></>,
  };
  return <svg className="glyph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.spark}</svg>;
}

const mainLinks: NavLink[] = [
  { href: "/", icon: "home", label: "Home", match: (path: string) => path === "/" },
  { href: "/?view=schedule", icon: "grid", label: "My day", match: (_path: string, view: string) => view === "schedule" },
  { href: "/crm/calendar", icon: "grid", label: "Calendar", match: (path: string) => path.startsWith("/crm/calendar") },
  { href: "/crm/needs-you", icon: "list", label: "Needs you", match: (path: string) => path.startsWith("/crm/needs-you") },
  { href: "/crm", icon: "growth", label: "Growth", match: (path: string) => ["/crm", "/crm/pipeline", "/crm/outreach"].includes(path) },
  { href: "/crm/preparation", icon: "edit", label: "Preparation", match: (path: string) => path.startsWith("/crm/preparation") },
  { href: "/crm/tasks", icon: "check", label: "Tasks", match: (path: string) => path.startsWith("/crm/tasks") },
  { href: "/crm/projects", icon: "delivery", label: "Delivery", match: (path: string) => path.startsWith("/crm/projects") },
  { href: "/crm/client-success", icon: "client", label: "Client success", match: (path: string) => path.startsWith("/crm/client-success") },
  { href: "/crm/finance", icon: "money", label: "Money", match: (path: string) => path.startsWith("/crm/finance") },
  { href: "/crm/workforce", icon: "spark", label: "AI team", match: (path: string) => path.startsWith("/crm/workforce") },
];

const secondaryLinks: NavLink[] = [
  { href: "/crm/intelligence", icon: "spark", label: "Intelligence", match: (path: string) => path.startsWith("/crm/intelligence") },
  { href: "/crm/strategy", icon: "strategy", label: "Strategy & memory", match: (path: string) => path.startsWith("/crm/strategy") },
  { href: "/crm/settings", icon: "settings", label: "Settings", match: (path: string) => path.startsWith("/crm/settings") },
];

function pageTitle(pathname: string, view: string) {
  if (pathname.startsWith("/crm/audit")) return "Business audit";
  if (pathname.startsWith("/crm/calendar")) return "Calendar";
  if (pathname.startsWith("/crm/needs-you")) return "Today";
  if (pathname.startsWith("/crm/call")) return "Call mode";
  if (pathname.startsWith("/crm/scoreboard")) return "Scoreboard";
  if (pathname.startsWith("/crm/tasks")) return "Tasks";
  if (pathname.startsWith("/crm/projects")) return "Delivery";
  if (pathname.startsWith("/crm/client-success")) return "Client success";
  if (pathname.startsWith("/crm/finance")) return "Money";
  if (pathname.startsWith("/crm/pipeline")) return "Sales pipeline";
  if (pathname.startsWith("/crm/deals")) return "Deal";
  if (pathname.startsWith("/crm/outreach")) return "Outreach";
  if (pathname.startsWith("/crm/preparation")) return "Preparation";
  if (pathname.startsWith("/crm/workforce") || view === "workforce") return "AI team";
  if (pathname.startsWith("/crm/intelligence") || view === "intelligence") return "Intelligence";
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
  return (
    <div className="app-shell crm-app-shell">
      <CinderSidebar activeKey={view || (pathname === "/" ? "home" : "")} mode="crm" pathname={pathname} />
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
