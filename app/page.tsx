import { redirect } from "next/navigation";

// Old ?view= links still land on the right page.
const VIEWS: Record<string, string> = {
  "needs-you": "/crm/needs-you", schedule: "/crm/needs-you", growth: "/crm", tasks: "/crm/tasks", workforce: "/crm/workforce",
  projects: "/crm/projects", "client-success": "/crm/client-success", finance: "/crm/finance", intelligence: "/crm/intelligence",
  strategy: "/crm/strategy", settings: "/crm/settings", calendar: "/crm/calendar", audit: "/crm/audit", preparation: "/crm/preparation",
  ask: "/crm/ask",
};

/** Home is your day: Cinder opens on Today, the prioritized action list. Ask Cinder lives at /crm/ask. */
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = (await searchParams).view;
  redirect(VIEWS[typeof view === "string" ? view : ""] ?? "/crm/needs-you");
}
