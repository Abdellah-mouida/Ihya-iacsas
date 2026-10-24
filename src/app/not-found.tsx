"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Compass,
  Home,
  Calendar,
  MessageSquare,
  Sparkles,
  MapPin,
} from "lucide-react";

import { useLocale } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { PageTexture } from "@/components/common/page-texture";
import { AuthAmbientBackdrop } from "@/components/auth/auth-ambient-backdrop";

export default function NotFound() {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";

  return (
    <div
      data-testid="page-not-found"
      className="relative isolate min-h-dvh flex flex-col items-center justify-between p-4 sm:p-8 text-foreground bg-background overflow-hidden z-0"
    >
      <PageTexture />

      {/* Top Header Utilities */}
      <header className="w-full max-w-5xl flex items-center justify-between py-2 z-20">
        <Link
          href="/"
          className="flex items-center gap-2 group font-heading font-bold text-lg text-foreground hover:text-primary transition-colors"
        >
          <span className="size-8 rounded-full bg-primary/10 border border-brass/30 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
            إ
          </span>
          <span>{isAr ? "برنامج إحياء" : "Ihyaa Program"}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Card */}
      <main className="my-auto py-8 w-full max-w-xl z-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl border border-brass/25 bg-card/85 p-6 sm:p-10 text-center shadow-layered backdrop-blur-2xl"
        >
          {/* Animated Illustration: Mountain Hike & Adventurous Detour */}
          <div className="relative mx-auto mb-6 w-full max-w-[280px] h-36 flex items-center justify-center select-none">
            {/* Mountain Ridges SVG */}
            <svg
              viewBox="0 0 300 140"
              className="absolute inset-0 size-full text-muted-foreground/20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Stars in Sky */}
              <circle cx="50" cy="25" r="1.5" fill="currentColor" className="text-brass/60 animate-pulse" />
              <circle cx="120" cy="18" r="1.5" fill="currentColor" className="text-brass/80" />
              <circle cx="180" cy="22" r="1.2" fill="currentColor" className="text-brass/50 animate-pulse" />
              <circle cx="250" cy="30" r="1.5" fill="currentColor" className="text-brass/70" />

              {/* Mountain Back Ridge */}
              <polygon
                points="110,130 185,45 260,130"
                className="fill-muted/60 stroke-border/60"
                strokeWidth="1.5"
              />
              {/* Mountain Front Ridge */}
              <polygon
                points="30,130 105,35 180,130"
                className="fill-card stroke-primary/30"
                strokeWidth="1.5"
              />

              {/* Winding Trail with Dots */}
              <path
                d="M 60,130 Q 80,105 105,95 T 140,85 T 190,95 T 235,115"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="text-brass/80"
              />
            </svg>

            {/* Floating Compass / Soccer Ball Badge in Center */}
            <motion.div
              animate={{ y: [-4, 4, -4], rotate: [-2, 2, -2] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="relative size-20 rounded-2xl bg-gradient-to-br from-emerald-600 via-primary to-teal-700 p-0.5 shadow-lg shadow-primary/25 border border-white/20 grid place-items-center">
                <div className="size-full rounded-[14px] bg-background/90 backdrop-blur-md grid place-items-center">
                  <Compass className="size-9 text-brass animate-spin [animation-duration:18s]" />
                </div>
                {/* 404 Kicker Tag */}
                <span className="absolute -bottom-2 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-black tracking-widest bg-brass text-night shadow-xs">
                  {t("errors.notFoundCode")}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-1 mb-4">
            <h1
              data-testid="error-title"
              className="font-heading text-2xl sm:text-3xl font-bold text-foreground"
            >
              {t("errors.notFoundTitle")}
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t("errors.notFoundSubtitle")}
            </p>
          </div>

          {/* Humorous Story Body */}
          <p
            data-testid="error-humor"
            className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto mb-8 font-sans"
          >
            {t("errors.notFoundHumor")}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              data-testid="error-home-btn"
              className="h-11 w-full sm:w-auto rounded-xl px-5 font-heading font-semibold shadow-md shadow-primary/15 transition-transform hover:-translate-y-0.5"
            >
              <Link href="/">
                <Home className="size-4 me-2 shrink-0" />
                <span>{t("errors.notFoundHome")}</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              data-testid="error-events-btn"
              className="h-11 w-full sm:w-auto rounded-xl border-border/80 px-5 font-heading font-semibold hover:border-primary/50 transition-colors"
            >
              <Link href="/events">
                <Calendar className="size-4 me-2 text-primary shrink-0" />
                <span>{t("errors.notFoundEvents")}</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              data-testid="error-contact-btn"
              className="h-11 w-full sm:w-auto rounded-xl px-4 text-xs font-heading text-muted-foreground hover:text-foreground"
            >
              <Link href="/#contact">
                <MessageSquare className="size-3.5 me-1.5 shrink-0 opacity-70" />
                <span>{t("errors.notFoundContact")}</span>
              </Link>
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Footer copyright */}
      <footer className="w-full text-center py-2 text-xs text-muted-foreground/70 z-20">
        © {new Date().getFullYear()} {isAr ? "برنامج إحياء. جميع الحقوق محفوظة." : "Ihyaa Program. All rights reserved."}
      </footer>
    </div>
  );
}
