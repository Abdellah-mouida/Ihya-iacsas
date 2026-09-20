"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  createCarouselPost,
  deleteCarouselPost,
  getCarouselPosts,
  toggleCarouselActive,
  updateCarouselPost,
} from "@/app/actions/carousel";
import { Button } from "@/components/ui/button";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { useLocale } from "@/i18n/locale-provider";

type CarouselItem = {
  id: string;
  imageUrl: string;
  order: number;
  active: boolean;
  createdAt: Date;
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

export default function AdminCarouselPage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<CarouselItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CarouselItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Clean up blob object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const setSafePreviewUrl = (newUrl: string | null) => {
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:") && prev !== newUrl) {
        URL.revokeObjectURL(prev);
      }
      return newUrl;
    });
  };

  const fetchPosts = async () => {
    setLoading(true);
    const res = await getCarouselPosts();
    if (res.success && res.posts) {
      setPosts(res.posts as unknown as CarouselItem[]);
    } else if (res.error) {
      toast.error(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !currentActive } : p)),
    );
    const res = await toggleCarouselActive(id, !currentActive);
    if (res.success) {
      toast.success(
        locale === "ar" ? "تم تحديث حالة الملصق" : "Poster status updated",
      );
    } else {
      toast.error(res.error || "Failed to toggle poster status");
      fetchPosts();
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        locale === "ar"
          ? "هل أنت تأكد من رغبتك في حذف هذا الملصق؟"
          : "Are you sure you want to delete this poster?",
      )
    ) {
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== id));
    const res = await deleteCarouselPost(id);
    if (res.success) {
      toast.success(locale === "ar" ? "تم حذف الملصق بنجاح" : "Poster deleted successfully");
    } else {
      toast.error(res.error || "Failed to delete poster");
      fetchPosts();
    }
  };

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const file = formData.get("image") as File | null;
    const imageUrl = formData.get("imageUrl") as string | null;

    if (!file && !imageUrl) {
      toast.error(locale === "ar" ? "الرجاء اختيار صورة أو إدخال رابط صورة" : "Please select an image file or enter an image URL");
      setSubmitting(false);
      return;
    }

    let res;
    if (editingPost) {
      res = await updateCarouselPost(editingPost.id, formData);
    } else {
      res = await createCarouselPost(formData);
    }

    setSubmitting(false);

    if (res.success) {
      toast.success(
        editingPost
          ? locale === "ar"
            ? "تم تحديث الملصق بنجاح"
            : "Poster updated successfully"
          : locale === "ar"
          ? "تم إضافة الملصق الجديد بنجاح"
          : "Poster created successfully",
      );
      setModalOpen(false);
      setEditingPost(null);
      setSafePreviewUrl(null);
      fetchPosts();
    } else {
      toast.error(res.error || "Failed to save poster");
    }
  };

  const openAddModal = () => {
    setEditingPost(null);
    setSafePreviewUrl(null);
    setModalOpen(true);
  };

  const openEditModal = (post: CarouselItem) => {
    setEditingPost(post);
    setSafePreviewUrl(post.imageUrl);
    setModalOpen(true);
  };

  return (
    <div className="space-y-8 min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brass font-semibold text-xs uppercase tracking-wider mb-1 shrink-0">
            <Sparkles className="size-4 shrink-0" />
            <span className="whitespace-nowrap">
              {locale === "ar" ? "إدارة الواجهة" : "Homepage Showcase"}
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight whitespace-nowrap">
            {locale === "ar" ? "شريط الملصقات (Card Carousel)" : "Carousel Posters"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {locale === "ar"
              ? "تحكم في ملصقات وبطاقات الرحلات المعروضة في الشريط التكراري على الصفحة الرئيسية."
              : "Manage poster cards displayed in the looping homepage carousel."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={fetchPosts}
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
              {locale === "ar" ? "إضافة ملصق" : "Add Poster"}
            </span>
          </Button>
        </div>
      </div>

      {/* Grid of Posters */}
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <IslamicLoader
            message={
              locale === "ar"
                ? "جاري تحميل الملصقات..."
                : "Loading posters..."
            }
          />
        </div>
      ) : posts.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center space-y-4">
          <ImageIcon className="size-12 text-brass/50 mx-auto shrink-0" />
          <h3 className="font-heading text-lg font-bold text-foreground">
            {locale === "ar" ? "لا توجد ملصقات حالياً" : "No Posters Found"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {locale === "ar"
              ? "قم بإضافة ملصق جديد لبيانه في شريط الصفحة الرئيسية."
              : "Add a new poster to display in the main homepage carousel."}
          </p>
          <Button onClick={openAddModal} className="bg-brass-gradient text-night rounded-full px-6 text-sm h-10 font-semibold">
            <Plus className="size-4 me-1.5 shrink-0" />
            <span className="whitespace-nowrap">
              {locale === "ar" ? "إضافة أول ملصق" : "Add First Poster"}
            </span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass rounded-2xl overflow-hidden border border-border/60 shadow-layered group flex flex-col justify-between min-w-0"
            >
              <div className="relative aspect-[4/5] bg-muted/40 overflow-hidden">
                <Image
                  src={post.imageUrl}
                  alt={`Carousel item ${post.order}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Status Badges */}
                <div className="absolute top-3 start-3 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold shadow-md backdrop-blur-md whitespace-nowrap ${
                      post.active
                        ? "bg-emerald-500/80 text-white"
                        : "bg-amber-500/80 text-white"
                    }`}
                  >
                    {post.active ? (
                      <>
                        <CheckCircle2 className="size-3 shrink-0" />
                        <span>{locale === "ar" ? "مفعّل" : "Active"}</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3 shrink-0" />
                        <span>{locale === "ar" ? "مخفي" : "Disabled"}</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="absolute top-3 end-3 bg-night/70 text-white text-xs px-2.5 py-1 rounded-full font-semibold backdrop-blur-md">
                  #{post.order}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="p-4 bg-card/60 border-t border-border/50 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                  {locale === "ar" ? "الترتيب:" : "Order:"} <strong>{post.order}</strong>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(post.id, post.active)}
                    className="h-8 rounded-lg text-xs font-semibold px-2.5"
                    title={post.active ? "Hide" : "Show"}
                  >
                    {post.active ? (
                      <EyeOff className="size-3.5 text-amber-500 shrink-0" />
                    ) : (
                      <Eye className="size-3.5 text-emerald-500 shrink-0" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(post)}
                    className="h-8 rounded-lg text-xs glass px-3 font-semibold"
                  >
                    <span className="whitespace-nowrap">
                      {locale === "ar" ? "تعديل" : "Edit"}
                    </span>
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(post.id)}
                    className="h-8 rounded-lg text-xs px-2.5"
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-night/60 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong border border-brass/30 rounded-2xl w-full max-w-lg p-6 shadow-layered space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <h2 className="font-heading text-xl font-bold text-foreground whitespace-nowrap">
                {editingPost
                  ? locale === "ar"
                    ? "تعديل ملصق الواجهة"
                    : "Edit Carousel Poster"
                  : locale === "ar"
                  ? "إضافة ملصق جديد"
                  : "Add New Carousel Poster"}
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
              {/* Image Upload/URL Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {locale === "ar" ? "الصورة (تحميل أو رابط)" : "Image (Upload or URL)"}
                  </label>
                  <span className="text-[11px] font-medium text-brass/90 bg-brass/10 px-2 py-0.5 rounded-md border border-brass/20">
                    {locale === "ar" ? "المقاس المقترح: 4:5 عمودي (800×1000px)" : "Recommended: 4:5 portrait (800×1000px)"}
                  </span>
                </div>

                {isValidImageUrl(previewUrl) && (
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-border/60 bg-muted mb-2">
                    <Image
                      src={previewUrl!}
                      alt="Preview"
                      fill
                      unoptimized={previewUrl!.startsWith("blob:")}
                      className="object-contain"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const blobUrl = URL.createObjectURL(file);
                        setSafePreviewUrl(blobUrl);
                      }
                    }}
                    className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brass/20 file:text-brass hover:file:bg-brass/30 cursor-pointer"
                  />

                  <div className="text-center text-xs text-muted-foreground my-1">
                    {locale === "ar" ? "أو أدخل رابط صورة مباشر:" : "or enter direct image URL:"}
                  </div>

                  <input
                    type="url"
                    name="imageUrl"
                    defaultValue={editingPost?.imageUrl || ""}
                    placeholder="https://images.unsplash.com/..."
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (isValidImageUrl(val)) {
                        setSafePreviewUrl(val);
                      }
                    }}
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                  />
                </div>
              </div>

              {/* Order input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  {locale === "ar" ? "الترتيب (Position)" : "Display Order"}
                </label>
                <input
                  type="number"
                  name="order"
                  defaultValue={editingPost?.order ?? posts.length}
                  required
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="activeToggle"
                  name="active"
                  defaultChecked={editingPost ? editingPost.active : true}
                  className="size-4 rounded border-border text-brass focus:ring-brass"
                />
                <label
                  htmlFor="activeToggle"
                  className="text-sm font-semibold text-foreground cursor-pointer"
                >
                  {locale === "ar" ? "تفعيل العرض في الواجهة" : "Active / Visible on Home"}
                </label>
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
                    {editingPost
                      ? locale === "ar"
                        ? "حفظ التغييرات"
                        : "Save Changes"
                      : locale === "ar"
                      ? "إضافة الملصق"
                      : "Add Poster"}
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
