import type { NeonQueryFunction } from "@neondatabase/serverless";

export type EnrollResult = {
  id: string;
  contactId: string;
  status: string;
  currentStep: number;
  nextActionAt: string;
};

export class DoNotContactError extends Error {
  constructor() {
    super("This prospect is marked do not contact and cannot be re-enrolled.");
    this.name = "DoNotContactError";
  }
}

/**
 * Enroll (or re-activate) a contact in the outreach sequence. Shared by
 * /api/outreach (manual single-contact enroll) and /api/contacts/import
 * (bulk enroll after CSV import) so there is exactly one implementation of
 * this logic and one contact_outreach table, never a parallel/duplicate one.
 *
 * Throws DoNotContactError if the contact is currently suppressed; callers
 * decide how to report that (never silently re-enroll a suppressed contact).
 */
export async function enrollContactInOutreach(
  sql: NeonQueryFunction<false, false>,
  ownerId: string,
  contactId: string,
  niche: string,
  painPoint: string,
  researchNotes: string
): Promise<EnrollResult> {
  const suppression = await sql`
    SELECT id FROM public.contact_suppressions
    WHERE owner_id = ${ownerId} AND contact_id = ${contactId}::uuid LIMIT 1
  `;
  const existing = await sql`
    SELECT status FROM public.contact_outreach
    WHERE owner_id = ${ownerId} AND contact_id = ${contactId}::uuid LIMIT 1
  `;
  if (suppression.length || existing[0]?.status === "do_not_contact") {
    throw new DoNotContactError();
  }
  const rows = await sql`
    INSERT INTO public.contact_outreach (owner_id, contact_id, niche, pain_point, research_notes, started_at, next_action_at)
    VALUES (${ownerId}, ${contactId}::uuid, ${niche}, ${painPoint}, ${researchNotes}, now(), now())
    ON CONFLICT (owner_id, contact_id) DO UPDATE SET
      niche = EXCLUDED.niche, pain_point = EXCLUDED.pain_point,
      research_notes = EXCLUDED.research_notes,
      status = CASE WHEN public.contact_outreach.status IN ('parked','completed') THEN 'active' ELSE public.contact_outreach.status END,
      current_step = CASE WHEN public.contact_outreach.status IN ('parked','completed') THEN 1 ELSE public.contact_outreach.current_step END,
      started_at = CASE WHEN public.contact_outreach.status IN ('parked','completed') THEN now() ELSE public.contact_outreach.started_at END,
      next_action_at = CASE WHEN public.contact_outreach.status IN ('parked','completed') THEN now() ELSE public.contact_outreach.next_action_at END,
      updated_at = now()
    RETURNING id, contact_id, status, current_step, next_action_at
  `;
  const row = rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    status: String(row.status),
    currentStep: Number(row.current_step),
    nextActionAt: String(row.next_action_at),
  };
}
