"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Shield,
  ShieldAlert,
  Sparkles,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { clearLegacyBookingState } from "@/lib/booking-state";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { IMAGES } from "@/lib/content";
import { cn } from "@/lib/utils";

interface AdminUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "ADMIN" | "MODERATOR" | "USER";
}

interface AdminLayoutClientProps {
  user: AdminUser;
  children: React.ReactNode;
}

export function AdminLayoutClient({ user, children }: AdminLayoutClientProps) {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/admin", label: isAr ? "نظرة عامة" : "Overview", icon: LayoutDashboard },
    { href: "/admin/carousel", label: isAr ? "شريط الصور" : "Carousel", icon: Sparkles },
    { href: "/admin/gallery", label: isAr ? "معرض الصور" : "Gallery", icon: ImageIcon },
    { href: "/admin/events", label: isAr ? "الفعاليات" : "Events", icon: Calendar },
    { href: "/admin/branches", label: t("adminBranches.navLabel"), icon: MapPin },
    { href: "/admin/bookings", label: isAr ? "الحجوزات" : "Bookings", icon: Ticket },
    { href: "/admin/contacts", label: isAr ? "الرسائل" : "Messages", icon: Mail },
    { href: "/admin/moderation", label: t("adminModeration.navLabel"), icon: ShieldAlert },
    ...(user.role === "ADMIN"
      ? [
          { href: "/admin/users", label: isAr ? "المستخدمون" : "Users", icon: Users },
          { href: "/admin/logs", label: t("nav.logs"), icon: FileText },
        ]
      : []),
  ];

  const handleLogout = async () => {
    clearLegacyBookingState();
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="relative isolate min-h-screen text-foreground antialiased transition-colors duration-300 z-0">
      {/* Background Page Texture */}

      <div className="relative z-10 flex w-full flex-col lg:flex-row min-h-screen">
        {/* Desktop Sidebar */}
        <aside data-testid="admin-sidebar" className="hidden lg:flex w-64 xl:w-72 flex-col border-e border-border/60 bg-card/40 backdrop-blur-sm p-5 xl:p-6 shrink-0 sticky top-0 h-screen overflow-hidden">
          <div data-testid="admin-sidebar-header" className="shrink-0">
            {/* Header Brand */}
            <Link href="/" prefetch={false} className="flex items-center gap-2.5 px-1.5 py-2 mb-2.5">
              <Image
                src={IMAGES.logoCircle}
                alt="Ihyaa"
                width={36}
                height={36}
                className="size-9 object-contain"
              />
              <div>
                <span className="font-heading text-lg font-bold text-gradient-brass block leading-none">
                  {t("nav.brand")}
                </span>
                <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-semibold">
                  {isAr ? "لوحة الإدارة" : "Admin Portal"}
                </span>
              </div>
            </Link>

            {/* User Profile Card */}
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3">
              <UserAvatar
                name={user.name}
                src={user.image}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold font-heading text-foreground">
                  {user.name || (isAr ? "مستخدم مسؤول" : "Admin User")}
                </p>
                <p className="truncate text-[0.7rem] text-muted-foreground font-sans">
                  {user.email}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold border",
                      user.role === "ADMIN"
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                    )}
                  >
                    <Shield className="size-2.5" />
                    {user.role === "ADMIN" ? (isAr ? "مسؤول عام" : "Admin") : (isAr ? "مشرف" : "Moderator")}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Only the links move; keep the account header and controls in place. */}
          <div className="relative flex-1 min-h-0">
            <nav data-testid="admin-sidebar-nav" className="flex h-full flex-col gap-1.5 overflow-y-auto py-2 no-scrollbar">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors duration-200",
                      active
                        ? "bg-brass/15 text-brass dark:bg-brass/20 dark:text-amber-300 shadow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-card/70 to-transparent" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-card/70 to-transparent" />
          </div>

          {/* Footer Controls */}
          <div data-testid="admin-sidebar-footer" className="shrink-0 pt-6 border-t border-border/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t("dashboard.theme") || (isAr ? "المظهر واللغة" : "Theme & Lang")}
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
              <Link href="/" prefetch={false}>
                {t("dashboard.backToSite") || (isAr ? "← العودة إلى الموقع" : "← Back to Site")}
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleLogout}
              data-testid="admin-logout-btn"
              className="w-full rounded-xl text-xs font-semibold justify-center text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-3.5 me-2" />
              {t("dashboard.logout") || (isAr ? "تسجيل الخروج" : "Log out")}
            </Button>
          </div>
        </aside>

        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between border-b border-border/60 bg-card/40 backdrop-blur-xl px-4 py-3">
          <Link href="/" prefetch={false} className="flex items-center gap-2.5">
            <Image
              src={IMAGES.logoCircle}
              alt="Ihyaa"
              width={32}
              height={32}
              className="size-8 object-contain"
            />
            <span className="font-heading text-base font-bold text-gradient-brass">
              {t("nav.brand")} {isAr ? "الإدارة" : "Admin"}
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
            data-testid="admin-mobile-drawer"
            className="lg:hidden h-[calc(100svh-4rem)] max-h-[calc(100svh-4rem)] overflow-hidden border-b border-border/60 bg-card/90 backdrop-blur-2xl p-4 flex flex-col"
          >
            {/* User Info on Mobile */}
            <div className="shrink-0 flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-2.5 mb-2">
              <UserAvatar
                name={user.name}
                src={user.image}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">
                  {user.name}
                </p>
                <p className="truncate text-[0.65rem] text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold bg-primary/10 text-primary border border-primary/20">
                {user.role}
              </span>
            </div>

            <div className="relative flex-1 min-h-0">
            <nav data-testid="admin-mobile-nav" className="flex max-h-full flex-col gap-1.5 overflow-y-auto py-1 no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2.5 text-base font-semibold transition-colors",
                    active
                      ? "bg-brass/15 text-brass"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                    <Icon className="size-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            </nav>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-card/90 to-transparent" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-card/90 to-transparent" />
            </div>
            <div className="shrink-0 pt-3 mt-2 border-t border-border flex items-center justify-between gap-2">
              <LanguageSwitcher />
              <Button asChild size="sm" variant="outline" className="rounded-xl">
                <Link href="/" prefetch={false}>
                  {t("dashboard.backToSite") || (isAr ? "العودة للموقع" : "Back to Site")}
                </Link>
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="admin-logout-mobile-btn"
              className="shrink-0 w-full rounded-xl text-xs font-semibold justify-center text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-3.5 me-2" />
              {t("dashboard.logout") || (isAr ? "تسجيل الخروج" : "Log out")}
            </Button>
          </motion.div>
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10 w-full min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
