import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { cleanDiscovery, PROPOSAL_STATUSES, stageForProposal, CONTRACT_STATUSES, stageForContract, type ProposalStatus, type ContractStatus } from "@/lib/deal-workspace";
import { DEAL_STAGES } from "@/lib/offers";
import { runDealHandoff, HandoffNotReady } from "@/lib/deal-handoff";
import { reportSection, sanitizeForLog } from "@/lib/business-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}
const d10 = (v: unknown) => (!v ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

/** GET /api/deal-workspace?id=… — everything needed to work one deal. */
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!UUID.test(id)) return fail("Valid deal id is required.", 400);
    const sql = db();
    const rows = await sql`
      SELECT d.*, c.first_name, c.last_name, c.company, c.phone, c.email, c.website, c.location, c.notes AS contact_notes
      FROM public.deals d LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
      WHERE d.id = ${id}::uuid AND d.owner_id = ${user.id}`;
    if (!rows.length) return fail("Deal not found.", 404);
    const d = rows[0];
    const cid = d.contact_id ? String(d.contact_id) : null;
    const [acts, tasks, events, audits, proposals, project, agreements] = await Promise.all([
      cid ? sql`SELECT channel, outcome, notes, occurred_at FROM public.contact_activities WHERE owner_id = ${user.id} AND contact_id = ${cid}::uuid AND outcome IS DISTINCT FROM 'initiated' ORDER BY occurred_at DESC LIMIT 12` : [],
      sql`SELECT id, title, status, priority, due_at FROM public.tasks WHERE owner_id = ${user.id} AND status NOT IN ('done','cancelled') AND (deal_id = ${id}::uuid OR (${cid}::uuid IS NOT NULL AND contact_id = ${cid}::uuid)) ORDER BY due_at NULLS LAST LIMIT 10`,
      sql`SELECT id, title, starts_at, event_type, status FROM public.calendar_events WHERE owner_id = ${user.id} AND status <> 'cancelled' AND (deal_id = ${id}::uuid OR (${cid}::uuid IS NOT NULL AND contact_id = ${cid}::uuid)) ORDER BY starts_at DESC LIMIT 8`,
      cid ? sql`SELECT id, title, content, created_at FROM public.research_artifacts WHERE owner_id = ${user.id} AND contact_id = ${cid}::uuid AND artifact_type = 'audit_prep' AND status <> 'archived' ORDER BY created_at DESC LIMIT 1` : [],
      sql`SELECT id, title, content, status, created_at, updated_at FROM public.research_artifacts WHERE owner_id = ${user.id} AND deal_id = ${id}::uuid AND artifact_type = 'proposal' AND status <> 'archived' ORDER BY created_at DESC LIMIT 5`,
      sql`SELECT id, name, status, target_date FROM public.projects WHERE owner_id = ${user.id} AND deal_id = ${id}::uuid LIMIT 1`,
      sql`SELECT id, title, content, status, created_at, updated_at FROM public.research_artifacts WHERE owner_id = ${user.id} AND deal_id = ${id}::uuid AND artifact_type = 'agreement' AND status <> 'archived' ORDER BY created_at DESC LIMIT 3`,
    ]);
    const a = audits[0];
    return Response.json({
      deal: {
        id: d.id, title: d.title, stage: d.stage, serviceType: d.service_type, setupFee: Number(d.setup_fee), monthlyFee: Number(d.monthly_fee),
        expectedCloseDate: d10(d.expected_close_date), source: d.source, notes: d.notes, lostReason: d.lost_reason, agreementStatus: d.agreement_status,
        discovery: d.discovery ?? {}, nextStep: d.next_step ?? "", nextStepAt: d10(d.next_step_at),
        proposalStatus: d.proposal_status ?? "none", proposalSentAt: iso(d.proposal_sent_at), proposalDecidedAt: iso(d.proposal_decided_at),
        contractStatus: d.contract_status ?? "none", contractSentAt: iso(d.contract_sent_at), signedAt: iso(d.signed_at),
        createdAt: iso(d.created_at), updatedAt: iso(d.updated_at),
      },
      contact: cid ? { id: cid, name: [d.first_name, d.last_name].filter(Boolean).join(" "), company: d.company, phone: d.phone, email: d.email, website: d.website, location: d.location, notes: d.contact_notes } : null,
      activity: acts.map(x => ({ channel: x.channel, outcome: x.outcome, notes: x.notes, at: iso(x.occurred_at) })),
      tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due: iso(t.due_at) })),
      events: events.map(e => ({ id: e.id, title: e.title, startsAt: iso(e.starts_at), type: e.event_type, status: e.status })),
      audit: a ? { id: a.id, title: a.title, date: d10(a.created_at), verdict: reportSection(String(a.content), "Verdict"), opportunities: reportSection(String(a.content), "Top opportunities"), upsells: reportSection(String(a.content), "Future upsells") } : null,
      proposals: proposals.map(p => ({ id: p.id, title: p.title, content: p.content, status: p.status, createdAt: iso(p.created_at), updatedAt: iso(p.updated_at) })),
      agreements: agreements.map(p => ({ id: p.id, title: p.title, content: p.content, status: p.status, createdAt: iso(p.created_at), updatedAt: iso(p.updated_at) })),
      project: project[0] ? { id: project[0].id, name: project[0].name, status: project[0].status, targetDate: d10(project[0].target_date) } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Deal workspace GET failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not load this deal.", 500);
  }
}

