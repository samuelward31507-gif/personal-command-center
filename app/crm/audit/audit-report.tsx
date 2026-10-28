"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { reportSection } from "@/lib/business-audit";

export type AuditView = {
  id: string; title: string; companyName: string; content: string; sourceUrls: string[]; confidence: string;
  officialWebsite?: string | null; websiteStatus?: string; fitDecision?: string | null; incomplete?: boolean; createdAt?: string;
};

const C = {
  text: "#f4f4f5", body: "#d4d4d8", muted: "#9a9aa4", faint: "#6f6f78", line: "#26262b",
  card: "#141417", inset: "#101013", accent: "#d6a98c",
};

const FIT: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  fit: { label: "Fit", fg: "#86efac", bg: "#10241a", border: "#1f4d33" },
  conditional_fit: { label: "Conditional fit", fg: "#fcd34d", bg: "#2a2410", border: "#5a4a1a" },
  no_fit: { label: "No fit", fg: "#fca5a5", bg: "#2a1414", border: "#5c2a2a" },
  needs_clarification: { label: "Needs clarification", fg: "#c4b5fd", bg: "#1c1830", border: "#3b3366" },
};

const TAGS: Record<string, string> = {
  "VERIFIED FACT": "#86efac", VERIFIED: "#86efac", OBSERVATION: "#93c5fd", HYPOTHESIS: "#fcd34d", UNKNOWN: "#a1a1aa",
};

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Minimal, safe inline renderer: **bold**, bare URLs → short links, evidence labels → tags. No HTML injection. */
function inline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*)|(https?:\/\/[^\s)\]]+)|\b(VERIFIED FACT|VERIFIED|OBSERVATION|HYPOTHESIS|UNKNOWN)\b:?/g;
  let last = 0; let i = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index! > last) nodes.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) nodes.push(<strong key={k} style={{ color: C.text, fontWeight: 600 }}>{inline(m[1].slice(2, -2), k)}</strong>);
    else if (m[2]) {
      const url = m[2].replace(/[.,;:]+$/, "");
      nodes.push(<a key={k} href={url} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none", borderBottom: "1px dotted #6b5446", whiteSpace: "nowrap" }}>{host(url)}</a>);
      if (url.length < m[2].length) nodes.push(m[2].slice(url.length));
    } else if (m[3]) {
      const color = TAGS[m[3]];
      nodes.push(<span key={k} style={{ display: "inline-block", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color, border: `1px solid ${color}40`, background: `${color}12`, borderRadius: 4, padding: "1px 5px", marginRight: 4, verticalAlign: "1px" }}>{m[3] === "VERIFIED FACT" ? "VERIFIED" : m[3]}</span>);
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Block renderer for one section: bullets, numbered lists and short paragraphs. */
function Blocks({ text }: { text: string }) {
  const lines = text.split("\n").map(l => l.replace(/\s+$/, "")).filter(l => l.trim() && !/^-{3,}$/.test(l.trim()));
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(<Tag key={`l${out.length}`} style={{ margin: "2px 0 0", paddingLeft: 18, display: "grid", gap: 7 }}>
      {list.items.map((item, i) => <li key={i} style={{ paddingLeft: 2 }}>{inline(item, `li${out.length}-${i}`)}</li>)}
    </Tag>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const item = (bullet ?? numbered)![1];
      if (list && list.ordered === ordered) list.items.push(item);
      else { flush(); list = { ordered, items: [item] }; }
    } else {
      flush();
      out.push(<p key={`p${out.length}`} style={{ margin: 0 }}>{inline(line, `p${out.length}`)}</p>);
    }
  }
  flush();
  return <div style={{ display: "grid", gap: 9, fontSize: 13.5, lineHeight: 1.65, color: C.body }}>{out}</div>;
}

function Card({ title, children, tone, tag }: { title: string; children: ReactNode; tone?: string; tag?: string }) {
  return <section style={{ background: C.card, border: `1px solid ${C.line}`, borderTop: tone ? `2px solid ${tone}` : `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px", minWidth: 0 }}>
    <h3 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: tone ?? C.muted, display: "flex", alignItems: "center", gap: 8 }}>
      {title}{tag && <span style={{ fontSize: 9.5, letterSpacing: 0.8, color: C.faint, border: `1px solid ${C.line}`, borderRadius: 999, padding: "1px 7px" }}>{tag}</span>}
    </h3>
    {children}
  </section>;
}

export function AuditReport({ audit }: { audit: AuditView }) {
  const s = (h: string) => reportSection(audit.content, h);
  const verdict = s("Verdict").replace(/^[-*•]\s+/, "");
  const sections = {
    business: s("Business"), opportunities: s("Top opportunities"), flags: s("Red flags"),
    call: s("Call plan"), upsells: s("Future upsells").replace(/^\*\*?Later[^\n]*\n?/i, ""), next: s("Next CRM action").replace(/^[-*•]\s+/, ""),
  };
  const structured = Boolean(verdict || sections.business || sections.call);
  const fit = FIT[audit.fitDecision ?? ""] ?? null;
  const btn: CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 8, background: "#1a1a1e", color: C.text, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", textDecoration: "none" };

  return <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
    {/* Header */}
    <header style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, letterSpacing: 1.6, color: C.accent }}>BUSINESS AUDIT · SAVED DRAFT</p>
          <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.5px", color: C.text }}>{audit.companyName}</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={btn} onClick={() => navigator.clipboard.writeText(audit.content)}>Copy</button>
          <Link href="/crm/preparation" style={btn}>Open in Preparation</Link>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 12.5, color: C.muted }}>
        {fit && <span style={{ color: fit.fg, background: fit.bg, border: `1px solid ${fit.border}`, borderRadius: 999, padding: "4px 11px", fontWeight: 700, fontSize: 12 }}>{fit.label}</span>}
        <span style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 11px" }}>{audit.confidence} confidence</span>
        {audit.officialWebsite
          ? <a href={audit.officialWebsite} target="_blank" rel="noreferrer" style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 11px", color: C.body, textDecoration: "none" }}>{host(audit.officialWebsite)} <span style={{ color: audit.websiteStatus === "verified" ? "#86efac" : "#fcd34d" }}>{audit.websiteStatus === "verified" ? "✓ verified" : `· ${(audit.websiteStatus ?? "unverified").replace("_", " ")}`}</span></a>
          : <span style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 11px", color: "#fcd34d" }}>No website found</span>}
      </div>
      {verdict && <p style={{ margin: 0, padding: "12px 14px", background: C.inset, borderLeft: `3px solid ${fit?.fg ?? C.accent}`, borderRadius: 8, fontSize: 14.5, lineHeight: 1.6, color: C.text }}>{inline(verdict.replace(/\*\*/g, ""), "verdict")}</p>}
      {audit.incomplete && <p style={{ margin: 0, fontSize: 12.5, color: "#fca5a5" }}>Research stopped early. Treat this report as partial.</p>}
    </header>

    {sections.next && <div style={{ display: "flex", gap: 12, alignItems: "baseline", background: "#1b1714", border: "1px solid #4a3a2f", borderRadius: 12, padding: "13px 18px" }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: C.accent, whiteSpace: "nowrap" }}>NEXT STEP</span>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text }}>{inline(sections.next, "next")}</div>
    </div>}

    {structured ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14 }}>
        {sections.business && <Card title="Business"><Blocks text={sections.business} /></Card>}
        {sections.call && <Card title="Call plan" tone={C.accent}><Blocks text={sections.call} /></Card>}
      </div>
      {sections.opportunities && <Card title="Top opportunities"><Blocks text={sections.opportunities} /></Card>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14 }}>
        {sections.flags && <Card title="Red flags" tone="#fca5a5"><Blocks text={sections.flags} /></Card>}
        {sections.upsells && <Card title="Future upsells" tag="LATER — NOT THE FIRST PITCH" tone="#93c5fd"><Blocks text={sections.upsells} /></Card>}
      </div>
    </> : <Card title="Report"><Blocks text={audit.content.replace(/^#+\s*/gm, "")} /></Card>}

    {audit.sourceUrls.length > 0 && <details style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 18px" }}>
      <summary style={{ cursor: "pointer", fontSize: 12.5, color: C.muted }}>Sources ({audit.sourceUrls.length})</summary>
      <ul style={{ margin: "12px 0 2px", paddingLeft: 18, display: "grid", gap: 6, fontSize: 12.5 }}>
        {audit.sourceUrls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>{host(url)}</a> <span style={{ color: C.faint, overflowWrap: "anywhere" }}>{url.replace(/^https?:\/\/(www\.)?[^/]+/, "").slice(0, 70)}</span></li>)}
      </ul>
    </details>}
  </div>;
}
