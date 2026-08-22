import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  Inter,
  Reem_Kufi,
  IBM_Plex_Sans_Arabic,
} from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const reemKufi = Reem_Kufi({
  variable: "--font-reem",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-ar",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "إحياء — Ihyaa Community",
  description:
    "مجتمع إحياء الشبابي: لقاءات، أنشطة، ومحتوى هادف يجمع الشباب في مدن المغرب.",
  icons: {
    icon: "/images/logo-square.jpg",
    apple: "/images/logo-square.jpg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f2" },
    { media: "(prefers-color-scheme: dark)", color: "#12101c" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${reemKufi.variable} ${plexArabic.variable} antialiased`}
    >
      <body className="min-h-dvh bg-background text-foreground overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
