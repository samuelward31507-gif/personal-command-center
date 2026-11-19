import { defaultOwnerId, loadWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/workspace/public — only what public pages show: business name, first name, logo, accent, the booked-call
 * video and the booking link. Nothing private. */
export async function GET() {
  const w = await loadWorkspace(defaultOwnerId());
  return Response.json({ businessName: w.businessName, ownerFirstName: w.ownerFirstName, logoUrl: w.logoUrl, accentColor: w.accentColor, bookedVideo: w.bookedVideo, bookingLink: w.bookingLink, contactEmail: w.contactEmail }, { headers: { "Cache-Control": "public, max-age=300" } });
}
