import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Cinder",
  description: "Every lead, every conversation, every booked estimate.",
  manifest: "/app.webmanifest",
  appleWebApp: { capable: true, title: "Cinder", statusBarStyle: "default" },
  icons: { icon: "/app-icon-192.png", apple: "/app-icon-180.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#f6f6f4", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
