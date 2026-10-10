"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  ListOrdered,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  User,
  Users,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";

import {
  approveBooking,
  deleteBooking,
  getBookings,
  promoteWaitlistBooking,
  rejectBooking,
} from "@/app/actions/bookings";
import { getEvents } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
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
  confirmed: boolean;
  status: "CONFIRMED" | "PENDING" | "WAITLISTED" | "REJECTED" | string;
  waitlistOrder?: number | null;
  createdAt: Date;
  event: {
    id: string;
    titleAr: string;
    titleEn: string;
    date: Date;
    location: string;
    capacityType?: string;
    capacity?: number | null;
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
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeModalBooking, setActiveModalBooking] =
    useState<BookingRecord | null>(null);
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

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
    let ignore = false;
    void (async () => {
      setLoading(true);
      const res = await getBookings(selectedEventId);
      if (!ignore) {
        if (res.success && res.bookings) {
          setBookings(res.bookings as BookingRecord[]);
        }
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [selectedEventId]);

  const handleApprove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const res = await approveBooking(id);
    if (res.success) {
      toast.success(
        locale === "ar"
          ? "تمت الموافقة على الحجز بنجاح"
          : "Booking approved successfully",
      );
      fetchData();
    } else {
      toast.error(res.error || "Failed to approve booking");
    }
  };

  const handleReject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: locale === "ar" ? "تأكيد رفض الحجز" : "Confirm Reject Booking",
      description:
        locale === "ar"
          ? "هل أنت متأكد من رفض هذا الحجز؟ في حال توفر مقعد سيتم ترقية الحجز التالي في قائمة الانتظار تلقائياً."
          : "Are you sure you want to reject this booking? If a spot opens, the next waitlisted attendee will be auto-promoted.",
      confirmText: locale === "ar" ? "رفض الحجز" : "Reject Booking",
      variant: "destructive",
    });
    if (!ok) return;

    const res = await rejectBooking(id);
    if (res.success) {
      toast.success(locale === "ar" ? "تم رفض الحجز" : "Booking rejected");
      fetchData();
    } else {
      toast.error(res.error || "Failed to reject booking");
    }
  };

  const handlePromote = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const res = await promoteWaitlistBooking(id);
    if (res.success) {
      toast.success(
        locale === "ar"
          ? "تمت ترقية الحجز بنجاح وإرسال بريد التأكيد"
          : "Booking promoted to confirmed and email sent",
      );
      fetchData();
    } else {
      toast.error(res.error || "Failed to promote booking");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: locale === "ar" ? "تأكيد حذف الحجز" : "Confirm Delete Booking",
      description:
        locale === "ar"
          ? "هل أنت متأكد من رغبتك في حذف هذا الحجز؟"
          : "Are you sure you want to delete this booking record?",
      confirmText: locale === "ar" ? "حذف الحجز" : "Delete Booking",
      variant: "destructive",
    });
    if (!ok) return;

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

  // Filter bookings based on search query and status
  const filteredBookings = bookings.filter((b) => {
    if (selectedStatus !== "all" && b.status !== selectedStatus) {
      return false;
    }
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

  const renderStatusBadge = (
    status: string,
    waitlistOrder?: number | null,
    bookingId?: string,
  ) => {
    const testAttr = bookingId ? { "data-testid": `booking-status-${bookingId}` } : {};
    switch (status) {
      case "CONFIRMED":
        return (
          <span
            {...testAttr}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
          >
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span>{locale === "ar" ? "مؤكد" : "Confirmed"}</span>
          </span>
        );
      case "PENDING":
        return (
          <span
            {...testAttr}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/30"
          >
            <Clock className="size-3.5 shrink-0" />
            <span>
              {locale === "ar" ? "قيد الموافقة" : "Pending Approval"}
            </span>
          </span>
        );
      case "WAITLISTED":
        return (
          <span
            {...testAttr}
            className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/30"
          >
            <ListOrdered className="size-3.5 shrink-0" />
            <span>
              {locale === "ar"
                ? `قائمة الانتظار (#${waitlistOrder || 1})`
                : `Waitlisted (#${waitlistOrder || 1})`}
            </span>
          </span>
        );
      case "REJECTED":
        return (
          <span
            {...testAttr}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/30"
          >
            <XCircle className="size-3.5 shrink-0" />
            <span>{locale === "ar" ? "مرفوض" : "Rejected"}</span>
          </span>
        );
      default:
        return null;
    }
  };

  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;
  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;
  const waitlistedCount = bookings.filter(
    (b) => b.status === "WAITLISTED",
  ).length;

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

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Filter Status */}
          <div className="flex items-center gap-2">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px] sm:w-[170px]" data-testid="status-filter-select">
                <SelectValue placeholder={locale === "ar" ? "جميع الحالات" : "All Statuses"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "ar" ? "جميع الحالات" : "All Statuses"}
                </SelectItem>
                <SelectItem value="CONFIRMED">
                  {locale === "ar" ? "مؤكد" : "Confirmed"}
                </SelectItem>
                <SelectItem value="PENDING">
                  {locale === "ar" ? "قيد الموافقة" : "Pending Approval"}
                </SelectItem>
                <SelectItem value="WAITLISTED">
                  {locale === "ar" ? "قائمة الانتظار" : "Waitlisted"}
                </SelectItem>
                <SelectItem value="REJECTED">
                  {locale === "ar" ? "مرفوض" : "Rejected"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Event Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-brass shrink-0" />
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-[180px] sm:w-[220px]" data-testid="event-filter-select">
                <SelectValue placeholder={locale === "ar" ? "جميع الفعاليات" : "All Events"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "ar" ? "جميع الفعاليات" : "All Events"}
                </SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {locale === "ar" ? e.titleAr : e.titleEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
        <span className="glass px-3.5 py-1.5 rounded-full border border-border/60 flex items-center gap-2 whitespace-nowrap">
          <Users className="size-3.5 text-brass shrink-0" />
          <span>
            {locale === "ar"
              ? `إجمالي المسجلين: ${bookings.length}`
              : `Total Registrations: ${bookings.length}`}
          </span>
        </span>
        <span className="glass px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 whitespace-nowrap">
          <CheckCircle2 className="size-3.5 shrink-0" />
          <span>
            {locale === "ar"
              ? `مؤكد: ${confirmedCount}`
              : `Confirmed: ${confirmedCount}`}
          </span>
        </span>
        <span className="glass px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 whitespace-nowrap">
          <Clock className="size-3.5 shrink-0" />
          <span>
            {locale === "ar"
              ? `قيد الموافقة: ${pendingCount}`
              : `Pending Approval: ${pendingCount}`}
          </span>
        </span>
        <span className="glass px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center gap-1.5 whitespace-nowrap">
          <ListOrdered className="size-3.5 shrink-0" />
          <span>
            {locale === "ar"
              ? `قائمة الانتظار: ${waitlistedCount}`
              : `Waitlisted: ${waitlistedCount}`}
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

                    {/* Status & Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {renderStatusBadge(
                          b.status || (b.confirmed ? "CONFIRMED" : "PENDING"),
                          b.waitlistOrder,
                          b.id,
                        )}

                        {b.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`approve-btn-${b.id}`}
                            onClick={(e) => handleApprove(e, b.id)}
                            className="size-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-lg"
                            title={locale === "ar" ? "الموافقة على الحجز" : "Approve booking"}
                          >
                            <UserCheck className="size-4" />
                          </Button>
                        )}

                        {b.status === "WAITLISTED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`promote-btn-${b.id}`}
                            onClick={(e) => handlePromote(e, b.id)}
                            className="size-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-500/10 rounded-lg"
                            title={locale === "ar" ? "ترقية إلى مؤكد" : "Promote to confirmed"}
                          >
                            <UserCheck className="size-4" />
                          </Button>
                        )}

                        {(b.status === "CONFIRMED" || b.status === "PENDING") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`reject-btn-${b.id}`}
                            onClick={(e) => handleReject(e, b.id)}
                            className="size-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 rounded-lg"
                            title={locale === "ar" ? "رفض الحجز" : "Reject booking"}
                          >
                            <UserX className="size-4" />
                          </Button>
                        )}

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(e, b.id)}
                          className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title={locale === "ar" ? "حذف الحجز" : "Delete record"}
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
            className="sm:max-w-lg glass-strong border-brass/30 no-scrollbar max-h-[90vh] overflow-y-auto"
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
                  {locale === "ar" ? "حالة الحجز" : "Booking Status"}
                </span>
                {renderStatusBadge(
                  activeModalBooking.status ||
                    (activeModalBooking.confirmed ? "CONFIRMED" : "PENDING"),
                  activeModalBooking.waitlistOrder,
                  `modal-${activeModalBooking.id}`,
                )}
              </div>

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

              {/* Action Buttons in Modal */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-border/50">
                {activeModalBooking.status === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      onClick={async (e) => {
                        await handleApprove(e, activeModalBooking.id);
                        setActiveModalBooking(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl text-xs h-9 px-3 font-semibold"
                    >
                      <UserCheck className="size-3.5" />
                      {locale === "ar" ? "قبول وتأكيد الحجز" : "Approve Booking"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        await handleReject(e, activeModalBooking.id);
                        setActiveModalBooking(null);
                      }}
                      className="text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5 rounded-xl text-xs h-9 px-3 font-semibold"
                    >
                      <UserX className="size-3.5" />
                      {locale === "ar" ? "رفض الحجز" : "Reject"}
                    </Button>
                  </>
                )}
                {activeModalBooking.status === "WAITLISTED" && (
                  <Button
                    size="sm"
                    onClick={async (e) => {
                      await handlePromote(e, activeModalBooking.id);
                      setActiveModalBooking(null);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 rounded-xl text-xs h-9 px-3 font-semibold"
                  >
                    <UserCheck className="size-3.5" />
                    {locale === "ar" ? "ترقية إلى مؤكد" : "Promote to Confirmed"}
                  </Button>
                )}
                {(activeModalBooking.status === "CONFIRMED" ||
                  (!activeModalBooking.status && activeModalBooking.confirmed)) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async (e) => {
                      await handleReject(e, activeModalBooking.id);
                      setActiveModalBooking(null);
                    }}
                    className="text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5 rounded-xl text-xs h-9 px-3 font-semibold"
                  >
                    <UserX className="size-3.5" />
                    {locale === "ar" ? "إلغاء / رفض الحجز" : "Cancel / Reject"}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      {ConfirmDialogComponent}
    </div>
  );
}