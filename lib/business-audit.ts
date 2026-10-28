// Pure helpers for the Business Audit route. No I/O, no secrets — safe to unit test.

export const DEFAULT_AUDIT_MODEL = "claude-sonnet-5-5";
export const WEB_SEARCH_TOOL = "web_search_20250305";

/**
 * Normalize a user/CRM-supplied website. Accepts bare domains ("acme.com",
 * "www.acme.com/contact") because imported contacts frequently omit the scheme.
 * Returns null for an empty value and { error } for something that is not a usable public URL.
 */
export function normalizeWebsite(raw: string): { url: string } | { error: string } | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, "")}`;
  let parsed: URL;
  try { parsed = new URL(withScheme); } catch { return { error: "Enter a valid website (for example acme.com or https://acme.com)." }; }
  if (!["http:", "https:"].includes(parsed.protocol)) return { error: "Website must be an HTTP(S) URL." };
  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".") || /\s/.test(host)) return { error: "Enter a valid website (for example acme.com or https://acme.com)." };
  if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    return { error: "Website must be a public business domain." };
  }
  parsed.hash = "";
  return { url: parsed.toString() };
}

export type ProviderFailure = { status: number; clientMessage: string; category: string; retryable: boolean };

/** Map an Anthropic HTTP error to a safe, specific client message. Never includes secrets or raw payloads. */
export function classifyProviderError(httpStatus: number, errorType: unknown, errorMessage: unknown): ProviderFailure {
  const type = typeof errorType === "string" ? errorType : "unknown";
  const message = typeof errorMessage === "string" ? errorMessage.toLowerCase() : "";
  if (httpStatus === 401 || type === "authentication_error") {
    return { status: 502, category: "provider_auth", retryable: false, clientMessage: "The research provider rejected Cinder's API key. Update ANTHROPIC_API_KEY for this deployment environment, then redeploy." };
  }
  if (httpStatus === 403 || type === "permission_error") {
    return { status: 502, category: "provider_permission", retryable: false, clientMessage: "The research provider's API key does not have permission for this model or tool. Check the Anthropic Console workspace and key permissions." };
  }
  if (httpStatus === 404 || type === "not_found_error") {
    return { status: 502, category: "provider_model", retryable: false, clientMessage: "The configured research model is not available to this API key. Check CINDER_AUDIT_MODEL (or unset it to use the default)." };
  }
  if (httpStatus === 429 || type === "rate_limit_error") {
    return { status: 429, category: "provider_rate_limit", retryable: true, clientMessage: "Research is temporarily rate-limited. Wait a minute and try again." };
  }
  if (httpStatus === 413 || type === "request_too_large") {
    return { status: 400, category: "provider_request_size", retryable: false, clientMessage: "The audit request was too large. Shorten the context notes and try again." };
  }
  if (httpStatus === 400 || type === "invalid_request_error") {
    if (message.includes("credit balance")) {
      return { status: 502, category: "provider_billing", retryable: false, clientMessage: "The research provider account has insufficient credit. Add credit in the Anthropic Console billing settings, then retry." };
    }
    if (message.includes("web search") || message.includes("web_search")) {
      return { status: 502, category: "provider_tool", retryable: false, clientMessage: "Web search is not available for this Anthropic organization or model. Enable web search in the Anthropic Console (Settings → Capabilities)." };
    }
    if (message.includes("model")) {
      return { status: 502, category: "provider_model", retryable: false, clientMessage: "The configured research model rejected the request. Check CINDER_AUDIT_MODEL (or unset it to use the default)." };
    }
    return { status: 502, category: "provider_bad_request", retryable: false, clientMessage: "The research provider rejected the audit request as malformed. This is a Cinder bug — the server log has the sanitized reason." };
  }
  if (httpStatus === 529 || type === "overloaded_error" || httpStatus >= 500) {
    return { status: 503, category: "provider_unavailable", retryable: true, clientMessage: "The research provider is temporarily unavailable. Try again in a few minutes." };
  }
  return { status: 502, category: "provider_unknown", retryable: false, clientMessage: `The research provider returned an unexpected error (HTTP ${httpStatus}).` };
}

/** Strip anything that looks like a credential from a provider message before logging it. */
export function sanitizeForLog(value: unknown, max = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, "[redacted-db-url]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, max);
}

export type AuditMeta = {
  officialWebsite: string | null;
  websiteStatus: "verified" | "likely" | "ambiguous" | "not_found";
  websiteEvidence: string;
  candidates: string[];
  fitDecision: "fit" | "conditional_fit" | "no_fit" | "needs_clarification";
  confidence: "low" | "medium" | "high";
  confidenceRationale: string;
  decisionMaker: string;
  verifiedFacts: string[];
  hypotheses: string[];
  nextCrmAction: string;
  futureUpsells: string[];
};

const META_FENCE = /```cinder-meta\s*([\s\S]*?)```/i;

function strings(value: unknown, maxItems: number, maxLen: number): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map(v => v.trim().slice(0, maxLen)).slice(0, maxItems)
    : [];
}
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

/** Separate the human report from the machine-readable meta block the model appends. */
export function parseAuditOutput(text: string): { report: string; meta: AuditMeta | null } {
  const match = text.match(META_FENCE);
  const report = text.replace(META_FENCE, "").trim();
  if (!match) return { report, meta: null };
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(match[1]); } catch { return { report, meta: null }; }
  if (!raw || typeof raw !== "object") return { report, meta: null };
  const site = typeof raw.officialWebsite === "string" ? normalizeWebsite(raw.officialWebsite) : null;
  return {
    report,
    meta: {
      officialWebsite: site && "url" in site ? site.url : null,
      websiteStatus: pick(raw.websiteStatus, ["verified", "likely", "ambiguous", "not_found"] as const, "not_found"),
      websiteEvidence: typeof raw.websiteEvidence === "string" ? raw.websiteEvidence.slice(0, 600) : "",
      candidates: strings(raw.candidates, 5, 300),
      fitDecision: pick(raw.fitDecision, ["fit", "conditional_fit", "no_fit", "needs_clarification"] as const, "needs_clarification"),
      confidence: pick(raw.confidence, ["low", "medium", "high"] as const, "low"),
      confidenceRationale: typeof raw.confidenceRationale === "string" ? raw.confidenceRationale.slice(0, 600) : "",
      decisionMaker: typeof raw.decisionMaker === "string" ? raw.decisionMaker.slice(0, 300) : "",
      verifiedFacts: strings(raw.verifiedFacts, 50, 500),
      hypotheses: strings(raw.hypotheses, 50, 500),
      nextCrmAction: typeof raw.nextCrmAction === "string" ? raw.nextCrmAction.slice(0, 300) : "",
      futureUpsells: strings(raw.futureUpsells, 4, 300),
    },
  };
}

/** Collect cited and inline source URLs from the provider's content blocks. */
export function collectSourceUrls(blocks: unknown[], report: string): string[] {
  const urls = new Set<string>();
  const add = (u: string) => {
    const url = u.replace(/[.,;:'"]+$/, "");
    try { if (["http:", "https:"].includes(new URL(url).protocol)) urls.add(url); } catch { /* ignore */ }
  };
  for (const block of blocks as Array<{ citations?: Array<{ url?: unknown }> }>) {
    if (Array.isArray(block?.citations)) for (const c of block.citations) if (typeof c?.url === "string") add(c.url);
  }
  for (const m of report.matchAll(/https?:\/\/[^\s)\]>"'`]+/g)) add(m[0]);
  return [...urls].slice(0, 30);
}

