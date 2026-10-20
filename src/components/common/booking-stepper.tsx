"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  createAuthenticatedBooking,
  getBookingUserState,
} from "@/app/actions/bookings";
import { getEventById } from "@/app/actions/events";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { OrnamentDivider } from "@/components/common/ornament-divider";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/i18n/locale-provider";
import { isEventBooked, markEventBooked } from "@/lib/booking-state";
import { notify } from "@/lib/toast";
import { EVENT, IMAGES } from "@/lib/content";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

type UserSnapshot = {
  id: string;
  name: string;
  email: string;
  city: string;
  age: number;
  image?: string | null;
};

export function BookingStepper({ initialEventId }: { initialEventId?: string } = {}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("eventId") || undefined;

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [userAuthChecked, setUserAuthChecked] = useState(false);
  const [userSnapshot, setUserSnapshot] = useState<UserSnapshot | null>(null);

  const [motive, setMotive] = useState<string>("");
  const [targetEventId, setTargetEventId] = useState<string>(
    initialEventId || eventIdParam || "majlis-ihyaa-2026",
  );
  const [eventInfo, setEventInfo] = useState<{
    id?: string;
    titleAr?: string;
    titleEn?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    date?: Date | string;
    time?: string;
    location?: string;
    posterUrl?: string | null;
    capacityType?: string;
    capacity?: number | null;
    confirmedCount?: number;
    isFull?: boolean;
  } | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string>("CONFIRMED");
  const [waitlistOrder, setWaitlistOrder] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [eventLoading, setEventLoading] = useState<boolean>(() => Boolean(targetEventId));

  // Check authentication & onboarding status on mount
  useEffect(() => {
    let ignore = false;
    if (!targetEventId) return;

    getBookingUserState(targetEventId).then((res) => {
      if (ignore) return;
      if (!res.authenticated) {
        const dest = `/events/${targetEventId}/book`;
        router.push(`/login?callbackUrl=${encodeURIComponent(dest)}`);
        return;
      }
      if (res.needsOnboarding) {
        const dest = `/events/${targetEventId}/book`;
        router.push(`/onboarding?callbackUrl=${encodeURIComponent(dest)}`);
        return;
      }
      if (res.alreadyBooked) {
        router.replace(`/events#event-${targetEventId}`);
        return;
      }
      if (res.user) {
        setUserSnapshot(res.user);
      }
      setUserAuthChecked(true);
    });

    return () => {
      ignore = true;
    };
  }, [targetEventId, router]);

  // Load target event details
  useEffect(() => {
    let ignore = false;
    if (!targetEventId) return;

    getEventById(targetEventId)
      .then((res) => {
        if (ignore) return;
        if (res.success && res.event) {
          setEventInfo(res.event);
        }
      })
      .finally(() => {
        if (!ignore) setEventLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [targetEventId]);

  const [arrivedAlreadyBooked] = useState<boolean>(() => isEventBooked(targetEventId));

  useEffect(() => {
    if (arrivedAlreadyBooked && step !== 2) {
      const timer = setTimeout(() => {
        router.replace(`/events#event-${targetEventId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [arrivedAlreadyBooked, step, targetEventId, router]);

  if (arrivedAlreadyBooked && step !== 2) {
    return (
      <div
        data-testid="already-booked-gate"
        className="mx-auto w-full max-w-lg text-center py-12 px-6 rounded-3xl border border-brass/20 bg-card/60 backdrop-blur-sm shadow-layered"
      >
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-brass/10 text-brass">
          <CheckCircle2 className="size-8" />
        </div>
        <h2 className="font-amiri text-2xl font-bold text-foreground">
          {t("booking.alreadyRegisteredTitle")}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {t("booking.alreadyRegisteredDesc")}
        </p>
        <div className="mt-8 flex justify-center">
          <Button
            asChild
            data-testid="already-booked-back-btn"
            className="rounded-full bg-brass-gradient px-8 py-3 text-night font-bold shadow-layered hover:brightness-110"
          >
            <Link href={`/events#event-${targetEventId}`}>
              {t("booking.alreadyRegisteredBack")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!userAuthChecked || (eventLoading && !eventInfo)) {
    return (
      <div
        data-testid="booking-loading"
        className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center py-20 min-h-[420px]"
      >
        <div className="glass relative flex w-full max-w-md flex-col items-center justify-center rounded-3xl p-10 ring-1 ring-border/60 shadow-layered">
          <IslamicLoader size="lg" message={t("booking.loading")} />
        </div>
      </div>
    );
  }

  const steps = [
    t("booking.stepDetails"),
    t("booking.stepConfirm"),
  ];

  async function submitBooking(ev: FormEvent) {
    ev.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const res = await createAuthenticatedBooking({
        eventId: targetEventId,
        motive: motive.trim() || undefined,
        locale,
      });

      if (res.success) {
        if (res.eventId) {
          setTargetEventId(res.eventId);
        }
        if (res.status) {
          setBookingStatus(res.status);
        }
        if (res.waitlistOrder !== undefined) {
          setWaitlistOrder(res.waitlistOrder ?? null);
        }

        markEventBooked(res.eventId || targetEventId, res.bookingRef);
        setStep(2);
        notify.success(t("booking.bookingSuccessToast"));
      } else {
        const err = res.error || "Failed to complete booking";
        setErrors({ form: err });
        notify.error(err);
      }
    } catch {
      const fallbackErr =
        locale === "ar"
          ? "تعذر تأكيد الحجز. يرجى المحاولة لاحقاً."
          : "Failed to confirm booking. Please try again later.";
      setErrors({ form: fallbackErr });
      notify.error(fallbackErr);
    } finally {
      setSubmitting(false);
    }
  }

  const summaryTitle =
    (locale === "ar" ? eventInfo?.titleAr : eventInfo?.titleEn) ||
    eventInfo?.titleAr ||
    eventInfo?.titleEn ||
    "";

  const summaryDate = eventInfo?.date
    ? new Date(eventInfo.date).toLocaleDateString(
        locale === "ar" ? "ar-MA" : "en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric" },
      )
    : "";

  const summaryTime = eventInfo?.time || "";
  const summaryLocation = eventInfo?.location || "";
  const summaryPoster = eventInfo?.posterUrl || IMAGES.eventPoster;
  const isLimited = eventInfo?.capacityType === "LIMITED";
  const isFull = eventInfo?.isFull;

  return (
    <div data-testid="booking-stepper" className="mx-auto w-full max-w-5xl">
      {/* Back link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-brass"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("booking.back")}
      </Link>

      {/* Stepper indicator */}
      <div className="mt-8 flex items-center max-w-md mx-auto">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const active = step === n;
          const done = step > n;
          return (
            <div
              key={label}
              className="flex flex-1 items-center last:flex-none"
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "grid size-10 place-items-center rounded-full text-sm font-semibold ring-1 transition-all",
                    done && "bg-brass-gradient text-night ring-transparent",
                    active &&
                      "bg-brass-gradient text-night shadow-layered ring-transparent",
                    !active &&
                      !done &&
                      "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  {done ? <Check className="size-5" /> : n}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    active
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {n < steps.length ? (
                <div
                  className={cn(
                    "mx-4 h-0.5 flex-1 rounded-full transition-colors",
                    step > n ? "bg-brass" : "bg-border",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
        {/* Main form container */}
        <div className="w-full order-2 lg:order-1 lg:col-span-7">
          <div className="glass-strong overflow-hidden rounded-3xl p-4 min-[400px]:p-6 shadow-layered sm:p-8">
            <AnimatePresence mode="wait">
              {/* STEP 1 — ATTENDANCE CONFIRMATION & PROFILE SNAPSHOT */}
              {step === 1 ? (
                <motion.form
                  key="details"
                  onSubmit={submitBooking}
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
                      {t("booking.accountSnapshotDesc")}
                    </p>
                  </header>

                  {errors.form ? (
                    <div
                      data-testid="booking-error-banner"
                      role="alert"
                      className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                    >
                      {errors.form}
                    </div>
                  ) : null}

                  {/* Pre-filled Account Profile Snapshot Card */}
                  <div
                    data-testid="account-snapshot-card"
                    className="rounded-2xl border border-brass/25 bg-muted/40 p-4 sm:p-5 flex flex-col gap-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={userSnapshot?.image}
                          name={userSnapshot?.name}
                          email={userSnapshot?.email}
                          size="lg"
                          shape="circle"
                          className="size-12 shrink-0 border-brass/30 ring-1 ring-primary/20"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-foreground">
                              {userSnapshot?.name}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <ShieldCheck className="size-3" />
                              {locale === "ar" ? "موثق" : "Verified"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground dir-ltr block">
                            {userSnapshot?.email}
                          </span>
                        </div>
                      </div>

                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="text-xs text-brass hover:text-brass/80 gap-1.5 h-8 px-2.5 rounded-full"
                      >
                        <Link href="/settings?tab=profile" target="_blank">
                          <Pencil className="size-3" />
                          {t("booking.editAccountProfile")}
                        </Link>
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-card/60 p-2.5 border border-border/40">
                        <span className="text-muted-foreground block text-[11px] mb-0.5">
                          {t("booking.fCity")}
                        </span>
                        <span className="font-semibold text-foreground">
                          {userSnapshot?.city || "—"}
                        </span>
                      </div>
                      <div className="rounded-xl bg-card/60 p-2.5 border border-border/40">
                        <span className="text-muted-foreground block text-[11px] mb-0.5">
                          {t("booking.fAge")}
                        </span>
                        <span className="font-semibold text-foreground">
                          {userSnapshot?.age ? `${userSnapshot.age} ${locale === "ar" ? "سنة" : "years"}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Motive (Optional) */}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="b-motive">{t("booking.fMotive")}</Label>
                    <Textarea
                      id="b-motive"
                      value={motive}
                      placeholder={t("booking.motivePh")}
                      onChange={(e) => setMotive(e.target.value)}
                      className="min-h-24 resize-none"
                    />
                  </div>

                  {isLimited && (
                    <div
                      className={cn(
                        "rounded-xl p-3.5 text-xs font-medium border flex items-start gap-2.5",
                        isFull
                          ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      <Sparkles className="size-4 shrink-0 mt-0.5" />
                      <span>
                        {isFull
                          ? locale === "ar"
                            ? "المقاعد المتاحة لهذه الفعالية مكتملة حالياً. يمكنك إتمام التسجيل للانضمام إلى قائمة الانتظار، وسيتم إشعارك فور توفر مقعد."
                            : "This event is currently at full capacity. Register to join the waitlist, and you will be notified if a seat opens up."
                          : locale === "ar"
                            ? "هذه الفعالية ذات مقاعد محدودة وتخضع لموافقة الإدارة. بعد التأكيد، سيكون طلبك قيد المراجعة."
                            : "This event has limited capacity and requires admin approval. After confirmation, your booking will be reviewed."}
                      </span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    data-testid="submit-booking-btn"
                    disabled={submitting}
                    className="bg-brass-gradient mt-2 h-12 rounded-full text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95"
                  >
                    {submitting ? (
                      <span>{t("booking.bookingSubmitting")}</span>
                    ) : isLimited && isFull ? (
                      <>
                        <span>{t("booking.submitBookingWaitlist")}</span>
                        <ArrowRight className="size-5 rtl:rotate-180" />
                      </>
                    ) : isLimited ? (
                      <>
                        <span>{t("booking.submitBookingPending")}</span>
                        <ArrowRight className="size-5 rtl:rotate-180" />
                      </>
                    ) : (
                      <>
                        <span>{t("booking.submitBookingConfirmed")}</span>
                        <ArrowRight className="size-5 rtl:rotate-180" />
                      </>
                    )}
                  </Button>
                </motion.form>
              ) : null}

              {/* STEP 2 — SUCCESS CONFIRMATION */}
              {step === 2 ? (
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
                    className={cn(
                      "grid size-20 place-items-center rounded-full shadow-layered",
                      bookingStatus === "PENDING"
                        ? "bg-amber-500/20 text-amber-500 border border-amber-500/40"
                        : bookingStatus === "WAITLISTED"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                          : "bg-brass-gradient text-night",
                    )}
                  >
                    {bookingStatus === "PENDING" ? (
                      <Clock className="size-10 text-amber-500" />
                    ) : bookingStatus === "WAITLISTED" ? (
                      <Users className="size-10 text-purple-400" />
                    ) : (
                      <Check className="size-10" />
                    )}
                  </motion.span>

                  <h2
                    data-testid="booking-confirmation-title"
                    className="font-heading text-2xl font-bold sm:text-3xl"
                  >
                    {bookingStatus === "PENDING"
                      ? t("booking.statusPendingTitle")
                      : bookingStatus === "WAITLISTED"
                        ? t("booking.statusWaitlistTitle")
                        : t("booking.confirmTitle")}
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-md">
                    {bookingStatus === "PENDING"
                      ? t("booking.statusPendingDesc")
                      : bookingStatus === "WAITLISTED"
                        ? `${t("booking.statusWaitlistDesc")} (#${waitlistOrder || 1})`
                        : t("booking.confirmDesc")}
                  </p>

                  <OrnamentDivider compact />

                  <div className="w-full rounded-2xl bg-muted/60 p-5 text-start space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{locale === "ar" ? "حالة الحجز" : "Status"}:</span>
                      <span
                        data-testid="booking-status-badge"
                        className={cn(
                          "px-2.5 py-0.5 rounded-full font-bold text-xs",
                          bookingStatus === "CONFIRMED" &&
                            "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
                          bookingStatus === "PENDING" &&
                            "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30",
                          bookingStatus === "WAITLISTED" &&
                            "bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30",
                        )}
                      >
                        {bookingStatus === "CONFIRMED"
                          ? locale === "ar"
                            ? "مؤكد"
                            : "Confirmed"
                          : bookingStatus === "PENDING"
                            ? locale === "ar"
                              ? "قيد المراجعة والموافقة"
                              : "Pending Approval"
                            : locale === "ar"
                              ? `قائمة الانتظار (#${waitlistOrder || 1})`
                              : `Waitlist (#${waitlistOrder || 1})`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("booking.fName")}:</span>
                      <span className="font-semibold text-foreground">
                        {userSnapshot?.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("booking.fEmail")}:</span>
                      <span className="font-semibold text-foreground dir-ltr">
                        {userSnapshot?.email}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("booking.fCity")}:</span>
                      <span className="font-semibold text-foreground">
                        {userSnapshot?.city}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
                    <Button
                      asChild
                      data-testid="view-my-bookings-btn"
                      className="bg-brass-gradient h-12 rounded-full text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95 sm:flex-1"
                    >
                      <Link href="/profile#bookings">
                        {t("booking.viewMyBookings")}
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      data-testid="back-to-events-btn"
                      className="glass h-12 rounded-full text-base font-semibold sm:flex-1"
                    >
                      <Link href="/events">
                        {t("booking.backToEvents")}
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

        {/* Event summary card: on mobile above form (order-1), on desktop beside form (order-2, col-span-5) */}
        <div className="w-full order-1 lg:order-2 lg:col-span-5">
          <aside
            data-testid="event-summary-card"
            className="w-full rounded-3xl border border-brass/20 bg-card/60 p-5 sm:p-6 backdrop-blur-md shadow-layered space-y-5"
          >
            {/* Header / Title */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-brass">
                  {locale === "ar" ? "تفاصيل الفعالية" : "Event Overview"}
                </span>

                {/* Capacity badge */}
                {isLimited ? (
                  isFull ? (
                    <span
                      data-testid="summary-capacity-badge"
                      className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400 border border-purple-500/20"
                    >
                      <Users className="size-3" />
                      {locale === "ar" ? "قائمة الانتظار" : "Waitlist"}
                    </span>
                  ) : (
                    <span
                      data-testid="summary-capacity-badge"
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    >
                      <Users className="size-3" />
                      {locale === "ar"
                        ? `مقاعد محدودة (${eventInfo?.confirmedCount || 0}/${eventInfo?.capacity || 0})`
                        : `Limited (${eventInfo?.confirmedCount || 0}/${eventInfo?.capacity || 0})`}
                    </span>
                  )
                ) : (
                  <span
                    data-testid="summary-capacity-badge"
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  >
                    <Users className="size-3" />
                    {locale === "ar" ? "حجز مفتوح" : "Open"}
                  </span>
                )}
              </div>

              <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground leading-snug">
                {summaryTitle}
              </h2>
            </div>

            {/* Poster image 16:9 ratio */}
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-brass/15 bg-muted/40 shadow-inner">
              <Image
                src={summaryPoster}
                alt={summaryTitle}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 400px"
              />
            </div>

            {/* Meta info list */}
            <div className="space-y-3 pt-1 text-sm border-t border-border/60">
              {summaryDate && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brass/10 text-brass">
                    <Calendar className="size-4" />
                  </div>
                  <span>{summaryDate}</span>
                </div>
              )}

              {summaryTime && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brass/10 text-brass">
                    <Clock className="size-4" />
                  </div>
                  <span>{summaryTime}</span>
                </div>
              )}

              {summaryLocation && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brass/10 text-brass">
                    <MapPin className="size-4" />
                  </div>
                  <span>{summaryLocation}</span>
                </div>
              )}
            </div>

            {/* Questions & Inquiries */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <span>{locale === "ar" ? "للاستفسار والتواصل:" : "Questions & inquiries:"}</span>
              <a
                href={`tel:${EVENT.phone}`}
                className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-brass transition-colors dir-ltr"
              >
                <Phone className="size-3 text-brass" />
                <span>{EVENT.phone}</span>
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
