import { getAllowedSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getAllowedSession();
    if (!result?.data?.session || !result?.data?.user?.id) {
      return Response.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const token = process.env.HERMES_BRIDGE_TOKEN;
    const ownerId = process.env.HERMES_BRIDGE_OWNER_ID;
    const configured = Boolean(process.env.DATABASE_URL && token && token.length >= 32 && ownerId);
    // Cal.ai bookings need the webhook secret and the owner the bookings belong to.
    const calAi = Boolean(process.env.DATABASE_URL && process.env.CAL_AI_WEBHOOK_SECRET && process.env.CINDER_OWNER_ID);
    return Response.json({ configured, calAi }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Hermes bridge status failed", error);
    return Response.json({ error: "Unable to check Hermes bridge status." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
