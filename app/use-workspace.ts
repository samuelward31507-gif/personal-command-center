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

export type PublicBrand = { businessName: string; ownerFirstName: string; logoUrl: string; accentColor: string };
let brandCache: PublicBrand | null = null;
let brandPending: Promise<PublicBrand | null> | null = null;

/** Paint the white-label accent over the default ember everywhere the design system uses it. */
export function applyAccent(hex: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) { root.setProperty("--u-ember", hex); root.setProperty("--mc-accent", hex); }
  else { root.removeProperty("--u-ember"); root.removeProperty("--mc-accent"); }
}

/** Public pages (lead form, signing, kickoff, invoices, reports): business name, first name, logo and accent only. */
export function usePublicBrand(): PublicBrand {
  const [b, setB] = useState<PublicBrand>(brandCache ?? { businessName: DEFAULT_WORKSPACE.businessName, ownerFirstName: DEFAULT_WORKSPACE.ownerFirstName, logoUrl: "", accentColor: "" });
  useEffect(() => {
    let on = true;
    brandPending ??= fetch("/api/workspace/public").then(r => (r.ok ? r.json() : null)).then(d => (d?.businessName ? (brandCache = { logoUrl: "", accentColor: "", ...d }) : null)).catch(() => null);
    void brandPending.then(d => { if (on && d) { setB(d); applyAccent(d.accentColor); } });
    return () => { on = false; };
  }, []);
  return b;
}
