"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  CreditCard,
  Home,
  Minus,
  Plus,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { createBooking } from "@/app/actions/bookings";
import { OrnamentDivider } from "@/components/common/ornament-divider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/i18n/locale-provider";
import { EVENT } from "@/lib/content";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Details = { name: string; email: string; phone: string; quantity: number };
type Payment = { cardName: string; cardNumber: string; expiry: string; cvc: string };

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function makeRef() {
  return `IHYAA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function BookingStepper() {
  const { t, dir } = useLocale();
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<Details>({
    name: "",
    email: "",
    phone: "",
    quantity: 1,
  });
  const [payment, setPayment] = useState<Payment>({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmationRef, setConfirmationRef] = useState("");

  const steps = [t("booking.stepDetails"), t("booking.stepPayment"), t("booking.stepConfirm")];

  function validateDetails() {
    const e: Record<string, string> = {};
    if (!details.name.trim()) e.name = t("booking.errRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email))
      e.email = t("booking.errEmail");
    if (details.phone.replace(/\D/g, "").length < 6)
      e.phone = t("booking.errRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validatePayment() {
    const e: Record<string, string> = {};
    if (!payment.cardName.trim()) e.cardName = t("booking.errRequired");
    if (payment.cardNumber.replace(/\s/g, "").length !== 16)
      e.cardNumber = t("booking.errCard");
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(payment.expiry))
      e.expiry = t("booking.errExpiry");
    if (!/^\d{3,4}$/.test(payment.cvc)) e.cvc = t("booking.errCvc");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submitDetails(ev: FormEvent) {
    ev.preventDefault();
    if (validateDetails()) {
      setErrors({});
      setStep(2);
    }
  }

  async function submitPayment(ev: FormEvent) {
    ev.preventDefault();
    if (validatePayment()) {
      setErrors({});
      // Create real database booking
      const res = await createBooking({
        eventId: "majlis-ihyaa-2026",
        fullName: details.name,
        email: details.email,
        phone: details.phone,
        quantity: details.quantity,
      });

      if (res.success && res.confirmationNumber) {
        setConfirmationRef(res.confirmationNumber);
      } else {
        setConfirmationRef(makeRef());
      }
      setStep(3);
    }
  }

  function downloadIcs() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ihyaa//Booking//EN",
      "BEGIN:VEVENT",
      `UID:${confirmationRef}@ihyaa`,
      "DTSTART:20260603T213000",
      "DTEND:20260603T230000",
      `SUMMARY:${t("event.name")}`,
      `LOCATION:${t("event.location")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ihyaa-majlis.ics";
    a.click();
    URL.revokeObjectURL(url);
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

      {/* Demo banner */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm font-medium text-brass">
        <ShieldAlert className="size-5 shrink-0" />
        {t("booking.demoBanner")}
      </div>

      {/* Stepper indicator */}
      <div className="mt-8 flex items-center">
        {steps.map((label, i) => {
          const n = i + 1;
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
                    active ? "text-foreground" : "text-muted-foreground",
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="b-name">{t("booking.fName")}</Label>
                <Input
                  id="b-name"
                  value={details.name}
                  aria-invalid={!!errors.name}
                  placeholder={t("booking.namePh")}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, name: e.target.value }))
                  }
                  className="h-11"
                />
                {errors.name ? (
                  <span className="text-xs text-destructive">{errors.name}</span>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="b-email">{t("booking.fEmail")}</Label>
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
                />
                {errors.email ? (
                  <span className="text-xs text-destructive">{errors.email}</span>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="b-phone">{t("booking.fPhone")}</Label>
                <Input
                  id="b-phone"
                  type="tel"
                  dir="ltr"
                  value={details.phone}
                  aria-invalid={!!errors.phone}
                  placeholder={t("booking.phonePh")}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, phone: e.target.value }))
                  }
                  className="h-11"
                />
                {errors.phone ? (
                  <span className="text-xs text-destructive">{errors.phone}</span>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{t("booking.fQuantity")}</Label>
                <div className="flex w-max items-center gap-4 rounded-full border border-border bg-background p-1">
                  <button
                    type="button"
                    aria-label="-"
                    onClick={() =>
                      setDetails((d) => ({
                        ...d,
                        quantity: Math.max(1, d.quantity - 1),
                      }))
                    }
                    className="grid size-9 place-items-center rounded-full transition hover:bg-muted"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="min-w-6 text-center font-heading text-lg font-semibold">
                    {details.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() =>
                      setDetails((d) => ({
                        ...d,
                        quantity: Math.min(8, d.quantity + 1),
                      }))
                    }
                    className="grid size-9 place-items-center rounded-full transition hover:bg-muted"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="bg-brass-gradient mt-2 h-12 rounded-full text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95"
              >
                {t("booking.continue")}
                <ArrowRight className="size-5 rtl:rotate-180" />
              </Button>
            </motion.form>
          ) : null}

          {/* STEP 2 — PAYMENT */}
          {step === 2 ? (
            <motion.form
              key="payment"
              onSubmit={submitPayment}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex flex-col gap-5"
              noValidate
            >
              <header className="flex flex-col gap-1">
                <h2 className="font-heading text-2xl font-semibold">
                  {t("booking.paymentTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("booking.paymentDesc")}
                </p>
              </header>

              {/* summary */}
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {t("booking.ticketsLabel")}
                </span>
                <span className="font-semibold">{details.quantity}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {t("booking.totalLabel")}
                </span>
                <span className="font-semibold text-brass">
                  {t("booking.free")}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="p-name">{t("booking.cardName")}</Label>
                <Input
                  id="p-name"
                  value={payment.cardName}
                  aria-invalid={!!errors.cardName}
                  placeholder={t("booking.cardNamePh")}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, cardName: e.target.value }))
                  }
                  className="h-11"
                />
                {errors.cardName ? (
                  <span className="text-xs text-destructive">
                    {errors.cardName}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="p-number">{t("booking.cardNumber")}</Label>
                <Input
                  id="p-number"
                  inputMode="numeric"
                  dir="ltr"
                  value={payment.cardNumber}
                  aria-invalid={!!errors.cardNumber}
                  placeholder={t("booking.cardNumberPh")}
                  onChange={(e) =>
                    setPayment((p) => ({
                      ...p,
                      cardNumber: formatCardNumber(e.target.value),
                    }))
                  }
                  className="h-11"
                />
                {errors.cardNumber ? (
                  <span className="text-xs text-destructive">
                    {errors.cardNumber}
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="p-exp">{t("booking.expiry")}</Label>
                  <Input
                    id="p-exp"
                    inputMode="numeric"
                    dir="ltr"
                    value={payment.expiry}
                    aria-invalid={!!errors.expiry}
                    placeholder={t("booking.expiryPh")}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        expiry: formatExpiry(e.target.value),
                      }))
                    }
                    className="h-11"
                  />
                  {errors.expiry ? (
                    <span className="text-xs text-destructive">
                      {errors.expiry}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="p-cvc">{t("booking.cvc")}</Label>
                  <Input
                    id="p-cvc"
                    inputMode="numeric"
                    dir="ltr"
                    value={payment.cvc}
                    aria-invalid={!!errors.cvc}
                    placeholder={t("booking.cvcPh")}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        cvc: e.target.value.replace(/\D/g, "").slice(0, 4),
                      }))
                    }
                    className="h-11"
                  />
                  {errors.cvc ? (
                    <span className="text-xs text-destructive">{errors.cvc}</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="glass h-12 rounded-full px-6 text-base font-semibold sm:flex-1"
                >
                  <ArrowLeft className="size-5 rtl:rotate-180" />
                  {t("booking.payBack")}
                </Button>
                <Button
                  type="submit"
                  className="bg-brass-gradient h-12 rounded-full px-6 text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95 sm:flex-[2]"
                >
                  <CreditCard className="size-5" />
                  {t("booking.pay")}
                </Button>
              </div>
            </motion.form>
          ) : null}

          {/* STEP 3 — CONFIRMATION */}
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
                transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 12 }}
                className="bg-brass-gradient grid size-20 place-items-center rounded-full text-night shadow-layered"
              >
                <Check className="size-10" />
              </motion.span>

              <h2 className="font-heading text-2xl font-semibold sm:text-3xl">
                {t("booking.confirmTitle")}
              </h2>
              <p className="text-muted-foreground">{t("booking.confirmDesc")}</p>

              <OrnamentDivider compact />

              <div className="w-full rounded-2xl bg-muted/60 p-5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("booking.ref")}
                </span>
                <p className="font-heading text-2xl font-bold tracking-widest text-brass">
                  {confirmationRef}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("booking.emailedTo", { email: details.email })}
                </p>
              </div>

              <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={downloadIcs}
                  className="bg-brass-gradient h-12 rounded-full text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95 sm:flex-1"
                >
                  <CalendarPlus className="size-5" />
                  {t("booking.addCalendar")}
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
