"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import "./crm-shell.css";
import CinderSidebar from "../cinder-sidebar";

function pageTitle(pathname: string, view: string) {
  if (pathname.startsWith("/crm/audits")) return "Audit report";
  if (pathname.startsWith("/crm/audit")) return "Business audit";
  if (pathname.startsWith("/crm/calendar")) return "Meetings";
  if (pathname.startsWith("/crm/ask")) return "Ask Cinder";
  if (pathname.startsWith("/crm/needs-you")) return "Today";
  if (pathname.startsWith("/crm/call")) return "Call mode";
  if (pathname.startsWith("/crm/scoreboard")) return "Scoreboard";
  if (pathname.startsWith("/crm/tasks")) return "Tasks";
  if (pathname.startsWith("/crm/projects")) return "Delivery";
  if (pathname.startsWith("/crm/client-success")) return "Clients";
  if (pathname.startsWith("/crm/reports")) return "Client reports";
  if (pathname.startsWith("/crm/finance")) return "Money";
  if (pathname.startsWith("/crm/pipeline")) return "Pipeline";
  if (pathname.startsWith("/crm/deals")) return "Deal";
  if (pathname.startsWith("/crm/outreach")) return "Outreach";
  if (pathname.startsWith("/crm/preparation")) return "Research";
  if (pathname.startsWith("/crm/workforce") || view === "workforce") return "AI team";
  if (pathname.startsWith("/crm/intelligence") || view === "intelligence") return "Signals";
  if (pathname.startsWith("/crm/strategy") || view === "strategy") return "Strategy & memory";
  if (pathname.startsWith("/crm/settings") || view === "settings") return "Settings";
  if (view === "schedule") return "My day";
  if (view === "needs-you") return "Today";
  if (pathname === "/crm") return "Contacts";
  return "Home";
}

function CrmLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "";
  const title = pageTitle(pathname, view);
  return (
    <div className="app-shell crm-app-shell">
      <CinderSidebar activeKey={view} mode="crm" pathname={pathname} />
      <section className="main-panel crm-shell-main">
        <header className="topbar">
          <div className="breadcrumbs"><Link href="/crm/needs-you">Cinder</Link><span className="breadcrumb-slash">/</span><strong>{title}</strong></div>
          
        </header>
        {children}
      </section>
    </div>
  );
}


export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="crm-layout-loading">Loading agency workspace…</div>}><CrmLayoutContent>{children}</CrmLayoutContent></Suspense>;
}
