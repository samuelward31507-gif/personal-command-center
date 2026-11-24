import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Cinder",
  description: "Every lead, every conversation, every booked estimate.",
  manifest: "/app.webmanifest",
  appleWebApp: { capable: true, title: "Cinder", statusBarStyle: "default" },
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/app-icon-192.png", type: "image/png", sizes: "192x192" }], apple: "/app-icon-180.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
