"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useEffect, useTransition } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  MailCheck,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { toast } from "@/lib/toast";
import { resendAccountVerificationOtp } from "@/app/actions/auth";
import { GoogleIcon } from "./signup-view";

function sanitizeCallbackUrl(url: string | null): string {
  if (!url) return "/account";
  // Disallow external URLs and protocol-relative URLs like //evil.com
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  return "/account";
}

export function LoginView() {
  const { t, locale, dir } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAr = locale === "ar";

  const rawCallbackUrl = searchParams.get("callbackUrl");
  const callbackUrl = sanitizeCallbackUrl(rawCallbackUrl);
  const initialEmail = searchParams.get("email") || "";
  const isVerifiedBanner = searchParams.get("verified") === "true";

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, setIsGooglePending] = useState(false);
  const [isResendPending, setIsResendPending] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) return;

    if (errorParam === "access_denied" || errorParam === "OAuthCallbackError_access_denied") {
      setErrorMessage(t("auth.oauthCancelled"));
      toast.error(t("auth.oauthCancelled"));
    } else {
      setErrorMessage(t("auth.oauthError"));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setUnverifiedEmail(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error(t("auth.errEmailRequired"));
      return;
    }
    if (!password) {
      toast.error(
        isAr ? "يرجى إدخال كلمة المرور" : "Please enter your password",
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await signIn("credentials", {
          email: cleanEmail,
          password,
          redirect: false,
        });

        if (!res) {
          setErrorMessage(t("auth.errInvalidCredentials"));
          toast.error(t("auth.errInvalidCredentials"));
          return;
        }

        if (res.error) {
          let code = res.code;
          if (!code && res.url) {
            try {
              const parsed = new URL(res.url);
              code = parsed.searchParams.get("code") || undefined;
            } catch {}
          }

          if (code === "unverified_email") {
            setUnverifiedEmail(cleanEmail);
            setErrorMessage(t("auth.errAccountUnverified"));
            return;
          }

          if (code === "rate_limited") {
            setErrorMessage(t("auth.loginRateLimited"));
            toast.error(t("auth.loginRateLimited"));
            return;
          }

          setErrorMessage(t("auth.errInvalidCredentials"));
          toast.error(t("auth.errInvalidCredentials"));
          return;
        }

        toast.success(t("auth.loginSuccess"));
        try {
          const sessionRes = await fetch("/api/auth/session");
          const sessionData = await sessionRes.json();
          if (sessionData?.user?.mustChangePassword) {
            router.push("/change-password");
            router.refresh();
            return;
          }
          if (!sessionData?.user?.onboardingComplete) {
            router.push(`/onboarding?callbackUrl=${encodeURIComponent(callbackUrl)}`);
            router.refresh();
            return;
          }
        } catch {}
        router.push(callbackUrl);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("unverified_email")) {
          setUnverifiedEmail(cleanEmail);
          setErrorMessage(t("auth.errAccountUnverified"));
        } else {
          setErrorMessage(t("auth.errInvalidCredentials"));
          toast.error(t("auth.errInvalidCredentials"));
        }
      }
    });
  };

  const handleVerifyUnverified = async () => {
    if (!unverifiedEmail) return;
    setIsResendPending(true);
    try {
      const res = await resendAccountVerificationOtp(unverifiedEmail, locale);
      if (res.success) {
        toast.success(t("auth.codeResent"));
        router.push(
          `/verify-email?email=${encodeURIComponent(unverifiedEmail)}`,
        );
      } else {
        toast.error(res.error || t("auth.errRateLimited"));
        router.push(
          `/verify-email?email=${encodeURIComponent(unverifiedEmail)}`,
        );
      }
    } catch {
      router.push(
        `/verify-email?email=${encodeURIComponent(unverifiedEmail)}`,
      );
    } finally {
      setIsResendPending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGooglePending(true);
    try {
      const targetCallback = callbackUrl === "/events" ? "/onboarding" : callbackUrl;
      await signIn("google", { callbackUrl: targetCallback });
    } catch {
      setIsGooglePending(false);
      toast.error(
        isAr ? "تعذر الاتصال بـ Google" : "Could not connect to Google",
      );
    }
  };

  return (
    <div
      dir={dir}
      data-testid="login-view"
      className="w-full max-w-5xl mx-auto rounded-3xl border border-brass/15 bg-card/60 backdrop-blur-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[560px]"
    >
      {/* Visual Side Banner (Desktop Only) */}
      <div className="hidden lg:col-span-5 lg:flex flex-col justify-between relative p-10 overflow-hidden bg-primary/95 text-white">
        <Image
          src="/images/gathering.jpg"
          alt="Ihyaa Program"
          fill
          priority
          className="object-cover opacity-20 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary to-primary-dark/95" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="size-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center p-1.5 shadow-inner">
            <Image
              src="/images/logo-circle.png"
              alt="Ihyaa Logo"
              width={36}
              height={36}
              className="size-full object-contain"
            />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-white tracking-wide">
              {isAr ? "برنامج إحياء" : "Ihyaa Program"}
            </h2>
            <p className="text-[11px] text-white/70">
              {isAr ? "تسجيل الدخول إلى حسابك" : "Sign in to your account"}
            </p>
          </div>
        </div>

        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-brass-light mb-4">
            <Sparkles className="size-3.5" />
            <span>{isAr ? "مرحباً بعودتك" : "Welcome Back"}</span>
          </div>
          <h3 className="font-heading text-2xl font-bold text-white leading-relaxed mb-3">
            {isAr
              ? "متابعة الفعاليات، إدارة الحجوزات، والتواصل مع أعضاء البرنامج"
              : "Track events, manage bookings, and stay connected with program members"}
          </h3>
          <p className="text-xs text-white/75 leading-relaxed">
            {isAr
              ? "منصة شبابية تجمع بين القيم الإيمانية، البناء الفكري، والأنشطة التربوية الهادفة."
              : "A youth platform uniting spiritual values, intellectual growth, and purposeful activities."}
          </p>
        </div>

        <div className="relative z-10 text-[11px] text-white/60 flex items-center justify-between border-t border-white/10 pt-4">
          <span>{isAr ? "برنامج إحياء © 2026" : "Ihyaa Program © 2026"}</span>
          <span>{isAr ? "المملكة المغربية" : "Kingdom of Morocco"}</span>
        </div>
      </div>

      {/* Form Area */}
      <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {isAr ? "حسابك الشخصي" : "Your Account"}
            </span>
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <span>{isAr ? "الرئيسية" : "Home"}</span>
              {isAr ? (
                <ArrowLeft className="size-3" />
              ) : (
                <ArrowRight className="size-3" />
              )}
            </Link>
          </div>
          <h1
            data-testid="login-title"
            className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-1.5"
          >
            {t("auth.loginTitle")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t("auth.loginSubtitle")}
          </p>
        </div>

        {/* Verified Account Notification Banner */}
        {isVerifiedBanner && !errorMessage && !unverifiedEmail && (
          <div
            data-testid="verified-success-banner"
            role="status"
            className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-3 animate-in fade-in"
          >
            <MailCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">
              {t("auth.emailVerifiedSuccess")}
            </span>
          </div>
        )}

        {/* Unverified Email Alert */}
        {unverifiedEmail && (
          <div
            data-testid="unverified-alert"
            role="alert"
            className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold">{t("auth.errAccountUnverified")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAr
                    ? "يرجى تأكيد بريدك الإلكتروني لتفعيل الحساب وتسجيل الدخول."
                    : "Please verify your email address to activate your account."}
                </p>
              </div>
            </div>
            <button
              type="button"
              data-testid="verify-now-btn"
              onClick={handleVerifyUnverified}
              disabled={isResendPending}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-600 text-white font-medium text-xs hover:bg-amber-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isResendPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <MailCheck className="size-3.5" />
              )}
              <span>{t("auth.verifyNow")}</span>
            </button>
          </div>
        )}

        {/* General Error Banner */}
        {errorMessage && !unverifiedEmail && (
          <div
            data-testid="login-error-banner"
            role="alert"
            className="mb-6 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 text-destructive text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          data-testid="google-signin-btn"
          onClick={handleGoogleSignIn}
          disabled={isGooglePending || isPending}
          className="w-full h-11 px-4 rounded-2xl border border-border/80 bg-background/80 hover:bg-muted/60 text-foreground text-xs sm:text-sm font-medium transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow hover:border-brass/40 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {isGooglePending ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <GoogleIcon className="size-4 shrink-0" />
          )}
          <span>{t("auth.continueWithGoogle")}</span>
        </button>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <span className="relative px-3 bg-card text-xs text-muted-foreground font-sans font-medium">
            {t("auth.orContinueWith")}
          </span>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              {t("auth.email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              data-testid="login-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className="w-full h-11 px-3.5 rounded-2xl border border-input bg-background/80 focus:bg-background text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 shadow-sm"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-foreground"
              >
                {t("auth.password")}
              </label>
              <Link
                href="/forgot-password"
                data-testid="forgot-password-link"
                className="text-[11px] text-primary hover:text-primary-dark hover:underline transition-colors font-medium"
              >
                {t("auth.forgotPassword")}
              </Link>
            </div>
            <div className="relative" dir="ltr">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                className="w-full h-11 ps-3.5 pe-11 text-start rounded-2xl border border-input bg-background/80 focus:bg-background text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 shadow-sm"
              />
              <button
                type="button"
                tabIndex={-1}
                data-testid="toggle-password-visibility"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 end-0 pe-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            data-testid="login-submit-btn"
            disabled={isPending || isGooglePending}
            className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary-dark transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed group mt-2"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{t("auth.signingIn")}</span>
              </>
            ) : (
              <>
                <span>{t("auth.signIn")}</span>
                {isAr ? (
                  <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
                ) : (
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </>
            )}
          </button>
        </form>

        {/* Footer: Signup Link */}
        <div className="mt-6 pt-5 border-t border-border/60 text-center text-xs text-muted-foreground">
          <span>{t("auth.dontHaveAccount")} </span>
          <Link
            href={
              callbackUrl !== "/account"
                ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`
                : "/signup"
            }
            data-testid="signup-link"
            className="font-semibold text-primary hover:text-primary-dark hover:underline transition-colors"
          >
            {t("auth.signUp")}
          </Link>
        </div>
      </div>
    </div>
  );
}
