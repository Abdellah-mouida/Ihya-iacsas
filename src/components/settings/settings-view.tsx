"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { UserAccountData, updateUserProfile } from "@/app/actions/account";
import { changePassword } from "@/app/actions/auth";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import { MOROCCAN_CITIES } from "@/lib/moroccan-cities";
import { ProfileTagEditor } from "@/components/settings/profile-tag-editor";
import { ImageCropperDialog } from "@/components/common/image-cropper-dialog";
import { PatternCover } from "@/components/common/pattern-cover";
import { getLastNonSettingsPath } from "@/components/common/route-history-tracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Palette,
  Globe2,
  Shield,
  Upload,
  CheckCircle2,
  KeyRound,
  Trash2,
  LogOut,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

import { ThemeDto } from "@/lib/theme-constants";

interface SettingsViewProps {
  initialData: UserAccountData;
  initialTab?: string;
  availableThemes?: ThemeDto[];
}

const DEFAULT_COVER_PRESETS = [
  { id: "default", nameAr: "افتراضي", nameEn: "Default", path: "/patterns/girih.svg" },
  { id: "mandala", nameAr: "ماندالا", nameEn: "Mandala", path: "/patterns/mandala.svg" },
  { id: "octagon", nameAr: "مثمن", nameEn: "Octagon", path: "/patterns/octagon-tile.svg" },
];

