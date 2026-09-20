"use client";

import { motion } from "framer-motion";
import {
  Clock,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { deleteContactMessage, getContactMessages } from "@/app/actions/contacts";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";

type ContactRecord = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
};

export default function AdminContactsPage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ContactRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const res = await getContactMessages();

    if (res.success && res.messages) {
      setMessages(res.messages as ContactRecord[]);
    } else if (res.error) {
      toast.error(res.error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        locale === "ar"
          ? "هل أنت متأكد من رغبتك في حذف هذه الرسالة؟"
          : "Are you sure you want to delete this contact message?",
      )
    ) {
      return;
    }

    setMessages((prev) => prev.filter((m) => m.id !== id));
    const res = await deleteContactMessage(id);
    if (res.success) {
      toast.success(
        locale === "ar" ? "تم حذف الرسالة بنجاح" : "Contact message deleted",
      );
    } else {
      toast.error(res.error || "Failed to delete message");
      fetchData();
    }
  };

  const filtered = messages.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-500 font-semibold text-xs uppercase tracking-wider mb-1 shrink-0">
            <MessageSquare className="size-4 shrink-0" />
            <span className="whitespace-nowrap">
              {locale === "ar" ? "تواصل الزوار" : "Contact Inquiries"}
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight whitespace-nowrap">
            {locale === "ar" ? "رسائل التواصل الواردة" : "Visitor Messages"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {locale === "ar"
              ? "متابعة واستعراض الرسائل والاستفسارات المرسلة من زوار الموقع."
              : "Review and manage inquiries received from the public contact form."}
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
            {locale === "ar" ? "تحديث" : "Refresh"}
          </span>
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="glass rounded-2xl p-4 sm:p-5 border border-border/60 shadow-layered flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              locale === "ar"
                ? "بحث بالاسم، البريد، أو محتوى الرسالة..."
                : "Search by name, email, or message content..."
            }
            className="w-full rounded-xl border border-border bg-background/50 ps-10 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="glass px-3.5 py-2 rounded-full border border-border/60 flex items-center gap-2">
            <Mail className="size-4 text-brass shrink-0" />
            <span>
              {locale === "ar"
                ? `إجمالي الرسائل: ${filtered.length}`
                : `Total Messages: ${filtered.length}`}
            </span>
          </span>
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <IslamicLoader
            message={
              locale === "ar"
                ? "جاري تحميل الرسائل..."
                : "Loading messages..."
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center space-y-4">
          <Mail className="size-12 text-brass/50 mx-auto shrink-0" />
          <h3 className="font-heading text-lg font-bold text-foreground">
            {locale === "ar" ? "لا توجد رسائل واردة" : "No Messages Found"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {searchQuery
              ? locale === "ar"
                ? "لا توجد رسائل تطابق معايير البحث."
                : "No messages match your search criteria."
              : locale === "ar"
              ? "ستظهر هنا أي رسالة جديدة يرسلها الزوار من نموذج التواصل في الصفحة الرئيسية."
              : "Messages submitted via the contact form on the home page will appear here."}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid gap-4"
        >
          {filtered.map((record) => (
            <div
              key={record.id}
              className="glass rounded-2xl p-5 border border-border/60 shadow-layered space-y-3 hover:border-brass/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    <User className="size-4 text-brass" />
                    <span>{record.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground dir-ltr">
                    <Mail className="size-3.5 text-brass" />
                    <a
                      href={`mailto:${record.email}`}
                      className="hover:text-brass hover:underline"
                    >
                      {record.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-brass shrink-0" />
                    <span>
                      {new Date(record.createdAt).toLocaleDateString(
                        locale === "ar" ? "ar-MA" : "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(record.id)}
                    className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <p className="text-sm bg-muted/40 p-4 rounded-xl whitespace-pre-wrap leading-relaxed border border-border/40">
                {record.message}
              </p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
