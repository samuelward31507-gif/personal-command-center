import { neon } from "@neondatabase/serverless";
import { sendAlert } from "@/lib/notify";
import { hashToken, contentHash, isTokenShape, validateSignature, clientIp, CONSENT_TEXT } from "@/lib/esign";
import { runDealHandoff, HandoffNotReady } from "@/lib/deal-handoff";
import { createKickoffLink, publicOrigin } from "@/lib/kickoff-link";
import { sanitizeForLog } from "@/lib/business-audit";
import { loadWorkspace } from "@/lib/workspace-data";
import { paymentLinkFor } from "@/lib/workspace";
import { sendDirectEmail } from "@/lib/gmail-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

async function load(token: string) {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT s.id, s.owner_id, s.deal_id, s.status, s.content_hash, s.expires_at, s.created_at, s.signed_at, s.signer_name, s.signer_title,
      s.signed_content, s.provider_name, s.provider_signer, a.content, c.company, d.title AS deal_title
    FROM public.signing_requests s
    JOIN public.research_artifacts a ON a.id = s.artifact_id AND a.owner_id = s.owner_id
    JOIN public.deals d ON d.id = s.deal_id AND d.owner_id = s.owner_id
    LEFT JOIN public.contacts c ON c.id = d.contact_id AND c.owner_id = d.owner_id
    WHERE s.token_hash = ${hashToken(token)} LIMIT 1`;
  return { sql, row: rows[0] };
}

/** GET /api/sign?token=… — public: the agreement behind a signing link. Shows only that agreement. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isTokenShape(token)) return reply({ error: "This signing link isn't valid." }, 404);
  if (!process.env.DATABASE_URL) return reply({ error: "Signing is unavailable right now." }, 503);
  try {
    const { sql, row } = await load(token);
    if (!row || row.status === "void") return reply({ error: "This signing link is no longer active. Ask for a new one." }, 404);
    const signed = row.status === "signed";
    // First open: note it, so the CRM can tell you they're reading it.
    if (!signed) await sql`UPDATE public.signing_requests SET viewed_at = now() WHERE id = ${row.id}::uuid AND viewed_at IS NULL`.catch(() => {});
    const expired = !signed && Date.parse(String(row.expires_at)) < Date.now();
    const changed = !signed && contentHash(String(row.content)) !== row.content_hash;
    return reply({
      status: signed ? "signed" : expired ? "expired" : changed ? "changed" : "open",
      client: String(row.company || String(row.deal_title).split(" — ")[0] || ""),
      provider: String(row.provider_name || ""), providerSigner: String(row.provider_signer || ""), sentAt: iso(row.created_at),
      content: signed ? String(row.signed_content) : expired || changed ? "" : String(row.content),
      signerName: signed ? row.signer_name : null, signerTitle: signed ? row.signer_title : null, signedAt: iso(row.signed_at),
      consent: CONSENT_TEXT,
    });
  } catch (error) {
    console.error("Sign GET failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Couldn't load this agreement. Try again." }, 500);
  }
}

/**
 * POST /api/sign { token, name, title?, email, consent: true } — the client signs.
 * Records name, time, IP, browser and the exact text signed; the deal becomes Won and onboarding starts.
 * Payments stay "expected" — signing never marks anything paid.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body && typeof body === "object" ? (body as Record<string, unknown>).token : null;
  if (!isTokenShape(token)) return reply({ error: "This signing link isn't valid." }, 404);
  const v = validateSignature(body);
  if ("error" in v) return reply({ error: v.error }, 400);
  if (!process.env.DATABASE_URL) return reply({ error: "Signing is unavailable right now." }, 503);
  try {
    const { sql, row } = await load(token);
    if (!row || row.status === "void") return reply({ error: "This signing link is no longer active. Ask for a new one." }, 404);
    if (row.status === "signed") return reply({ error: "This agreement is already signed." }, 409);
    if (Date.parse(String(row.expires_at)) < Date.now()) return reply({ error: "This signing link has expired. Ask for a new one." }, 410);
    const content = String(row.content);
    if (contentHash(content) !== row.content_hash) return reply({ error: "This agreement was changed after the link was sent. Ask for a new link." }, 409);

    const signedRows = await sql`
      UPDATE public.signing_requests SET status = 'signed', signed_at = now(), signer_name = ${v.ok.name}, signer_title = ${v.ok.title}, signer_email = ${v.ok.email},
        signer_ip = ${clientIp(request.headers.get("x-forwarded-for"))}, signer_user_agent = ${(request.headers.get("user-agent") ?? "").slice(0, 400)}, signed_content = ${content}
      WHERE id = ${row.id}::uuid AND status = 'open' RETURNING signed_at`;
    if (!signedRows.length) return reply({ error: "This agreement is already signed." }, 409);

    const owner = String(row.owner_id), dealId = String(row.deal_id);
    let kickoffUrl: string | null = null;
    const moved = await sql`
      UPDATE public.deals SET contract_status = 'signed', stage = 'won', agreement_status = 'active', signed_at = COALESCE(signed_at, now()),
        effective_at = COALESCE(effective_at, CURRENT_DATE), next_step = 'Kickoff call', next_step_at = CURRENT_DATE + 1, updated_at = now()
      WHERE id = ${dealId}::uuid AND owner_id = ${owner} AND stage NOT IN ('won','lost') RETURNING contact_id`;
    if (moved.length) {
      if (moved[0].contact_id) {
        await sql`INSERT INTO public.contact_activities (owner_id, contact_id, channel, action, outcome, notes)
          VALUES (${owner}, ${String(moved[0].contact_id)}::uuid, 'note', 'note', 'other', ${`Signed the service agreement electronically (${v.ok.name}${v.ok.title ? ", " + v.ok.title : ""}).`})`;
      }
      try { await runDealHandoff(sql, owner, dealId); }
      catch (e) { console.error("Handoff after signature failed", { name: e instanceof HandoffNotReady ? "HandoffNotReady" : e instanceof Error ? e.name : typeof e }); }
      // Hand the client straight to their kickoff checklist, so the go-live clock can start today.
      try { kickoffUrl = await createKickoffLink(sql, owner, dealId, publicOrigin(request.url)); }
      catch (e) { console.error("Kickoff link after signature failed", { name: e instanceof Error ? e.name : typeof e }); }
      await sendAlert({ subject: `Signed: ${String(row.company || "your client")} signed the agreement`, lines: [
        `${v.ok.name}${v.ok.title ? `, ${v.ok.title}` : ""} signed the service agreement for ${String(row.company || "the client")}.`,
        "The deal is Won and onboarding has started. Payments stay expected until you record them on Money.",
        ...(kickoffUrl ? [`Kickoff checklist (text it to them too): ${kickoffUrl}`] : []),
      ], link: { label: "Open the deal", path: `/crm/deals/${dealId}` } });
    }
    // Send the setup payment link straight away (and show it on the page): collect while they're ready.
    let payUrl: string | null = null;
    try {
      const ws = await loadWorkspace(owner);
      const [d] = await sql`SELECT service_type, setup_fee FROM public.deals WHERE id = ${dealId}::uuid AND owner_id = ${owner}` as { service_type: string | null; setup_fee: number | null }[];
      const fee = Number(d?.setup_fee ?? 0);
      payUrl = paymentLinkFor(ws, d?.service_type ?? null, "setup_fee", fee).link || null;
      // The next-steps email goes out whenever there's something to send, with or without a payment link,
      // so the kickoff checklist never lives only on the signing screen.
      if ((payUrl || kickoffUrl) && v.ok.email) {
        const steps = [
          payUrl ? `Setup payment${fee ? ` ($${fee.toLocaleString("en-US")})` : ""}: ${payUrl}` : "",
          kickoffUrl ? `Kickoff checklist (about 10 minutes): ${kickoffUrl}` : "",
        ].filter(Boolean).map((t, i, a) => (a.length > 1 ? `${i + 1}. ` : "") + t);
        const intro = steps.length > 1 ? "Two quick things and we start building:" : "One quick thing and we start building:";
        const payNote = payUrl ? "" : `\n${fee ? `I'll send the setup invoice ($${fee.toLocaleString("en-US")}) separately.\n` : ""}`;
        await sendDirectEmail(sql, owner, ws, { to: v.ok.email, contactId: moved[0]?.contact_id ? String(moved[0].contact_id) : null, kind: "setup payment",
          subject: `Next steps for ${String(row.company || "your setup")}`,
          body: `Hi ${v.ok.name.split(" ")[0]},\n\nThanks for signing. ${intro}\n\n${steps.join("\n")}\n${payNote}\nYour monthly plan doesn't start until your first booked appointment.\n\n${ws.ownerFirstName || "Sam"}\n${ws.businessName || "Cinder Revenue Company"}` });
      }
    } catch (e) { console.error("Payment link after signature failed", { name: e instanceof Error ? e.name : typeof e }); }
    return reply({ ok: true, signedAt: iso(signedRows[0].signed_at), kickoffUrl, payUrl });
  } catch (error) {
    console.error("Sign POST failed", { name: error instanceof Error ? error.name : typeof error, message: sanitizeForLog(error instanceof Error ? error.message : "") });
    return reply({ error: "Couldn't record your signature. Try again." }, 500);
  }
}
