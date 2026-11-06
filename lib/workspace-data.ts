// Loads and saves workspace settings. Read failures fall back to the defaults so no page breaks over settings.
import { neon } from "@neondatabase/serverless";
import { envDefaults, mergeWorkspace, type WorkspaceSettings } from "@/lib/workspace";

export async function loadWorkspace(ownerId: string | null | undefined): Promise<WorkspaceSettings> {
  const base = envDefaults(process.env);
  if (!ownerId || !process.env.DATABASE_URL) return base;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT settings FROM public.workspace_settings WHERE owner_id = ${ownerId}`;
    return mergeWorkspace(rows[0]?.settings, base);
  } catch (error) {
    // Table not created yet, or the database is briefly unavailable: keep working on defaults.
    console.error("Workspace settings unavailable; using defaults", { name: error instanceof Error ? error.name : typeof error });
    return base;
  }
}

export async function saveWorkspace(ownerId: string, settings: WorkspaceSettings): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const sql = neon(process.env.DATABASE_URL);
  await sql`INSERT INTO public.workspace_settings (owner_id, settings) VALUES (${ownerId}, ${JSON.stringify(settings)}::jsonb)
    ON CONFLICT (owner_id) DO UPDATE SET settings = EXCLUDED.settings || jsonb_strip_nulls(jsonb_build_object('offer', public.workspace_settings.settings->'offer')), updated_at = now()`;
  // The founding offer settings live in the same row and are saved separately (lib/offer-data.ts), so they are kept here.
}

/** The single owner used by background jobs and public pages (signing, kickoff, lead form). */
export const defaultOwnerId = () => process.env.CINDER_OWNER_ID?.trim() || null;
