import { auth } from "@/lib/auth/server";
import { validateWorkspace } from "@/lib/workspace";
import { loadWorkspace, saveWorkspace } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const result = await auth.getSession();
  return result?.data?.session && result?.data?.user?.id ? { id: String(result.data.user.id) } : null;
}

/** GET /api/workspace — the owner's settings (defaults filled in). */
export async function GET() {
  const user = await currentUser();
  if (!user) return reply({ error: "Unauthorized" }, 401);
  return reply({ settings: await loadWorkspace(user.id) });
}

/** PUT /api/workspace { settings } — save the whole settings object after a strict check. */
export async function PUT(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return reply({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const checked = validateWorkspace(body?.settings);
    if ("error" in checked) return reply({ error: checked.error }, 400);
    await saveWorkspace(user.id, checked.ok);
    return reply({ settings: checked.ok });
  } catch (error) {
    console.error("Workspace save failed", { name: error instanceof Error ? error.name : typeof error });
    return reply({ error: "Could not save settings. If this is the first save, the workspace_settings table may not exist yet." }, 500);
  }
}
