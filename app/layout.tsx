import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

const SITE = "https://plinko.onyxlab.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Plinko · Onyx Labs — Demo (not real funds)",
    template: "%s · Onyx Labs",
  },
  description:
    "Onyx Plinko demo by Onyx Labs. Virtual WLD and SOL chips only — Demo — not real funds. No on-chain transfers in v1.",
  applicationName: "Onyx Plinko",
  keywords: [
    "Onyx Labs",
    "Plinko",
    "demo",
    "not real funds",
    "WLD",
    "SOL",
    "Solana",
  ],
  openGraph: {
    title: "Plinko · Onyx Labs — Demo (not real funds)",
    description:
      "Virtual WLD and SOL chips only. Demo — not real funds. No on-chain transfers in v1.",
    url: SITE,
    siteName: "Onyx Labs",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Plinko · Onyx Labs — Demo (not real funds)",
    description:
      "Virtual WLD and SOL chips only. Demo — not real funds.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
