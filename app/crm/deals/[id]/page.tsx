"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DISCOVERY_FIELDS, discoveryCompleteness, EMAIL_PURPOSES, mailtoLink, type Discovery, type ProposalStatus, type ContractStatus, type EmailPurpose } from "@/lib/deal-workspace";
import { DEAL_STAGES, STAGE_LABELS } from "@/lib/offers";
import { offersFrom } from "@/lib/workspace";
import { useWorkspace } from "../../../use-workspace";
import { OUTCOME_LABELS, type CallOutcome } from "@/lib/call-outcomes";
import { Markdown } from "../../../ask-answer";
import "../../../home-search.css";
import "./deal.css";

type DealTab = "discovery" | "proposal" | "agreement" | "kickoff" | "email";
type Workspace = {
  deal: { id: string; title: string; stage: string; serviceType: string; setupFee: number; monthlyFee: number; expectedCloseDate: string | null; lostReason: string; notes: string;
    discovery: Discovery; nextStep: string; nextStepAt: string | null; proposalStatus: ProposalStatus; proposalSentAt: string | null; proposalDecidedAt: string | null; agreementStatus: string;
    contractStatus: ContractStatus; contractSentAt: string | null; signedAt: string | null };
  contact: { id: string; name: string; company: string; phone: string; email: string; website: string; location: string } | null;
  activity: { channel: string; outcome: string; notes: string; at: string }[];
  tasks: { id: string; title: string; status: string; priority: string; due: string | null }[];
  events: { id: string; title: string; startsAt: string; type: string; status: string }[];
  audit: { id: string; title: string; date: string; verdict: string; opportunities: string; upsells: string } | null;
  proposals: { id: string; title: string; content: string; status: string; createdAt: string; updatedAt: string }[];
  agreements: { id: string; title: string; content: string; status: string; createdAt: string; updatedAt: string }[];
  project: { id: string; name: string; status: string; targetDate: string | null } | null;
};