/**
 * Confidence is the model's own assessment, capped by the evidence actually returned:
 * no verifiable website or fewer than 2 sources can never be better than "low".
 */
export function effectiveConfidence(meta: AuditMeta | null, sourceCount: number): "low" | "medium" | "high" {
  const claimed = meta?.confidence ?? (sourceCount >= 3 ? "medium" : "low");
  if (sourceCount < 2) return "low";
  if (meta && (meta.websiteStatus === "ambiguous" || meta.websiteStatus === "not_found")) return "low";
  if (claimed === "high" && sourceCount < 4) return "medium";
  return claimed;
}

/** Fallback extraction when the model omits the meta block. */
export function extractLabeledLines(report: string) {
  const lines = report.split("\n").map(l => l.replace(/^\s*[-*#\d.]+\s*/, "").trim()).filter(Boolean);
  return {
    facts: lines.filter(l => /VERIFIED FACT/i.test(l)).slice(0, 50),
    hypotheses: lines.filter(l => /\b(HYPOTHESIS|UNKNOWN)\b/.test(l)).slice(0, 50),
  };
}

export function buildUserPrompt(input: { companyName: string; website: string | null; location: string; context: string }): string {
  const websiteLine = input.website
    ? `Website supplied by CRM: ${input.website}\n(Verify it belongs to this business before relying on it. If it does not, say so and find the correct one.)`
    : `Website: NOT SUPPLIED. Discover the official website first using the business name, location and contact details below. If several businesses share the name, list the candidates and use location/phone/email/social evidence to pick one. If none can be verified, do not invent a URL — set websiteStatus to "not_found" or "ambiguous" and continue with whatever public evidence exists.`;
  return `Independently audit this business; do not assume our offer fits.
Business: ${input.companyName}
${websiteLine}
Location/service area: ${input.location || "Unknown — research if publicly available"}
CRM context (treat as unverified hints, not facts):
${input.context || "None supplied"}

Use web search, prioritize first-party sources, cite URLs inline, and make a clear evidence-based fit/no-fit decision.`;
}
