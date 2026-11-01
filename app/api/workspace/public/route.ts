import { defaultOwnerId, loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/workspace/public — only what public pages show: business name and first name. Nothing private. */
export async function GET() {
  const w = await loadWorkspace(defaultOwnerId());
  return Response.json({ businessName: w.businessName, ownerFirstName: w.ownerFirstName }, { headers: { "Cache-Control": "public, max-age=300" } });
}
