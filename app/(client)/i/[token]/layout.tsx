import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your invoice", robots: { index: false, follow: false } };

export default function InvoiceLayout({ children }: { children: React.ReactNode }) { return children; }
