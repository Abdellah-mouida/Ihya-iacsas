"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { UserAccountData, AccountBookingItem } from "@/app/actions/account";
import { useLocale } from "@/i18n/locale-provider";
import { RoleBadge } from "@/components/common/role-badge";
import { StatusNotice } from "@/components/common/status-notice";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  MapPin,
  Mail,
  GraduationCap,
  Building,
  Heart,
  Wrench,
  Globe2,
  Users,
  Settings,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Clock3,
  XCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

interface ProfileViewProps {
  initialData: UserAccountData;
}

export function ProfileView({ initialData }: ProfileViewProps) {
  const { t, locale, dir } = useLocale();
  const isAr = locale === "ar";
  const { user, bookings } = initialData;

  const resolvedCover = user.coverImage || "/patterns/girih.svg";
  const confirmedBookingsCount = bookings.filter((b) => b.status === "CONFIRMED" || b.confirmed).length;

  return (
    <div className="space-y-8" data-testid="profile-view-container">
      {/* Profile Header & Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-border/80 bg-card/60 backdrop-blur-xl shadow-xl">
        {/* Cover Canvas */}
        <div className="relative h-48 sm:h-64 w-full overflow-hidden bg-muted/40">
          <Image
            src={resolvedCover}
            alt={user.name || "Cover"}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        {/* Profile Card & Avatar */}
        <div className="relative px-6 sm:px-10 pb-8 pt-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-start">
            {/* Centered Avatar */}
            <div className="relative size-28 sm:size-32 rounded-full border-4 border-background bg-card shadow-xl overflow-hidden ring-2 ring-primary/30 shrink-0">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name || "User Avatar"}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="size-full flex items-center justify-center bg-primary/10 text-primary font-heading font-bold text-3xl">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : "IH"}
                </div>
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
                  {user.name || (isAr ? "مستخدم إحياء" : "Ihyaa Member")}
                </h1>
                <RoleBadge role={user.role || "USER"} size="sm" />
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs sm:text-sm text-muted-foreground">
                {user.email && (
                  <span className="flex items-center gap-1 font-sans">
                    <Mail className="size-3.5 text-primary" />
                    <span>{user.email}</span>
                  </span>
                )}
                {user.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5 text-primary" />
                    <span>{user.city}</span>
                  </span>
                )}
                {user.age && (
                  <span>
                    {user.age} {isAr ? "سنة" : "years"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center sm:justify-end shrink-0">
            <Button
              asChild
              variant="outline"
              data-testid="profile-edit-settings-btn"
              className="rounded-xl gap-2 font-heading font-semibold h-11 px-5 border-border/80 hover:bg-primary/10 hover:text-primary"
            >
              <Link href="/settings">
                <Settings className="size-4" />
                <span>{isAr ? "تعديل الملف والإعدادات" : "Edit Profile & Settings"}</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Bio & Academic Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl space-y-4 shadow-sm">
            <h2 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="size-4 text-primary" />
              <span>{isAr ? "البيانات الأكاديمية" : "Academic Background"}</span>
            </h2>

            {user.bio && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed italic border-s-2 border-primary/40 ps-3">
                «{user.bio}»
              </p>
            )}

            <div className="space-y-3 pt-2 text-xs">
              {user.studyLevel ? (
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-0.5">
                    {isAr ? "المستوى الدراسي" : "Study Level"}
                  </span>
                  <span className="font-semibold text-foreground">{user.studyLevel}</span>
                </div>
              ) : null}

              {user.institution ? (
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-0.5">
                    {isAr ? "المؤسسة التعليمية" : "Institution"}
                  </span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Building className="size-3.5 text-primary shrink-0" />
                    <span>{user.institution}</span>
                  </span>
                </div>
              ) : null}

              {!user.bio && !user.studyLevel && !user.institution && (
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "لم يتم إضافة نبذة أو معلومات دراسية بعد."
                    : "No academic details or bio added yet."}
                </p>
              )}
            </div>
          </div>

          {/* Interests & Skills Tags */}
          <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl space-y-4 shadow-sm">
            <h2 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
              <Heart className="size-4 text-primary" />
              <span>{isAr ? "الاهتمامات والمهارات" : "Interests & Skills"}</span>
            </h2>

            {user.interests && user.interests.length > 0 ? (
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                  {isAr ? "الاهتمامات:" : "Interests:"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {user.interests.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {user.skills && user.skills.length > 0 ? (
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                  {isAr ? "المهارات:" : "Skills:"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {user.skills.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brass/10 text-brass border border-brass/20"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {user.languages && user.languages.length > 0 ? (
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                  {isAr ? "اللغات:" : "Languages:"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {user.languages.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-foreground border border-border/60"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {user.volunteerAreas && user.volunteerAreas.length > 0 ? (
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                  {isAr ? "مجالات التطوع:" : "Volunteer Areas:"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {user.volunteerAreas.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {(!user.interests || user.interests.length === 0) &&
              (!user.skills || user.skills.length === 0) && (
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "يمكنك إضافة اهتماماتك ومهاراتك في صفحة الإعدادات."
                    : "You can add your interests and skills in settings."}
                </p>
              )}
          </div>
        </div>

        {/* Right Columns (2 cols): Bookings & Activities */}
        <div className="md:col-span-2 space-y-6">
          <div
            id="bookings"
            data-testid="profile-bookings-section"
            className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-sm space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
                  <CalendarCheck className="size-5 text-primary" />
                  <span>{isAr ? "حجوزاتي ومشاركاتي" : "My Bookings & Events"}</span>
                </h2>
                <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                  {isAr
                    ? `إجمالي الحجوزات: ${bookings.length} (${confirmedBookingsCount} مؤكدة)`
                    : `Total bookings: ${bookings.length} (${confirmedBookingsCount} confirmed)`}
                </p>
              </div>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl font-heading text-xs"
              >
                <Link href="/events">
                  <span>{isAr ? "تصفح الفعاليات" : "Browse Events"}</span>
                  <ChevronRight className="size-3.5 ms-1 rtl:rotate-180" />
                </Link>
              </Button>
            </div>

            {/* Bookings List */}
            {bookings.length === 0 ? (
              <div className="p-8 sm:p-12 text-center rounded-2xl border border-border/50 bg-background/40 space-y-3">
                <div className="size-12 rounded-xl bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
                  <Calendar className="size-6" />
                </div>
                <h3 className="text-sm font-heading font-bold text-foreground">
                  {isAr ? "لا توجد حجوزات حتى الآن" : "No bookings yet"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isAr
                    ? "لم تقم بالتسجيل في أي لقاء أو فعالية بعد. استكشف فعاليات إحياء القادمة واحجز مكانك!"
                    : "You haven't registered for any events yet. Explore upcoming events and reserve your spot!"}
                </p>
                <Button asChild size="sm" className="rounded-xl mt-2 font-heading text-xs">
                  <Link href="/events">{isAr ? "استكشف الفعاليات" : "Explore Events"}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => {
                  const eventTitle = isAr ? booking.event.titleAr : booking.event.titleEn;
                  const isConfirmed = booking.status === "CONFIRMED" || booking.confirmed;
                  const isWaitlisted = booking.status === "WAITLISTED";
                  const isRejected = booking.status === "CANCELLED" || booking.status === "REJECTED";
                  const isPending = !isConfirmed && !isWaitlisted && !isRejected;

                  return (
                    <div
                      key={booking.id}
                      data-testid={`profile-booking-item-${booking.id}`}
                      className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-primary/40"
                    >
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {isConfirmed && (
                            <StatusNotice
                              variant="success"
                              size="sm"
                              icon={<CheckCircle2 className="size-3.5" />}
                              message={isAr ? "حجز مؤكد" : "Confirmed"}
                              testId={`booking-status-${booking.id}`}
                            />
                          )}
                          {isPending && (
                            <StatusNotice
                              variant="warning"
                              size="sm"
                              icon={<Clock3 className="size-3.5" />}
                              message={isAr ? "قيد المراجعة" : "Pending"}
                              testId={`booking-status-${booking.id}`}
                            />
                          )}
                          {isWaitlisted && (
                            <StatusNotice
                              variant="pending"
                              size="sm"
                              icon={<AlertCircle className="size-3.5" />}
                              message={
                                booking.waitlistOrder
                                  ? (isAr
                                      ? `قائمة الانتظار (رقم #${booking.waitlistOrder})`
                                      : `Waitlist (Position #${booking.waitlistOrder})`)
                                  : isAr
                                  ? "قائمة الانتظار"
                                  : "Waitlist"
                              }
                              testId={`booking-status-${booking.id}`}
                            />
                          )}
                          {isRejected && (
                            <StatusNotice
                              variant="error"
                              size="sm"
                              icon={<XCircle className="size-3.5" />}
                              message={isAr ? "ملغي / مرفوض" : "Cancelled / Rejected"}
                              testId={`booking-status-${booking.id}`}
                            />
                          )}
                        </div>

                        <h3 className="text-base font-heading font-bold text-foreground">
                          {eventTitle}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3 text-primary" />
                            <span>{booking.event.date}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3 text-primary" />
                            <span>{booking.event.time}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3 text-primary" />
                            <span>{booking.event.location}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs gap-1.5 h-9"
                        >
                          <Link href={`/events/${booking.event.slug}`}>
                            <ExternalLink className="size-3.5" />
                            <span>{isAr ? "صفحة الفعالية" : "View Event"}</span>
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
