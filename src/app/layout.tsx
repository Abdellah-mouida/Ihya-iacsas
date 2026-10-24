import type { Metadata, Viewport } from "next";
import { Montserrat, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { RouteHistoryTracker } from "@/components/common/route-history-tracker";
import { DynamicThemeStyles } from "@/components/common/dynamic-theme-styles";

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var l=localStorage.getItem('ihyaa-locale');
if(l==='en'||l==='ar'){document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';}
var t=localStorage.getItem('ihyaa-theme');
var validThemes=['light','sunset','amoled','black'];
if(!t||!validThemes.includes(t)){
  var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  t=prefersDark?'black':'light';
}
document.documentElement.setAttribute('data-theme',t);
if(t==='dark'||t==='black'||t==='amoled'){
  document.documentElement.classList.add('dark');
}else{
  document.documentElement.classList.remove('dark');
}
}catch(e){}})();`,
          }}
        />
        <DynamicThemeStyles />
      </head>
      <body className="min-h-dvh bg-background text-foreground overflow-x-hidden">
        <Providers>
          <RouteHistoryTracker />
          {children}
        </Providers>
      </body>
    </html>
  );
}
