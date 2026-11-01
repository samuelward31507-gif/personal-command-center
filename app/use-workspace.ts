"use client";
// Workspace settings in client components. Fetched once per page load and shared; defaults until it arrives.
import { useEffect, useState } from "react";
import { DEFAULT_WORKSPACE, type WorkspaceSettings } from "@/lib/workspace";

let cached: WorkspaceSettings | null = null;
let pending: Promise<WorkspaceSettings> | null = null;

function fetchWorkspace(): Promise<WorkspaceSettings> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch("/api/workspace", { cache: "no-store" })
    .then(r => (r.ok ? r.json() : null))
    .then(d => (cached = d?.settings ?? DEFAULT_WORKSPACE))
    .catch(() => DEFAULT_WORKSPACE)
    .finally(() => { pending = null; });
  return pending;
}

export function useWorkspace(): WorkspaceSettings {
  const [w, setW] = useState<WorkspaceSettings>(cached ?? DEFAULT_WORKSPACE);
  useEffect(() => { let on = true; void fetchWorkspace().then(v => { if (on) setW(v); }); return () => { on = false; }; }, []);
  return w;
}

/** Public pages (lead form, signing, kickoff): business name and first name only. */
export function usePublicBrand(): { businessName: string; ownerFirstName: string } {
  const [b, setB] = useState({ businessName: DEFAULT_WORKSPACE.businessName, ownerFirstName: DEFAULT_WORKSPACE.ownerFirstName });
  useEffect(() => {
    let on = true;
    fetch("/api/workspace/public").then(r => (r.ok ? r.json() : null)).then(d => { if (on && d?.businessName) setB(d); }).catch(() => {});
    return () => { on = false; };
  }, []);
  return b;
}
