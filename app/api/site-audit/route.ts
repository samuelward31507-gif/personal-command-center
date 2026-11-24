import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { normalizeWebsite } from "@/lib/business-audit";
import { rateDecision } from "@/lib/demo";
import { leakMath } from "@/lib/prospect-report";
import { fetchPublicPage } from "@/lib/safe-fetch";
import { autoFindings, readSite } from "@/lib/site-check";
import { auditChecks, validateAudit } from "@/lib/site-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/site-audit — public "where you're losing jobs" audit on cinderrevenue.com/audit.
 * Loads their homepage (public addresses only), reports what a homeowner runs into, and works out what slow replies
 * likely cost from the numbers they typed. Nothing is texted, emailed or saved; only a hashed IP and time, to rate-limit.
 */
export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return reply({ error: "The audit is offline right now. Book a call and we'll run it with you." }, 503);
  const input = validateAudit(await request.json().catch(() => null));
  if (input === "spam") return reply({ error: "Something went wrong." }, 400);
  if ("error" in input) return reply(input, 400);
  const site = normalizeWebsite(input.website);
  if (!site || "error" in site) return reply({ error: site && "error" in site ? site.error : "Enter your website." }, 400);

  const sql = neon(process.env.DATABASE_URL);
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update("cinder-demo:" + ip).digest("hex").slice(0, 32);
  const counts = await sql`SELECT count(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip, count(*)::int AS total FROM public.demo_runs WHERE at > now() - interval '1 day'` as { ip: number; total: number }[];
  const gate = rateDecision(counts[0]?.ip ?? 0, counts[0]?.total ?? 0);
  if (!gate.ok) return reply({ error: "You've run a few audits today. Book a call and we'll go through yours together." }, 429);
  await sql`INSERT INTO public.demo_runs (ip_hash) VALUES (${ipHash})`;

  const page = await fetchPublicPage(site.url, 9000);
  const check = readSite(page.html, page.finalUrl, page.html ? page.ms : null);
  const money = leakMath({ leads: input.leads, jobValue: input.jobValue, closeRate: input.closeRate, speed: input.speed, followsUp: input.followsUp });
  return reply({
    business: input.business,
    website: site.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    reached: check.reached,
    checks: check.reached ? auditChecks(check) : [],
    findings: check.reached ? autoFindings(check, new Date().getFullYear()) : [],
    money: { month: Math.round(money.month), year: Math.round(money.year), lostJobs: Math.round((money.lostJobs + money.followUpJobs) * 10) / 10 },
  });
}
