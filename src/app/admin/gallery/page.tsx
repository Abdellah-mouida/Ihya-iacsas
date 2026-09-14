"use client";

import { motion } from "framer-motion";
import {
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  createGalleryPhoto,
  deleteGalleryPhoto,
  getGalleryPhotos,
  updateGalleryPhoto,
} from "@/app/actions/gallery";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";

type GalleryPhoto = {
  id: string;
  imageUrl: string;
  captionAr: string | null;
  captionEn: string | null;
  createdAt: Date;
};

export default function AdminGalleryPage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<GalleryPhoto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchPhotos = async () => {
    setLoading(true);
    const res = await getGalleryPhotos();
    if (res.success && res.photos) {
      setPhotos(res.photos as unknown as GalleryPhoto[]);
    } else if (res.error) {
      toast.error(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        locale === "ar"
          ? "هل أنت تأكد من رغبتك في حذف هذه الصورة من المعرض؟"
          : "Are you sure you want to delete this photo from the gallery?",
      )
    ) {
      return;
    }

    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const res = await deleteGalleryPhoto(id);
    if (res.success) {
      toast.success(locale === "ar" ? "تم حذف الصورة بنجاح" : "Photo deleted successfully");
    } else {
      toast.error(res.error || "Failed to delete photo");
      fetchPhotos();
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
    if (editingPhoto) {
      res = await updateGalleryPhoto(editingPhoto.id, formData);
    } else {
      res = await createGalleryPhoto(formData);
    }

    setSubmitting(false);

    if (res.success) {
      toast.success(
        editingPhoto
          ? locale === "ar"
            ? "تم تحديث الصورة بنجاح"
            : "Photo updated successfully"
          : locale === "ar"
          ? "تم إضافة الصورة الجديدة بنجاح"
          : "Photo added successfully",
      );
      setModalOpen(false);
      setEditingPhoto(null);
      setPreviewUrl(null);
      fetchPhotos();
    } else {
      toast.error(res.error || "Failed to save photo");
    }
  };

  const openAddModal = () => {
    setEditingPhoto(null);
    setPreviewUrl(null);
    setModalOpen(true);
  };

  const openEditModal = (photo: GalleryPhoto) => {
    setEditingPhoto(photo);
    setPreviewUrl(photo.imageUrl);
    setModalOpen(true);
  };

  return (
    <div className="space-y-8 min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-500 font-semibold text-xs uppercase tracking-wider mb-1 shrink-0">
            <ImageIcon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">
              {locale === "ar" ? "ألبوم الصور" : "Moments Gallery"}
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight whitespace-nowrap">
            {locale === "ar" ? "معرض الصور (لحظات)" : "Gallery Management"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {locale === "ar"
              ? "إدارة الصور الموثقة في قسم اللحظات على الصفحة الرئيسية للموقع."
              : "Manage photo moments displayed on the main website gallery."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={fetchPhotos}
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
              {locale === "ar" ? "إضافة صورة" : "Add Photo"}
            </span>
          </Button>
        </div>
      </div>

      {/* Grid of Photos */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground text-sm animate-pulse">
          {locale === "ar" ? "جاري تحميل معرض الصور..." : "Loading gallery photos..."}
        </div>
      ) : photos.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center space-y-4">
          <ImageIcon className="size-12 text-brass/50 mx-auto shrink-0" />
          <h3 className="font-heading text-lg font-bold text-foreground">
            {locale === "ar" ? "لا توجد صور في المعرض" : "No Photos Found"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {locale === "ar"
              ? "قم بإضافة صور جديدة لتظهر في معرض اللحظات بالموقع."
              : "Add new photos to showcase in the website moments gallery."}
          </p>
          <Button onClick={openAddModal} className="bg-brass-gradient text-night rounded-full px-6 text-sm h-10 font-semibold">
            <Plus className="size-4 me-1.5 shrink-0" />
            <span className="whitespace-nowrap">
              {locale === "ar" ? "إضافة أول صورة" : "Add First Photo"}
            </span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {photos.map((photo, index) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass rounded-2xl overflow-hidden border border-border/60 shadow-layered group flex flex-col justify-between min-w-0"
            >
              <div className="relative aspect-[4/3] bg-muted/40 overflow-hidden">
                <Image
                  src={photo.imageUrl}
                  alt={photo.captionAr || "Gallery image"}
                  fill
                  sizes="(max-width: 768px) 100vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              {/* Caption details */}
              <div className="p-4 space-y-1">
                <p className="text-xs font-semibold text-foreground line-clamp-2">
                  {locale === "ar"
                    ? photo.captionAr || photo.captionEn || "بدون عنوان"
                    : photo.captionEn || photo.captionAr || "No caption"}
                </p>
                {photo.captionAr && photo.captionEn && (
                  <p className="text-[0.7rem] text-muted-foreground line-clamp-1 dir-ltr">
                    {photo.captionEn}
                  </p>
                )}
              </div>

              {/* Actions toolbar */}
              <div className="px-4 pb-4 pt-1 flex items-center justify-between border-t border-border/40">
                <span className="text-[0.65rem] text-muted-foreground whitespace-nowrap">
                  {new Date(photo.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(photo)}
                    className="h-8 rounded-lg text-xs glass px-3 font-semibold"
                  >
                    <span className="whitespace-nowrap">
                      {locale === "ar" ? "تعديل" : "Edit"}
                    </span>
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(photo.id)}
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

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-night/60 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong border border-brass/30 rounded-2xl w-full max-w-lg p-6 shadow-layered space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <h2 className="font-heading text-xl font-bold text-foreground whitespace-nowrap">
                {editingPhoto
                  ? locale === "ar"
                    ? "تعديل صورة المعرض"
                    : "Edit Gallery Photo"
                  : locale === "ar"
                  ? "إضافة صورة جديدة"
                  : "Add New Gallery Photo"}
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
              {/* Image Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  {locale === "ar" ? "الصورة" : "Image File or URL"}
                </label>

                {previewUrl && (
                  <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-border/60 bg-muted mb-2">
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      fill
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
                    if (file) setPreviewUrl(URL.createObjectURL(file));
                  }}
                  className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brass/20 file:text-brass hover:file:bg-brass/30 cursor-pointer"
                />

                <input
                  type="url"
                  name="imageUrl"
                  defaultValue={editingPhoto?.imageUrl || ""}
                  placeholder="https://..."
                  onChange={(e) => {
                    if (e.target.value) setPreviewUrl(e.target.value);
                  }}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                />
              </div>

              {/* Caption Arabic */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  {locale === "ar" ? "الوصف (بالعربية)" : "Caption (Arabic)"}
                </label>
                <input
                  type="text"
                  name="captionAr"
                  defaultValue={editingPhoto?.captionAr || ""}
                  placeholder="لحظات إيمانية في لقاء شبابي..."
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                />
              </div>

              {/* Caption English */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  {locale === "ar" ? "الوصف (بالإنجليزية)" : "Caption (English)"}
                </label>
                <input
                  type="text"
                  name="captionEn"
                  defaultValue={editingPhoto?.captionEn || ""}
                  placeholder="Spiritual moments in a youth gathering..."
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass dir-ltr"
                />
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
                    {editingPhoto
                      ? locale === "ar"
                        ? "حفظ التغييرات"
                        : "Save Changes"
                      : locale === "ar"
                      ? "إضافة الصورة"
                      : "Add Photo"}
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
