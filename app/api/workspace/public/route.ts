import { defaultOwnerId, loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/workspace/public — only what public pages show: business name, first name, logo and accent. Nothing private. */
export async function GET() {
  const w = await loadWorkspace(defaultOwnerId());
  return Response.json({ businessName: w.businessName, ownerFirstName: w.ownerFirstName, logoUrl: w.logoUrl, accentColor: w.accentColor }, { headers: { "Cache-Control": "public, max-age=300" } });
}
