"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Shield,
  Sparkles,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
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
    { href: "/admin/bookings", label: isAr ? "الحجوزات" : "Bookings", icon: Ticket },
    { href: "/admin/contacts", label: isAr ? "الرسائل" : "Messages", icon: Mail },
    ...(user.role === "ADMIN"
      ? [{ href: "/admin/users", label: isAr ? "المستخدمون" : "Users", icon: Users }]
      : []),
  ];

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased transition-colors duration-300">
      {/* Background Girih Texture Fade */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-girih opacity-[0.03] dark:opacity-[0.05]"
      />

      <div className="flex w-full flex-col lg:flex-row min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 xl:w-72 flex-col border-e border-border/60 bg-card/40 backdrop-blur-xl p-5 xl:p-6 shrink-0 justify-between sticky top-0 h-screen overflow-y-auto">
          <div>
            {/* Header Brand */}
            <Link href="/" prefetch={false} className="flex items-center gap-3 px-2 py-3 mb-4">
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

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
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
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Controls */}
          <div className="pt-6 border-t border-border/50 flex flex-col gap-3">
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
            className="lg:hidden border-b border-border/60 bg-card/90 backdrop-blur-2xl p-4 flex flex-col gap-2"
          >
            {/* User Info on Mobile */}
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-2.5 mb-2">
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

            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
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
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-3 mt-2 border-t border-border flex items-center justify-between gap-2">
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
              className="w-full rounded-xl text-xs font-semibold justify-center text-destructive hover:bg-destructive/10"
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
