"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  ShieldAlert,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { IMAGES } from "@/lib/content";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", labelKey: "dashboard.overview", icon: LayoutDashboard },
  { href: "/admin/carousel", labelKey: "dashboard.carousel", icon: Sparkles },
  { href: "/admin/gallery", labelKey: "dashboard.gallery", icon: ImageIcon },
  { href: "/admin/events", labelKey: "dashboard.events", icon: Calendar },
  { href: "/admin/bookings", labelKey: "dashboard.bookings", icon: Ticket },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased transition-colors duration-300">
      {/* Background Girih Texture Fade */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-girih opacity-[0.03] dark:opacity-[0.05]"
      />

      {/* Access Control Notice Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2">
        <ShieldAlert className="size-4 shrink-0 text-amber-500" />
        <span>
          <strong>{t("dashboard.authNoticeTitle") || "Security Warning:"}</strong>{" "}
          {t("dashboard.authNoticeBody") ||
            "This admin route is currently unauthenticated for dev testing. Add NextAuth before production deployment."}
        </span>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row min-h-[calc(100vh-37px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-e border-border/60 bg-card/40 backdrop-blur-xl p-5 shrink-0 justify-between">
          <div>
            {/* Header Brand */}
            <Link href="/" className="flex items-center gap-3 px-2 py-3 mb-6">
              <Image
                src={IMAGES.logoSquare}
                alt="Ihyaa"
                width={36}
                height={36}
                className="size-9 rounded-full object-cover ring-1 ring-brass/40"
              />
              <div>
                <span className="font-heading text-lg font-bold text-gradient-brass block leading-none">
                  {t("nav.brand")}
                </span>
                <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-semibold">
                  {t("dashboard.title") || "Admin Portal"}
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200",
                      active
                        ? "bg-brass/15 text-brass dark:bg-brass/20 dark:text-amber-300 shadow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>
                      {t(item.labelKey) ||
                        item.labelKey.split(".").pop()?.toUpperCase()}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Controls */}
          <div className="pt-6 border-t border-border/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t("dashboard.theme") || "Theme & Lang"}
              </span>
              <div className="flex items-center gap-1.5">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl text-xs font-semibold justify-center"
            >
              <Link href="/">{t("dashboard.backToSite") || "← Back to Site"}</Link>
            </Button>
          </div>
        </aside>

        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between border-b border-border/60 bg-card/40 backdrop-blur-xl px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src={IMAGES.logoSquare}
              alt="Ihyaa"
              width={32}
              height={32}
              className="size-8 rounded-full ring-1 ring-brass/40"
            />
            <span className="font-heading text-base font-bold text-gradient-brass">
              {t("nav.brand")} {t("dashboard.portal") || "Admin"}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-full"
              aria-label="Toggle Navigation"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden border-b border-border/60 bg-card/90 backdrop-blur-2xl p-4 flex flex-col gap-2"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-all",
                    active
                      ? "bg-brass/15 text-brass"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <Icon className="size-5" />
                  <span>
                    {t(item.labelKey) ||
                      item.labelKey.split(".").pop()?.toUpperCase()}
                  </span>
                </Link>
              );
            })}
            <div className="pt-3 mt-2 border-t border-border flex items-center justify-between">
              <LanguageSwitcher />
              <Button asChild size="sm" variant="outline" className="rounded-xl">
                <Link href="/">{t("dashboard.backToSite") || "Back to Site"}</Link>
              </Button>
            </div>
          </motion.div>
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
