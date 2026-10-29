"use client";

import { Fragment, useState, type ReactNode } from "react";
import { resolveLink, type AskAction } from "@/lib/ask";

/* ---------- Minimal, safe Markdown (no HTML injection): headings, lists, tables, bold, italics, code, links. ---------- */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|(?<![\w*])\*([^*\n]+)\*(?!\w)|(https?:\/\/[^\s)]+)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1] !== undefined) {
      const href = resolveLink(m[2]);
      const record = /^cinder:\/\/(contact|deal|audit)\//i.exec(m[2])?.[1];
      if (!href) out.push(m[1]);
      else if (record) out.push(<a key={k} href={href} className={"ask-chip ask-chip-" + record.toLowerCase()}>{m[1]}</a>);
      else out.push(<a key={k} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>{m[1]}</a>);
    } else if (m[3] !== undefined) out.push(<strong key={k}>{inline(m[3], k)}</strong>);
    else if (m[4] !== undefined) out.push(<code key={k}>{m[4]}</code>);
    else if (m[5] !== undefined) out.push(<em key={k}>{m[5]}</em>);
    else if (m[6] !== undefined) out.push(<a key={k} href={m[6]} target="_blank" rel="noreferrer">{m[6].replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, b = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = "b" + b++;
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { blocks.push(<h4 key={key} className="ask-h">{inline(h[2], key)}</h4>); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(<div key={key} className="ask-table-wrap"><table className="ask-table"><thead><tr>{head.map((c, j) => <th key={j}>{inline(c, key + "h" + j)}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, `${key}r${ri}c${j}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) item += " " + lines[i++].trim();
        items.push(item);
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={key} className="ask-list">{items.map((it, j) => <li key={j}>{inline(it, key + "i" + j)}</li>)}</List>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s|^\s*([-*•]|\d+[.)])\s+|^\s*\|.*\|\s*$/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key}>{para.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, key + "p" + j)}</Fragment>)}</p>);
  }
  return <div className="ask-md">{blocks}</div>;
}

/* ---------- Confirm card for one proposed change ---------- */

const KIND_ICON: Record<string, string> = { create_contact: "+", set_follow_up: "◷", add_note: "✎", create_task: "✓", create_deal: "$", move_deal: "→", schedule_event: "▦" };

function describe(a: AskAction): string[] {
  const p = a.params;
  const money = (n: unknown) => "$" + Number(n ?? 0).toLocaleString("en-US");
  switch (a.kind) {
    case "create_contact": return [p.company ? String(p.company) : "", p.phone ? String(p.phone) : "", p.location ? String(p.location) : ""].filter(Boolean);
    case "set_follow_up": return ["Follow up on " + new Date(String(p.date) + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })];
    case "create_task": return [String(p.priority) + " priority", p.dueDate ? "due " + p.dueDate : "no due date"];
    case "create_deal": return [`${money(p.setupFee)} setup + ${money(p.monthlyFee)}/mo`, "stage: " + String(p.stage).replace(/_/g, " ")];
    case "move_deal": return ["→ " + String(p.stage).replace(/_/g, " "), p.stage === "won" ? "starts onboarding · payments stay expected until you record them" : p.lostReason ? "reason: " + p.lostReason : ""].filter(Boolean);
    case "schedule_event": return [new Date(String(p.startsAt)).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), p.durationMinutes + " min"];
    default: return [];
  }
}

export function ActionCard({ action }: { action: AskAction }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "dismissed" | "error">("idle");
  const [result, setResult] = useState<{ message: string; href?: string } | null>(null);
  if (state === "dismissed") return null;
  async function confirm() {
    setState("saving");
    try {
      const r = await fetch("/api/ask/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Couldn't make that change.");
      setResult({ message: data.message, href: data.href }); setState("done");
    } catch (e) { setResult({ message: e instanceof Error ? e.message : "Couldn't make that change." }); setState("error"); }
  }
  return <div className={"ask-action" + (state === "done" ? " is-done" : "")}>
    <span className="ask-action-icon" aria-hidden="true">{state === "done" ? "✓" : KIND_ICON[action.kind] ?? "•"}</span>
    <div className="ask-action-main">
      <strong>{action.label}</strong>
      <small>{state === "done" || state === "error" ? result?.message : (describe(action).filter(Boolean).join(" · ") || action.summary)}</small>
    </div>
    {state === "done"
      ? result?.href && <a className="ask-btn" href={result.href}>Open</a>
      : <div className="ask-action-btns">
          <button data-variant="primary" type="button" className="ask-btn ask-btn-ghost" onClick={() => setState("dismissed")} disabled={state === "saving"}>Dismiss</button>
          <button data-variant="primary" type="button" className="ask-btn ask-btn-primary" onClick={() => void confirm()} disabled={state === "saving"}>{state === "saving" ? "Saving…" : state === "error" ? "Retry" : "Confirm"}</button>
        </div>}
  </div>;
}
