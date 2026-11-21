import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
// One stylesheet for the whole command center. The older layered sheets were retired in favor of it.
import "./cinder.css";
// DESIGN-SPEC layer: the same look as the client app. Last, so it wins.
import "./spec.css";

// Same faces as cinderrevenue.com: Inter for interface text, Inter Tight for titles and figures.
// The variable names stay as they were so every older stylesheet picks the new faces up.
const geistSans = Inter({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Inter_Tight({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const greetingSerif = Inter_Tight({ variable: "--font-greeting", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Cinder",
  description: "Cinder personal command center — one place to run the business.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${greetingSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
