"use client";

/**
 * Temporary Admin Login Page
 *
 * NOTE: STOPGAP ACCESS GATE
 * Provides a streamlined password gate for administrators before accessing
 * protected /admin routes. This stops casual unauthorized access until a
 * full authentication system is integrated.
 */

import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { adminLogin } from "@/app/actions/admin-auth";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/i18n/locale-provider";
import { IMAGES } from "@/lib/content";

export default function AdminLoginPage() {
  const { t, locale } = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextDestination = searchParams.get("next") || "/admin";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError(isRtl ? "يرجى إدخال كلمة المرور" : "Please enter the password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await adminLogin(password);
      if (res.success) {
        router.push(nextDestination);
        router.refresh();
      } else {
        setError(
          res.error ||
            (isRtl
              ? "كلمة المرور غير صحيحة. تم رفض الوصول."
              : "Invalid password. Access denied."),
        );
      }
    } catch {
      setError(
        isRtl
          ? "تعذر التحقق من الدخول. يرجى المحاولة لاحقاً."
          : "Could not verify credentials. Please try again later.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-background text-foreground antialiased selection:bg-brass selection:text-foreground">
      {/* Background Girih / Islamic Pattern Texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-girih opacity-[0.03] dark:opacity-[0.05]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(45%_35%_at_50%_25%,color-mix(in_oklch,var(--gold)_12%,transparent),transparent_70%)]"
      />

      {/* Top Navigation */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="group flex items-center gap-3 transition-opacity hover:opacity-85"
          aria-label="Ihyaa Home"
        >
          <Image
            src={IMAGES.logoSquare}
            alt="Ihyaa"
            width={38}
            height={38}
            priority
            className="size-9 rounded-full object-cover ring-1 ring-brass/40"
          />
          <span className="font-heading text-xl font-bold text-gradient-brass">
            {t("nav.brand") || "إحياء"}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Login Card */}
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/60 p-7 sm:p-9 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 dark:bg-card/40">
            {/* Top Accent Gradient Bar */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brass via-emerald-500 to-brass" />

            {/* Header / Lock Emblem */}
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brass/15 text-brass border border-brass/30 shadow-inner">
                <Lock className="size-7" />
              </div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                {isRtl ? "بوابة الإدارة" : "Admin Access Gate"}
              </h1>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                {isRtl
                  ? "أدخل كلمة المرور الإدارية للوصول إلى لوحة التحكم."
                  : "Enter the administrative password to access the dashboard."}
              </p>
            </div>

            {/* Error Message Box */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                data-testid="admin-login-error"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400"
              >
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="admin-password"
                  className="text-xs font-semibold text-foreground/90 flex items-center justify-between"
                >
                  <span>{isRtl ? "كلمة المرور" : "Password"}</span>
                  <KeyRound className="size-3.5 text-muted-foreground" />
                </Label>

                <div className="relative">
                  <Input
                    id="admin-password"
                    data-testid="admin-password-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={
                      isRtl ? "••••••••••••" : "Enter access password"
                    }
                    autoComplete="current-password"
                    autoFocus
                    disabled={loading}
                    className="h-11 rounded-xl bg-background/50 pe-11 ps-3.5 text-sm border-border/80 focus-visible:ring-brass"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                data-testid="admin-login-submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-brass text-brass-foreground font-semibold shadow-md hover:bg-brass-deep transition-all mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin me-2" />
                    <span>{isRtl ? "جاري التحقق..." : "Verifying..."}</span>
                  </>
                ) : (
                  <span>{isRtl ? "دخول إلى اللوحة" : "Unlock Dashboard"}</span>
                )}
              </Button>
            </form>

            {/* Back to Public Site Link */}
            <div className="mt-6 pt-5 border-t border-border/50 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isRtl ? (
                  <>
                    <span>العودة إلى الموقع العام</span>
                    <ArrowLeft className="size-3.5" />
                  </>
                ) : (
                  <>
                    <ArrowLeft className="size-3.5" />
                    <span>Back to public site</span>
                  </>
                )}
              </Link>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="py-4 text-center text-[11px] text-muted-foreground/70 px-4">
        <span>
          {isRtl
            ? "نظام حماية مؤقت مخصص لجمعية إحياء • للوصول الإداري المصرح به فقط"
            : "Temporary access gate for Ihyaa Platform • Authorized personnel only"}
        </span>
      </footer>
    </div>
  );
}
