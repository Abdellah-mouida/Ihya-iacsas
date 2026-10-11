"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Loader2, Mail, RefreshCw, Sparkles } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { toast } from "@/lib/toast";
import { SegmentedOtpInput } from "@/components/common/segmented-otp-input";
import { resendAccountVerificationOtp, verifyAccountEmail } from "@/app/actions/auth";

export function VerifyEmailView() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAr = locale === "ar";

  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = (submittedCode?: string) => {
    const codeToVerify = (submittedCode || code).trim();
    if (!email) {
      toast.error(t("auth.errEmailRequired"));
      return;
    }
    if (codeToVerify.length !== 6) {
      toast.error(t("auth.errInvalidOtp"));
      return;
    }

    startTransition(async () => {
      const res = await verifyAccountEmail(email, codeToVerify, locale);

      if (!res.success) {
        toast.error(res.error || t("auth.errInvalidOtp"));
        return;
      }

      toast.success(t("auth.emailVerifiedSuccess"));
      router.push(`/login?verified=true&email=${encodeURIComponent(email)}`);
    });
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    if (!email) {
      toast.error(t("auth.errEmailRequired"));
      return;
    }

    try {
      setIsResending(true);
      const res = await resendAccountVerificationOtp(email, locale);

      if (!res.success) {
        toast.error(res.error || t("auth.errRateLimited"));
        return;
      }

      toast.success(t("auth.codeResent"));
      setCountdown(60);
    } catch {
      toast.error(t("auth.errRateLimited"));
    } finally {
      setIsResending(false);
    }
  };

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-radial-[at_top_right] from-primary/10 via-background to-background pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#107527_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg p-6 sm:p-10 rounded-3xl border border-brass/15 bg-card/70 backdrop-blur-2xl shadow-2xl overflow-hidden text-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative size-16 rounded-full overflow-hidden border-2 border-brass/40 shadow-lg mb-4">
            <Image
              src="/images/logo-circle.png"
              alt="Ihyaa Program Logo"
              fill
              className="object-cover"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-semibold text-primary mb-2">
            <Sparkles className="size-3" />
            <span>{t("auth.verifyEmailTitle")}</span>
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {t("auth.verifyEmailTitle")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md font-sans">
            {t("auth.verifyEmailSubtitle")}
          </p>
        </div>

        {/* Email Badge & Edit */}
        {email ? (
          <div className="mb-6 p-3 rounded-2xl bg-muted/40 border border-border/50 inline-flex items-center gap-2 max-w-full">
            <Mail className="size-4 text-primary shrink-0" />
            <span
              dir="ltr"
              data-testid="verify-email-display"
              className="font-mono text-xs sm:text-sm font-semibold text-foreground truncate"
            >
              {email}
            </span>
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-foreground mb-1 text-start">
              {t("auth.email")}
            </label>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              className="w-full h-11 px-3.5 rounded-xl border border-border/70 bg-background/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>
        )}

        {/* 6-Digit OTP Box */}
        <div className="mb-6" data-testid="verify-otp-container">
          <SegmentedOtpInput
            value={code}
            onChange={setCode}
            onComplete={(val) => handleVerify(val)}
            disabled={isPending}
          />
        </div>

        {/* Submit Button */}
        <button
          type="button"
          data-testid="verify-submit"
          onClick={() => handleVerify()}
          disabled={isPending || code.length !== 6}
          className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>{t("auth.verifying")}</span>
            </>
          ) : (
            <span>{t("auth.verifyButton")}</span>
          )}
        </button>

        {/* Resend Code Section */}
        <div className="mt-6 pt-5 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <button
            type="button"
            data-testid="verify-resend"
            onClick={handleResend}
            disabled={countdown > 0 || isResending}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isResending ? "animate-spin" : ""}`} />
            {countdown > 0 ? (
              <span>
                {t("auth.resendIn")} ({countdown}s)
              </span>
            ) : (
              <span className="text-primary hover:underline">{t("auth.resendCode")}</span>
            )}
          </button>

          <Link
            href="/signup"
            data-testid="verify-back-signup"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <BackIcon className="size-3" />
            <span>{t("auth.backToSignup")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
