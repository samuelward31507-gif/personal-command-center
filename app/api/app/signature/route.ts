import { appSession, db } from "@/lib/client-app-run";
import { signatureImage } from "@/lib/client-portal-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?id=<sign-off id> — the customer's signature, for the signed-in owner, office or crew of that business. */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return new Response("Sign in", { status: 401 });
  const sig = await signatureImage(db(), s.projects, new URL(req.url).searchParams.get("id") ?? "");
  if (!sig) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(sig.split(",")[1] ?? "", "base64")), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=31536000, immutable" } });
}
