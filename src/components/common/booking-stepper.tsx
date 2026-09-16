"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Home,
  KeyRound,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  requestBookingOtp,
  resendBookingOtp,
  verifyBookingOtp,
} from "@/app/actions/bookings";
import { ALLOWED_EMAIL_DOMAINS } from "@/lib/constants";
import { OrnamentDivider } from "@/components/common/ornament-divider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/i18n/locale-provider";
import { EVENT } from "@/lib/content";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Details = {
  fullName: string;
  email: string;
  city: string;
  age: string;
  motive: string;
};

export function BookingStepper() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("eventId") || undefined;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [details, setDetails] = useState<Details>({
    fullName: "",
    email: "",
    city: "",
    age: "",
    motive: "",
  });

  const [bookingId, setBookingId] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [bookingRef, setBookingRef] = useState<string>("");
  const [targetEventId, setTargetEventId] = useState<string>(eventIdParam || "majlis-ihyaa");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [redirectCountdown, setRedirectCountdown] = useState<number>(5);

  const steps = [
    t("booking.stepDetails"),
    t("booking.stepVerify"),
    t("booking.stepConfirm"),
  ];

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto-redirect timer on Step 3
  useEffect(() => {
    if (step !== 3) return;

    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push("/events");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, router]);

  function validateDetails(): boolean {
    const e: Record<string, string> = {};

    if (!details.fullName.trim()) {
      e.fullName = t("booking.errRequired");
    }

    const email = details.email.trim().toLowerCase();
    if (!email) {
      e.email = t("booking.errRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = t("booking.errEmail");
    } else {
      const parts = email.split("@");
      const domain = parts[1];
      if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
        e.email = t("booking.errDomain");
      }
    }

    if (!details.city.trim()) {
      e.city = t("booking.errRequired");
    }

    const ageNum = parseInt(details.age, 10);
    if (!details.age || isNaN(ageNum) || ageNum < 5 || ageNum > 120) {
      e.age = t("booking.errAge");
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submitDetails(ev: FormEvent) {
    ev.preventDefault();
    if (!validateDetails()) return;

    setErrors({});
    setSubmitting(true);

    const res = await requestBookingOtp({
      eventId: eventIdParam,
      fullName: details.fullName,
      email: details.email,
      city: details.city,
      age: parseInt(details.age, 10),
      motive: details.motive,
      locale,
    });

    setSubmitting(false);

    if (res.success && res.bookingId) {
      setBookingId(res.bookingId);
      if (res.eventId) setTargetEventId(res.eventId);
      setResendTimer(60);
      setStep(2);
    } else {
      setErrors({ form: res.error || "Failed to process registration" });
    }
  }

  async function submitOtp(ev: FormEvent) {
    ev.preventDefault();
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      setErrors({ otp: t("booking.errOtpRequired") });
      return;
    }

    setErrors({});
    setSubmitting(true);

    const res = await verifyBookingOtp({
      bookingId,
      otp: cleanOtp,
      locale,
    });

    setSubmitting(false);

    if (res.success && res.bookingRef) {
      setBookingRef(res.bookingRef);
      if (res.eventId) setTargetEventId(res.eventId);

      // Store in localStorage for client recognition
      try {
        localStorage.setItem(`ihyaa_booked_${res.eventId || targetEventId}`, "true");
        localStorage.setItem("ihyaa_booked_latest", "true");
        localStorage.setItem("ihyaa_booked_ref", res.bookingRef);
      } catch (e) {
        console.warn("Storage error", e);
      }

      setStep(3);
    } else {
      setErrors({ otp: res.error || "Invalid verification code" });
    }
  }

  async function handleResend() {
    if (resendTimer > 0 || resending) return;

    setResending(true);
    setErrors({});

    const res = await resendBookingOtp({
      bookingId,
      locale,
    });

    setResending(false);

    if (res.success) {
      setResendTimer(60);
      setOtp("");
    } else {
      setErrors({ otp: res.error || "Failed to resend verification code" });
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Back link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-brass"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("booking.back")}
      </Link>

      {/* Stepper indicator */}
      <div className="mt-8 flex items-center">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "grid size-10 place-items-center rounded-full text-sm font-semibold ring-1 transition-all",
                    done && "bg-brass-gradient text-night ring-transparent",
                    active &&
                      "bg-brass-gradient text-night shadow-layered ring-transparent",
                    !active && !done && "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  {done ? <Check className="size-5" /> : n}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    active ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {n < steps.length ? (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                    step > n ? "bg-brass" : "bg-border",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="glass-strong mt-8 overflow-hidden rounded-3xl p-6 shadow-layered sm:p-8">
        <AnimatePresence mode="wait">
          {/* STEP 1 — DETAILS */}
          {step === 1 ? (
            <motion.form
              key="details"
              onSubmit={submitDetails}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex flex-col gap-5"
              noValidate
            >
              <header className="flex flex-col gap-1">
                <h2 className="font-heading text-2xl font-semibold">
                  {t("booking.detailsTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("booking.detailsDesc")}
                </p>
              </header>

              {errors.form ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.form}
                </div>
              ) : null}

              {/* Full Name */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="b-name">{t("booking.fName")} *</Label>
                <Input
                  id="b-name"
                  value={details.fullName}
                  aria-invalid={!!errors.fullName}
                  placeholder={t("booking.namePh")}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, fullName: e.target.value }))
                  }
                  className="h-11"
                  required
                />
                {errors.fullName ? (
                  <span className="text-xs text-destructive">{errors.fullName}</span>
                ) : null}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="b-email">{t("booking.fEmail")} *</Label>
                <Input
                  id="b-email"
                  type="email"
                  dir="ltr"
                  value={details.email}
                  aria-invalid={!!errors.email}
                  placeholder={t("booking.emailPh")}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, email: e.target.value }))
                  }
                  className="h-11"
                  required
                />
                {errors.email ? (
                  <span
                    data-testid="email-error"
                    className="text-xs text-destructive font-medium"
                  >
                    {errors.email}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {locale === "ar"
                      ? "المزودات المقبولة: Gmail, Yahoo, Outlook, Hotmail, iCloud, ProtonMail..."
                      : "Accepted: Gmail, Yahoo, Outlook, Hotmail, iCloud, ProtonMail..."}
                  </span>
                )}
              </div>

              {/* City and Age */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="b-city">{t("booking.fCity")} *</Label>
                  <Input
                    id="b-city"
                    value={details.city}
                    aria-invalid={!!errors.city}
                    placeholder={t("booking.cityPh")}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, city: e.target.value }))
                    }
                    className="h-11"
                    required
                  />
                  {errors.city ? (
                    <span className="text-xs text-destructive">{errors.city}</span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="b-age">{t("booking.fAge")} *</Label>
                  <Input
                    id="b-age"
                    type="number"
                    min="5"
                    max="120"
                    value={details.age}
                    aria-invalid={!!errors.age}
                    placeholder={t("booking.agePh")}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, age: e.target.value }))
                    }
                    className="h-11"
                    required
                  />
                  {errors.age ? (
                    <span className="text-xs text-destructive">{errors.age}</span>
                  ) : null}
                </div>
              </div>

              {/* Motive */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="b-motive">{t("booking.fMotive")}</Label>
                <Textarea
                  id="b-motive"
                  value={details.motive}
                  placeholder={t("booking.motivePh")}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, motive: e.target.value }))
                  }
                  className="min-h-24 resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="bg-brass-gradient mt-2 h-12 rounded-full text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95"
              >
                {submitting
                  ? locale === "ar"
                    ? "جاري إرسال الرمز..."
                    : "Sending code..."
                  : t("booking.continue")}
                <ArrowRight className="size-5 rtl:rotate-180" />
              </Button>
            </motion.form>
          ) : null}

          {/* STEP 2 — OTP VERIFICATION */}
          {step === 2 ? (
            <motion.form
              key="otp-step"
              onSubmit={submitOtp}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex flex-col gap-5"
              noValidate
            >
              <header className="flex flex-col gap-1">
                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-brass/10 text-brass ring-1 ring-brass/25 mb-1">
                  <KeyRound className="size-6" />
                </div>
                <h2 className="font-heading text-2xl font-semibold">
                  {t("booking.verifyTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("booking.verifyDesc", { email: details.email })}
                </p>
              </header>

              <div className="flex flex-col gap-2">
                <Label htmlFor="b-otp">{t("booking.otpLabel")}</Label>
                <Input
                  id="b-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  dir="ltr"
                  value={otp}
                  aria-invalid={!!errors.otp}
                  placeholder={t("booking.otpPh")}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="h-14 text-center font-mono text-2xl tracking-[0.4em] font-bold"
                  autoFocus
                />
                {errors.otp ? (
                  <span
                    data-testid="otp-error"
                    className="text-xs text-destructive font-medium"
                  >
                    {errors.otp}
                  </span>
                ) : null}
              </div>

              {/* Resend button */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {locale === "ar"
                    ? "لم يصلك الرمز؟"
                    : "Didn't receive the code?"}
                </span>
                {resendTimer > 0 ? (
                  <span className="font-mono text-brass font-medium">
                    {t("booking.resendWait", { seconds: resendTimer })}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="inline-flex items-center gap-1 font-semibold text-brass hover:underline disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn("size-3.5", resending && "animate-spin")}
                    />
                    {t("booking.resendCode")}
                  </button>
                )}
              </div>

              <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep(1);
                    setErrors({});
                  }}
                  className="glass h-12 rounded-full px-6 text-base font-semibold sm:flex-1"
                >
                  <ArrowLeft className="size-5 rtl:rotate-180" />
                  {t("booking.verifyBack")}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-brass-gradient h-12 rounded-full px-6 text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95 sm:flex-[2]"
                >
                  <CheckCircle2 className="size-5" />
                  {submitting
                    ? locale === "ar"
                      ? "جاري التحقق..."
                      : "Verifying..."
                    : t("booking.verifyButton")}
                </Button>
              </div>
            </motion.form>
          ) : null}

          {/* STEP 3 — SUCCESS CONFIRMATION */}
          {step === 3 ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  delay: 0.1,
                  type: "spring",
                  stiffness: 200,
                  damping: 12,
                }}
                className="bg-brass-gradient grid size-20 place-items-center rounded-full text-night shadow-layered"
              >
                <Check className="size-10" />
              </motion.span>

              <h2 className="font-heading text-2xl font-bold sm:text-3xl">
                {t("booking.confirmTitle")}
              </h2>
              <p className="text-muted-foreground text-sm max-w-md">
                {t("booking.confirmDesc")}
              </p>

              <OrnamentDivider compact />

              <div className="w-full rounded-2xl bg-muted/60 p-5 text-start space-y-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("booking.ref")}:</span>
                  <span
                    data-testid="booking-ref-display"
                    className="font-mono font-bold text-brass text-sm"
                  >
                    {bookingRef}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("booking.fName")}:</span>
                  <span className="font-semibold text-foreground">
                    {details.fullName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("booking.fEmail")}:</span>
                  <span className="font-semibold text-foreground dir-ltr">
                    {details.email}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("booking.fCity")}:</span>
                  <span className="font-semibold text-foreground">
                    {details.city}
                  </span>
                </div>
              </div>

              {/* Redirect notice banner */}
              <div
                data-testid="redirect-notice"
                className="w-full rounded-xl border border-brass/30 bg-brass/10 py-3 px-4 text-xs font-medium text-brass flex items-center justify-center gap-2"
              >
                <RefreshCw className="size-3.5 animate-spin" />
                <span>
                  {t("booking.redirectNotice", { seconds: redirectCountdown })}
                </span>
              </div>

              <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="bg-brass-gradient h-12 rounded-full text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95 sm:flex-1"
                >
                  <Link href="/events">
                    <ArrowLeft className="size-5 rtl:rotate-180" />
                    {locale === "ar"
                      ? "الذهاب لصفحة الفعالية الآن"
                      : "Go to Event Page Now"}
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="glass h-12 rounded-full text-base font-semibold sm:flex-1"
                >
                  <Link href="/">
                    <Home className="size-5" />
                    {t("booking.home")}
                  </Link>
                </Button>
              </div>

              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-brass" />
                {EVENT.phone}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}