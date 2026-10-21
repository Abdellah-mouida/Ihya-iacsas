"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Home,
  ArrowLeft,
  ArrowRight,
  Tent,
  Lock,
} from "lucide-react";

import { useLocale } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { AuthAmbientBackdrop } from "@/components/auth/auth-ambient-backdrop";

export function ForbiddenView() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const isAr = locale === "ar";

  return (
    <div
      data-testid="page-forbidden"
      className="relative min-h-dvh flex flex-col items-center justify-between p-4 sm:p-8 text-foreground overflow-hidden"
    >
      <div className="texture-surface texture-mandala -z-10 !opacity-10" />

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
          className="relative rounded-3xl border border-amber-500/25 bg-card/85 p-6 sm:p-10 text-center shadow-layered backdrop-blur-2xl"
        >
          {/* Animated Illustration: Organizers Tent & Lantern */}
          <div className="relative mx-auto mb-6 w-full max-w-[280px] h-36 flex items-center justify-center select-none">
            <svg
              viewBox="0 0 300 140"
              className="absolute inset-0 size-full text-muted-foreground/20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Stars in Sky */}
              <circle cx="45" cy="25" r="1.5" fill="currentColor" className="text-amber-400/80 animate-pulse" />
              <circle cx="110" cy="18" r="1.2" fill="currentColor" className="text-amber-400/60" />
              <circle cx="210" cy="22" r="1.5" fill="currentColor" className="text-amber-400/70 animate-pulse" />
              <circle cx="265" cy="28" r="1.2" fill="currentColor" className="text-amber-400/60" />

              {/* Desert Dune Background */}
              <path
                d="M 10,135 Q 80,105 160,120 T 290,135"
                className="stroke-border/70"
                strokeWidth="1.5"
              />

              {/* Berber / Camping Tent Outline */}
              <polygon
                points="150,42 90,130 210,130"
                className="fill-muted/70 stroke-amber-500/40"
                strokeWidth="2"
              />
              <line
                x1="150"
                y1="42"
                x2="150"
                y2="130"
                className="stroke-amber-500/60"
                strokeWidth="1.5"
              />
              <polygon
                points="150,75 130,130 170,130"
                className="fill-card stroke-amber-500/50"
                strokeWidth="1"
              />
            </svg>

            {/* Floating Padlock / Organizer Medallion */}
            <motion.div
              animate={{ y: [-4, 4, -4], rotate: [1, -1, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="relative size-20 rounded-2xl bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 p-0.5 shadow-lg shadow-amber-500/25 border border-white/20 grid place-items-center">
                <div className="size-full rounded-[14px] bg-background/90 backdrop-blur-md grid place-items-center">
                  <Lock className="size-8 text-amber-500" />
                </div>
                {/* 403 Kicker Tag */}
                <span
                  data-testid="error-code"
                  className="absolute -bottom-2 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-black tracking-widest bg-amber-500 text-night shadow-xs"
                >
                  {t("errors.forbiddenCode")}
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
              {t("errors.forbiddenTitle")}
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {t("errors.forbiddenSubtitle")}
            </p>
          </div>

          {/* Humorous Story Body */}
          <p
            data-testid="error-humor"
            className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto mb-8 font-sans"
          >
            {t("errors.forbiddenHumor")}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              data-testid="error-back-btn"
              onClick={() => router.back()}
              className="h-11 w-full sm:w-auto rounded-xl border-border/80 px-5 font-heading font-semibold hover:border-amber-500/50 transition-colors"
            >
              {isAr ? (
                <ArrowRight className="size-4 me-2 text-amber-500 shrink-0" />
              ) : (
                <ArrowLeft className="size-4 me-2 text-amber-500 shrink-0" />
              )}
              <span>{t("errors.forbiddenBack")}</span>
            </Button>

            <Button
              asChild
              data-testid="error-home-btn"
              className="h-11 w-full sm:w-auto rounded-xl px-5 font-heading font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 transition-transform hover:-translate-y-0.5"
            >
              <Link href="/">
                <Home className="size-4 me-2 shrink-0" />
                <span>{t("errors.forbiddenHome")}</span>
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
