"use client";

import { useCallback, useEffect, useState } from "react";
import { CALL_OUTCOMES, OUTCOME_LABELS, type CallOutcome } from "@/lib/call-outcomes";
import type { QueueItem, QueueGroup, QueueStatus } from "@/lib/my-day";
import SuggestedDeal, { type SuggestedDealData } from "./suggested-deal";

const STATUS: Record<QueueStatus, { label: string; color: string }> = {
  overdue: { label: "Overdue", color: "#f0a3a3" },
  blocked: { label: "Blocked", color: "#e8b08a" },
  today: { label: "Today", color: "#d6a98c" },
  upcoming: { label: "Upcoming", color: "#8a8a8a" },
};

function localKey(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

const ROW: React.CSSProperties = { background: "#121212", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px 16px" };
const PILL: React.CSSProperties = { flex: "0 0 auto", minWidth: 74, textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: .4, border: "1px solid", borderRadius: 999, padding: "4px 10px", marginTop: 1 };
const BTN: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid #303030", background: "#1b1b1b", color: "#ddd", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", lineHeight: 1.2 };
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: "#ededed", color: "#0b0b0b", borderColor: "#ededed" };
const SALES: QueueGroup[] = ["revenue", "prospects", "meetings", "deals"];
const chip = (on: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid " + (on ? "#ededed" : "#2a2a2a"), background: on ? "#ededed" : "#141414", color: on ? "#0b0b0b" : "#cfcfcf", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" });

export default function MyDayQueue({ showFilters = false, title = "Today’s queue" }: { showFilters?: boolean; title?: string }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [focus, setFocus] = useState<"all" | "sales" | "delivery" | "admin">("all");
  const [notice, setNotice] = useState<{ ok: boolean; text: string; deal?: SuggestedDealData | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const now = new Date();
      const tomorrow = new Date(now); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const q = new URLSearchParams({ today: localKey(now), dayEnd: tomorrow.toISOString(), windowEnd: dayAfter.toISOString() });
      const r = await fetch("/api/my-day?" + q.toString(), { cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see today's queue." : data.error || "Could not load today's queue.");
      setItems(Array.isArray(data.items) ? data.items : []);
      setGroups(data.groups || {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load today's queue.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function call(item: QueueItem) {
    if (!item.contact?.phone) return;
    // Record that a call was launched; the outcome the founder taps attaches to it.
    void fetch("/api/call-logs", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: item.contact.id, channel: "call", action: "outbound_call", outcome: "initiated", notes: "Call launched from My Day." }) }).catch(() => {});
    setOpen(item.id);
    window.location.href = "tel:" + item.contact.phone.replace(/[^+\d]/g, "");
  }

  async function logOutcome(item: QueueItem, outcome: CallOutcome) {
    if (!item.contact) return;
    if (outcome === "do_not_contact" && !confirm(`Mark ${item.contact.name} do not contact? This stops all outreach and suppresses the number and email.`)) return;
    setBusy(item.id + outcome); setNotice(null);
    try {
      const r = await fetch("/api/contacts/outcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: item.contact.id, outcome }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Could not log this outcome.");
      const parts = [`${item.contact.name}: ${data.label}`, data.nextFollowUp ? `next follow-up ${data.nextFollowUp}` : "follow-up cleared"];
      if (data.sequenceStopped) parts.push("sequence stopped");
      for (const d of data.deals || []) parts.push(`“${d.title}” → ${d.to}`);
      setNotice({ ok: true, text: parts.join(" · "), deal: data.suggestedDeal || null });
      setOpen(null);
      setItems(old => old.filter(i => i.id !== item.id)); // handled for today
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Could not log this outcome." });
    } finally { setBusy(null); }
  }

  const visible = items.filter(i => focus === "all" || (focus === "sales" ? SALES.includes(i.group) : i.group === focus));
  const byGroup = visible.reduce<Record<string, QueueItem[]>>((acc, i) => { (acc[i.group] ||= []).push(i); return acc; }, {});
  const order: QueueGroup[] = ["revenue", "prospects", "meetings", "deals", "delivery", "admin"];
  const overdue = items.filter(i => i.status === "overdue" || i.status === "blocked").length;

  return <section className="surface-panel schedule-panel" aria-labelledby="queue-heading">
    <div className="panel-heading">
      <div>
        <h2 id="queue-heading">{title}</h2>
        <p>{loading ? "Building your queue…" : items.length ? `${items.length} item${items.length === 1 ? "" : "s"}${overdue ? ` · ${overdue} overdue or blocked` : ""}. Revenue first. Cinder prepares; you make the calls.` : "Nothing due. Prospect, or prep tomorrow."}</p>
      </div>
      <button className="text-action" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    {showFilters && items.length > 0 && <div role="tablist" aria-label="Queue focus" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 2px" }}>
      {([["all", "All", items.length], ["sales", "Sales focus", items.filter(i => SALES.includes(i.group)).length], ["delivery", "Delivery", items.filter(i => i.group === "delivery").length], ["admin", "Money & admin", items.filter(i => i.group === "admin").length]] as const).map(([key, label, count]) =>
        <button key={key} type="button" role="tab" aria-selected={focus === key} style={chip(focus === key)} onClick={() => setFocus(key)}>{label} <span style={{ opacity: .6 }}>{count}</span></button>)}
    </div>}
    {error && <p className="local-note" role="alert">{error}</p>}
    {notice && <p className="local-note" role="status" style={{ color: notice.ok ? "#86efac" : "#fca5a5" }}>{notice.text}</p>}
    {notice?.deal && <SuggestedDeal key={notice.text} deal={notice.deal} />}
    {order.filter(g => byGroup[g]?.length).map(g => <div key={g} style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: "#9a9aa4", margin: "0 0 6px" }}>{groups[g] || g} · {byGroup[g].length}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {byGroup[g].map(item => <div key={item.id} style={ROW}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <span style={{ ...PILL, color: STATUS[item.status].color, borderColor: STATUS[item.status].color + "55" }}>{STATUS[item.status].label}</span>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 650, color: "#f3f3f3", lineHeight: 1.35 }}>{item.title}</div>
              <div style={{ fontSize: 12.5, color: "#a1a1a1", lineHeight: 1.55, marginTop: 3 }}>{item.why}</div>
              {item.lastActivity && <div style={{ fontSize: 12, color: "#7c7c86", marginTop: 2 }}>Last touch: {item.lastActivity}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
              {item.callable && <button type="button" style={BTN_PRIMARY} onClick={() => call(item)}>Call</button>}
              {item.contact && (item.group === "revenue" || item.group === "prospects" || item.group === "deals") && <button type="button" style={BTN} onClick={() => setOpen(open === item.id ? null : item.id)} aria-expanded={open === item.id}>Log outcome</button>}
              <a style={{ ...BTN, textDecoration: "none" }} href={item.href}>Open</a>
            </div>
          </div>
          {open === item.id && item.contact && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "1px solid #262626" }}>
            {CALL_OUTCOMES.map(o => <button key={o} type="button" disabled={busy !== null} onClick={() => void logOutcome(item, o)}
              style={{ ...BTN, justifyContent: "center", color: o === "do_not_contact" ? "#fca5a5" : o === "meeting_booked" || o === "interested" ? "#86efac" : "#ddd" }}>
              {busy === item.id + o ? "Saving…" : OUTCOME_LABELS[o]}
            </button>)}
          </div>}
        </div>)}
      </div>
    </div>)}
  </section>;
}
