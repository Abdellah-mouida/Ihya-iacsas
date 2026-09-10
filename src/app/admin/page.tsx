"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Clock,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getDashboardStats } from "@/app/actions/dashboard";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";

type StatsData = {
  carouselCount: number;
  activeCarouselCount: number;
  galleryCount: number;
  totalEventsCount: number;
  upcomingEventsCount: number;
  totalBookingsCount: number;
};

type RecentBooking = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  quantity: number;
  createdAt: Date;
  event: {
    titleAr: string;
    titleEn: string;
  };
};

export default function AdminOverviewPage() {
  const { locale, t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);

  const loadData = async () => {
    setLoading(true);
    const res = await getDashboardStats();
    if (res.success && res.stats) {
      setStats(res.stats);
      setRecentBookings((res.recentBookings as unknown as RecentBooking[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const statCards = [
    {
      title: locale === "ar" ? "ملصقات الواجهة" : "Carousel Posters",
      value: stats ? `${stats.activeCarouselCount} / ${stats.carouselCount}` : "-",
      subtext: locale === "ar" ? "ملصقات مفعّلة على التوالي" : "Active posters on home",
      icon: Sparkles,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
      href: "/admin/carousel",
    },
    {
      title: locale === "ar" ? "معرض الصور" : "Gallery Photos",
      value: stats ? stats.galleryCount : "-",
      subtext: locale === "ar" ? "صورة ولحظة موثقة" : "Moments documented",
      icon: ImageIcon,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      href: "/admin/gallery",
    },
    {
      title: locale === "ar" ? "الفعاليات" : "Total Events",
      value: stats ? stats.totalEventsCount : "-",
      subtext:
        locale === "ar"
          ? `${stats?.upcomingEventsCount || 0} فعالية قادمة مفتوحة`
          : `${stats?.upcomingEventsCount || 0} open upcoming events`,
      icon: Calendar,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
      href: "/admin/events",
    },
    {
      title: locale === "ar" ? "إجمالي الحجوزات" : "Total Bookings",
      value: stats ? stats.totalBookingsCount : "-",
      subtext: locale === "ar" ? "حجز حقيقي مسجل" : "Registered bookings",
      icon: Ticket,
      color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
      href: "/admin/bookings",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
            {t("dashboard.overview") || "Overview"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {locale === "ar"
              ? "مرحباً بك في لوحة تحكم برنامج إحياء. إدارة المحتوى والفعاليات والحجوزات مباشرة من قاعدة البيانات."
              : "Welcome to Ihyaa Admin Dashboard. Manage live content, events, and bookings."}
          </p>
        </div>

        <Button
          onClick={loadData}
          disabled={loading}
          variant="outline"
          className="rounded-xl glass gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          <span>{locale === "ar" ? "تحديث البيانات" : "Refresh"}</span>
        </Button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Link
                href={card.href}
                className="group relative block glass rounded-2xl p-5 shadow-layered border border-border/60 transition-all duration-300 hover:-translate-y-1 hover:border-brass/40"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {card.title}
                  </span>
                  <div className={`p-2.5 rounded-xl border ${card.color}`}>
                    <Icon className="size-5" />
                  </div>
                </div>

                <div className="font-heading text-3xl font-extrabold text-foreground tracking-tight">
                  {card.value}
                </div>

                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
                  <span>{card.subtext}</span>
                  <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-brass rtl:rotate-180" />
                </p>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Action Banner */}
      <div className="glass-strong rounded-2xl p-6 shadow-layered border border-brass/30 bg-gradient-to-r from-brass/10 via-background to-background flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">
            {locale === "ar" ? "إضافة فعالية جديدة" : "Add a New Event"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {locale === "ar"
              ? "أنشئ فعالية قادمة لتمكين الحجز المباشر وإعلام المتابعين باللقاء القادم."
              : "Create an upcoming event to open bookings and notify users on the live site."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            asChild
            className="bg-brass-gradient text-night rounded-full px-6 font-semibold shadow-layered hover:opacity-95"
          >
            <Link href="/admin/events?action=new">
              <Plus className="size-4 me-1.5" />
              {locale === "ar" ? "إنشاء فعالية" : "Create Event"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full glass">
            <Link href="/admin/carousel?action=new">
              {locale === "ar" ? "رفع ملصق" : "Upload Poster"}
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent Bookings Table Preview */}
      <div className="glass rounded-2xl p-6 border border-border/60 shadow-layered space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-brass" />
            <h2 className="font-heading text-lg font-bold text-foreground">
              {locale === "ar" ? "أحدث الحجوزات المسجلة" : "Recent Booking Submissions"}
            </h2>
          </div>

          <Button asChild variant="ghost" size="sm" className="text-xs font-semibold text-brass">
            <Link href="/admin/bookings">
              {locale === "ar" ? "عرض الكل ←" : "View All →"}
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
            {locale === "ar" ? "جاري تحميل البيانات..." : "Loading submissions..."}
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {locale === "ar"
              ? "لا توجد حجوزات مسجلة بعد في قاعدة البيانات."
              : "No booking submissions recorded in the database yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground text-xs uppercase">
                  <th className="py-3 px-4 text-start font-semibold">
                    {locale === "ar" ? "اسم المحجوز له" : "Full Name"}
                  </th>
                  <th className="py-3 px-4 text-start font-semibold">
                    {locale === "ar" ? "الفعالية" : "Event"}
                  </th>
                  <th className="py-3 px-4 text-start font-semibold">
                    {locale === "ar" ? "المعلومات" : "Contact"}
                  </th>
                  <th className="py-3 px-4 text-start font-semibold">
                    {locale === "ar" ? "التذاكر" : "Quantity"}
                  </th>
                  <th className="py-3 px-4 text-start font-semibold">
                    {locale === "ar" ? "تاريخ الحجز" : "Submitted"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      {b.fullName}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {locale === "ar" ? b.event.titleAr : b.event.titleEn}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground dir-ltr text-start">
                      <div>{b.email}</div>
                      <div className="text-xs text-muted-foreground/80">{b.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brass/10 text-brass border border-brass/20">
                        {b.quantity} {locale === "ar" ? "تذاكر" : "tickets"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(b.createdAt).toLocaleDateString(
                          locale === "ar" ? "ar-MA" : "en-US",
                          { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
