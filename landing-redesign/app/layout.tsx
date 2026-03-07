import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aha — Your 24/7 AI Employee for Influencer Marketing",
  description:
    "Aha automates influencer discovery, outreach, pricing negotiation, contracts, and payments — so your team can focus on strategy.",
  openGraph: {
    title: "Aha — Your 24/7 AI Employee for Influencer Marketing",
    description:
      "5M+ creators. 140+ countries. Automated end-to-end influencer campaigns.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
