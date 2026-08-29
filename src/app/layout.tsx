import type { Metadata, Viewport } from "next";
import { Montserrat, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const notoKufi = Noto_Kufi_Arabic({
  variable: "--font-noto-kufi",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "إحياء — Ihyaa Program",
  description:
    "برنامج إحياء الشبابي: لقاءات، أنشطة، ومحتوى هادف يجمع الشباب في مدن المغرب.",
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
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${montserrat.variable} ${notoKufi.variable} antialiased`}
    >
      <body className="min-h-dvh bg-background text-foreground overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