const money = (n: number) => "$" + Number(n || 0).toLocaleString("en-US");
const dateLabel = (v: string | null) => (v ? new Date(v.length === 10 ? v + "T12:00:00" : v).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/** Turn the audit's "Future upsells" section into short, clickable ideas. */
function upsellIdeas(text: string): string[] {
  return text.split("\n").map(l => l.replace(/\*+/g, "").replace(/^[-•\d.)\s]+/, "").trim())
    .filter(l => l && !/^later only|not part of the first pitch/i.test(l))
    .map(l => l.split(/[:(—]/)[0].trim()).filter(l => l.length > 3 && l.length < 70).slice(0, 4);
}
const PROPOSAL_COPY: Record<ProposalStatus, string> = { none: "No proposal yet", draft: "Draft ready", sent: "Sent — waiting on them", accepted: "Accepted", declined: "Declined" };
const CONTRACT_COPY: Record<ContractStatus, string> = { none: "Not drafted", draft: "Draft ready", sent: "Sent — waiting on signature", signed: "Signed" };
const twoBusinessDays = () => { const d = new Date(); let added = 0; while (added < 2) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; } return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function defaultPurpose(stage: string, proposal: ProposalStatus, contract: ContractStatus): EmailPurpose {
  if (stage === "won") return "referral_ask";
  if (contract === "sent" || contract === "draft" || proposal === "accepted") return "agreement_follow_up";
  if (proposal === "sent") return "proposal_follow_up";
  if (stage === "nurture") return "check_in";
  if (stage === "meeting_booked") return "no_show";
  return "meeting_recap";
}

export default function DealWorkspacePage() {
  const wsp = useWorkspace();
  const { id } = useParams<{ id: string }>();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [disc, setDisc] = useState<Discovery>({});
  const [next, setNext] = useState({ step: "", at: "" });
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [priceEdit, setPriceEdit] = useState<{ svc: string; setup: string; monthly: string } | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [agEdit, setAgEdit] = useState<{ id: string; content: string } | null>(null);
  const [purpose, setPurpose] = useState<EmailPurpose | "">("");
  const [mailNotes, setMailNotes] = useState("");
  const [mail, setMail] = useState<{ subject: string; body: string; to: string } | null>(null);
  const [signReq, setSignReq] = useState<{ status: string; createdAt: string; signedAt: string | null; signerName: string | null; signerTitle: string | null } | null>(null);
  const [signUrl, setSignUrl] = useState("");
  const [kick, setKick] = useState<{ tier: string; status: string; createdAt: string; submittedAt: string | null; items: { label: string; value: string }[]; files?: { field: string; label: string; name: string; size: number }[] } | null>(null);
  const [kickUrl, setKickUrl] = useState("");
  const [dtab, setDtab] = useState<DealTab | null>(null);
  // Links like /crm/deals/<id>#agreement open that step.
  useEffect(() => { const h = window.location.hash.slice(1); if (["discovery", "proposal", "agreement", "kickoff", "email"].includes(h)) setDtab(h as DealTab); }, []);
  async function newKickoffLink() {
    setSaving("kickoff"); setFlash(null);
    try {
      const r = await fetch("/api/kickoff/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not create the kickoff link.");
      setKickUrl(d.url); void navigator.clipboard?.writeText(d.url);
      setFlash({ ok: true, text: "Kickoff link created and copied. Send it to your client. Older links stop working." });
      const k = await fetch(`/api/kickoff/link?dealId=${id}`, { cache: "no-store" }).then(x => x.ok ? x.json() : null).catch(() => null);
      setKick(k?.request ?? null);
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not create the kickoff link." }); }
    finally { setSaving(null); }
  }
  async function revealEin() {
    const k = await fetch(`/api/kickoff/link?dealId=${id}&reveal=ein`, { cache: "no-store" }).then(x => x.ok ? x.json() : null).catch(() => null);
    if (k?.request) setKick(k.request);
  }
  const copy = (key: string, text: string) => { void navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1400); }); };

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/deal-workspace?id=${id}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see this deal." : d.error || "Could not load this deal.");
      setWs(d); setDisc(d.deal.discovery ?? {}); setNext({ step: d.deal.nextStep ?? "", at: d.deal.nextStepAt ?? "" });
      const s = await fetch(`/api/agreements/sign-link?dealId=${id}`, { cache: "no-store" }).then(x => x.ok ? x.json() : null).catch(() => null);
      setSignReq(s?.request ?? null);
      if (d.deal.stage === "won") {
        const k = await fetch(`/api/kickoff/link?dealId=${id}`, { cache: "no-store" }).then(x => x.ok ? x.json() : null).catch(() => null);
        setKick(k?.request ?? null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load this deal."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>, label: string, okText: string) {
    setSaving(label); setFlash(null);
    try {
      const r = await fetch("/api/deal-workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not save.");
      setFlash({ ok: true, text: [okText, d.handoff].filter(Boolean).join(" ") });
      await load();
      return true;
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not save." }); return false; }
    finally { setSaving(null); }
  }

  async function draftProposal() {
    setSaving("proposal"); setFlash(null);
    try {
      const r = await fetch("/api/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: id, notes: draftNotes }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not draft the proposal.");
      setFlash({ ok: true, text: "Proposal drafted. Read it, edit anything that's off, then copy it into your email." });
      await load();
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not draft the proposal." }); }
    finally { setSaving(null); }
  }

  async function saveProposal() {
    if (!editing) return;
    setSaving("edit");
    try {
      const r = await fetch("/api/proposals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not save.");
      setEditing(null); await load();
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not save." }); }
    finally { setSaving(null); }
  }

  const [addon, setAddon] = useState(false);
  // Changing the plan or add-on rewrites the draft right away, so what he signs always matches what you agreed on the call.
  async function switchPlan(svc: string) {
    const o = Object.values(offersFrom(wsp)).find(x => x.serviceType === svc);
    if (!o || !ws) return;
    if (!(await patch({ serviceType: svc, setupFee: o.setupFee, monthlyFee: o.monthlyFee }, "plan", `Switched to ${o.label}.`))) return;
    if (ws.agreements[0]) await draftAgreement(`Switched to ${o.label}. The agreement was rewritten with the new plan and price: fill in his address and company type again${deal_sent() ? ", then send a new signing link (the old one shows the old plan)" : ""}.`);
  }
  async function switchAddon(on: boolean) {
    setAddon(on);
    if (ws?.agreements[0]) await draftAgreement(`Reactivation add-on ${on ? "added" : "removed"}. The agreement was rewritten: fill in his address and company type again${deal_sent() ? ", then send a new signing link" : ""}.`, on);
  }
  const deal_sent = () => ws?.deal.contractStatus === "sent";
  async function draftAgreement(done?: string, withAddon?: boolean) {
    setSaving("agreement"); setFlash(null);
    try {
      const r = await fetch("/api/agreements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: id, addon: withAddon ?? addon }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not draft the agreement.");
      setFlash({ ok: true, text: done ?? "Agreement created from your template. Fill in every [bracketed] blank before you send it." });
      await load();
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not draft the agreement." }); }
    finally { setSaving(null); }
  }

  // The [bracketed] blanks as fill-in boxes: type his answers on the call, Save, send. No editing contract text.
  const [fills, setFills] = useState<Record<string, string>>({});
  async function saveFills(ag: { id: string; content: string }) {
    let content = ag.content;
    for (const [blank, v] of Object.entries(fills) as [string, string][]) if (v.trim()) content = content.split(blank).join(v.trim());
    if (content === ag.content) { setFlash({ ok: false, text: "Type at least one answer first." }); return; }
    setSaving("fills");
    try {
      const r = await fetch("/api/agreements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ag.id, content }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not save.");
      setFills({}); await load();
      const left = (content.match(/\[[^\]\n]{1,80}\]/g) ?? []).length;
      setFlash({ ok: true, text: left ? `Saved. ${left} blank${left === 1 ? "" : "s"} left.` : "All blanks filled. Send it to sign below." });
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not save." }); }
    finally { setSaving(null); }
  }

  async function saveAgreement() {
    if (!agEdit) return;
    setSaving("agedit");
    try {
      const r = await fetch("/api/agreements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(agEdit) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not save.");
      setAgEdit(null); await load();
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not save." }); }
    finally { setSaving(null); }
  }

  async function createSignLink() {
    setSaving("sign"); setFlash(null); setSignUrl("");
    try {
      const r = await fetch("/api/agreements/sign-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: id, email: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not create the signing link.");
      setSignUrl(d.url);
      setFlash({ ok: true, text: d.emailed ? `Agreement emailed to ${d.emailed}. You'll get an alert when they open it and when they sign. Signing sends them the setup payment link and kickoff checklist by itself.` : `Signing link ready.${d.emailError ? ` ${d.emailError}` : ""} When they sign, the deal moves to Won and they get the payment link and kickoff checklist.` });
      await load();
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not create the signing link." }); }
    finally { setSaving(null); }
  }

  function setContract(status: ContractStatus) {
    if (status === "sent") {
      const at = twoBusinessDays();
      void patch({ contractStatus: status, nextStep: "Follow up on the agreement", nextStepAt: at }, "contract", `Agreement marked sent. Follow-up set for ${dateLabel(at)}.`);
    } else if (status === "signed") {
      if (!confirm("Mark the agreement signed? The deal moves to Won and onboarding starts. Payments stay 'expected' until you record them on Money.")) return;
      void patch({ contractStatus: status, nextStep: "Kickoff call", nextStepAt: inDays(1) }, "contract", "Signed. Deal is Won.");
    }
  }

  async function draftEmail(p: EmailPurpose) {
    setSaving("mail"); setFlash(null); setMail(null);
    try {
      const r = await fetch("/api/follow-up-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: id, purpose: p, notes: mailNotes }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not draft the email.");
      setMail({ subject: d.subject ?? "", body: d.body ?? "", to: d.to ?? "" });
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not draft the email." }); }
    finally { setSaving(null); }
  }

  function setProposal(status: ProposalStatus) {
    if (status === "declined") {
      const reason = prompt("Why did they decline? (price, timing, went with someone else, not a fit…)");
      if (!reason) return;
      void patch({ proposalStatus: status, lostReason: reason }, "status", "Marked declined and moved to Lost.");
    } else if (status === "accepted") {
      if (!confirm("Mark accepted? Next you send the agreement. The deal becomes Won when the agreement is signed.")) return;
      void patch({ proposalStatus: status, nextStep: "Send the agreement", nextStepAt: inDays(0) }, "status", "Accepted. Next: draft and send the agreement below.");
    } else if (status === "sent") {
      const at = twoBusinessDays();
      void patch({ proposalStatus: status, nextStep: "Follow up on the proposal", nextStepAt: at }, "status", `Marked sent. Deal moved to Proposal, follow-up set for ${dateLabel(at)}.`);
    } else void patch({ proposalStatus: status }, "status", "Saved.");
  }

  function printDoc(content: string, heading: string) {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = esc(content).replace(/^# (.*)$/gm, "").replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/^[-*] (.*)$/gm, "<li>$1</li>").replace(/\n{2,}/g, "</p><p>");
    w.document.write(`<!doctype html><title>${esc(heading)}</title><style>body{font:15px/1.65 -apple-system,Segoe UI,Inter,sans-serif;color:rgba(18,20,23,.32);max-width:720px;margin:48px auto;padding:0 24px}h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}h3{font-size:15px;margin:20px 0 6px}li{margin:4px 0 4px 18px}.m{color:rgba(147,152,159,1);font-size:13px;margin-bottom:28px}</style><h1>${esc(heading)}</h1><div class="m">${esc(wsp.businessName)} · ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div><p>${html}</p><script>setTimeout(()=>print(),300)</script>`);
    w.document.close();
  }

  async function createUpsell(idea: string) {
    if (!ws) return;
    setSaving("upsell"); setFlash(null);
    try {
      const who = ws.contact?.company || ws.deal.title.split(" — ")[0];
      const r = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: `${who} — Upsell: ${idea}`.slice(0, 240), contactId: ws.contact?.id ?? null, serviceType: "custom_ai_implementation",
        stage: "contacted", setupFee: 0, monthlyFee: 0, source: "upsell", notes: `Upsell from ${ws.deal.title}: ${idea}` }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not create the upsell deal.");
      window.location.assign("/crm/deals/" + d.id);
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not create the upsell deal." }); setSaving(null); }
  }

  if (error) return <div className="u-page dw-page" role="region" aria-label="Deal"><p className="dw-err">{error}</p><Link href="/crm/pipeline">Back to pipeline</Link></div>;
  if (!ws) return <div className="u-page dw-page" role="region" aria-label="Deal"><p className="dw-muted">Loading deal…</p></div>;
  const { deal, contact } = ws;
  const offer = Object.values(offersFrom(wsp)).find(o => o.serviceType === deal.serviceType);
  const pct = discoveryCompleteness(disc);
  const proposal = ws.proposals[0];
  const closed = deal.stage === "won" || deal.stage === "lost";
  const agreement = ws.agreements[0];
  // The agreement is one click from every open deal: on a call, you go straight from "yes" to the signing link.
  const showAgreement = !closed || deal.contractStatus !== "none" || !!agreement;
  const showKickoff = deal.stage === "won" && (deal.serviceType === "tier1_speed_to_lead" || deal.serviceType === "tier2_revenue_system");
  const showEmail = !closed || deal.stage === "won";
  const tabs: { key: DealTab; label: string }[] = [
    { key: "discovery", label: "Discovery" }, { key: "proposal", label: "Proposal" },
    ...(showAgreement ? [{ key: "agreement" as const, label: "Agreement" }] : []),
    ...(showKickoff ? [{ key: "kickoff" as const, label: "Kickoff" }] : []),
    ...(showEmail ? [{ key: "email" as const, label: "Email" }] : []),
  ];
  // Opens on the step the deal is at; you can switch freely.
  const stepTab: DealTab = showKickoff ? "kickoff" : showAgreement && deal.contractStatus !== "signed" ? "agreement" : deal.stage === "proposal" || deal.proposalStatus !== "none" ? "proposal" : "discovery";
  const tab: DealTab = dtab && tabs.some(t => t.key === dtab) ? dtab : stepTab;
  const blanks = agreement ? (agreement.content.match(/\[[^\]\n]{1,80}\]/g) ?? []).length : 0;

  return <div className="u-page dw-page" role="region" aria-label="Deal">
    <Link className="dw-back" href="/crm/pipeline">Pipeline</Link>
    <header className="dw-head">
      <div>
        <div className="dw-eyebrow">{offer?.label ?? "Deal"}</div>
        <h1 className="dw-title">{contact?.company || deal.title}</h1>
        <div className="dw-meta">
          {contact?.name && <span>{contact.name}</span>}
          {contact?.phone && <a href={"tel:" + contact.phone.replace(/[^+\d]/g, "")}>{contact.phone}</a>}
          {contact?.email && <span>{contact.email}</span>}
          {contact && <Link href={`/crm?contact=${contact.id}`}>Contact record</Link>}
        </div>
      </div>
      {priceEdit ? <form className="dw-price-edit" onSubmit={e => { e.preventDefault();
          const setup = Number(priceEdit.setup), monthly = Number(priceEdit.monthly);
          if (!Number.isFinite(setup) || !Number.isFinite(monthly) || setup < 0 || monthly < 0) { setFlash({ ok: false, text: "Prices must be numbers." }); return; }
          void patch({ serviceType: priceEdit.svc, setupFee: setup, monthlyFee: monthly }, "price", agreement && deal.contractStatus !== "signed" ? "Price saved. Click Recreate from template on the Agreement tab so the contract shows it." : "Price saved.").then(() => setPriceEdit(null)); }}>
        <label>Plan<select value={priceEdit.svc} onChange={e => { const o = Object.values(offersFrom(wsp)).find(x => x.serviceType === e.target.value);
          setPriceEdit({ svc: e.target.value, setup: o ? String(o.setupFee) : priceEdit.setup, monthly: o ? String(o.monthlyFee) : priceEdit.monthly }); }}>
          {Object.values(offersFrom(wsp)).map(o => <option key={o.serviceType} value={o.serviceType}>{o.label}</option>)}
          {!Object.values(offersFrom(wsp)).some(o => o.serviceType === priceEdit.svc) && <option value={priceEdit.svc}>Custom</option>}
        </select></label>
        <label>Setup<input inputMode="decimal" value={priceEdit.setup} onChange={e => setPriceEdit({ ...priceEdit, setup: e.target.value.replace(/[^0-9.]/g, "") })} /></label>
        <label>Monthly<input inputMode="decimal" value={priceEdit.monthly} onChange={e => setPriceEdit({ ...priceEdit, monthly: e.target.value.replace(/[^0-9.]/g, "") })} /></label>
        <span className="dw-price-acts"><button type="submit" data-variant="primary" disabled={!!saving}>{saving === "price" ? "Saving…" : "Save"}</button><button type="button" onClick={() => setPriceEdit(null)}>Cancel</button></span>
      </form>
      : <div className="dw-value"><strong>{money(deal.setupFee)}</strong><span>setup</span><strong>{money(deal.monthlyFee)}</strong><span>/ month</span>
        {!closed && deal.contractStatus !== "signed" && <button type="button" className="dw-price-btn" onClick={() => setPriceEdit({ svc: deal.serviceType, setup: String(deal.setupFee), monthly: String(deal.monthlyFee) })}>Edit price</button>}</div>}
    </header>

    <div className="dw-stages" aria-label="Stage">
      {DEAL_STAGES.map(s => {
        const order = DEAL_STAGES.indexOf(s as typeof DEAL_STAGES[number]);
        const cur = DEAL_STAGES.indexOf(deal.stage as typeof DEAL_STAGES[number]);
        const state = s === deal.stage ? "is-on" : deal.stage !== "lost" && order < cur && s !== "lost" ? "is-past" : "";
        return <button data-variant="primary" key={s} className={"dw-stage " + state} disabled={!!saving || s === deal.stage}
          onClick={() => {
            if (s === "won" && !confirm("Mark Won? Onboarding starts and payments are booked as expected, not paid.")) return;
            if (s === "lost") { const reason = prompt("Why was it lost?"); if (!reason) return; void patch({ stage: s, lostReason: reason }, "stage", "Moved to Lost."); return; }
            if (s === "nurture") {
              const d = new Date(); d.setDate(d.getDate() + 30);
              const def = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const at = prompt("Not now, but maybe later. When should Cinder remind you to check back? (YYYY-MM-DD)", def);
              if (!at || !/^\d{4}-\d{2}-\d{2}$/.test(at)) return;
              void patch({ stage: s, nextStep: "Check back in", nextStepAt: at }, "stage", `Parked in Nurture. It comes back to Today on ${dateLabel(at)}.`); return;
            }
            void patch({ stage: s }, "stage", `Moved to ${STAGE_LABELS[s]}.`);
          }}>{STAGE_LABELS[s]}</button>;
      })}
    </div>
    {deal.stage === "lost" && deal.lostReason && <p className="dw-muted">Lost: {deal.lostReason}</p>}
    {flash && <div className={"dw-flash" + (flash.ok ? "" : " is-bad")} role="status">{flash.text}</div>}

    <div className="dw-grid">
      <div className="dw-col">
        <section className="u-sheet dw-box">
          <h2>Next step</h2>
          <div className="dw-next">
            <input value={next.step} onChange={e => setNext({ ...next, step: e.target.value })} placeholder="e.g. Send proposal, follow up on decision, kickoff call…" />
            <input type="date" value={next.at} onChange={e => setNext({ ...next, at: e.target.value })} />
            <button data-variant="primary" className="dw-btn" disabled={saving === "next"} onClick={() => void patch({ nextStep: next.step, nextStepAt: next.at || null }, "next", "Next step saved.")}>{saving === "next" ? "Saving…" : "Save"}</button>
          </div>
          {!deal.nextStep && !closed && <p className="dw-hint">Every open deal needs a next step with a date. It shows up in Today when it&apos;s due.</p>}
        </section>

        <div className="dw-tabs" role="group" aria-label="Deal steps">
          {tabs.map(t => <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setDtab(t.key)}>{t.label}{t.key === stepTab && <i aria-label="current step" />}</button>)}
        </div>

        {tab === "discovery" && <section className="u-sheet dw-box">
          <div className="u-sheet dw-boxhead"><h2>Discovery</h2><span className="dw-pct"><b><i style={{ width: pct + "%" }} /></b>{pct}% captured</span></div>
          <p className="dw-hint">Fill this in during or right after the discovery call. The proposal is written from it.</p>
          <div className="dw-fields">
            {DISCOVERY_FIELDS.map(f => <label key={f.key} className={"dw-field" + (f.kind === "long" ? " is-wide" : "")}>
              <span>{f.label}</span>
              {f.kind === "long"
                ? <textarea rows={2} value={disc[f.key] ?? ""} placeholder={f.hint} onChange={e => setDisc({ ...disc, [f.key]: e.target.value })} />
                : <input value={disc[f.key] ?? ""} placeholder={f.hint} onChange={e => setDisc({ ...disc, [f.key]: e.target.value })} />}
            </label>)}
          </div>
          <div className="dw-right"><button data-variant="primary" className="dw-btn dw-primary" disabled={saving === "disc"} onClick={() => void patch({ discovery: disc }, "disc", "Discovery saved.")}>{saving === "disc" ? "Saving…" : "Save discovery"}</button></div>
        </section>}

        {tab === "proposal" && <section className="u-sheet dw-box">
          <div className="u-sheet dw-boxhead"><h2>Proposal</h2><span className={"dw-pill dw-pill-" + deal.proposalStatus}>{PROPOSAL_COPY[deal.proposalStatus]}{deal.proposalSentAt && deal.proposalStatus === "sent" ? ` · ${dateLabel(deal.proposalSentAt)}` : ""}</span></div>
          {!proposal ? <>
            <p className="dw-hint">{pct < 50 ? "Capture discovery first — a proposal written without it will be generic." : "Cinder drafts it from your discovery notes, the audit and this deal's price. You review before anything goes out."}</p>
            <textarea className="dw-notes" rows={2} value={draftNotes} onChange={e => setDraftNotes(e.target.value)} placeholder="Anything to emphasise? (optional)" />
            <button data-variant="primary" className="dw-btn dw-primary" disabled={saving === "proposal"} onClick={() => void draftProposal()}>{saving === "proposal" ? "Drafting… (about 20s)" : "Draft proposal"}</button>
          </> : editing?.id === proposal.id ? <>
            <textarea className="dw-editor" rows={18} value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} />
            <div className="dw-row"><button data-variant="primary" className="dw-btn" onClick={() => setEditing(null)}>Cancel</button><button data-variant="primary" className="dw-btn dw-primary" disabled={saving === "edit"} onClick={() => void saveProposal()}>{saving === "edit" ? "Saving…" : "Save edits"}</button></div>
          </> : <>
            <div className="dw-proposal ask-root"><Markdown text={proposal.content} /></div>
            <div className="dw-row">
              <button data-variant="primary" className="dw-btn" onClick={() => setEditing({ id: proposal.id, content: proposal.content })}>Edit</button>
              <button data-variant="primary" className="dw-btn" onClick={() => copy("proposal", proposal.content)}>{copied === "proposal" ? "Copied" : "Copy text"}</button>
              <button data-variant="primary" className="dw-btn" onClick={() => printDoc(proposal.content, `Proposal for ${contact?.company || deal.title}`)}>Print / PDF</button>
              <button data-variant="primary" className="dw-btn" disabled={saving === "proposal"} onClick={() => void draftProposal()}>{saving === "proposal" ? "Redrafting…" : "Redraft"}</button>
            </div>
            {!closed && <div className="dw-row dw-decide">
              <span className="dw-muted">After you send it yourself:</span>
              {deal.proposalStatus !== "sent" && deal.proposalStatus !== "accepted" && <button data-variant="primary" className="dw-btn" disabled={!!saving} onClick={() => setProposal("sent")}>Mark sent</button>}
              {deal.proposalStatus !== "accepted" && <button data-variant="primary" className="dw-btn dw-good" disabled={!!saving} onClick={() => setProposal("accepted")}>Accepted</button>}
              <button data-variant="primary" className="dw-btn dw-bad" disabled={!!saving} onClick={() => setProposal("declined")}>Declined</button>
            </div>}
          </>}
        </section>}

        {tab === "agreement" && <section className="u-sheet dw-box" id="agreement">
          <div className="u-sheet dw-boxhead"><h2>Agreement</h2><span className={"dw-pill dw-pill-c-" + deal.contractStatus}>{CONTRACT_COPY[deal.contractStatus]}{deal.contractSentAt && deal.contractStatus === "sent" ? ` · ${dateLabel(deal.contractSentAt)}` : ""}{deal.signedAt && deal.contractStatus === "signed" ? ` · ${dateLabel(deal.signedAt)}` : ""}</span></div>
          {deal.contractStatus !== "signed" && !closed && <div className="dw-signfor">
            <label><span>Signing for</span>
              <select value={deal.serviceType} disabled={!!saving} onChange={e => void switchPlan(e.target.value)}>
                {Object.values(offersFrom(wsp)).map(o => <option key={o.serviceType} value={o.serviceType}>{o.label}: ${o.setupFee.toLocaleString("en-US")} setup + ${o.monthlyFee.toLocaleString("en-US")}/mo</option>)}
                {!Object.values(offersFrom(wsp)).some(o => o.serviceType === deal.serviceType) && <option value={deal.serviceType}>Custom plan</option>}
              </select></label>
            <label className="dw-signfor-add"><input type="checkbox" checked={addon} disabled={!!saving} onChange={e => void switchAddon(e.target.checked)} /> Reactivation add-on (+$497/mo)</label>
            <span className="dw-signfor-price">{money(deal.setupFee)} setup · {money(deal.monthlyFee + (addon ? 497 : 0))}/mo <button type="button" className="dw-price-btn" onClick={() => setPriceEdit({ svc: deal.serviceType, setup: String(deal.setupFee), monthly: String(deal.monthlyFee) })}>Custom price</button></span>
          </div>}
          {!agreement ? <>
            <p className="dw-hint">Your service agreement, filled in with this deal's plan, price and client, with an itemized Statement of Work in Schedule A. Anything Cinder doesn't know stays as a [bracketed] blank for you.</p>
            <label className="dw-hint" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={addon} onChange={e => setAddon(e.target.checked)} /> Include the Reactivation add-on ($497/month)</label>
            <button data-variant="primary" className="dw-btn dw-primary" disabled={saving === "agreement"} onClick={() => void draftAgreement()}>{saving === "agreement" ? "Creating…" : "Create agreement"}</button>
          </> : agEdit?.id === agreement.id ? <>
            <textarea className="dw-editor" rows={22} value={agEdit.content} onChange={e => setAgEdit({ ...agEdit, content: e.target.value })} />
            <div className="dw-row"><button data-variant="primary" className="dw-btn" onClick={() => setAgEdit(null)}>Cancel</button><button data-variant="primary" className="dw-btn dw-primary" disabled={saving === "agedit"} onClick={() => void saveAgreement()}>{saving === "agedit" ? "Saving…" : "Save edits"}</button></div>
          </> : <>
            {blanks > 0 && deal.contractStatus !== "signed" && <form className="dw-fills" onSubmit={e => { e.preventDefault(); void saveFills(agreement); }}>
              <p className="dw-fills-h">Fill in {blanks === 1 ? "the last blank" : `${blanks} blanks`} before you send it</p>
              {Array.from(new Set<string>(agreement.content.match(/\[[^\]\n]{1,80}\]/g) ?? [])).map((b: string) => <label key={b}><span>{b.slice(1, -1)}</span>
                <input value={fills[b] ?? ""} placeholder={/entity/i.test(b) ? "e.g. a Florida corporation" : /address/i.test(b) ? "e.g. 123 Main St" : ""} onChange={e => setFills({ ...fills, [b]: e.target.value })} /></label>)}
              <button type="submit" data-variant="primary" className="dw-btn dw-primary" disabled={saving === "fills"}>{saving === "fills" ? "Saving…" : "Save answers"}</button>
            </form>}
            <p className="dw-warn">A draft for your review, not legal advice. Fill in every [bracketed] blank{blanks ? ` (${blanks} left)` : ""} and have it checked before you rely on it.</p>
            <div className="dw-proposal ask-root"><Markdown text={agreement.content} /></div>
            <div className="dw-row">
              <button data-variant="primary" className="dw-btn" onClick={() => setAgEdit({ id: agreement.id, content: agreement.content })}>Edit</button>
              <button data-variant="primary" className="dw-btn" onClick={() => copy("agreement", agreement.content)}>{copied === "agreement" ? "Copied" : "Copy text"}</button>
              <button data-variant="primary" className="dw-btn" onClick={() => printDoc(agreement.content, `Service Agreement — ${contact?.company || deal.title}`)}>Print / PDF</button>
              {deal.contractStatus !== "signed" && <button data-variant="primary" className="dw-btn" disabled={saving === "agreement"} onClick={() => void draftAgreement()}>{saving === "agreement" ? "Recreating…" : "Recreate from template"}</button>}
            </div>
            {signReq?.status === "signed" && <p className="dw-signed">Signed electronically by {signReq.signerName}{signReq.signerTitle ? `, ${signReq.signerTitle}` : ""} · {signReq.signedAt ? new Date(signReq.signedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</p>}
            {deal.contractStatus !== "signed" && !closed && <div className="dw-sign">
              <div className="dw-sign-head"><strong>Get it signed online</strong>
                {signReq?.status === "open" && <span className="dw-muted dw-small">Link sent {dateLabel(signReq.createdAt)} · waiting on signature</span>}</div>
              {blanks ? <p className="dw-hint">Fill in the {blanks} [bracketed] blank{blanks === 1 ? "" : "s"} first (Edit). A client should never sign a draft with gaps.</p>
                : <p className="dw-hint">They read it, type their name and sign. Cinder records who, when, their IP and the exact text, then marks the deal Won and starts onboarding.</p>}
              <div className="dw-row">
                <button data-variant="primary" className="dw-btn dw-primary" disabled={!!blanks || saving === "sign"} onClick={() => void createSignLink()}>{saving === "sign" ? "Sending…" : signReq?.status === "open" ? "Send a new signing link" : "Email it to sign"}</button>
                {signUrl && <><input className="dw-mail-subject dw-sign-url" readOnly value={signUrl} onFocus={e => e.currentTarget.select()} aria-label="Signing link" />
                  <button data-variant="primary" className="dw-btn" onClick={() => copy("sign", signUrl)}>{copied === "sign" ? "Copied" : "Copy link"}</button></>}
              </div>
              {signReq?.status === "open" && !signUrl && <p className="dw-muted dw-small">The link was shown once when you created it. Lost it? Create a new one; the old one stops working.</p>}
            </div>}
            {deal.contractStatus !== "signed" && !closed && <div className="dw-row dw-decide">
              <span className="dw-muted">Signing on paper instead? After you send it yourself:</span>
              {deal.contractStatus !== "sent" && <button data-variant="primary" className="dw-btn" disabled={!!saving} onClick={() => setContract("sent")}>Mark sent</button>}
              <button data-variant="primary" className="dw-btn dw-good" disabled={!!saving} onClick={() => setContract("signed")}>Signed</button>
            </div>}
          </>}
        </section>}

        {tab === "kickoff" && <section className="u-sheet dw-box" id="kickoff">
          <div className="u-sheet dw-boxhead"><h2>Kickoff checklist</h2><span className={"dw-pill " + (kick?.status === "submitted" ? "dw-pill-c-signed" : "dw-pill-c-sent")}>{kick?.status === "submitted" ? "Received" : kick ? "Waiting on client" : "Not sent"}</span></div>
          {kick?.status === "submitted" ? <>
            <p className="dw-hint">Received {new Date(kick.submittedAt ?? kick.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}. The 21-business-day go-live clock started then. It's also saved in the project notes.</p>
            <dl className="dw-kick">{kick.items.map(it => <div key={it.label}><dt>{it.label}</dt><dd>{it.value}</dd></div>)}
              {(kick.files ?? []).map(f => <div key={f.field}><dt>{f.label}</dt><dd><a href={`/api/kickoff/link?dealId=${id}&file=${f.field}`} target="_blank" rel="noopener noreferrer">{f.name}</a> ({Math.max(1, Math.round(f.size / 1024))} KB)</dd></div>)}</dl>
            <div className="dw-row"><button data-variant="primary" className="dw-btn" onClick={() => copy("kickoff", kick.items.map(it => `${it.label}: ${it.value}`).join("\n"))}>{copied === "kickoff" ? "Copied" : "Copy answers"}</button>
              {kick.items.some(it => it.value.startsWith("••")) && <button data-variant="primary" className="dw-btn" onClick={() => void revealEin()}>Show EIN</button>}</div>
          </> : <>
            <p className="dw-hint">Your client gets this link right after signing: hours, service area, prices, rules and the details carriers need to register their texting number. Answers land here and check off the kickoff steps in Delivery.</p>
            {kickUrl && <div className="dw-row"><input className="dw-mail-subject dw-sign-url" readOnly value={kickUrl} onFocus={e => e.currentTarget.select()} aria-label="Kickoff link" /><button data-variant="primary" className="dw-btn" onClick={() => copy("kickurl", kickUrl)}>{copied === "kickurl" ? "Copied" : "Copy"}</button></div>}
            <div className="dw-row"><button data-variant="primary" className="dw-btn dw-primary" disabled={saving === "kickoff"} onClick={() => void newKickoffLink()}>{saving === "kickoff" ? "Creating…" : kick ? "Create a new link" : "Create kickoff link"}</button>
              {kick && !kickUrl && <span className="dw-muted dw-small">A link was sent{signReq?.status === "signed" ? " on the signing page" : ""}. Lost it? Create a new one; the old one stops working.</span>}</div>
          </>}
        </section>}

        {tab === "email" ? <section className="u-sheet dw-box">
          <div className="u-sheet dw-boxhead"><h2>Follow-up email</h2><span className="dw-muted dw-small">Email only · you send it</span></div>
          <div className="dw-mailbar">
            <select value={purpose || defaultPurpose(deal.stage, deal.proposalStatus, deal.contractStatus)} onChange={e => setPurpose(e.target.value as EmailPurpose)}>
              {(Object.keys(EMAIL_PURPOSES) as EmailPurpose[]).map(k => <option key={k} value={k}>{EMAIL_PURPOSES[k].label}</option>)}
            </select>
            <input value={mailNotes} onChange={e => setMailNotes(e.target.value)} placeholder="Anything to mention? (optional)" />
            <button data-variant="primary" className="dw-btn dw-primary" disabled={saving === "mail"} onClick={() => void draftEmail(purpose || defaultPurpose(deal.stage, deal.proposalStatus, deal.contractStatus))}>{saving === "mail" ? "Drafting…" : mail ? "Redraft" : "Draft email"}</button>
          </div>
          {mail && <div className="dw-mail">
            <input className="dw-mail-subject" value={mail.subject} onChange={e => setMail({ ...mail, subject: e.target.value })} aria-label="Subject" />
            <textarea className="dw-editor" rows={9} value={mail.body} onChange={e => setMail({ ...mail, body: e.target.value })} aria-label="Email body" />
            <div className="dw-row">
              <button data-variant="primary" className="dw-btn" onClick={() => copy("mail", `Subject: ${mail.subject}\n\n${mail.body}`)}>{copied === "mail" ? "Copied" : "Copy"}</button>
              <a className="dw-btn dw-primary dw-linkbtn" href={mailtoLink(mail.to || contact?.email || "", mail.subject, mail.body)}>Open in my email</a>
              {!(mail.to || contact?.email) && <span className="dw-muted dw-small">No email on this contact. Add one on the contact record.</span>}
            </div>
          </div>}
        </section> : null}
      </div>

      <div className="dw-col dw-side">
        {ws.project && <section className="u-sheet dw-box dw-win"><h2>Onboarding</h2><p><Link href="/crm/projects">{ws.project.name}</Link> · {ws.project.status.replace(/_/g, " ")}{ws.project.targetDate ? ` · launch ${dateLabel(ws.project.targetDate)}` : ""}</p></section>}
        {ws.audit && <section className="u-sheet dw-box"><div className="u-sheet dw-boxhead"><h2>Audit</h2><Link href={`/crm/audits/${ws.audit.id}`} className="dw-mini-link">Full report</Link></div><div className="dw-small dw-md"><Markdown text={ws.audit.verdict.replace(/^HYPOTHESIS:\s*/gim, "").slice(0, 700)} /></div>{ws.audit.upsells && deal.stage !== "won" && <><div className="dw-label">Later upsells</div><p className="dw-small">{ws.audit.upsells.replace(/\*\*/g, "").split("\n").slice(0, 3).join(" · ")}</p></>}</section>}
        {deal.stage === "won" && <section className="u-sheet dw-box"><h2>Grow this client</h2>
          <p className="dw-small">Upsells and referrals come from clients who are getting results. Start one as its own deal.</p>
          {upsellIdeas(ws.audit?.upsells ?? "").map(idea => <div key={idea} className="dw-upsell"><span>{idea}</span>
            <button data-variant="primary" className="dw-btn" disabled={!!saving} onClick={() => void createUpsell(idea)}>Create deal</button></div>)}
          <div className="dw-row"><button data-variant="primary" className="dw-btn" disabled={!!saving} onClick={() => { const idea = prompt("What's the upsell? (e.g. Old-lead reactivation, Tier 2 upgrade)"); if (idea) void createUpsell(idea); }}>+ Other upsell</button>
            <button data-variant="primary" className="dw-btn" disabled={!!saving} onClick={() => void patch({ nextStep: "Ask for a referral", nextStepAt: inDays(30) }, "next", "Referral ask scheduled for 30 days out — it'll show in Today.")}>Remind me to ask for a referral</button></div>
        </section>}
        <section className="u-sheet dw-box"><h2>Meetings</h2>{ws.events.length ? ws.events.map(e => <div key={e.id} className="dw-line"><span>{e.title}</span><small>{new Date(e.startsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></div>) : <p className="dw-muted">None yet.</p>}</section>
        <section className="u-sheet dw-box"><h2>Open tasks</h2>{ws.tasks.length ? ws.tasks.map(t => <div key={t.id} className="dw-line"><span>{t.title}</span><small>{t.due ? dateLabel(t.due) : t.priority}</small></div>) : <p className="dw-muted">None.</p>}</section>
        <section className="u-sheet dw-box"><h2>Call history</h2>{ws.activity.length ? ws.activity.map((a, i) => <div key={i} className="dw-line"><span>{OUTCOME_LABELS[a.outcome as CallOutcome] ?? a.outcome.replace(/_/g, " ")}{a.notes ? ` — ${a.notes.slice(0, 80)}` : ""}</span><small>{dateLabel(a.at)}</small></div>) : <p className="dw-muted">No calls logged.</p>}</section>
      </div>
    </div>
  </div>;
}
