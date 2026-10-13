import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/sign-in" });

export const config = {
  // "/" renders the home dashboard and fetches private business data
  // (contacts, deals, tasks, finance, calendar) client-side; it must be
  // gated the same way every /crm/* page already is, so a signed-out
  // visitor is sent to /sign-in instead of seeing a dashboard shell with
  // failed data fetches.
  matcher: ["/", "/crm/:path*"],
};
