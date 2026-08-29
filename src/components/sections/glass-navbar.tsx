"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { EVENT, IMAGES, NAV_LINKS, hasNewEvent } from "@/lib/content";
import { EASE, fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

const hamburgerTop = {
  closed: { rotate: 0, y: -6 },
  open: { rotate: 45, y: 0 },
};
const hamburgerMid = { closed: { opacity: 1 }, open: { opacity: 0 } };
const hamburgerBot = {
  closed: { rotate: 0, y: 6 },
  open: { rotate: -45, y: 0 },
};

/** Pulsing green dot shown on the Events link when a new event is bookable. */
function NewEventDot({ label }: { label: string }) {
  return (
    <span className="relative ms-1.5 inline-flex size-2.5" role="status" aria-label={label}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-70" />
      <span className="relative inline-flex size-2.5 rounded-full bg-green ring-2 ring-green/30" />
    </span>
  );
}

export function GlassNavbar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock scroll + Escape to close the mobile menu.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close the mobile menu on route change.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4"
    >
      <nav
        className={cn(
          "relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-4 overflow-hidden rounded-[1.9rem] border border-border/60 px-3 backdrop-blur-xl backdrop-saturate-150 transition-all duration-500 sm:px-4",
          scrolled
            ? "bg-[color-mix(in_oklch,var(--background)_72%,transparent)] py-1.5 shadow-layered"
            : "bg-[color-mix(in_oklch,var(--background)_50%,transparent)] py-2.5",
        )}
      >
        {/* animated gradient sheen inside the glass */}
        <span
          aria-hidden
          className="bg-brass-gradient animate-gradient pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-[0.07] [background-size:200%_200%]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />

        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label={t("nav.brand")}
        >
          <span className="relative shrink-0">
            <Image
              src={IMAGES.logoSquare}
              alt={t("nav.brand")}
              width={40}
              height={40}
              priority
              className="size-10 rounded-full object-cover ring-1 ring-brass/40 transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
          </span>
          <span className="text-gradient-brass font-heading text-xl font-bold">
            {t("nav.brand")}
          </span>
        </Link>

        {/* Desktop links with moving active pill (brand green) */}
        <ul className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            const showDot = Boolean(link.indicator) && hasNewEvent;
            return (
              <li key={link.href} className="relative">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-200",
                    active
                      ? "text-green"
                      : "text-foreground/85 hover:text-green",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="navActive"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      className="absolute inset-0 -z-10 rounded-full bg-green/12 ring-1 ring-green/25"
                    />
                  ) : null}
                  {t(link.key)}
                  {showDot ? <NewEventDot label={t("nav.newEvent")} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Button
            asChild
            className="bg-brass-gradient hidden h-10 rounded-full px-5 text-sm font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95 sm:inline-flex"
          >
            <Link href={EVENT.bookHref}>{t("nav.book")}</Link>
          </Button>

          {/* Animated hamburger */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={t("nav.menu")}
            aria-expanded={open}
            className="glass grid size-10 place-items-center rounded-full text-foreground transition-transform hover:scale-105 lg:hidden"
          >
            <span className="relative block size-5 text-current">
              <motion.span
                variants={hamburgerTop}
                animate={open ? "open" : "closed"}
                className="absolute inset-x-0 top-1/2 -mt-px h-0.5 rounded-full bg-current"
                style={{ originX: 0.5, originY: 0.5 }}
              />
              <motion.span
                variants={hamburgerMid}
                animate={open ? "open" : "closed"}
                className="absolute inset-x-0 top-1/2 -mt-px h-0.5 rounded-full bg-current"
              />
              <motion.span
                variants={hamburgerBot}
                animate={open ? "open" : "closed"}
                className="absolute inset-x-0 top-1/2 -mt-px h-0.5 rounded-full bg-current"
                style={{ originX: 0.5, originY: 0.5 }}
              />
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-0 bg-night/40 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="glass-strong absolute inset-x-3 top-[4.5rem] z-10 origin-top rounded-[1.75rem] p-4 shadow-layered sm:inset-x-4 lg:hidden"
            >
              <motion.ul
                variants={staggerContainer(0.06)}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-1"
              >
                {NAV_LINKS.map((link) => {
                  const active = isActive(link.href);
                  const showDot = Boolean(link.indicator) && hasNewEvent;
                  return (
                    <motion.li key={link.href} variants={fadeUp}>
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between rounded-2xl px-4 py-3 text-lg font-semibold transition-colors",
                          active
                            ? "bg-green/15 text-green"
                            : "text-foreground/85 hover:bg-muted hover:text-green",
                        )}
                      >
                        <span className="flex items-center">
                          {t(link.key)}
                          {showDot ? (
                            <NewEventDot label={t("nav.newEvent")} />
                          ) : null}
                        </span>
                        <ChevronLeft className="size-4 opacity-40 rtl:rotate-180" />
                      </Link>
                    </motion.li>
                  );
                })}
              </motion.ul>
              <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                <LanguageSwitcher className="flex-1 justify-center" />
                <Button
                  asChild
                  className="bg-brass-gradient h-11 flex-1 rounded-full font-semibold text-night"
                >
                  <Link href={EVENT.bookHref} onClick={() => setOpen(false)}>
                    {t("nav.book")}
                  </Link>
                </Button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
