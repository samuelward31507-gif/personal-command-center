import type { ReactNode } from "react";
import { Inter, Inter_Tight } from "next/font/google";
import "./tokens.css";

// The root layout for everything a client or their customer sees: the owner's app at /app and the quote and
// invoice pages at /q and /i. It shares nothing with the agency's CRM, so its one stylesheet is the whole look.
const ui = Inter({ variable: "--font-ui", subsets: ["latin"], display: "swap" });
const tight = Inter_Tight({ variable: "--font-tight", subsets: ["latin"], display: "swap", weight: ["500", "600"] });

export default function ClientRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${tight.variable}`}>
      <body>{children}</body>
    </html>
  );
}
