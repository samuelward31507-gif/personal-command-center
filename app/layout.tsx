import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import "./cinder-minimal.css";
import "./stealth.css";
import "./polish.css";
import "./claude.css";
import "./design.css";
import "./mission.css";
import "./ui.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display face for titles and key figures: Archivo at an expanded width reads like an instrument readout.
const display = Archivo({ variable: "--font-display", subsets: ["latin"], axes: ["wdth"], display: "swap" });
// Serif for the Home greeting only.
const greetingSerif = Newsreader({ variable: "--font-greeting", subsets: ["latin"], axes: ["opsz"], display: "swap" });

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
