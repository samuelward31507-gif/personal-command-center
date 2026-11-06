import { getAllowedSession } from "@/lib/auth/server";
import { priceScript, validateOffer } from "@/lib/founding-offer";
import { loadOffer, saveOffer } from "@/lib/offer-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await getAllowedSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** GET /api/offer — founding offer settings, spots used (counted from founding clients) and the price script. */
export async function GET() {
  const user = await currentUser();
  if (!user) return reply({ error: "Unauthorized" }, 401);
  const { offer, used, left } = await loadOffer(user.id);
  return reply({ offer, used, left, script: priceScript(offer) });
}

/** PUT /api/offer { offer } — save the offer settings after a strict check. */
export async function PUT(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return reply({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const checked = validateOffer(body?.offer);
    if ("error" in checked) return reply({ error: checked.error }, 400);
    await saveOffer(user.id, checked.ok);
    const { used, left } = await loadOffer(user.id);
    return reply({ offer: checked.ok, used, left, script: priceScript(checked.ok) });
  } catch (error) {
    console.error("Offer save failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Could not save the offer settings." }, 500);
  }
}