/**
 * PATCH /api/deal-workspace { id, discovery?, nextStep?, nextStepAt?, proposalStatus?, contractStatus?, stage?, lostReason? }
 * Proposal accepted keeps the deal open; a signed agreement (or moving the stage to Won) makes it Won.
 * Won runs the onboarding handoff (expected payments only — never marks anything paid).
 */
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Unauthorized", 401);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || typeof body.id !== "string" || !UUID.test(body.id)) return fail("Valid deal id is required.", 400);
    const sql = db();
    const current = await sql`SELECT stage, proposal_status FROM public.deals WHERE id = ${body.id}::uuid AND owner_id = ${user.id}`;
    if (!current.length) return fail("Deal not found.", 404);
    const stageNow = String(current[0].stage);

    const discovery = body.discovery !== undefined ? cleanDiscovery(body.discovery) : null;
    const nextStep = typeof body.nextStep === "string" ? body.nextStep.trim().slice(0, 500) : null;
    const keepNextAt = body.nextStepAt === undefined;
    const nextAt = typeof body.nextStepAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.nextStepAt) ? body.nextStepAt : null;
    let proposalStatus: ProposalStatus | null = null;
    if (body.proposalStatus !== undefined) {
      if (!(PROPOSAL_STATUSES as readonly string[]).includes(body.proposalStatus)) return fail("Invalid proposal status.", 400);
      proposalStatus = body.proposalStatus;
    }
    let contractStatus: ContractStatus | null = null;
    if (body.contractStatus !== undefined) {
      if (!(CONTRACT_STATUSES as readonly string[]).includes(body.contractStatus)) return fail("Invalid agreement status.", 400);
      contractStatus = body.contractStatus;
    }
    let stage: string | null = null;
    if (body.stage !== undefined) {
      if (!(DEAL_STAGES as readonly string[]).includes(body.stage)) return fail("Invalid deal stage.", 400);
      stage = body.stage;
    } else if (contractStatus) stage = stageForContract(contractStatus, stageNow);
    else if (proposalStatus) stage = stageForProposal(proposalStatus, stageNow);
    const lostReason = typeof body.lostReason === "string" ? body.lostReason.trim().slice(0, 1000) : "";
    if (stage === "lost" && stageNow !== "lost" && !lostReason) return fail("Say why it was lost — it's how the pipeline gets better.", 400);

    await sql`
      UPDATE public.deals SET
        discovery = CASE WHEN ${discovery !== null} THEN ${JSON.stringify(discovery ?? {})}::jsonb ELSE discovery END,
        next_step = COALESCE(${nextStep}, next_step),
        next_step_at = CASE WHEN ${keepNextAt} THEN next_step_at ELSE ${nextAt}::date END,
        proposal_status = COALESCE(${proposalStatus}, proposal_status),
        proposal_sent_at = CASE WHEN ${proposalStatus} = 'sent' THEN COALESCE(proposal_sent_at, now()) ELSE proposal_sent_at END,
        proposal_decided_at = CASE WHEN ${proposalStatus} IN ('accepted','declined') THEN now() ELSE proposal_decided_at END,
        contract_status = COALESCE(${contractStatus}, CASE WHEN ${stage} = 'won' THEN 'signed' ELSE contract_status END),
        contract_sent_at = CASE WHEN ${contractStatus} = 'sent' THEN COALESCE(contract_sent_at, now()) ELSE contract_sent_at END,
        stage = COALESCE(${stage}, stage),
        lost_reason = CASE WHEN ${stage} = 'lost' AND ${lostReason} <> '' THEN ${lostReason} ELSE lost_reason END,
        agreement_status = CASE WHEN ${stage} = 'won' AND stage <> 'won' THEN 'active' ELSE agreement_status END,
        signed_at = CASE WHEN ${stage} = 'won' THEN COALESCE(signed_at, now()) ELSE signed_at END,
        effective_at = CASE WHEN ${stage} = 'won' THEN COALESCE(effective_at, CURRENT_DATE) ELSE effective_at END,
        updated_at = now()
      WHERE id = ${body.id}::uuid AND owner_id = ${user.id}`;

    let handoff: string | null = null;
    if (stage === "won" && stageNow !== "won") {
      try { await runDealHandoff(sql, user.id, body.id); handoff = "Onboarding project and expected payments created. Record payments on Money when they actually arrive."; }
      catch (e) { handoff = e instanceof HandoffNotReady ? `Won, but onboarding didn't start: ${e.message}` : "Won, but onboarding couldn't start. Open the pipeline to retry."; }
    }
    return Response.json({ ok: true, stage: stage ?? stageNow, handoff });
  } catch (error) {
    console.error("Deal workspace PATCH failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return fail("Could not save this deal.", 500);
  }
}
