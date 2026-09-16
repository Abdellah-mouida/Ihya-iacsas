"use client";

import { motion } from "framer-motion";
import { Mail, RefreshCw, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { deleteContactMessage, getContactMessages } from "@/app/actions/contacts";
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
          ? "هل أنت تأكد من رغبتك في حذف هذه الرسالة؟"
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {locale === "ar" ? "رسائل التواصل" : "Contact Submissions"}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {locale === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : messages.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          {locale === "ar"
            ? "لا توجد رسائل تواصل حالياً."
            : "No contact messages found."}
        </p>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid gap-4"
        >
          {messages.map((record) => (
            <div
              key={record.id}
              className="p-4 border rounded-xl bg-card shadow-sm space-y-3"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <User className="h-4 w-4 text-brass" />
                    <span>{record.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 text-brass" />
                    <a
                      href={`mailto:${record.email}`}
                      className="hover:underline"
                    >
                      {record.email}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(record.createdAt).toLocaleDateString(locale)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(record.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm bg-muted/40 p-3 rounded-lg whitespace-pre-wrap">
                {record.message}
              </p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}