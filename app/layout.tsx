import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import "./cinder-minimal.css";
import "./stealth.css";
import "./polish.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display serif for page titles and the greeting.
const display = Newsreader({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"], display: "swap" });

export const metadata: Metadata = {
  title: "Cinder — Personal Command Center",
  description: "Cinder personal command center — one place to run the business.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
