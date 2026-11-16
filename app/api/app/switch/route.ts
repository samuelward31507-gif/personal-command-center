import { appSession, clientFor, db, json } from "@/lib/client-app-run";
import { clearImport, currentImport, decide, pullStep, runStep, setGoLive, stageRows, startImport, undoImport } from "@/lib/client-switch-run";
import { SOURCES } from "@/lib/switch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;

/** GET ?p= — the move in progress (or the last one) for the switch-over center. Owner and office. */
export async function GET(req: Request) {
  const s = appSession(req);
  if (!s) return json({ error: "Sign in" }, 401);
  try {
    const sql = db(), c = await clientFor(sql, s, new URL(req.url).searchParams.get("p"));
    if (!c) return json({ error: "Sign in" }, 401);
    if (s.role === "crew") return json({ error: "Only the owner can move data in." }, 403);
    return json({ import: await currentImport(sql, c), golive: (() => { try { return JSON.parse(c.setup.golive || "{}"); } catch { return {}; } })(), goliveStart: c.setup.golive_start || null });
  } catch (e) { console.error("Switch load failed", e instanceof Error ? e.message : e); return json({ error: "Couldn't load." }, 500); }
}

/**
 * POST { p, action, ... }:
 *  start { source } — a batch for this source (the open draft is reused). clear { id } — start the draft over.
 *  stage { id, rows } — rows from a file, read in the browser. pull { id } — the next page from Jobber or QuickBooks.
 *  decide { id, decisions } — merges undone, phones typed. run { id } — write the next slice. undo { id } — take a batch back.
 *  golive { key, done } — tick an item on the go-live list.
 */
export async function POST(req: Request) {
  const s = appSession(req);
  if (!s) return json({ error: "Sign in" }, 401);
  const b = await req.json().catch(() => ({})) as { p?: string; action?: string; id?: string; source?: string; rows?: unknown; decisions?: unknown; key?: string; done?: boolean };
  try {
    const sql = db(), c = await clientFor(sql, s, b.p);
    if (!c) return json({ error: "Sign in" }, 401);
    if (s.role === "crew") return json({ error: "Only the owner can move data in." }, 403);
    if (b.action === "start") {
      if (!SOURCES.some(x => x.key === b.source)) return json({ error: "Pick where you're coming from." }, 400);
      return json({ ok: true, import: await startImport(sql, c, String(b.source)) });
    }
    if (b.action === "golive") { await setGoLive(sql, c, String(b.key ?? ""), !!b.done); return json({ ok: true }); }
    if (!b.id || !UUID.test(b.id)) return json({ error: "Which move?" }, 400);
    if (b.action === "clear") { await clearImport(sql, c, b.id); return json({ ok: true, import: await currentImport(sql, c) }); }
    const r = b.action === "stage" ? await stageRows(sql, c, b.id, b.rows)
      : b.action === "pull" ? await pullStep(sql, c, b.id)
      : b.action === "decide" ? await decide(sql, c, b.id, b.decisions)
      : b.action === "run" ? await runStep(sql, c, b.id)
      : b.action === "undo" ? await undoImport(sql, c, b.id).then(async x => ({ ...x, view: await currentImport(sql, c) ?? undefined }))
      : { ok: false, error: "Unknown action." };
    return r.ok ? json({ ok: true, import: "view" in r ? r.view : null, done: "done" in r ? r.done : undefined }) : json({ error: r.error }, 400);
  } catch (e) { console.error("Switch failed", e instanceof Error ? e.message : e); return json({ error: "Something went wrong. Try again." }, 500); }
}
