"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./crm-shell.css";

const mainLinks = [
  { href: "/", icon: "⌂", label: "Overview" },
  { href: "/?view=schedule", icon: "▦", label: "My day" },
  { href: "/crm/needs-you", icon: "▤", label: "Needs attention" },
  { href: "/crm", icon: "↗", label: "Contacts" },
  { href: "/crm/tasks", icon: "✓", label: "Tasks" },
  { href: "/crm/projects", icon: "▱", label: "Projects" },
  { href: "/crm/finance", icon: "$", label: "Finances" },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell crm-app-shell">
      <aside className="sidebar">
        <Link className="brand crm-brand" href="/" aria-label="Cinder home">
          <span className="cinder-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M25.2 7.1A13 13 0 1 0 25.2 24.9L20.8 20.5a6.8 6.8 0 1 1 0-9L25.2 7.1Z" fill="currentColor"/><circle cx="25.5" cy="16" r="3.1" fill="#bf542f"/></svg></span>
          <span className="brand-name cinder-wordmark">CINDER</span><span className="workspace-chevron">⌄</span>
        </Link>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Workspace">
          {mainLinks.map(item => <Link key={item.label} href={item.href} className={"nav-item"+(pathname === item.href && item.href === "/crm" ? " active" : "")}><span className="glyph" aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>)}
        </nav>
        <div className="sidebar-divider"/>
        <div className="nav-section-label">YOUR SPACE</div>
        <nav className="primary-nav" aria-label="Your space">
          <Link className="nav-item" href="/?view=strategy"><span className="glyph">✧</span><span>Strategy &amp; memory</span></Link>
          <Link className="nav-item" href="/?view=settings"><span className="glyph">⚙</span><span>Settings</span></Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card"><span className="connection-dot"/><div><strong>Personal workspace</strong><small>CRM storage connected</small></div></div>
          <div className="profile-row"><span className="profile-avatar">F</span><span className="profile-copy"><strong>Founder</strong><small>Personal workspace</small></span></div>
        </div>
      </aside>
      <section className="main-panel crm-shell-main">
        <header className="topbar">
          <div className="breadcrumbs"><Link href="/">Cinder</Link><span className="breadcrumb-slash">/</span><strong>Contacts &amp; growth</strong></div>
          <div className="topbar-actions"><span className="topbar-status"><span className="status-ring"/> Personal CRM</span><Link className="quiet-button crm-back-home" href="/">Home</Link></div>
        </header>
        {children}
      </section>
    </div>
  );
}
