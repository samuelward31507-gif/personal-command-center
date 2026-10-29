"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DISCOVERY_FIELDS, discoveryCompleteness, type Discovery, type ProposalStatus } from "@/lib/deal-workspace";
import { DEAL_STAGES, STAGE_LABELS, OFFERS } from "@/lib/offers";
import { OUTCOME_LABELS, type CallOutcome } from "@/lib/call-outcomes";
import { Markdown } from "../../../ask-answer";
import "../../../home-search.css";
import "./deal.css";

type Workspace = {
  deal: { id: string; title: string; stage: string; serviceType: string; setupFee: number; monthlyFee: number; expectedCloseDate: string | null; lostReason: string; notes: string;
    discovery: Discovery; nextStep: string; nextStepAt: string | null; proposalStatus: ProposalStatus; proposalSentAt: string | null; proposalDecidedAt: string | null; agreementStatus: string };
  contact: { id: string; name: string; company: string; phone: string; email: string; website: string; location: string } | null;
  activity: { channel: string; outcome: string; notes: string; at: string }[];
  tasks: { id: string; title: string; status: string; priority: string; due: string | null }[];
  events: { id: string; title: string; startsAt: string; type: string; status: string }[];
  audit: { id: string; title: string; date: string; verdict: string; opportunities: string; upsells: string } | null;
  proposals: { id: string; title: string; content: string; status: string; createdAt: string; updatedAt: string }[];
  project: { id: string; name: string; status: string; targetDate: string | null } | null;
};

