import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AiDataBootstrap } from "@/components/medflow/AiDataBootstrap";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedFlow Transcribe AI — Secure AI-Assisted Medical Transcription Operations",
  description:
    "MedFlow Transcribe AI helps healthcare organizations and transcription service teams securely transform clinical dictation into review-ready documentation — using AI automation, human quality control, SLA intelligence, and EHR-ready delivery.",
  keywords: [
    "medical transcription",
    "BPO",
    "clinical documentation",
    "AI agents",
    "FHIR",
    "HL7",
    "HIPAA",
    "healthcare SaaS",
    "MedFlow",
  ],
  authors: [{ name: "MedFlow Transcribe AI" }],
  icons: {
    icon: "/medflow-logo.png",
  },
  openGraph: {
    title: "MedFlow Transcribe AI",
    description:
      "Secure AI-assisted medical transcription operations for healthcare organizations and managed offshore delivery teams.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Server-side bootstrap: fetches FastAPI data + embeds as window.__MEDFLOW_AI_DATA__
            so client sections have data even if runtime fetches fail in published mode */}
        <AiDataBootstrap />
        {children}
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
