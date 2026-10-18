"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useTransition, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { toast } from "@/lib/toast";
import { validatePasswordStrength } from "@/lib/password";
import { signUpWithCredentials } from "@/app/actions/auth";
import { AuthAmbientBackdrop } from "./auth-ambient-backdrop";

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function SignUpView() {
  const { t, locale, dir } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAr = locale === "ar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, setIsGooglePending] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) return;

    if (errorParam === "access_denied" || errorParam === "OAuthCallbackError_access_denied") {
      toast.error(t("auth.oauthCancelled"));
    } else {
      toast.error(t("auth.oauthError"));
    }
    setIsGooglePending(false);
  }, [searchParams, t]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsGooglePending(false);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const passwordRules = validatePasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t("auth.errNameRequired"));
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error(t("auth.errEmailRequired"));
      return;
    }
    if (!passwordRules.valid) {
      toast.error(
        isAr
          ? "يرجى استيفاء جميع شروط كلمة المرور"
          : "Please fulfill all password requirements",
      );
      return;
    }
    if (!passwordsMatch) {
      toast.error(t("auth.errPasswordMismatch"));
      return;
    }
    if (!termsAccepted) {
      toast.error(t("auth.errTermsRequired"));
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("email", email);
      formData.set("password", password);
      formData.set("termsAccepted", termsAccepted ? "true" : "false");

      const res = await signUpWithCredentials(formData, locale);

      if (!res.success) {
        toast.error(res.error || t("auth.errRateLimited"));
        return;
      }

      toast.success(
        isAr
          ? "تم إنشاء الحساب بنجاح! يرجى إدخال رمز التحقق"
          : "Account created! Please verify your email",
      );

      router.push(`/verify-email?email=${encodeURIComponent(res.email || email.trim().toLowerCase())}`);
    });
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGooglePending(true);
      await signIn("google", { callbackUrl: "/onboarding" });
    } catch {
      toast.error(
        isAr
          ? "تعذر الاتصال بـ Google، يرجى المحاولة لاحقاً"
          : "Failed to connect to Google, please try again",
      );
      setIsGooglePending(false);
    }
  };

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Ambient background with depth and glow */}
      <AuthAmbientBackdrop />

      {/* Container with max width */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch rounded-3xl border border-brass/15 bg-card/75 dark:bg-card/60 backdrop-blur-2xl shadow-2xl overflow-hidden">
        {/* Visual / Branding Panel (Desktop Only) */}
        <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-10 text-white overflow-hidden bg-primary/95">
          <Image
            src="/images/gathering.jpg"
            alt="Ihyaa Gathering"
            fill
            className="object-cover mix-blend-overlay opacity-30 select-none pointer-events-none"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/90 via-primary/70 to-emerald-950/95" />

          {/* Top Brand */}
          <div className="relative z-10">
            <Link
              href="/"
              className="inline-flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              <div className="relative size-12 rounded-full overflow-hidden border-2 border-brass/40 shadow-lg">
                <Image
                  src="/images/logo-circle.png"
                  alt="Ihyaa Program Logo"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <span className="font-heading text-xl font-bold tracking-tight block">
                  {isAr ? "برنامج إحياء" : "Ihyaa Program"}
                </span>
                <span className="text-xs text-brass-muted font-medium block">
                  {isAr ? "مبادرات ولقاءات شبابية" : "Youth Programs & Gatherings"}
                </span>
              </div>
            </Link>
          </div>

          {/* Center Quote / Pitch */}
          <div className="relative z-10 my-auto py-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brass/15 border border-brass/30 text-xs font-semibold text-brass mb-4">
              <Sparkles className="size-3.5" />
              <span>{isAr ? "انضم إلى برنامج إحياء" : "Join Ihyaa Program"}</span>
            </div>
            <h2 className="font-heading text-2xl font-bold leading-snug mb-3">
              {isAr
                ? "مساحتك للتلاقي، البناء، والإحياء"
                : "Your space for connection, growth, and revival"}
            </h2>
            <p className="text-sm text-white/80 leading-relaxed font-sans">
              {isAr
                ? "سجّل الآن لتتمكن من حجز مقعدك في كافة المجالس والفعاليات بنقرة واحدة، ومتابعة حالة حجوزاتك بشكل فوري."
                : "Sign up today to reserve your seat at all upcoming gatherings and events with one click, and track your bookings in real time."}
            </p>
          </div>

          {/* Bottom Back Link */}
          <div className="relative z-10 pt-4 border-t border-white/10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
            >
              <BackIcon className="size-3.5" />
              <span>{isAr ? "العودة إلى الصفحة الرئيسية" : "Back to Home"}</span>
            </Link>
          </div>
        </div>

        {/* Form Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between lg:hidden mb-4">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <Image
                  src="/images/logo-circle.png"
                  alt="Ihyaa Program Logo"
                  width={38}
                  height={38}
                  className="rounded-full border border-brass/30"
                />
                <span className="font-heading text-base font-bold text-foreground">
                  {isAr ? "برنامج إحياء" : "Ihyaa Program"}
                </span>
              </Link>
              <Link
                href="/"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <BackIcon className="size-3" />
                <span>{isAr ? "الرئيسية" : "Home"}</span>
              </Link>
            </div>

            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {t("auth.signupTitle")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 font-sans">
              {t("auth.signupSubtitle")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="signup-form">
            {/* Full Name */}
            <div>
              <label
                htmlFor="signup-name"
                className="block text-xs font-semibold text-foreground mb-1.5"
              >
                {t("auth.fullName")} <span className="text-destructive">*</span>
              </label>
              <input
                id="signup-name"
                data-testid="signup-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.fullNamePlaceholder")}
                className="w-full h-11 px-3.5 rounded-xl border border-border/70 bg-background/60 focus:bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                disabled={isPending}
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-semibold text-foreground mb-1.5"
              >
                {t("auth.email")} <span className="text-destructive">*</span>
              </label>
              <input
                id="signup-email"
                data-testid="signup-email"
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full h-11 px-3.5 rounded-xl border border-border/70 bg-background/60 focus:bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-start"
                disabled={isPending}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-semibold text-foreground mb-1.5"
              >
                {t("auth.password")} <span className="text-destructive">*</span>
              </label>
              <div className="relative" dir="ltr">
                <input
                  id="signup-password"
                  data-testid="signup-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  className="w-full h-11 ps-3.5 pe-11 text-start rounded-xl border border-border/70 bg-background/60 focus:bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-0 pe-3 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Real-time Password Strength checklist */}
              {password.length > 0 && (
                <div className="mt-2.5 p-3 rounded-xl bg-muted/40 border border-border/40 space-y-1.5 text-xs">
                  <div className="font-semibold text-muted-foreground mb-1">
                    {t("auth.passwordStrength")}:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div
                      className={`flex items-center gap-1.5 ${passwordRules.length ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}
                    >
                      {passwordRules.length ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                      <span>{t("auth.ruleLength")}</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${passwordRules.uppercase && passwordRules.lowercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}
                    >
                      {passwordRules.uppercase && passwordRules.lowercase ? (
                        <Check className="size-3.5" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                      <span>{isAr ? "حرف كبير وصغير" : "Upper & lower case"}</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${passwordRules.number ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}
                    >
                      {passwordRules.number ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                      <span>{t("auth.ruleNumber")}</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${passwordRules.special ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}
                    >
                      {passwordRules.special ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                      <span>{isAr ? "رمز خاص (!@#$)" : "Special character (!@#$)"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="signup-confirm-password"
                className="block text-xs font-semibold text-foreground mb-1.5"
              >
                {t("auth.confirmPassword")} <span className="text-destructive">*</span>
              </label>
              <div className="relative" dir="ltr">
                <input
                  id="signup-confirm-password"
                  data-testid="signup-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                  className={`w-full h-11 ps-3.5 pe-11 text-start rounded-xl border bg-background/60 focus:bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:border-primary transition-all ${
                    confirmPassword && !passwordsMatch
                      ? "border-destructive focus:ring-destructive/30"
                      : "border-border/70 focus:ring-primary/40"
                  }`}
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 end-0 pe-3 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {confirmPassword && (
                <div
                  className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                    passwordsMatch
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-destructive"
                  }`}
                >
                  {passwordsMatch ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  <span>
                    {passwordsMatch ? t("auth.ruleMatch") : t("auth.errPasswordMismatch")}
                  </span>
                </div>
              )}
            </div>

            {/* Terms of Service Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  data-testid="signup-terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-border/80 text-primary focus:ring-primary/30 accent-primary"
                  disabled={isPending}
                />
                <span className="text-muted-foreground leading-normal">
                  {t("auth.acceptTermsPrefix")}{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-primary hover:underline font-semibold"
                  >
                    {t("auth.termsOfService")}
                  </Link>{" "}
                  {t("auth.and")}{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-primary hover:underline font-semibold"
                  >
                    {t("auth.privacyPolicy")}
                  </Link>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                data-testid="signup-submit"
                disabled={isPending || isGooglePending}
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>{t("auth.creatingAccount")}</span>
                  </>
                ) : (
                  <span>{t("auth.createAccount")}</span>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/70" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="relative px-3 bg-card text-xs text-muted-foreground font-sans font-medium">
                  {t("auth.orContinueWith")}
                </span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <div>
              <button
                type="button"
                data-testid="signup-google"
                onClick={handleGoogleSignIn}
                disabled={isPending || isGooglePending}
                className="w-full h-11 rounded-xl border border-border/80 bg-background/80 hover:bg-muted/60 text-foreground font-medium text-sm transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-xs"
              >
                {isGooglePending ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <GoogleIcon className="size-4" />
                )}
                <span>{t("auth.continueWithGoogle")}</span>
              </button>
            </div>
          </form>

          {/* Footer - Switch to Login */}
          <div className="mt-6 pt-4 border-t border-border/50 text-center text-xs text-muted-foreground">
            <span>{t("auth.alreadyHaveAccount")} </span>
            <Link
              href="/login"
              data-testid="signup-login-link"
              className="text-primary hover:underline font-semibold"
            >
              {t("auth.signIn")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
