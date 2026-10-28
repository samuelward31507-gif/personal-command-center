"use client";

import { useCallback, useEffect, useState } from "react";
import { CALL_OUTCOMES, OUTCOME_LABELS, type CallOutcome } from "@/lib/call-outcomes";
import type { QueueItem, QueueGroup, QueueStatus } from "@/lib/my-day";
import SuggestedDeal, { type SuggestedDealData } from "./suggested-deal";

const STATUS: Record<QueueStatus, { label: string; color: string }> = {
  overdue: { label: "Overdue", color: "#fca5a5" },
  blocked: { label: "Blocked", color: "#fdba74" },
  today: { label: "Today", color: "#fcd34d" },
  upcoming: { label: "Upcoming", color: "#a1a1aa" },
};

function localKey(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export default function MyDayQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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

  const byGroup = items.reduce<Record<string, QueueItem[]>>((acc, i) => { (acc[i.group] ||= []).push(i); return acc; }, {});
  const order: QueueGroup[] = ["revenue", "prospects", "meetings", "deals", "delivery", "admin"];
  const overdue = items.filter(i => i.status === "overdue" || i.status === "blocked").length;

  return <section className="surface-panel schedule-panel" aria-labelledby="queue-heading">
    <div className="panel-heading">
      <div>
        <h2 id="queue-heading">Today’s queue</h2>
        <p>{loading ? "Building your queue…" : items.length ? `${items.length} item${items.length === 1 ? "" : "s"}${overdue ? ` · ${overdue} overdue or blocked` : ""}. Revenue first. Cinder prepares; you make the calls.` : "Nothing due. Prospect, or prep tomorrow."}</p>
      </div>
      <button className="text-action" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    {error && <p className="local-note" role="alert">{error}</p>}
    {notice && <p className="local-note" role="status" style={{ color: notice.ok ? "#86efac" : "#fca5a5" }}>{notice.text}</p>}
    {notice?.deal && <SuggestedDeal key={notice.text} deal={notice.deal} />}
    {order.filter(g => byGroup[g]?.length).map(g => <div key={g} style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: "#9a9aa4", margin: "0 0 6px" }}>{groups[g] || g} · {byGroup[g].length}</div>
      <div className="schedule-list">
        {byGroup[g].map(item => <div key={item.id} className="schedule-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <span className="schedule-time" style={{ color: STATUS[item.status].color, fontWeight: 700 }}>{STATUS[item.status].label}</span>
          <div className="schedule-description" style={{ minWidth: 0, flex: "1 1 260px" }}>
            <strong>{item.title}</strong>
            <small>{item.why}</small>
            {item.lastActivity && <small style={{ color: "#7c7c86" }}>Last touch: {item.lastActivity}</small>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {item.callable && <button className="text-action" onClick={() => call(item)}>Call</button>}
            {item.contact && (item.group === "revenue" || item.group === "prospects" || item.group === "deals") && <button className="text-action" onClick={() => setOpen(open === item.id ? null : item.id)} aria-expanded={open === item.id}>Log outcome</button>}
            <a className="text-action" href={item.href}>Open →</a>
          </div>
          {open === item.id && item.contact && <div style={{ flexBasis: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 6, marginTop: 8 }}>
            {CALL_OUTCOMES.map(o => <button key={o} type="button" className="quiet-button" disabled={busy !== null} onClick={() => void logOutcome(item, o)}
              style={{ fontSize: 12, padding: "7px 9px", color: o === "do_not_contact" ? "#fca5a5" : o === "meeting_booked" || o === "interested" ? "#86efac" : undefined }}>
              {busy === item.id + o ? "Saving…" : OUTCOME_LABELS[o]}
            </button>)}
          </div>}
        </div>)}
      </div>
    </div>)}
  </section>;
}
