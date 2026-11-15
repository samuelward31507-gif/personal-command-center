"use client";
// Client delivery tracker for the founding offer: dates, guarantee window and status, booked estimates,
// onboarding checklist, Review Builder setup and the monthly report. Nothing here sends anything.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BOOKING_SOURCES, DELIVERY_DATES, ONBOARDING_CHECKLIST, REVIEW_TRIGGERS, type Delivery, type DeliveryState, type ReviewSetup } from "@/lib/founding-offer";
import "../../founding.css";

type Booking = { id: string; bookedOn: string; estimateAt: string | null; homeowner: string; source: string; note: string };
type Data = {
  project: { id: string; name: string; status: string; offer: string; contactId: string | null };
  delivery: Delivery; reviews: ReviewSetup; state: DeliveryState; taskCreated: boolean; bookings: Booking[];
  reports: { period: string; status: string }[]; offer: { name: string; spotsTotal: number; used: number; left: number }; today: string;
};
const SOURCE_LABEL: Record<string, string> = { revival: "Dead Quote Revival", callback: "10-Second Callback", other: "Other (doesn't count)" };
const fmt = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");
const prevMonth = (today: string) => { const d = new Date(today.slice(0, 7) + "-15T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };

export default function DeliveryPanel({ projectId }: { projectId: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [del, setDel] = useState<Delivery>({});
  const [offer, setOffer] = useState("standard");
  const [rev, setRev] = useState<ReviewSetup | null>(null);
  const [bk, setBk] = useState({ bookedOn: "", source: "revival", homeowner: "", estimateAt: "" });
  const [rp, setRp] = useState({ period: "", leadsIn: "", under10Pct: "", reviewRequests: "", newReviews: "" });
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = useCallback((x: Data) => { setD(x); setDel(x.delivery); setOffer(x.project.offer); setRev(x.reviews); }, []);
  useEffect(() => {
    fetch("/api/delivery?project=" + encodeURIComponent(projectId), { cache: "no-store" })
      .then(async r => { const x = await r.json().catch(() => ({})); if (!r.ok) throw new Error(x.error || "Couldn't load delivery."); return x as Data; })
      .then(x => { apply(x); setBk(b => ({ ...b, bookedOn: x.today })); setRp(p => ({ ...p, period: prevMonth(x.today) })); })
      .catch(e => setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't load delivery." }));
  }, [projectId, apply]);

  async function post(action: string, payload: Record<string, unknown>, ok: string) {
    setBusy(action); setNote(null);
    try {
      const r = await fetch("/api/delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: projectId, action, ...payload }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(x.error || "Couldn't save.");
      if (action === "report") { window.location.href = `/crm/client-success/${projectId}/report/${payload.period}`; return; }
      apply(x); setNote({ ok: true, text: ok + (x.taskCreated ? " Guarantee is at risk: a task was added for you." : "") });
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." }); }
    finally { setBusy(""); }
  }

  if (!d || !rev) return <section className="fo"><h3>Delivery tracker</h3><p className="fo-sub">{note?.text ?? "Loading…"}</p></section>;
  const s = d.state;
  const statusClass = s.status === "met" ? "met" : s.status === "at risk" ? "risk" : s.status.startsWith("missed") ? "missed" : "";
  const checklist = del.checklist ?? {};

  return <section className="fo" aria-label="Delivery tracker">
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
      <h3>Delivery tracker · {d.offer.name}</h3>
      <span className={"fo-status " + statusClass}>Guarantee: {s.status}</span>
    </div>
    <p className="fo-sub">Booked estimates log here (manually until the texting system logs them). The 30-day window starts at go-live. Day 15 with fewer than 2 booked turns it at risk and adds a task for you.</p>

    <div className="fo-kpis">
      <div><small>Booked in window</small><b>{s.bookedInWindow} / 3</b></div>
      <div><small>Window</small><b>{s.guaranteeWindowEnd ? `Day ${s.windowDay ?? "—"} · ends ${fmt(s.guaranteeWindowEnd)}` : "Starts at go-live"}</b></div>
      <div><small>First booked estimate</small><b>{fmt(s.firstBookedEstimateDate)}</b></div>
      <div><small>Monthly billing starts</small><b>{s.monthlyBillingStart ? fmt(s.monthlyBillingStart) : "After first booked appointment"}</b></div>
    </div>

    <h4>Plan and dates</h4>
    <div className="fo-grid three">
      <label className="fo-field"><span>Offer</span><select value={offer} onChange={e => setOffer(e.target.value)}>
        <option value="standard">Standard</option>
        <option value="founding" disabled={d.project.offer !== "founding" && d.offer.left <= 0}>Founding ({d.offer.left} of {d.offer.spotsTotal} spots left)</option></select></label>
      {DELIVERY_DATES.map(f => <label key={f.key} className="fo-field"><span>{f.label}</span><input type="date" value={del[f.key] ?? ""} onChange={e => setDel({ ...del, [f.key]: e.target.value || undefined })} /></label>)}
    </div>

    <h4>Onboarding checklist</h4>
    <div className="fo-check">
      {ONBOARDING_CHECKLIST.map(c => <label key={c.key}><input type="checkbox" checked={!!checklist[c.key]} onChange={e => setDel({ ...del, checklist: { ...checklist, [c.key]: e.target.checked } })} />{c.label}
        {"count" in c && c.count && <input type="number" min={0} aria-label="How many old leads" placeholder="count" value={del.oldLeadsReceived ?? ""} onChange={e => setDel({ ...del, oldLeadsReceived: e.target.value === "" ? undefined : Number(e.target.value) })} />}</label>)}
    </div>
    <div className="fo-row"><button type="button" className="fo-btn primary" disabled={!!busy} onClick={() => void post("save", { delivery: del, offer }, "Saved.")}>{busy === "save" ? "Saving…" : "Save dates and checklist"}</button></div>

    <h4>Booked estimates</h4>
    <div className="fo-grid three">
      <label className="fo-field"><span>Booked on</span><input type="date" max={d.today} value={bk.bookedOn} onChange={e => setBk({ ...bk, bookedOn: e.target.value })} /></label>
      <label className="fo-field"><span>Source</span><select value={bk.source} onChange={e => setBk({ ...bk, source: e.target.value })}>{BOOKING_SOURCES.map(x => <option key={x} value={x}>{SOURCE_LABEL[x]}</option>)}</select></label>
      <label className="fo-field"><span>Homeowner (first name or initials)</span><input value={bk.homeowner} maxLength={120} onChange={e => setBk({ ...bk, homeowner: e.target.value })} /></label>
      <label className="fo-field"><span>Estimate date and time</span><input type="datetime-local" value={bk.estimateAt} onChange={e => setBk({ ...bk, estimateAt: e.target.value })} /></label>
    </div>
    <div className="fo-row"><button type="button" className="fo-btn" disabled={!!busy || !bk.bookedOn} onClick={() => void post("add-booking", { ...bk, estimateAt: bk.estimateAt ? new Date(bk.estimateAt).toISOString() : "" }, "Booked estimate logged.").then(() => setBk(b => ({ ...b, homeowner: "", estimateAt: "" })))}>{busy === "add-booking" ? "Logging…" : "Log booked estimate"}</button></div>
    {d.bookings.length > 0 && <ul className="fo-list">{d.bookings.map(b => <li key={b.id}><span>{fmt(b.bookedOn)} · {SOURCE_LABEL[b.source] ?? b.source}{b.homeowner ? ` · ${b.homeowner}` : ""}{b.estimateAt ? <small> · estimate {new Date(b.estimateAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small> : null}</span>
      <button type="button" className="fo-x" disabled={!!busy} onClick={() => { if (confirm("Remove this booked estimate from the log?")) void post("remove-booking", { id: b.id }, "Removed."); }}>Remove</button></li>)}</ul>}

    <h4>Review Builder</h4>
    <div className="fo-grid three">
      <label className="fo-field"><span>Job-complete trigger</span><select value={rev.trigger ?? ""} onChange={e => setRev({ ...rev, trigger: (e.target.value || undefined) as ReviewSetup["trigger"] })}><option value="">Not set</option>{REVIEW_TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label className="fo-field wide"><span>Google review link</span><input value={rev.reviewLink ?? ""} inputMode="url" placeholder="https://g.page/r/…/review" onChange={e => setRev({ ...rev, reviewLink: e.target.value })} /></label>
      <label className="fo-field"><span>Request after (days)</span><input type="number" min={0} value={rev.delayDays} onChange={e => setRev({ ...rev, delayDays: Number(e.target.value) })} /></label>
      <label className="fo-field"><span>Reminder after (days)</span><input type="number" min={0} value={rev.reminderDays} onChange={e => setRev({ ...rev, reminderDays: Number(e.target.value) })} /></label>
      <label className="fo-field"><span>Review requests sent</span><input type="number" min={0} value={rev.requestsSent} onChange={e => setRev({ ...rev, requestsSent: Number(e.target.value) })} /></label>
      <label className="fo-field"><span>Reviews received</span><input type="number" min={0} value={rev.reviewsReceived} onChange={e => setRev({ ...rev, reviewsReceived: Number(e.target.value) })} /></label>
    </div>
    <p className="fo-sub" style={{ marginTop: 8 }}>Setup only: sending is built in the texting system. Enter counts by hand until Google review access is connected.</p>
    <div className="fo-row"><button type="button" className="fo-btn" disabled={!!busy} onClick={() => void post("reviews", { reviews: rev }, "Review Builder saved.")}>{busy === "reviews" ? "Saving…" : "Save Review Builder"}</button></div>

    <h4>Monthly report</h4>
    <p className="fo-sub">Drafted automatically on the 1st. Booked estimates and value come from the log and the client&apos;s discovery numbers; add what the texting system shows.</p>
    <div className="fo-grid three">
      <label className="fo-field"><span>Month</span><input type="month" value={rp.period} onChange={e => setRp({ ...rp, period: e.target.value })} /></label>
      <label className="fo-field"><span>Leads in</span><input inputMode="numeric" value={rp.leadsIn} onChange={e => setRp({ ...rp, leadsIn: e.target.value })} /></label>
      <label className="fo-field"><span>% texted in under 10 seconds</span><input inputMode="numeric" value={rp.under10Pct} onChange={e => setRp({ ...rp, under10Pct: e.target.value })} /></label>
      <label className="fo-field"><span>Review requests sent</span><input inputMode="numeric" value={rp.reviewRequests} onChange={e => setRp({ ...rp, reviewRequests: e.target.value })} /></label>
      <label className="fo-field"><span>New reviews</span><input inputMode="numeric" value={rp.newReviews} onChange={e => setRp({ ...rp, newReviews: e.target.value })} /></label>
    </div>
    <div className="fo-row">
      <button type="button" className="fo-btn primary" disabled={!!busy || !rp.period} onClick={() => void post("report", rp, "Report saved.")}>{busy === "report" ? "Building…" : "Build report"}</button>
      {d.reports.slice(0, 6).map(r => <Link key={r.period} className="fo-btn" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} href={`/crm/client-success/${projectId}/report/${r.period}`}>{r.period}{r.status === "sent" ? " · sent" : ""}</Link>)}
    </div>
    {note && <p className={"fo-note " + (note.ok ? "ok" : "bad")} role="status">{note.text}</p>}
  </section>;
}