const money = (n: number) => "$" + Number(n || 0).toLocaleString("en-US");
const dateLabel = (v: string | null) => (v ? new Date(v.length === 10 ? v + "T12:00:00" : v).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const PROPOSAL_COPY: Record<ProposalStatus, string> = { none: "No proposal yet", draft: "Draft ready", sent: "Sent — waiting on them", accepted: "Accepted", declined: "Declined" };

export default function DealWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [disc, setDisc] = useState<Discovery>({});
  const [next, setNext] = useState({ step: "", at: "" });
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/deal-workspace?id=${id}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see this deal." : d.error || "Could not load this deal.");
      setWs(d); setDisc(d.deal.discovery ?? {}); setNext({ step: d.deal.nextStep ?? "", at: d.deal.nextStepAt ?? "" });
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
    } catch (e) { setFlash({ ok: false, text: e instanceof Error ? e.message : "Could not save." }); }
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

  function setProposal(status: ProposalStatus) {
    if (status === "declined") {
      const reason = prompt("Why did they decline? (price, timing, went with someone else, not a fit…)");
      if (!reason) return;
      void patch({ proposalStatus: status, lostReason: reason }, "status", "Marked declined and moved to Lost.");
    } else if (status === "accepted") {
      if (!confirm("Mark accepted? The deal moves to Won and onboarding starts. Payments stay 'expected' until you record them.")) return;
      void patch({ proposalStatus: status }, "status", "Accepted. Deal is Won.");
    } else void patch({ proposalStatus: status }, "status", status === "sent" ? "Marked sent. Deal moved to Proposal." : "Saved.");
  }

  function printProposal(content: string) {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = esc(content).replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/^[-*] (.*)$/gm, "<li>$1</li>").replace(/\n{2,}/g, "</p><p>");
    w.document.write(`<!doctype html><title>${esc(ws?.deal.title ?? "Proposal")}</title><style>body{font:15px/1.65 -apple-system,Segoe UI,Inter,sans-serif;color:#1a1a1a;max-width:720px;margin:48px auto;padding:0 24px}h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}li{margin:4px 0 4px 18px}.m{color:#666;font-size:13px;margin-bottom:28px}</style><h1>Proposal for ${esc(ws?.contact?.company || ws?.deal.title || "")}</h1><div class="m">Cinder Revenue Company · ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div><p>${html}</p><script>setTimeout(()=>print(),300)</script>`);
    w.document.close();
  }

  if (error) return <main className="dw-page"><p className="dw-err">{error}</p><Link href="/crm/pipeline">← Pipeline</Link></main>;
  if (!ws) return <main className="dw-page"><p className="dw-muted">Loading deal…</p></main>;
  const { deal, contact } = ws;
  const offer = Object.values(OFFERS).find(o => o.serviceType === deal.serviceType);
  const pct = discoveryCompleteness(disc);
  const proposal = ws.proposals[0];
  const closed = deal.stage === "won" || deal.stage === "lost";

  return <main className="dw-page">
    <Link className="dw-back" href="/crm/pipeline">← Pipeline</Link>
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
      <div className="dw-value"><strong>{money(deal.setupFee)}</strong><span>setup</span><strong>{money(deal.monthlyFee)}</strong><span>/ month</span></div>
    </header>

    <div className="dw-stages" aria-label="Stage">
      {DEAL_STAGES.filter(s => s !== "nurture").map(s => {
        const order = DEAL_STAGES.indexOf(s as typeof DEAL_STAGES[number]);
        const cur = DEAL_STAGES.indexOf(deal.stage as typeof DEAL_STAGES[number]);
        const state = s === deal.stage ? "is-on" : deal.stage !== "lost" && order < cur && s !== "lost" ? "is-past" : "";
        return <button data-variant="primary" key={s} className={"dw-stage " + state} disabled={!!saving || s === deal.stage}
          onClick={() => {
            if (s === "won" && !confirm("Mark Won? Onboarding starts and payments are booked as expected, not paid.")) return;
            if (s === "lost") { const reason = prompt("Why was it lost?"); if (!reason) return; void patch({ stage: s, lostReason: reason }, "stage", "Moved to Lost."); return; }
            void patch({ stage: s }, "stage", `Moved to ${STAGE_LABELS[s]}.`);
          }}>{STAGE_LABELS[s]}</button>;
      })}
    </div>
    {deal.stage === "lost" && deal.lostReason && <p className="dw-muted">Lost: {deal.lostReason}</p>}
    {flash && <div className={"dw-flash" + (flash.ok ? "" : " is-bad")} role="status">{flash.text}</div>}

    <div className="dw-grid">
      <div className="dw-col">
        <section className="dw-box">
          <h2>Next step</h2>
          <div className="dw-next">
            <input value={next.step} onChange={e => setNext({ ...next, step: e.target.value })} placeholder="e.g. Send proposal, follow up on decision, kickoff call…" />
            <input type="date" value={next.at} onChange={e => setNext({ ...next, at: e.target.value })} />
            <button data-variant="primary" className="dw-btn" disabled={saving === "next"} onClick={() => void patch({ nextStep: next.step, nextStepAt: next.at || null }, "next", "Next step saved.")}>{saving === "next" ? "Saving…" : "Save"}</button>
          </div>
          {!deal.nextStep && !closed && <p className="dw-hint">Every open deal needs a next step with a date. It shows up in Needs you when it&apos;s due.</p>}
        </section>

        <section className="dw-box">
          <div className="dw-boxhead"><h2>Discovery</h2><span className="dw-pct"><i style={{ width: pct + "%" }} />{pct}% captured</span></div>
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
        </section>

        <section className="dw-box">
          <div className="dw-boxhead"><h2>Proposal</h2><span className={"dw-pill dw-pill-" + deal.proposalStatus}>{PROPOSAL_COPY[deal.proposalStatus]}{deal.proposalSentAt && deal.proposalStatus === "sent" ? ` · ${dateLabel(deal.proposalSentAt)}` : ""}</span></div>
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
              <button data-variant="primary" className="dw-btn" onClick={() => { void navigator.clipboard?.writeText(proposal.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }); }}>{copied ? "Copied" : "Copy text"}</button>
              <button data-variant="primary" className="dw-btn" onClick={() => printProposal(proposal.content)}>Print / PDF</button>
              <button data-variant="primary" className="dw-btn" disabled={saving === "proposal"} onClick={() => void draftProposal()}>{saving === "proposal" ? "Redrafting…" : "Redraft"}</button>
            </div>
            {!closed && <div className="dw-row dw-decide">
              <span className="dw-muted">After you send it yourself:</span>
              {deal.proposalStatus !== "sent" && <button data-variant="primary" className="dw-btn" disabled={!!saving} onClick={() => setProposal("sent")}>Mark sent</button>}
              <button data-variant="primary" className="dw-btn dw-good" disabled={!!saving} onClick={() => setProposal("accepted")}>Accepted</button>
              <button data-variant="primary" className="dw-btn dw-bad" disabled={!!saving} onClick={() => setProposal("declined")}>Declined</button>
            </div>}
          </>}
        </section>
      </div>

      <aside className="dw-col dw-side">
        {ws.project && <section className="dw-box dw-win"><h2>Onboarding</h2><p><Link href="/crm/projects">{ws.project.name}</Link> · {ws.project.status.replace(/_/g, " ")}{ws.project.targetDate ? ` · launch ${dateLabel(ws.project.targetDate)}` : ""}</p></section>}
        {ws.audit && <section className="dw-box"><h2>Audit</h2><p className="dw-small">{ws.audit.verdict.replace(/\*\*/g, "")}</p>{ws.audit.upsells && <><div className="dw-label">Later upsells</div><p className="dw-small">{ws.audit.upsells.replace(/\*\*/g, "").split("\n").slice(0, 3).join(" · ")}</p></>}</section>}
        <section className="dw-box"><h2>Meetings</h2>{ws.events.length ? ws.events.map(e => <div key={e.id} className="dw-line"><span>{e.title}</span><small>{new Date(e.startsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></div>) : <p className="dw-muted">None yet.</p>}</section>
        <section className="dw-box"><h2>Open tasks</h2>{ws.tasks.length ? ws.tasks.map(t => <div key={t.id} className="dw-line"><span>{t.title}</span><small>{t.due ? dateLabel(t.due) : t.priority}</small></div>) : <p className="dw-muted">None.</p>}</section>
        <section className="dw-box"><h2>Call history</h2>{ws.activity.length ? ws.activity.map((a, i) => <div key={i} className="dw-line"><span>{OUTCOME_LABELS[a.outcome as CallOutcome] ?? a.outcome.replace(/_/g, " ")}{a.notes ? ` — ${a.notes.slice(0, 80)}` : ""}</span><small>{dateLabel(a.at)}</small></div>) : <p className="dw-muted">No calls logged.</p>}</section>
      </aside>
    </div>
  </main>;
}
