// Lets a test import app modules that use the "@/" path alias: "@/lib/x" resolves to ./lib/x.ts.
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) return next(new URL("./" + spec.slice(2) + ".ts", import.meta.url).href, ctx);
  return next(spec, ctx);
}
