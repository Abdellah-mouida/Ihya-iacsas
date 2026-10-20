"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { toast } from "@/lib/toast";
import { validatePasswordStrength } from "@/lib/password";
import { changePassword } from "@/app/actions/auth";

export function ChangePasswordView() {
  const { t, locale, dir } = useLocale();
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const isAr = locale === "ar";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordRules = validatePasswordStrength(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === confirmNewPassword;
  const isMustChange = Boolean(session?.user?.mustChangePassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPassword) {
      toast.error(
        isAr
          ? "يرجى إدخال كلمة المرور الحالية أو المؤقتة"
          : "Please enter your current or temporary password",
      );
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

    if (currentPassword === newPassword) {
      toast.error(t("auth.errNewPasswordSame"));
      setErrorMessage(t("auth.errNewPasswordSame"));
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("currentPassword", currentPassword);
      formData.set("newPassword", newPassword);
      formData.set("confirmNewPassword", confirmNewPassword);

      const res = await changePassword(formData, locale);
      if (!res.success) {
        setErrorMessage(res.error || t("auth.errCurrentPasswordWrong"));
        toast.error(res.error || t("auth.errCurrentPasswordWrong"));
        return;
      }

      // Update active session with new sessionVersion and cleared mustChangePassword flag
      await update({
        sessionVersion: res.sessionVersion,
        mustChangePassword: false,
      });

      toast.success(t("auth.changePasswordSuccess"));

      // Route onwards to onboarding if incomplete, else account
      if (!session?.user?.onboardingComplete) {
        router.push("/onboarding");
      } else {
        router.push("/profile");
      }
      router.refresh();
    });
  };

  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  if (status === "unauthenticated") {
    return (
      <div
        className="w-full max-w-md mx-auto my-12 p-8 rounded-3xl border border-brass/20 bg-card/60 backdrop-blur-2xl shadow-xl text-center space-y-6"
        dir={dir}
      >
        <div className="size-12 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="font-heading text-xl font-bold text-foreground">
          {isAr ? "يجب تسجيل الدخول أولاً" : "Sign In Required"}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isAr
            ? "لتغيير كلمة المرور، يرجى تسجيل الدخول إلى حسابك أولاً."
            : "To set a new password, please sign in to your account first."}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-heading font-semibold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
        >
          <span>{t("auth.signIn")}</span>
          <ArrowIcon className="size-4" />
        </Link>
      </div>
    );
  }

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
              <span>{isAr ? "أمان الحساب" : "Account Security"}</span>
            </div>
            <h2 className="font-heading text-2xl xl:text-3xl font-bold text-white leading-tight">
              {isAr ? "برنامج إحياء" : "Ihyaa Program"}
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              {isAr
                ? "تعيين كلمة مرور قوية ودائمة يضمن أمان حسابك وحماية بياناتك وحجوزاتك."
                : "Setting a strong permanent password protects your account and personal bookings."}
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
          <div className="max-w-md w-full mx-auto space-y-6">
            {/* Header */}
            <div className="space-y-3 text-start">
              <div className="size-12 rounded-2xl border border-brass/25 bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <KeyRound className="size-6 text-primary" />
              </div>
              <h1
                className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
                data-testid="change-password-title"
              >
                {t("auth.changePasswordTitle")}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("auth.changePasswordSubtitle")}
              </p>
            </div>

            {/* Must Change Password Notice Banner */}
            {isMustChange && (
              <div
                className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-3"
                role="alert"
                data-testid="must-change-password-alert"
              >
                <ShieldAlert className="size-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <p className="font-medium leading-relaxed">
                  {t("auth.mustChangePasswordNotice")}
                </p>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3"
                role="alert"
                data-testid="change-password-error-banner"
              >
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {/* Change Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-start">
              {/* Current or Temp Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="current-password"
                  className="block text-xs font-semibold text-foreground/90 uppercase tracking-wider"
                >
                  {t("auth.currentPasswordLabel")}
                </label>
                <div className="relative" dir="ltr">
                  <input
                    id="current-password"
                    name="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-11 ps-3.5 pe-11 text-start rounded-xl border border-brass/20 bg-background/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
                    data-testid="current-password-input"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 end-0 pe-3 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={
                      showCurrentPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="new-password"
                  className="block text-xs font-semibold text-foreground/90 uppercase tracking-wider"
                >
                  {t("auth.newPasswordLabel")}
                </label>
                <div className="relative" dir="ltr">
                  <input
                    id="new-password"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholder")}
                    className="w-full h-11 ps-3.5 pe-11 text-start rounded-xl border border-brass/20 bg-background/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
                    data-testid="new-password-input"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 end-0 pe-3 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={
                      showNewPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showNewPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>

                {/* Password Strength checklist */}
                {newPassword.length > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-muted/40 border border-border/40 space-y-1.5 text-xs">
                    <div className="font-semibold text-muted-foreground mb-1">
                      {t("auth.passwordStrength")}:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div
                        className={`flex items-center gap-1.5 ${passwordRules.length ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}
                      >
                        {passwordRules.length ? (
                          <Check className="size-3.5" />
                        ) : (
                          <X className="size-3.5" />
                        )}
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
                        <span>
                          {isAr ? "حرف كبير وصغير" : "Upper & lower case"}
                        </span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${passwordRules.number ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}
                      >
                        {passwordRules.number ? (
                          <Check className="size-3.5" />
                        ) : (
                          <X className="size-3.5" />
                        )}
                        <span>{t("auth.ruleNumber")}</span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${passwordRules.special ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}
                      >
                        {passwordRules.special ? (
                          <Check className="size-3.5" />
                        ) : (
                          <X className="size-3.5" />
                        )}
                        <span>
                          {isAr ? "رمز خاص (!@#$)" : "Special character (!@#$)"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-new-password"
                  className="block text-xs font-semibold text-foreground/90 uppercase tracking-wider"
                >
                  {t("auth.confirmNewPasswordLabel")}
                </label>
                <div className="relative" dir="ltr">
                  <input
                    id="confirm-new-password"
                    name="confirmNewPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder={t("auth.confirmPasswordPlaceholder")}
                    className={`w-full h-11 ps-3.5 pe-11 text-start rounded-xl border bg-background/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:border-primary transition-all text-sm ${
                      confirmNewPassword && !passwordsMatch
                        ? "border-destructive focus:ring-destructive/30"
                        : "border-brass/20 focus:ring-primary/40"
                    }`}
                    data-testid="confirm-new-password-input"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute inset-y-0 end-0 pe-3 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {confirmNewPassword.length > 0 && (
                  <div
                    className={`text-xs flex items-center gap-1 pt-1 ${passwordsMatch ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                  >
                    {passwordsMatch ? (
                      <>
                        <Check className="size-3.5" />
                        <span>{t("auth.ruleMatch")}</span>
                      </>
                    ) : (
                      <>
                        <X className="size-3.5" />
                        <span>{t("auth.errPasswordMismatch")}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending || !passwordRules.valid || !passwordsMatch}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-primary text-primary-foreground font-heading font-semibold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
                data-testid="change-password-submit-btn"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>{t("auth.changePasswordSubmitting")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("auth.changePasswordSubmit")}</span>
                    <ArrowIcon className="size-4 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}