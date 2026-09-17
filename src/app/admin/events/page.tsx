"use client";

import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Ticket,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  createEvent,
  deleteEvent,
  getEvents,
  toggleEventStatus,
  updateEvent,
} from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";

type EventItem = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  date: Date;
  time: string;
  location: string;
  posterUrl: string;
  isNew: boolean;
  bookingOpen: boolean;
  createdAt: Date;
  _count?: {
    bookings: number;
  };
};

function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminEventsPage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (posterPreview && posterPreview.startsWith("blob:")) {
        URL.revokeObjectURL(posterPreview);
      }
    };
  }, [posterPreview]);

  const setSafePosterPreview = (newUrl: string | null) => {
    setPosterPreview((prev) => {
      if (prev && prev.startsWith("blob:") && prev !== newUrl) {
        URL.revokeObjectURL(prev);
      }
      return newUrl;
    });
  };

  const fetchEvents = async () => {
    setLoading(true);
    const res = await getEvents();
    if (res.success && res.events) {
      setEvents(res.events as unknown as EventItem[]);
    } else if (res.error) {
      toast.error(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleToggleStatus = async (
    id: string,
    field: "isNew" | "bookingOpen",
    currentValue: boolean,
  ) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: !currentValue } : e)),
    );
    const res = await toggleEventStatus(id, field, !currentValue);
    if (res.success) {
      toast.success(
        locale === "ar" ? "تم تحديث حالة الفعالية" : "Event status updated",
      );
    } else {
      toast.error(res.error || "Failed to toggle event status");
      fetchEvents();
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        locale === "ar"
          ? "هل أنت تأكد من رغبتك في حذف هذه الفعالية بجميع حجوزاتها؟"
          : "Are you sure you want to delete this event and its bookings?",
      )
    ) {
      return;
    }

    setEvents((prev) => prev.filter((e) => e.id !== id));
    const res = await deleteEvent(id);
    if (res.success) {
      toast.success(locale === "ar" ? "تم حذف الفعالية بنجاح" : "Event deleted successfully");
    } else {
      toast.error(res.error || "Failed to delete event");
      fetchEvents();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const file = formData.get("image") as File | null;
    const posterUrl = formData.get("posterUrl") as string | null;

    if (!file && !posterUrl) {
      toast.error(locale === "ar" ? "الرجاء اختيار صورة أو إدخال رابط صورة" : "Please select an image file or enter an image URL");
      setSubmitting(false);
      return;
    }

    let res;
    if (editingEvent) {
      res = await updateEvent(editingEvent.id, formData);
    } else {
      res = await createEvent(formData);
    }

    setSubmitting(false);

    if (res.success) {
      toast.success(
        editingEvent
          ? locale === "ar"
            ? "تم تحديث الفعالية بنجاح"
            : "Event updated successfully"
          : locale === "ar"
          ? "تم إضافة الفعالية الجديدة بنجاح"
          : "Event created successfully",
      );
      setModalOpen(false);
      setEditingEvent(null);
      setSafePosterPreview(null);
      fetchEvents();
    } else {
      toast.error(res.error || "Failed to save event");
    }
  };

  const openAddModal = () => {
    setEditingEvent(null);
    setSafePosterPreview(null);
    setModalOpen(true);
  };

  const openEditModal = (evt: EventItem) => {
    setEditingEvent(evt);
    setSafePosterPreview(evt.posterUrl);
    setModalOpen(true);
  };

  return (
    <div className="space-y-8 min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-500 font-semibold text-xs uppercase tracking-wider mb-1 shrink-0">
            <CalendarIcon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">
              {locale === "ar" ? "برامج إحياء" : "Events Management"}
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight whitespace-nowrap">
            {locale === "ar" ? "إدارة الفعاليات واللقاءات" : "Manage Events"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {locale === "ar"
              ? "إنشاء وتعديل الفعاليات القادمة، وتفعيل شارة 'جديد' في القائمة العلوية وفتح الحجز."
              : "Create and manage upcoming & past events, toggle navbar indicators, and open/close bookings."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={fetchEvents}
            variant="outline"
            className="rounded-xl glass gap-2 h-10 px-4 text-sm font-semibold"
          >
            <RefreshCw className={`size-4 shrink-0 ${loading ? "animate-spin" : ""}`} />
            <span className="whitespace-nowrap">{locale === "ar" ? "تحديث" : "Refresh"}</span>
          </Button>

          <Button
            onClick={openAddModal}
            className="bg-brass-gradient text-night rounded-xl px-5 h-10 font-semibold shadow-layered hover:opacity-95 text-sm"
          >
            <Plus className="size-4 me-1.5 shrink-0" />
            <span className="whitespace-nowrap">
              {locale === "ar" ? "فعالية جديدة" : "New Event"}
            </span>
          </Button>
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground text-sm animate-pulse">
          {locale === "ar" ? "جاري تحميل الفعاليات..." : "Loading events..."}
        </div>
      ) : events.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center space-y-4">
          <CalendarIcon className="size-12 text-brass/50 mx-auto shrink-0" />
          <h3 className="font-heading text-lg font-bold text-foreground">
            {locale === "ar" ? "لا توجد فعاليات مسجلة" : "No Events Found"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {locale === "ar"
              ? "أنشئ أول فعالية لبرنامج إحياء لتفعيل الحجز والمؤشر العلوي."
              : "Create your first event to enable bookings and navbar indicators."}
          </p>
          <Button onClick={openAddModal} className="bg-brass-gradient text-night rounded-full px-6 text-sm h-10 font-semibold">
            <Plus className="size-4 me-1.5 shrink-0" />
            <span className="whitespace-nowrap">
              {locale === "ar" ? "إنشاء أول فعالية" : "Create First Event"}
            </span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4 min-w-0">
          {events.map((evt, index) => (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass rounded-2xl p-5 border border-border/60 shadow-layered flex flex-col md:flex-row items-start md:items-center justify-between gap-6 min-w-0"
            >
              {/* Event Poster Thumbnail & Info */}
              <div className="flex items-start md:items-center gap-4 min-w-0">
                <div className="relative size-20 rounded-xl overflow-hidden bg-muted shrink-0 border border-border/50">
                  <Image
                    src={evt.posterUrl || "/images/event-poster.jpg"}
                    alt={evt.titleAr}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-lg font-bold text-foreground truncate">
                      {locale === "ar" ? evt.titleAr : evt.titleEn}
                    </h3>

                    {/* Badges */}
                    {evt.bookingOpen ? (
                      <span className="inline-flex items-center gap-1 text-[0.7rem] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        <CheckCircle2 className="size-3 shrink-0" />
                        <span>{locale === "ar" ? "مفتوحة للحجز" : "Booking Open"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[0.7rem] px-2.5 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border border-border whitespace-nowrap">
                        <span>{locale === "ar" ? "أرشيف / انتهت" : "Past Event"}</span>
                      </span>
                    )}

                    {evt.isNew && (
                      <span className="inline-flex items-center gap-1 text-[0.7rem] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20 whitespace-nowrap">
                        <Sparkles className="size-3 shrink-0" />
                        <span>{locale === "ar" ? "مؤشر جديد" : "Navbar Dot Active"}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {locale === "ar" ? evt.descriptionAr : evt.descriptionEn}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <CalendarIcon className="size-3.5 text-brass shrink-0" />
                      <span>
                        {new Date(evt.date).toLocaleDateString(
                          locale === "ar" ? "ar-MA" : "en-US",
                          { year: "numeric", month: "long", day: "numeric" },
                        )}
                      </span>
                    </span>

                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Clock className="size-3.5 text-brass shrink-0" />
                      <span>{evt.time}</span>
                    </span>

                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <MapPin className="size-3.5 text-brass shrink-0" />
                      <span>{evt.location}</span>
                    </span>

                    <span className="flex items-center gap-1 font-semibold text-brass whitespace-nowrap">
                      <Ticket className="size-3.5 shrink-0" />
                      <span>
                        {evt._count?.bookings || 0}{" "}
                        {locale === "ar" ? "مسجلين" : "attendees"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Toggles & Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-border/40">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleToggleStatus(evt.id, "bookingOpen", evt.bookingOpen)
                  }
                  className="rounded-xl text-xs glass h-8 px-3 font-semibold"
                >
                  <span className="whitespace-nowrap">
                    {evt.bookingOpen
                      ? locale === "ar"
                        ? "إغلاق الحجز"
                        : "Close Booking"
                      : locale === "ar"
                      ? "فتح الحجز"
                      : "Open Booking"}
                  </span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleStatus(evt.id, "isNew", evt.isNew)}
                  className="rounded-xl text-xs glass h-8 px-3 font-semibold"
                >
                  <span className="whitespace-nowrap">
                    {evt.isNew
                      ? locale === "ar"
                        ? "إلغاء الشارة"
                        : "Disable Dot"
                      : locale === "ar"
                      ? "تفعيل الشارة"
                      : "Set 'New' Dot"}
                  </span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditModal(evt)}
                  className="rounded-xl text-xs glass h-8 px-3 font-semibold"
                >
                  <span className="whitespace-nowrap">
                    {locale === "ar" ? "تعديل" : "Edit"}
                  </span>
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(evt.id)}
                  className="rounded-xl text-xs h-8 px-2.5"
                >
                  <Trash2 className="size-3.5 shrink-0" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-night/60 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong border border-brass/30 rounded-2xl w-full max-w-2xl p-6 shadow-layered space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <h2 className="font-heading text-xl font-bold text-foreground whitespace-nowrap">
                {editingEvent
                  ? locale === "ar"
                    ? "تعديل الفعالية"
                    : "Edit Event"
                  : locale === "ar"
                  ? "إضافة فعالية جديدة"
                  : "Add New Event"}
              </h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setModalOpen(false)}
                className="rounded-full shrink-0"
              >
                <X className="size-5 shrink-0" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Titles AR & EN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {locale === "ar" ? "عنوان الفعالية (بالعربية)" : "Title (Arabic)"}
                  </label>
                  <input
                    type="text"
                    name="titleAr"
                    required
                    defaultValue={editingEvent?.titleAr || ""}
                    placeholder="مجالس إحياء الشبابي..."
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {locale === "ar" ? "العنوان (بالإنجليزية)" : "Title (English)"}
                  </label>
                  <input
                    type="text"
                    name="titleEn"
                    required
                    defaultValue={editingEvent?.titleEn || ""}
                    placeholder="Ihyaa Youth Gathering..."
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass dir-ltr"
                  />
                </div>
              </div>

              {/* Descriptions AR & EN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {locale === "ar" ? "الوصف (بالعربية)" : "Description (Arabic)"}
                  </label>
                  <textarea
                    name="descriptionAr"
                    rows={3}
                    defaultValue={editingEvent?.descriptionAr || ""}
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {locale === "ar" ? "الوصف (بالإنجليزية)" : "Description (English)"}
                  </label>
                  <textarea
                    name="descriptionEn"
                    rows={3}
                    defaultValue={editingEvent?.descriptionEn || ""}
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass dir-ltr"
                  />
                </div>
              </div>

              {/* Date, Time, Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {locale === "ar" ? "التاريخ" : "Date"}
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={
                      editingEvent
                        ? new Date(editingEvent.date).toISOString().split("T")[0]
                        : new Date().toISOString().split("T")[0]
                    }
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {locale === "ar" ? "الوقت" : "Time"}
                  </label>
                  <input
                    type="text"
                    name="time"
                    required
                    defaultValue={editingEvent?.time || "18:00"}
                    placeholder="18:00 - 21:00"
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {locale === "ar" ? "المكان" : "Location"}
                  </label>
                  <input
                    type="text"
                    name="location"
                    required
                    defaultValue={editingEvent?.location || ""}
                    placeholder="مراكش"
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                  />
                </div>
              </div>

              {/* Poster Upload/URL */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  {locale === "ar" ? "ملصق الفعالية (Poster Image)" : "Event Poster Image"}
                </label>

                {isValidImageUrl(posterPreview) && (
                  <div className="relative aspect-[16/9] max-h-40 rounded-xl overflow-hidden border border-border/60 bg-muted mb-2">
                    <Image
                      src={posterPreview!}
                      alt="Preview"
                      fill
                      unoptimized={posterPreview!.startsWith("blob:")}
                      className="object-contain"
                    />
                  </div>
                )}

                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const blobUrl = URL.createObjectURL(file);
                      setSafePosterPreview(blobUrl);
                    }
                  }}
                  className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brass/20 file:text-brass cursor-pointer"
                />

                <input
                  type="url"
                  name="posterUrl"
                  defaultValue={editingEvent?.posterUrl || ""}
                  placeholder="https://..."
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (isValidImageUrl(val)) {
                      setSafePosterPreview(val);
                    }
                  }}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="bookingOpenCheck"
                    name="bookingOpen"
                    defaultChecked={
                      editingEvent ? editingEvent.bookingOpen : true
                    }
                    className="size-4 rounded border-border text-brass focus:ring-brass"
                  />
                  <label
                    htmlFor="bookingOpenCheck"
                    className="text-sm font-semibold text-foreground cursor-pointer whitespace-nowrap"
                  >
                    {locale === "ar"
                      ? "مفتوحة للحجز (فعالية قادمة)"
                      : "Booking Open (Upcoming Event)"}
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isNewCheck"
                    name="isNew"
                    defaultChecked={editingEvent ? editingEvent.isNew : false}
                    className="size-4 rounded border-border text-brass focus:ring-brass"
                  />
                  <label
                    htmlFor="isNewCheck"
                    className="text-sm font-semibold text-foreground cursor-pointer whitespace-nowrap"
                  >
                    {locale === "ar"
                      ? "تفعيل الشارة النباضة في القائمة"
                      : "Enable Pulsing Dot in Navbar"}
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-border/60 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl glass text-sm h-10 font-semibold"
                >
                  <span className="whitespace-nowrap">{locale === "ar" ? "إلغاء" : "Cancel"}</span>
                </Button>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-brass-gradient text-night font-semibold rounded-xl px-6 text-sm h-10 shrink-0"
                >
                  {submitting ? (
                    <Upload className="size-4 animate-spin me-2 shrink-0" />
                  ) : null}
                  <span className="whitespace-nowrap">
                    {editingEvent
                      ? locale === "ar"
                        ? "حفظ التغييرات"
                        : "Save Changes"
                      : locale === "ar"
                      ? "إضافة الفعالية"
                      : "Add Event"}
                  </span>
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
