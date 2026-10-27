import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await auth.getSession();
    if (!result?.data?.session || !result?.data?.user?.id) {
      return Response.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const token = process.env.HERMES_BRIDGE_TOKEN;
    const ownerId = process.env.HERMES_BRIDGE_OWNER_ID;
    const configured = Boolean(process.env.DATABASE_URL && token && token.length >= 32 && ownerId);
    return Response.json({ configured }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Hermes bridge status failed", error);
    return Response.json({ error: "Unable to check Hermes bridge status." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
