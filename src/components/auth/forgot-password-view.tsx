"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  KeyRound,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  MailCheck,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { toast } from "@/lib/toast";
import { requestPasswordReset } from "@/app/actions/auth";

export function ForgotPasswordView() {
  const { t, locale, dir } = useLocale();
  const isAr = locale === "ar";

  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error(t("auth.errEmailRequired"));
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", cleanEmail);

      const res = await requestPasswordReset(formData, locale);
      if (!res.success) {
        setErrorMessage(res.error || t("auth.forgotRateLimited"));
        toast.error(res.error || t("auth.forgotRateLimited"));
        return;
      }

      setSubmittedEmail(cleanEmail);
      setIsSubmitted(true);
      toast.success(t("auth.forgotSuccessTitle"));
    });
  };

  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const BackArrowIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <div
      className="relative min-h-[calc(100vh-5rem)] flex items-stretch justify-center p-4 sm:p-6 lg:p-8"
      dir={dir}
    >
      <div className="w-full max-w-5xl my-auto grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-brass/20 bg-card/60 backdrop-blur-2xl shadow-2xl">
        {/* Left/Right Branding Banner (Desktop) */}
        <div className="relative hidden lg:flex lg:col-span-5 flex-col justify-between p-10 overflow-hidden bg-primary/95 text-white border-e border-brass/20">
          <Image
            src="/images/gathering.jpg"
            alt="Ihyaa Program"
            fill
            className="object-cover opacity-20 mix-blend-overlay"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary to-primary-dark/95" />

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-semibold text-brass-light backdrop-blur-md">
              <Sparkles className="size-3.5" />
              <span>{isAr ? "استعادة الوصول إلى الحساب" : "Account Recovery"}</span>
            </div>
            <h2 className="font-heading text-2xl xl:text-3xl font-bold text-white leading-tight">
              {isAr ? "برنامج إحياء" : "Ihyaa Program"}
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              {isAr
                ? "أدخل بريدك الإلكتروني لتلقي كلمة مرور مؤقتة وتعيين كلمة مرور جديدة لحسابك."
                : "Enter your email to receive a temporary password and restore access to your account."}
            </p>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-xs text-white/70">
            <span>{isAr ? "برنامج إحياء © 2026" : "Ihyaa Program © 2026"}</span>
            <div className="size-6 rounded-full border border-white/30 flex items-center justify-center text-brass-light font-heading font-bold text-xs">
              ۞
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-8">
            {/* Header */}
            <div className="space-y-3 text-start">
              <div className="size-12 rounded-2xl border border-brass/25 bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <KeyRound className="size-6 text-primary" />
              </div>
              <h1
                className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
                data-testid="forgot-title"
              >
                {t("auth.forgotTitle")}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("auth.forgotSubtitle")}
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3"
                role="alert"
                data-testid="forgot-error-banner"
              >
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {isSubmitted ? (
              /* Success State */
              <div
                className="space-y-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-6 text-start"
                data-testid="forgot-success-card"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <MailCheck className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-foreground">
                      {t("auth.forgotSuccessTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {submittedEmail}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("auth.forgotSuccessDesc")}
                </p>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Link
                    href={`/login?email=${encodeURIComponent(submittedEmail)}`}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-heading font-semibold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                    data-testid="goto-login-btn"
                  >
                    <span>{t("auth.signIn")}</span>
                    <ArrowIcon className="size-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitted(false);
                      setErrorMessage(null);
                    }}
                    className="inline-flex items-center justify-center px-4 py-3 rounded-xl border border-brass/20 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/40 transition-colors"
                  >
                    {isAr ? "إعادة المحاولة ببريد آخر" : "Try another email"}
                  </button>
                </div>
              </div>
            ) : (
              /* Request Form */
              <form onSubmit={handleSubmit} className="space-y-5 text-start">
                <div className="space-y-2">
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-semibold text-foreground/90 uppercase tracking-wider"
                  >
                    {t("auth.forgotEmailLabel")}
                  </label>
                  <input
                    id="forgot-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    dir="ltr"
                    className="w-full px-4 py-3 rounded-xl border border-brass/20 bg-background/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
                    data-testid="forgot-email-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary text-primary-foreground font-heading font-semibold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
                  data-testid="forgot-submit-btn"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>{t("auth.forgotSending")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("auth.forgotSubmit")}</span>
                      <ArrowIcon className="size-4 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Back to Login link */}
            <div className="pt-4 border-t border-brass/10 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                data-testid="back-to-login-link"
              >
                <BackArrowIcon className="size-4" />
                <span>{t("auth.backToLogin")}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}