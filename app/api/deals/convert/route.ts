import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
import { runDealHandoff, HandoffNotReady } from "@/lib/deal-handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => Response.json({ error: message }, { status });

/** Manual/retry entry point for the signed-deal handoff. Saving a deal as won also runs it. */
export async function POST(request: Request) {
  try {
    const result = await auth.getSession();
    const session = result?.data?.session;
    const user = result?.data?.user;
    if (!session || !user?.id) return fail("Unauthorized", 401);
    const body = await request.json();
    if (typeof body.dealId !== "string" || !uuid.test(body.dealId)) return fail("A valid deal id is required.", 400);
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is not configured.", 500);
    const sql = neon(process.env.DATABASE_URL);
    const out = await runDealHandoff(sql, String(user.id), body.dealId);
    return Response.json({ ok: true, ...out, message: "Signed deal connected to client delivery and expected receivables. No payment was recorded." });
  } catch (error) {
    if (error instanceof HandoffNotReady) return fail(error.message, error.message === "Deal not found." ? 404 : 409);
    console.error("Signed deal handoff failed", error);
    return fail("Unable to convert signed deal. Retry safely after checking the project and finance records.", 500);
  }
}