export function SettingsView({
  initialData,
  initialTab = "profile",
  availableThemes = [],
}: SettingsViewProps) {
  const { t, locale, setLocale, dir } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (initialTab === "themes" || initialTab === "appearance") return "themes";
    if (initialTab === "language") return "language";
    if (initialTab === "privacy" || initialTab === "security") return "privacy";
    return "profile";
  });

  const [userData, setUserData] = useState(initialData.user);
  const [isPending, startTransition] = useTransition();

  // Profile Form States
  const [name, setName] = useState(userData.name || "");
  const [city, setCity] = useState(userData.city || "");
  const [age, setAge] = useState(userData.age ? String(userData.age) : "");
  const [bio, setBio] = useState(userData.bio || "");
  const [studyLevel, setStudyLevel] = useState(userData.studyLevel || "");
  const [institution, setInstitution] = useState(userData.institution || "");
  const [interests, setInterests] = useState<string[]>(userData.interests || []);
  const [skills, setSkills] = useState<string[]>(userData.skills || []);
  const [languages, setLanguages] = useState<string[]>(userData.languages || []);
  const [volunteerAreas, setVolunteerAreas] = useState<string[]>(userData.volunteerAreas || []);

  // Avatar & Cover States
  const [avatarUrl, setAvatarUrl] = useState(userData.image || "");
  const [coverUrl, setCoverUrl] = useState(userData.coverImage || "/patterns/girih.svg");
  const [isAvatarCropOpen, setIsAvatarCropOpen] = useState(false);
  const [rawAvatarSrc, setRawAvatarSrc] = useState<string | null>(null);
  const [isCoverCropOpen, setIsCoverCropOpen] = useState(false);
  const [rawCoverSrc, setRawCoverSrc] = useState<string | null>(null);

  // Security Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.replace(`/settings?tab=${tab}`, { scroll: false });
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("city", city);
      formData.set("age", age);
      formData.set("bio", bio);
      formData.set("studyLevel", studyLevel);
      formData.set("institution", institution);
      formData.set("interests", JSON.stringify(interests));
      formData.set("skills", JSON.stringify(skills));
      formData.set("languages", JSON.stringify(languages));
      formData.set("volunteerAreas", JSON.stringify(volunteerAreas));

      const res = await updateUserProfile(formData, locale);
      if (res.success && res.user) {
        notify.success(isAr ? "تم تحديث الملف الشخصي بنجاح" : "Profile updated successfully");
      } else {
        notify.error(res.error || (isAr ? "حدث خطأ أثناء الحفظ" : "Save failed"));
      }
    });
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawAvatarSrc(reader.result as string);
      setIsAvatarCropOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawCoverSrc(reader.result as string);
      setIsCoverCropOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAvatarCropped = async (cropped: { file: File }) => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", cropped.file);
        formData.append("folder", "avatars");

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          setAvatarUrl(data.url);
          const profileForm = new FormData();
          profileForm.set("image", data.url);
          if (data.publicId) profileForm.set("imagePublicId", data.publicId);
          await updateUserProfile(profileForm, locale);
          notify.success(isAr ? "تم تحديث الصورة الشخصية" : "Profile photo updated");
        }
      } catch {
        notify.error(isAr ? "فشل رفع الصورة" : "Photo upload failed");
      }
    });
  };

  const handleCoverCropped = async (cropped: { file: File }) => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", cropped.file);
        formData.append("folder", "covers");

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          setCoverUrl(data.url);
          await fetch("/api/user/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coverImage: data.url, coverImagePublicId: data.publicId }),
          });
          notify.success(isAr ? "تم تحديث الغلاف بنجاح" : "Cover updated successfully");
        }
      } catch {
        notify.error(isAr ? "فشل رفع الغلاف" : "Cover upload failed");
      }
    });
  };

  const handleSelectDefaultCover = async (path: string) => {
    setCoverUrl(path);
    await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverImage: path, coverImagePublicId: null }),
    });
    notify.success(isAr ? "تم تعيين الغلاف الافتراضي" : "Default cover set");
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      notify.error(isAr ? "يرجى إدخال كلمة المرور الحالية" : "Current password required");
      return;
    }
    if (newPassword.length < 8) {
      notify.error(isAr ? "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل" : "Password must be at least 8 chars");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      notify.error(isAr ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("currentPassword", currentPassword);
      formData.set("newPassword", newPassword);
      formData.set("confirmNewPassword", confirmNewPassword);

      const res = await changePassword(formData, locale);
      if (res.success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        notify.success(isAr ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully");
      } else {
        notify.error(res.error || (isAr ? "فشل تغيير كلمة المرور" : "Failed to change password"));
      }
    });
  };

  const [backPath, setBackPath] = useState("/");

  useEffect(() => {
    // shortcut: In-memory tracker resets to "/" on full page reload.
    // Upgrade path: Store and validate a `?from=` query parameter.
    setBackPath(getLastNonSettingsPath());
  }, []);

  return (
    <div className="space-y-8" data-testid="settings-view-container">
      {/* Back Link to Last Non-Settings Page */}
      <div>
        <Link
          href={backPath}
          data-testid="settings-back-link"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-heading font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          {isAr ? (
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          ) : (
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          )}
          <span>{isAr ? "الرجوع للصفحة السابقة" : "Back"}</span>
        </Link>
      </div>

      {/* Settings Header */}
      <div className="border-b border-border/60 pb-6">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
          {isAr ? "إعدادات الحساب والمظهر" : "Settings & Preferences"}
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          {isAr
            ? "تحكم في بياناتك الشخصية، السمة اللونية، اللغة، وإعدادات الخصوصية والأمان"
            : "Manage your personal profile, color themes, display language, and privacy settings"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Side Navigation (Desktop) & Sticky Segmented Bar (Mobile) */}
        <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24">
          <nav
            role="tablist"
            className="flex lg:flex-col gap-1.5 p-1.5 rounded-2xl border border-border/80 bg-card/70 backdrop-blur-xl shadow-sm overflow-x-auto no-scrollbar"
          >
            {[
              { id: "profile", label: isAr ? "تعديل الملف" : "Edit Profile", icon: User },
              { id: "themes", label: isAr ? "السمات" : "Themes", icon: Palette },
              { id: "language", label: isAr ? "اللغة" : "Language", icon: Globe2 },
              { id: "privacy", label: isAr ? "الخصوصية والأمان" : "Privacy & Security", icon: Shield },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  role="tab"
                  id={`tab-${item.id}-btn`}
                  aria-selected={isSelected}
                  data-testid={`settings-tab-${item.id}-btn`}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-heading font-semibold transition-all whitespace-nowrap ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Panel */}
        <div className="flex-1 w-full min-w-0">
          {/* TAB 1: EDIT PROFILE */}
          {activeTab === "profile" && (
            <div
              id="settings-profile-section"
              data-testid="settings-profile-section"
              className="p-6 sm:p-10 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-sm space-y-8"
            >
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">
                  {isAr ? "الملف الشخصي والصور" : "Personal Profile & Imagery"}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {isAr
                    ? "حدّث صورتك الشخصية، غلاف حسابك، وبياناتك الشخصية والأكاديمية"
                    : "Update your avatar, profile cover banner, and academic background"}
                </p>
              </div>

              {/* Cover Banner Selection */}
              <div className="space-y-4">
                <Label className="text-xs font-semibold text-foreground">
                  {isAr ? "غلاف الملف الشخصي" : "Profile Cover"}
                </Label>
                <div className="relative h-44 rounded-2xl overflow-hidden border border-border/70 bg-muted/40">
                  <PatternCover coverUrl={coverUrl} alt="Cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-3 opacity-90 hover:opacity-100 transition-opacity">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card/90 backdrop-blur text-foreground text-xs font-semibold hover:bg-card">
                      <Upload className="size-3.5 text-primary" />
                      <span>{isAr ? "رفع غلاف مخصص" : "Upload Custom"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleCoverFile}
                      />
                    </label>
                  </div>
                </div>

                {/* Default Cover Option */}
                <div className="flex items-center justify-between pt-1">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground block">
                      {isAr ? "الغلاف الافتراضي" : "Default Pattern Cover"}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      {isAr ? "نمط هندسي إسلامي يتغير لونه تلقائياً مع السمة" : "Islamic geometric pattern automatically matching active theme"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant={coverUrl === "/patterns/girih.svg" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => handleSelectDefaultCover("/patterns/girih.svg")}
                    data-testid="default-cover-btn"
                    className="rounded-xl text-xs font-heading font-medium"
                  >
                    {isAr ? "استخدام النمط الافتراضي" : "Use Default Pattern"}
                  </Button>
                </div>
              </div>

              {/* Avatar Selection */}
              <div className="space-y-4 pt-4 border-t border-border/60">
                <Label className="text-xs font-semibold text-foreground">
                  {isAr ? "الصورة الشخصية" : "Profile Avatar"}
                </Label>
                <div className="flex items-center gap-5">
                  <div className="relative size-20 rounded-full border-2 border-border overflow-hidden bg-muted/40 shrink-0">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center font-heading font-bold text-lg text-primary">
                        IH
                      </div>
                    )}
                  </div>

                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted/50 text-xs font-semibold text-foreground transition-colors">
                    <Upload className="size-3.5 text-primary" />
                    <span>{isAr ? "تغيير الصورة الشخصية" : "Change Avatar"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleAvatarFile}
                    />
                  </label>
                </div>
              </div>

              {/* Main Profile Info Form */}
              <form onSubmit={handleProfileSubmit} className="space-y-5 pt-4 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">{isAr ? "الاسم الكامل" : "Full Name"}</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">{isAr ? "المدينة" : "City"}</Label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground"
                    >
                      <option value="">{isAr ? "اختر مدينتك..." : "Select city..."}</option>
                      {MOROCCAN_CITIES.map((c) => (
                        <option key={c.id} value={isAr ? c.nameAr : c.nameEn}>
                          {isAr ? c.nameAr : c.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">{isAr ? "العمر" : "Age"}</Label>
                    <Input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      min={10}
                      max={120}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">{isAr ? "المستوى الدراسي" : "Study Level"}</Label>
                    <Input
                      value={studyLevel}
                      onChange={(e) => setStudyLevel(e.target.value)}
                      placeholder={isAr ? "مثال: بكالوريا، ماستر، إجازة..." : "e.g. Master, Bachelor..."}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? "المؤسسة التعليمية" : "Institution"}</Label>
                  <Input
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder={isAr ? "مثال: جامعة محمد الخامس..." : "e.g. Mohammed V University..."}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? "نبذة قصيرة" : "Short Bio"}</Label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    maxLength={280}
                    placeholder={isAr ? "بضع كلمات عن أهدافك وطموحاتك..." : "A few words about your goals..."}
                    className="mt-1 text-sm resize-none"
                  />
                </div>

                {/* Tag Editors */}
                <div className="pt-4 space-y-4">
                  <ProfileTagEditor
                    label={isAr ? "الاهتمامات" : "Interests"}
                    tags={interests}
                    onChange={setInterests}
                    maxTags={8}
                    maxTagLength={30}
                    placeholder={isAr ? "أضف اهتماماً..." : "Add interest..."}
                    testIdPrefix="settings-interests"
                  />

                  <ProfileTagEditor
                    label={isAr ? "المهارات" : "Skills"}
                    tags={skills}
                    onChange={setSkills}
                    maxTags={8}
                    maxTagLength={30}
                    placeholder={isAr ? "أضف مهارة..." : "Add skill..."}
                    testIdPrefix="settings-skills"
                  />

                  <ProfileTagEditor
                    label={isAr ? "اللغات" : "Languages"}
                    tags={languages}
                    onChange={setLanguages}
                    maxTags={6}
                    maxTagLength={30}
                    placeholder={isAr ? "أضف لغة..." : "Add language..."}
                    testIdPrefix="settings-languages"
                  />

                  <ProfileTagEditor
                    label={isAr ? "مجالات التطوع" : "Volunteer Areas"}
                    tags={volunteerAreas}
                    onChange={setVolunteerAreas}
                    maxTags={6}
                    maxTagLength={30}
                    placeholder={isAr ? "أضف مجالاً..." : "Add area..."}
                    testIdPrefix="settings-volunteer"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={isPending}
                    data-testid="settings-save-profile-btn"
                    className="rounded-xl px-8 font-heading font-semibold"
                  >
                    {isPending ? (isAr ? "جاري الحفظ..." : "Saving...") : isAr ? "حفظ التغييرات" : "Save Changes"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: THEMES (Exactly 4 Themes) */}
          {activeTab === "themes" && (
            <div
              id="settings-themes-section"
              data-testid="settings-themes-section"
              className="p-6 sm:p-10 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-sm space-y-8"
            >
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">
                  {isAr ? "السمات والمظهر البصري" : "Themes & Appearance"}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {isAr
                    ? "اختر السمة البصرية المفضلة لديك من بين الأنماط الرسمية الأربعة"
                    : "Select your preferred visual appearance from the four official themes"}
                </p>
              </div>

              {/* Themes Card Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {((availableThemes && availableThemes.length > 0)
                  ? availableThemes
                  : [
                      {
                        id: "light",
                        slug: "light",
                        nameAr: "فاتح",
                        nameEn: "Light",
                        mode: "light" as const,
                        tokens: {
                          "--background": "#ffffff",
                          "--foreground": "#1a1a1a",
                          "--heading": "#1a1a1a",
                          "--primary": "#0a5417",
                          "--title-secondary": "#b8860b",
                        },
                      },
                      {
                        id: "sunset",
                        slug: "sunset",
                        nameAr: "غروب",
                        nameEn: "Sunset",
                        mode: "light" as const,
                        tokens: {
                          "--background": "#fbf4eb",
                          "--foreground": "#3e2723",
                          "--heading": "#3e2723",
                          "--primary": "#c85a17",
                          "--title-secondary": "#d97706",
                        },
                      },
                      {
                        id: "amoled",
                        slug: "amoled",
                        nameAr: "Amoled",
                        nameEn: "Amoled",
                        mode: "dark" as const,
                        tokens: {
                          "--background": "#000000",
                          "--foreground": "#f5f5f5",
                          "--heading": "#22c55e",
                          "--primary": "#22c55e",
                          "--title-secondary": "#eab308",
                        },
                      },
                      {
                        id: "black",
                        slug: "black",
                        nameAr: "أسود",
                        nameEn: "Black",
                        mode: "dark" as const,
                        tokens: {
                          "--background": "#111111",
                          "--foreground": "#f5f5f5",
                          "--heading": "#eab308",
                          "--primary": "#eab308",
                          "--title-secondary": "#22c55e",
                        },
                      },
                    ]
                ).map((th) => {
                  const slug = th.slug;
                  const displayName = isAr ? th.nameAr : th.nameEn;
                  const isDark = th.mode === "dark";
                  const tokens = (th.tokens as Record<string, string>) || {};
                  const bg = tokens["--background"] || (isDark ? "#111111" : "#ffffff");
                  const headingColor = tokens["--heading"] || tokens["--foreground"] || (isDark ? "#f5f5f5" : "#1a1a1a");
                  const primaryColor = tokens["--primary"] || (isDark ? "#eab308" : "#0a5417");
                  const secondaryColor = tokens["--title-secondary"] || tokens["--gold"] || (isDark ? "#22c55e" : "#b8860b");

                  const isCurrentTheme =
                    (slug === "light" && (!theme || theme === "light" || (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light"))) ||
                    (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === slug) ||
                    (slug === "black" && theme === "dark" && typeof document !== "undefined" && (!document.documentElement.getAttribute("data-theme") || document.documentElement.getAttribute("data-theme") === "black"));

                  return (
                    <button
                      key={slug}
                      type="button"
                      data-testid={`theme-card-${slug}`}
                      onClick={async () => {
                        setTheme(isDark ? "dark" : "light");
                        document.documentElement.setAttribute("data-theme", slug);
                        try {
                          localStorage.setItem("ihyaa-theme", slug);
                          document.cookie = `ihyaa-theme=${slug}; path=/; max-age=31536000; SameSite=Lax`;
                          await fetch("/api/user/preferences", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ theme: slug }),
                          });
                        } catch {}
                        notify.success(displayName);
                      }}
                      style={{
                        backgroundColor: bg,
                      }}
                      className={`theme-btn-hover relative text-start p-6 rounded-2xl border flex flex-col justify-between h-40 shadow-sm ${
                        isCurrentTheme
                          ? "border-primary ring-2 ring-primary/40 shadow-md shadow-primary/10"
                          : isDark
                            ? "border-white/15"
                            : "border-black/10"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className="font-heading font-bold text-lg"
                          style={{ color: headingColor }}
                        >
                          {displayName}
                        </span>
                        {isCurrentTheme && (
                          <CheckCircle2 className="size-5 text-primary shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 pt-3 border-t border-black/10 dark:border-white/10 w-full">
                        <span
                          className="size-4 rounded-full shadow-sm"
                          style={{ backgroundColor: primaryColor }}
                        />
                        <span
                          className="size-4 rounded-full shadow-sm"
                          style={{ backgroundColor: secondaryColor }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: LANGUAGE (Only "العربية" and "English") */}
          {activeTab === "language" && (
            <div
              id="settings-language-section"
              data-testid="settings-language-section"
              className="p-6 sm:p-10 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-sm space-y-8"
            >
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">
                  {isAr ? "اللغة المفضلة" : "Language Preferences"}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {isAr
                    ? "اختر اللغة المعتمدة لعرض المحتوى والواجهة"
                    : "Choose your preferred interface and display language"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                {[
                  { code: "ar", label: "العربية" },
                  { code: "en", label: "English" },
                ].map((lang) => {
                  const isLangSelected = locale === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      data-testid={`settings-lang-${lang.code}-btn`}
                      onClick={async () => {
                        setLocale(lang.code as "ar" | "en");
                        try {
                          localStorage.setItem("ihyaa-locale", lang.code);
                          document.cookie = `ihyaa-locale=${lang.code}; path=/; max-age=31536000; SameSite=Lax`;
                          await fetch("/api/user/preferences", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ locale: lang.code }),
                          });
                        } catch {}
                        notify.success(lang.label);
                      }}
                      className={`p-5 rounded-2xl border text-start flex items-center justify-between font-heading font-bold text-base transition-all ${
                        isLangSelected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                          : "border-border/70 hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <span>{lang.label}</span>
                      {isLangSelected && <CheckCircle2 className="size-5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PRIVACY & DATA */}
          {activeTab === "privacy" && (
            <div
              id="settings-privacy-section"
              data-testid="settings-privacy-section"
              className="p-6 sm:p-10 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-sm space-y-10"
            >
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">
                  {isAr ? "الخصوصية والأمان" : "Privacy & Security"}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {isAr
                    ? "تغيير كلمة المرور، تصدير البيانات الشخصية، وإدارة سرية الحساب"
                    : "Change password, export account data, and review privacy options"}
                </p>
              </div>

              {/* Password Change Form */}
              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
                <h3 className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" />
                  <span>{isAr ? "تغيير كلمة المرور" : "Change Password"}</span>
                </h3>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? "كلمة المرور الحالية" : "Current Password"}</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? "كلمة المرور الجديدة" : "New Password"}</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</Label>
                  <Input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl font-heading font-semibold"
                >
                  {isPending ? (isAr ? "جاري التحديث..." : "Updating...") : isAr ? "تحديث كلمة المرور" : "Update Password"}
                </Button>
              </form>

              {/* Data Inquiries Notice */}
              <div className="pt-6 border-t border-border/60 space-y-2">
                <h3 className="text-sm font-heading font-bold text-foreground">
                  {isAr ? "البيانات الشخصية والخصوصية" : "Personal Data & Privacy"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-xl">
                  {isAr
                    ? "وفقاً لسياسة الخصوصية، يمكنك في أي وقت طلب نسخة من بياناتك أو طلب تصحيحها أو حذفها بالتواصل المباشر مع إدارة البرنامج عبر وسائل الاتصال المعتمدة."
                    : "In accordance with our Privacy Policy, you may request a copy of your personal data, corrections, or deletion at any time by contacting the program administrators directly."}
                </p>
              </div>

              {/* Legal Links */}
              <div className="pt-6 border-t border-border/60 flex flex-wrap gap-4 text-xs">
                <Link
                  href="/privacy"
                  className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <span>{isAr ? "سياسة الخصوصية" : "Privacy Policy"}</span>
                  <ExternalLink className="size-3" />
                </Link>
                <Link
                  href="/terms"
                  className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <span>{isAr ? "شروط الخدمة والاستخدام" : "Terms of Service"}</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>

              {/* Sign Out */}
              <div className="pt-6 border-t border-border/60 flex justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  data-testid="settings-signout-btn"
                  className="rounded-xl font-heading font-semibold text-xs gap-2"
                >
                  <LogOut className="size-4" />
                  <span>{isAr ? "تسجيل الخروج من الحساب" : "Sign Out"}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cropper Dialogs */}
      {rawAvatarSrc && (
        <ImageCropperDialog
          open={isAvatarCropOpen}
          onOpenChange={(open) => {
            setIsAvatarCropOpen(open);
            if (!open) setRawAvatarSrc(null);
          }}
          imageSrc={rawAvatarSrc}
          cropShape="round"
          aspect={1}
          onCropComplete={handleAvatarCropped}
        />
      )}

      {rawCoverSrc && (
        <ImageCropperDialog
          open={isCoverCropOpen}
          onOpenChange={(open) => {
            setIsCoverCropOpen(open);
            if (!open) setRawCoverSrc(null);
          }}
          imageSrc={rawCoverSrc}
          aspect={16 / 9}
          onCropComplete={handleCoverCropped}
        />
      )}
    </div>
  );
}
