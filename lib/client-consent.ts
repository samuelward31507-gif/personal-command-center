// Every number a client texts has a reason on file: they called, texted, filled out a form or asked for a quote
// on Angi/Thumbtack/Facebook, or the owner confirmed they contacted the business before. Opt-outs and opt-ins too.
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
export type ConsentEvent = "inbound_call" | "inbound_text" | "web_form" | "paid_lead" | "owner_import" | "opt_out" | "opt_in" | "help";
export const CONSENT_LABEL: Record<ConsentEvent, string> = {
  inbound_call: "Called the business", inbound_text: "Texted the business first", web_form: "Submitted a web form", paid_lead: "Requested a quote on a lead site",
  owner_import: "Owner confirmed a past inquiry", opt_out: "Opted out", opt_in: "Opted back in", help: "Asked for help",
};

/** Never blocks a text: a failed log line is reported and the conversation goes on. */
export async function recordConsent(sql: Sql, c: { owner: string; projectId: string }, phone: string, event: ConsentEvent, source = "", evidence = "", ip = ""): Promise<void> {
  try {
    await sql`INSERT INTO public.client_consent (owner_id, project_id, phone, event, source, evidence, ip)
      VALUES (${c.owner}, ${c.projectId}::uuid, ${phone}, ${event}, ${source.slice(0, 60)}, ${evidence.slice(0, 600)}, ${ip.slice(0, 64)})`;
  } catch (e) { console.error("Consent log failed", e instanceof Error ? e.message : e); }
}

const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function consentCsv(rows: { at: string | Date; phone: string; event: string; source: string; evidence: string; ip: string }[]): string {
  const head = "time_utc,phone,event,what_happened,source,evidence,ip";
  return [head, ...rows.map(r => [new Date(r.at).toISOString(), r.phone, r.event, CONSENT_LABEL[r.event as ConsentEvent] ?? r.event, r.source, r.evidence, r.ip].map(cell).join(","))].join("\n") + "\n";
}
