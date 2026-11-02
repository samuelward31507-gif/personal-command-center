import type { Metadata } from "next";

// Client- and prospect-facing page: its own title, never the internal workspace name.
export const metadata: Metadata = { title: "Review and sign · Cinder Revenue Company", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
