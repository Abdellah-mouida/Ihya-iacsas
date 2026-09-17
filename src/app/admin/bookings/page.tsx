"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { deleteBooking, getBookings } from "@/app/actions/bookings";
import { getEvents } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { IslamicLoader } from "@/components/common/islamic-loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/i18n/locale-provider";

type BookingRecord = {
  id: string;
  fullName: string;
  email: string;
  city: string;
  age: number;
  motive?: string | null;
  createdAt: Date;
  event: {
    id: string;
    titleAr: string;
    titleEn: string;
    date: Date;
    location: string;
  };
};

type EventOption = {
  id: string;
  titleAr: string;
  titleEn: string;
};

export default function AdminBookingsPage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeModalBooking, setActiveModalBooking] =
    useState<BookingRecord | null>(null);

  const fetchData = async () => {
    setLoading(true);

    const [bookingRes, eventsRes] = await Promise.all([
      getBookings(selectedEventId),
      getEvents(),
    ]);

    if (bookingRes.success && bookingRes.bookings) {
      setBookings(bookingRes.bookings as unknown as BookingRecord[]);
    } else if (bookingRes.error) {
      toast.error(bookingRes.error);
    }

    if (eventsRes.success && eventsRes.events) {
      setEvents(
        eventsRes.events.map((e) => ({
          id: e.id,
          titleAr: e.titleAr,
          titleEn: e.titleEn,
        })),
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedEventId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (
      !confirm(
        locale === "ar"
          ? "هل أنت متأكد من رغبتك في حذف هذا الحجز؟"
          : "Are you sure you want to delete this booking record?",
      )
    ) {
      return;
    }

    setBookings((prev) => prev.filter((b) => b.id !== id));
    const res = await deleteBooking(id);
    if (res.success) {
      toast.success(
        locale === "ar" ? "تم حذف الحجز بنجاح" : "Booking record deleted",
      );
    } else {
      toast.error(res.error || "Failed to delete booking");
      fetchData();
    }
  };

  // Filter bookings based on search query
  const filteredBookings = bookings.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.fullName.toLowerCase().includes(q) ||
      b.email.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q) ||
      b.event.titleAr.toLowerCase().includes(q) ||
      b.event.titleEn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-500 font-semibold text-xs uppercase tracking-wider mb-1 shrink-0">
            <Ticket className="size-4 shrink-0" />
            <span className="whitespace-nowrap">
              {locale === "ar" ? "سجل الحجوزات" : "Booking Submissions"}
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight whitespace-nowrap">
            {locale === "ar" ? "حجوزات الفعاليات المؤكدة" : "Confirmed Bookings"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {locale === "ar"
              ? "اضغط على أي صف لعرض كامل التفاصيل والمعلومات المسجلة."
              : "Click any row to open full booking details and registration data."}
          </p>
        </div>

        <Button
          onClick={fetchData}
          variant="outline"
          className="rounded-xl glass gap-2 shrink-0 self-start sm:self-auto h-10 px-4 text-sm font-semibold"
        >
          <RefreshCw
            className={`size-4 shrink-0 ${loading ? "animate-spin" : ""}`}
          />
          <span className="whitespace-nowrap">
            {locale === "ar" ? "تحديث السجل" : "Refresh"}
          </span>
        </Button>
      </div>

      {/* Summary Stat & Search Filters */}
      <div className="glass rounded-2xl p-4 sm:p-5 border border-border/60 shadow-layered flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              locale === "ar"
                ? "بحث بالاسم، البريد، أو المدينة..."
                : "Search by name, email, or city..."
            }
            className="w-full rounded-xl border border-border bg-background/50 ps-10 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
          />
        </div>

        {/* Filter Event Dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 font-semibold whitespace-nowrap">
            <Filter className="size-4 text-brass shrink-0" />
            <span>
              {locale === "ar" ? "تصفية حسب الفعالية:" : "Filter Event:"}
            </span>
          </div>

          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brass shrink-0 font-medium"
          >
            <option value="all">
              {locale === "ar" ? "جميع الفعاليات" : "All Events"}
            </option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {locale === "ar" ? e.titleAr : e.titleEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Chip */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
        <span className="glass px-3.5 py-2 rounded-full border border-border/60 flex items-center gap-2 whitespace-nowrap text-sm">
          <Users className="size-4 text-brass shrink-0" />
          <span>
            {locale === "ar"
              ? `إجمالي الحاضرين المؤكدين: ${filteredBookings.length}`
              : `Total Confirmed Attendees: ${filteredBookings.length}`}
          </span>
        </span>
      </div>

      {/* Bookings Table View */}
      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <IslamicLoader
            message={
              locale === "ar"
                ? "جاري تحميل سجل الحجوزات..."
                : "Loading bookings..."
            }
          />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center space-y-4">
          <Ticket className="size-12 text-brass/50 mx-auto shrink-0" />
          <h3 className="font-heading text-lg font-bold text-foreground">
            {locale === "ar" ? "لا توجد حجوزات مسجلة" : "No Bookings Found"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {searchQuery || selectedEventId !== "all"
              ? locale === "ar"
                ? "لا توجد نتائج تطابق معايير البحث والتصفية المحددة."
                : "No booking records match your current filter."
              : locale === "ar"
              ? "سيظهر هنا كل حجز مؤكد تم التحقق منه بالبريد الإلكتروني."
              : "New verified bookings will appear here once OTP is confirmed."}
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl border border-border/60 shadow-layered overflow-hidden">
          <div className="w-full">
            <table className="w-full text-start text-sm border-collapse table-auto">
              <thead>
                <tr className="border-b border-border/60 bg-card/50 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4 sm:px-6 text-start">
                    {locale === "ar" ? "الاسم والرقم" : "Attendee / Ref"}
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 text-start">
                    {locale === "ar" ? "الفعالية" : "Event"}
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 text-start hidden sm:table-cell">
                    {locale === "ar" ? "تاريخ التأكيد" : "Date"}
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 text-end">
                    {locale === "ar" ? "الحالة" : "Status"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredBookings.map((b, index) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => setActiveModalBooking(b)}
                    data-testid={`booking-row-${b.id}`}
                    className="cursor-pointer hover:bg-brass/10 transition-colors group"
                  >
                    {/* Attendee Name & Ref */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-bold text-foreground group-hover:text-brass transition-colors">
                        {b.fullName}
                      </div>
                      <div className="text-[11px] font-mono text-brass/80">
                        IHY-{b.id.slice(-6).toUpperCase()}
                      </div>
                    </td>

                    {/* Target Event */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-medium text-foreground truncate max-w-[200px] sm:max-w-xs">
                        {locale === "ar" ? b.event.titleAr : b.event.titleEn}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {b.city}
                      </div>
                    </td>

                    {/* Submission Date */}
                    <td className="py-3.5 px-4 sm:px-6 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleDateString(
                        locale === "ar" ? "ar-MA" : "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </td>

                    {/* Status & Delete */}
                    <td className="py-3.5 px-4 sm:px-6 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="size-3.5 shrink-0" />
                          <span>{locale === "ar" ? "مؤكد" : "Confirmed"}</span>
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(e, b.id)}
                          className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5 shrink-0" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      <Dialog
        open={!!activeModalBooking}
        onOpenChange={(open) => {
          if (!open) setActiveModalBooking(null);
        }}
      >
        {activeModalBooking ? (
          <DialogContent
            data-testid="booking-detail-modal"
            className="sm:max-w-lg glass-strong border-brass/30"
          >
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <User className="size-5 text-brass" />
                  <span>
                    {locale === "ar" ? "تفاصيل الحجز" : "Booking Details"}
                  </span>
                </DialogTitle>
                <span className="font-mono text-xs font-bold text-brass bg-brass/10 px-2.5 py-1 rounded-full border border-brass/30">
                  IHY-{activeModalBooking.id.slice(-6).toUpperCase()}
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-1">
                {locale === "ar"
                  ? "جميع البيانات والمعلومات المسجلة للمشارك لحضور الفعالية."
                  : "Complete attendee registration information for this event."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between items-center border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground text-xs font-semibold uppercase">
                  {locale === "ar" ? "الاسم الكامل" : "Full Name"}
                </span>
                <span className="font-bold text-foreground text-base">
                  {activeModalBooking.fullName}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground text-xs font-semibold uppercase">
                  {locale === "ar" ? "البريد الإلكتروني" : "Email Address"}
                </span>
                <span className="font-medium text-foreground dir-ltr flex items-center gap-1.5">
                  <Mail className="size-3.5 text-brass" />
                  {activeModalBooking.email}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-border/40 pb-2.5">
                <div>
                  <span className="text-muted-foreground text-xs font-semibold uppercase block">
                    {locale === "ar" ? "المدينة" : "City"}
                  </span>
                  <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="size-3.5 text-brass" />
                    {activeModalBooking.city}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-semibold uppercase block">
                    {locale === "ar" ? "العمر" : "Age"}
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {activeModalBooking.age}{" "}
                    {locale === "ar" ? "سنة" : "years old"}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground text-xs font-semibold uppercase">
                  {locale === "ar" ? "الفعالية المستهدفة" : "Target Event"}
                </span>
                <span className="font-semibold text-foreground">
                  {locale === "ar"
                    ? activeModalBooking.event.titleAr
                    : activeModalBooking.event.titleEn}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground text-xs font-semibold uppercase">
                  {locale === "ar" ? "تاريخ الفعالية ومقرها" : "Event Details"}
                </span>
                <span className="font-medium text-muted-foreground text-xs flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-brass" />
                  {new Date(activeModalBooking.event.date).toLocaleDateString(
                    locale === "ar" ? "ar-MA" : "en-US",
                    { month: "long", day: "numeric", year: "numeric" },
                  )}
                  {" — "}
                  {activeModalBooking.event.location}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground text-xs font-semibold uppercase">
                  {locale === "ar" ? "تاريخ التسجيل" : "Registered At"}
                </span>
                <span className="font-medium text-muted-foreground text-xs flex items-center gap-1.5">
                  <Clock className="size-3.5 text-brass" />
                  {new Date(activeModalBooking.createdAt).toLocaleString(
                    locale === "ar" ? "ar-MA" : "en-US",
                  )}
                </span>
              </div>

              {activeModalBooking.motive ? (
                <div className="space-y-1.5 pt-1">
                  <span className="text-muted-foreground text-xs font-semibold uppercase">
                    {locale === "ar"
                      ? "دافع الحضور"
                      : "Reason for Attending"}
                  </span>
                  <p className="bg-muted/50 border border-border/50 p-3.5 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed">
                    {activeModalBooking.motive}
                  </p>
                </div>
              ) : null}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}