import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Electoral Roll Explorer | Advanced Voter Search",
  description: "A fast, intelligent search platform for digitized electoral rolls. Find voters instantly with exact matches or AI-powered fuzzy searching.",
  keywords: ["voter", "electoral roll", "search", "database", "hindi"],
  openGraph: {
    title: "Electoral Roll Explorer",
    description: "Intelligent search platform for digitized electoral rolls.",
    type: "website",
  },
  icons: {
    icon: "/mascot_transparent.png",
    apple: "/mascot_transparent.png",
  }
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
