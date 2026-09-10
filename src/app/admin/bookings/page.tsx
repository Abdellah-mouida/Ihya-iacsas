"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { deleteBooking, getBookings } from "@/app/actions/bookings";
import { getEvents } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";

type BookingRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  quantity: number;
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

  const fetchData = async () => {
    setLoading(true);

    const [bookingRes, eventsRes] = await Promise.all([
      getBookings(selectedEventId),
      getEvents(),
    ]);

    if (bookingRes.success && bookingRes.bookings) {
      setBookings(bookingRes.bookings as unknown as BookingRecord[]);
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

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        locale === "ar"
          ? "هل أنت تأكد من رغبتك في حذف هذا الحجز؟"
          : "Are you sure you want to delete this booking record?",
      )
    ) {
      return;
    }

    setBookings((prev) => prev.filter((b) => b.id !== id));
    await deleteBooking(id);
  };

  // Filter bookings based on search query
  const filteredBookings = bookings.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.fullName.toLowerCase().includes(q) ||
      b.email.toLowerCase().includes(q) ||
      b.phone.toLowerCase().includes(q) ||
      b.event.titleAr.toLowerCase().includes(q) ||
      b.event.titleEn.toLowerCase().includes(q)
    );
  });

  const totalTickets = filteredBookings.reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-500 font-semibold text-xs uppercase tracking-wider mb-1">
            <Ticket className="size-4" />
            <span>{locale === "ar" ? "سجل الحجوزات" : "Booking Submissions"}</span>
          </div>
          <h1 className="font-heading text-3xl font-extrabold text-foreground">
            {locale === "ar" ? "حجوزات الفعاليات المسجلة" : "Manage Bookings"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {locale === "ar"
              ? "استعراض وتصفية طلبات الحجز الحقيقية القادمة من صفحة الفعاليات بالموقع."
              : "Review, filter, and manage real booking submissions from the website."}
          </p>
        </div>

        <Button
          onClick={fetchData}
          variant="outline"
          className="rounded-xl glass gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          <span>{locale === "ar" ? "تحديث السجل" : "Refresh"}</span>
        </Button>
      </div>

      {/* Summary Stat & Search Filters */}
      <div className="glass rounded-2xl p-4 sm:p-5 border border-border/60 shadow-layered flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              locale === "ar"
                ? "بحث بالاسم، البريد، أو الهاتف..."
                : "Search by name, email, or phone..."
            }
            className="w-full rounded-xl border border-border bg-background/50 ps-10 pe-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
          />
        </div>

        {/* Filter Event Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 font-semibold">
            <Filter className="size-4 text-brass" />
            <span>{locale === "ar" ? "تصفية حسب الفعالية:" : "Filter Event:"}</span>
          </div>

          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
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

      {/* Summary Chips */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
        <span className="glass px-3 py-1.5 rounded-full border border-border/60 flex items-center gap-1.5">
          <Users className="size-3.5 text-brass" />
          {locale === "ar"
            ? `إجمالي الحجوزات: ${filteredBookings.length}`
            : `Submissions: ${filteredBookings.length}`}
        </span>

        <span className="glass px-3 py-1.5 rounded-full border border-border/60 flex items-center gap-1.5">
          <Ticket className="size-3.5 text-brass" />
          {locale === "ar"
            ? `مجموع التذاكر المطلوبة: ${totalTickets}`
            : `Total Tickets Requested: ${totalTickets}`}
        </span>
      </div>

      {/* Bookings Table / Card View */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground text-sm animate-pulse">
          {locale === "ar" ? "جاري تحميل سجل الحجوزات..." : "Loading bookings..."}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center space-y-4">
          <Ticket className="size-12 text-brass/50 mx-auto" />
          <h3 className="font-heading text-lg font-bold text-foreground">
            {locale === "ar" ? "لا توجد حجوزات مسجلة" : "No Bookings Found"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {searchQuery || selectedEventId !== "all"
              ? locale === "ar"
                ? "لا توجد نتائج تطابق معايير البحث والتصفية المحددة."
                : "No booking records match your current filter."
              : locale === "ar"
              ? "سيظهر هنا كل حجز جديد يتم إرصاده عبر صفحة الفعالية بالموقع."
              : "New bookings submitted on the public events page will appear here."}
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl border border-border/60 shadow-layered overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-card/40 text-muted-foreground text-xs uppercase">
                  <th className="py-3.5 px-4 text-start font-semibold">
                    {locale === "ar" ? "الرقم والاسم" : "Reference & Name"}
                  </th>
                  <th className="py-3.5 px-4 text-start font-semibold">
                    {locale === "ar" ? "الفعالية الحاضر لها" : "Target Event"}
                  </th>
                  <th className="py-3.5 px-4 text-start font-semibold">
                    {locale === "ar" ? "معلومات التواصل" : "Contact Info"}
                  </th>
                  <th className="py-3.5 px-4 text-start font-semibold">
                    {locale === "ar" ? "عدد المقاعد" : "Quantity"}
                  </th>
                  <th className="py-3.5 px-4 text-start font-semibold">
                    {locale === "ar" ? "تاريخ الحجز" : "Submitted At"}
                  </th>
                  <th className="py-3.5 px-4 text-end font-semibold">
                    {locale === "ar" ? "إجراءات" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredBookings.map((b, index) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-4 px-4 font-semibold text-foreground">
                      <div className="text-xs font-mono text-brass mb-0.5 dir-ltr text-start">
                        IHY-{b.id.slice(-6).toUpperCase()}
                      </div>
                      <div className="text-base font-bold">{b.fullName}</div>
                    </td>

                    <td className="py-4 px-4 text-muted-foreground">
                      <div className="font-semibold text-foreground">
                        {locale === "ar" ? b.event.titleAr : b.event.titleEn}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="size-3 text-brass" />
                        {new Date(b.event.date).toLocaleDateString(
                          locale === "ar" ? "ar-MA" : "en-US",
                          { month: "short", day: "numeric" },
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-muted-foreground dir-ltr text-start">
                      <div className="font-medium text-foreground">{b.email}</div>
                      <div className="text-xs text-muted-foreground">{b.phone}</div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brass/15 text-brass border border-brass/25">
                        {b.quantity} {locale === "ar" ? "مقاعد" : "tickets"}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3 text-brass" />
                        {new Date(b.createdAt).toLocaleDateString(
                          locale === "ar" ? "ar-MA" : "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(b.id)}
                        className="rounded-xl h-8 px-3"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
