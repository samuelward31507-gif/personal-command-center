import { qboAuthUrl, qboConfigured, readQboState } from "@/lib/qbo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?state= : the link the owner opens (Settings, Connections) to connect QuickBooks. Sends them to Intuit's Connect screen. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  if (!readQboState(state)) return new Response("This link expired. Open Settings in the Cinder app and connect again.", { status: 410 });
  if (!qboConfigured()) return new Response("The QuickBooks connection isn't switched on yet.", { status: 503 });
  const origin = process.env.CINDER_APP_URL?.trim().replace(/\/$/, "") || url.origin;
  return Response.redirect(qboAuthUrl(origin, state), 302);
}
