"use client";

import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLocale } from "@/i18n/locale-provider";
import { EVENT, IMAGES, NAV_LINKS } from "@/lib/content";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function GlassNavbar() {
  const { t, dir } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const side = dir === "rtl" ? "left" : "right";

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4"
    >
      <nav
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-3 py-2 transition-all duration-300 sm:px-4",
          scrolled ? "glass-strong shadow-layered" : "bg-transparent",
        )}
      >
        <Link href="#home" className="flex items-center gap-2" aria-label={t("nav.brand")}>
          <Image
            src={IMAGES.logoBanner}
            alt={t("nav.brand")}
            width={96}
            height={40}
            priority
            className="h-9 w-auto object-contain"
          />
        </Link>

        <ul className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="group relative rounded-lg px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:text-foreground"
              >
                {t(link.key)}
                <span className="bg-brass-gradient absolute inset-x-3 bottom-1 h-0.5 origin-center scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Button
            asChild
            className="bg-brass-gradient hidden h-10 rounded-full px-5 text-sm font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95 sm:inline-flex"
          >
            <Link href={EVENT.bookHref}>{t("nav.book")}</Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="glass size-10 rounded-full lg:hidden"
                aria-label={t("nav.menu")}
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={side} className="glass-strong w-72 border-border/60">
              <SheetTitle className="text-gradient-brass px-4 pt-4 font-heading text-2xl">
                {t("nav.brand")}
              </SheetTitle>
              <ul className="mt-4 flex flex-col gap-1 px-3">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <SheetClose asChild>
                      <a
                        href={link.href}
                        className="block rounded-lg px-3 py-3 text-base font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {t(link.key)}
                      </a>
                    </SheetClose>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-3 p-4">
                <LanguageSwitcher className="w-full justify-center" />
                <SheetClose asChild>
                  <Button
                    asChild
                    className="bg-brass-gradient h-11 w-full rounded-full font-semibold text-night"
                  >
                    <Link href={EVENT.bookHref}>{t("nav.book")}</Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </motion.header>
  );
}
