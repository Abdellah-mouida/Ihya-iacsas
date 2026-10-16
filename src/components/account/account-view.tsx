"use client";

import React, { useState, useTransition, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  User,
  Calendar,
  Shield,
  CheckCircle2,
  Clock,
  ListOrdered,
  XCircle,
  MapPin,
  Camera,
  Trash2,
  LogOut,
  ExternalLink,
  CalendarX2,
  Sparkles,
  GraduationCap,
  Building2,
  Heart,
  Wrench,
  Globe2,
  HandHeart,
} from "lucide-react";

import {
  AccountBookingItem,
  UserAccountData,
  updateUserProfile,
  cancelUserBooking,
} from "@/app/actions/account";
import { changePassword } from "@/app/actions/auth";
import { CityCombobox } from "@/components/common/city-combobox";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProfileTagEditor } from "@/components/account/profile-tag-editor";
import { IMAGES } from "@/lib/content";
import { useLocale } from "@/i18n/locale-provider";
import { validatePasswordStrength } from "@/lib/password";
import { notify } from "@/lib/toast";
import { ImageCropperDialog } from "@/components/common/image-cropper-dialog";

const INTEREST_PRESETS = {
  en: ["Camping", "Hiking", "Photography", "Reading", "Technology", "Sports", "Nature"],
  ar: ["التخييم", "المشي الجبلي", "التصوير", "القراءة", "التكنولوجيا", "الرياضة", "الطبيعة"],
};

const SKILL_PRESETS = {
  en: ["First Aid", "Leadership", "Cooking", "Graphic Design", "Video Editing", "Public Speaking", "Teaching"],
  ar: ["الإسعافات الأولية", "القيادة", "الطبخ", "التصميم", "المونتاج", "الخطابة", "التعليم"],
};

const LANGUAGE_PRESETS = {
  en: ["Arabic", "French", "English", "Amazigh", "Spanish", "German"],
  ar: ["العربية", "الفرنسية", "الإنجليزية", "الأمازيغية", "الإسبانية", "الألمانية"],
};

const VOLUNTEER_PRESETS = {
  en: ["Logistics", "Media & Press", "First Aid", "Youth Coaching", "Camp Organization", "Kitchen & Catering"],
  ar: ["اللوجستيك والتنظيم", "الإعلام والتوثيق", "الإسعافات", "تأطير الشباب", "المطبخ والتموين", "الاستقبال والضيافة"],
};

interface AccountViewProps {
  initialData: UserAccountData;
}

type TabType = "profile" | "bookings" | "security";

export function AccountView({ initialData }: AccountViewProps) {
  const { t, locale } = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update: updateSession } = useSession();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const initialTab = (searchParams.get("tab") as TabType) || "profile";
  const [activeTab, setActiveTab] = useState<TabType>(
    ["profile", "bookings", "security"].includes(initialTab) ? initialTab : "profile",
  );

  // User state
  const [userData, setUserData] = useState(initialData.user);
  const [bookings, setBookings] = useState<AccountBookingItem[]>(initialData.bookings);

  // Profile Form state
  const [name, setName] = useState(userData.name || "");
  const [city, setCity] = useState(userData.city || "");
  const [age, setAge] = useState(userData.age ? String(userData.age) : "");
  const [profileImage, setProfileImage] = useState<string | null>(userData.image);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawCropImage, setRawCropImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optional Profile Details state (Task 9)
  const [bio, setBio] = useState(userData.bio || "");
  const [studyLevel, setStudyLevel] = useState(userData.studyLevel || "");
  const [institution, setInstitution] = useState(userData.institution || "");
  const [interests, setInterests] = useState<string[]>(userData.interests || []);
  const [skills, setSkills] = useState<string[]>(userData.skills || []);
  const [languages, setLanguages] = useState<string[]>(userData.languages || []);
  const [volunteerAreas, setVolunteerAreas] = useState<string[]>(userData.volunteerAreas || []);

  // Security Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [isPending, startTransition] = useTransition();
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  const passwordRules = validatePasswordStrength(newPassword);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.replace(`/account?tab=${tab}`, { scroll: false });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      notify.error(t("account.errPhotoTooLarge"));
      e.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setRawCropImage(objectUrl);
    setCropperOpen(true);
    e.target.value = "";
  };

  const handleCropComplete = (result: { file: File; blobUrl: string }) => {
    setImageFile(result.file);
    setRemoveImage(false);
    setProfileImage(result.blobUrl);
  };

  const handleRemovePhoto = () => {
    setImageFile(null);
    setRemoveImage(true);
    setProfileImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      notify.error(t("account.errNameRequired"));
      return;
    }
    if (!city) {
      notify.error(t("account.errCityRequired"));
      return;
    }
    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 10 || ageNum > 120) {
      notify.error(t("account.errAgeRequired"));
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("city", city);
      formData.set("age", String(ageNum));
      formData.set("removeImage", removeImage ? "true" : "false");
      if (imageFile) {
        formData.set("image", imageFile);
      }

      // Optional Profile Details
      formData.set("bio", bio);
      formData.set("studyLevel", studyLevel);
      formData.set("institution", institution);
      formData.set("interests", JSON.stringify(interests));
      formData.set("skills", JSON.stringify(skills));
      formData.set("languages", JSON.stringify(languages));
      formData.set("volunteerAreas", JSON.stringify(volunteerAreas));

      const res = await updateUserProfile(formData, locale);
      if (res.success && res.user) {
        setUserData((prev) => ({
          ...prev,
          name: res.user!.name,
          city: res.user!.city,
          age: res.user!.age,
          image: res.user!.image,
          bio: res.user!.bio,
          studyLevel: res.user!.studyLevel,
          institution: res.user!.institution,
          interests: res.user!.interests,
          skills: res.user!.skills,
          languages: res.user!.languages,
          volunteerAreas: res.user!.volunteerAreas,
        }));
        setProfileImage(res.user.image);
        setImageFile(null);
        setRemoveImage(false);

        await updateSession({
          name: res.user.name,
          city: res.user.city,
          age: res.user.age,
          image: res.user.image,
        });

        notify.success(t("account.profileUpdated"));
      } else {
        notify.error(res.error || t("account.errLoadAccount"));
      }
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      notify.error(t("auth.currentPasswordLabel"));
      return;
    }
    if (!passwordRules.valid) {
      notify.error(t("auth.errPasswordShort"));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      notify.error(t("auth.errPasswordMismatch"));
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
        notify.success(t("account.passwordUpdated"));
      } else {
        notify.error(res.error || t("auth.errFailed"));
      }
    });
  };

  const handleCancelBooking = async (booking: AccountBookingItem) => {
    const ok = await confirm({
      title: t("account.cancelDialogTitle"),
      description: t("account.cancelDialogDesc"),
      confirmText: t("account.cancelDialogConfirm"),
      cancelText: t("account.cancelDialogCancel"),
      variant: "destructive",
    });

    if (!ok) return;

    setCancellingBookingId(booking.id);
    try {
      const res = await cancelUserBooking(booking.id, locale);
      if (res.success) {
        setBookings((prev) => prev.filter((b) => b.id !== booking.id));
        notify.success(t("account.cancelSuccess"));
      } else {
        notify.error(res.error || t("account.errLoadAccount"));
      }
    } catch (err) {
      console.error(err);
      notify.error(t("account.errLoadAccount"));
    } finally {
      setCancellingBookingId(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {ConfirmDialogComponent}

      {/* Header */}
      <div className="mb-8 sm:mb-12">
        <h1
          data-testid="account-page-title"
          className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-2"
        >
          {t("account.title")}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t("account.subtitle")}
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 mb-8 overflow-x-auto no-scrollbar">
        <button
          type="button"
          data-testid="tab-profile-btn"
          onClick={() => handleTabChange("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-heading text-sm font-semibold transition-all shrink-0 ${
            activeTab === "profile"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <User className="size-4" />
          <span>{t("account.tabProfile")}</span>
        </button>

        <button
          type="button"
          data-testid="tab-bookings-btn"
          onClick={() => handleTabChange("bookings")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-heading text-sm font-semibold transition-all shrink-0 ${
            activeTab === "bookings"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Calendar className="size-4" />
          <span>{t("account.tabBookings")}</span>
          {bookings.length > 0 && (
            <span
              data-testid="bookings-badge-count"
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "bookings"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {bookings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          data-testid="tab-security-btn"
          onClick={() => handleTabChange("security")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-heading text-sm font-semibold transition-all shrink-0 ${
            activeTab === "security"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Shield className="size-4" />
          <span>{t("account.tabSecurity")}</span>
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <div
          data-testid="account-profile-section"
          className="bg-card/70 backdrop-blur-xl border border-border/80 rounded-3xl p-6 sm:p-10 shadow-lg shadow-black/5"
        >
          <form onSubmit={handleProfileSubmit} className="space-y-8">
            {/* Avatar Section */}
            <div>
              <Label className="block text-sm font-semibold text-foreground mb-4">
                {t("account.profilePhoto")}
              </Label>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <UserAvatar
                  src={profileImage}
                  name={name}
                  email={userData.email}
                  size="3xl"
                  shape="rounded"
                  className="size-24 sm:size-28 border-2 border-primary/20 shrink-0 shadow-inner"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="account-upload-photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border-border/80 flex items-center gap-2 text-sm"
                  >
                    <Camera className="size-4" />
                    <span>{profileImage ? t("account.changePhoto") : t("account.uploadPhoto")}</span>
                  </Button>

                  {profileImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      data-testid="account-remove-photo-btn"
                      onClick={handleRemovePhoto}
                      className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 flex items-center gap-2 text-sm"
                    >
                      <Trash2 className="size-4" />
                      <span>{t("account.removePhoto")}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="account-name" className="text-sm font-semibold text-foreground">
                  {t("account.fullName")}
                </Label>
                <Input
                  id="account-name"
                  data-testid="account-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("account.fullNamePlaceholder")}
                  className="rounded-xl h-11"
                />
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="account-email" className="text-sm font-semibold text-foreground">
                    {t("account.email")}
                  </Label>
                  <span
                    data-testid="account-email-verified-badge"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
                  >
                    <CheckCircle2 className="size-3" />
                    <span>{t("account.emailVerifiedBadge")}</span>
                  </span>
                </div>
                <Input
                  id="account-email"
                  data-testid="account-email-input"
                  value={userData.email || ""}
                  disabled
                  readOnly
                  className="rounded-xl h-11 bg-muted/40 cursor-not-allowed opacity-80"
                />
              </div>

              {/* City Combobox */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  {t("account.city")}
                </Label>
                <CityCombobox
                  value={city}
                  onChange={setCity}
                  placeholder={t("account.cityPlaceholder")}
                  locale={locale}
                />
              </div>

              {/* Age */}
              <div className="space-y-2">
                <Label htmlFor="account-age" className="text-sm font-semibold text-foreground">
                  {t("account.age")}
                </Label>
                <Input
                  id="account-age"
                  data-testid="account-age-input"
                  type="number"
                  min={10}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={t("account.agePlaceholder")}
                  className="rounded-xl h-11"
                />
              </div>
            </div>

            {/* Optional Profile Details Section (Task 9) */}
            <div
              data-testid="account-optional-details-section"
              className="mt-8 pt-8 border-t border-border/60 space-y-6"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  <h3 className="text-lg font-heading font-bold text-foreground">
                    {t("account.optionalDetailsTitle")}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("account.optionalDetailsDesc")}
                </p>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="account-bio"
                    className="text-sm font-semibold text-foreground flex items-center gap-1.5"
                  >
                    {t("account.bioLabel")}
                  </Label>
                  <span
                    className="text-xs text-muted-foreground font-mono"
                    data-testid="account-bio-count"
                  >
                    {bio.length} / 280
                  </span>
                </div>
                <Textarea
                  id="account-bio"
                  data-testid="account-bio-input"
                  value={bio}
                  maxLength={280}
                  rows={3}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t("account.bioPlaceholder")}
                  className="rounded-xl resize-none text-sm"
                />
              </div>

              {/* Study Level & Institution */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="account-studylevel"
                      className="text-sm font-semibold text-foreground flex items-center gap-1.5"
                    >
                      <GraduationCap className="size-4 text-muted-foreground" />
                      {t("account.studyLevelLabel")}
                    </Label>
                    <span className="text-xs text-muted-foreground font-mono">
                      {studyLevel.length} / 100
                    </span>
                  </div>
                  <Input
                    id="account-studylevel"
                    data-testid="account-studylevel-input"
                    value={studyLevel}
                    maxLength={100}
                    onChange={(e) => setStudyLevel(e.target.value)}
                    placeholder={t("account.studyLevelPlaceholder")}
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="account-institution"
                      className="text-sm font-semibold text-foreground flex items-center gap-1.5"
                    >
                      <Building2 className="size-4 text-muted-foreground" />
                      {t("account.institutionLabel")}
                    </Label>
                    <span className="text-xs text-muted-foreground font-mono">
                      {institution.length} / 120
                    </span>
                  </div>
                  <Input
                    id="account-institution"
                    data-testid="account-institution-input"
                    value={institution}
                    maxLength={120}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder={t("account.institutionPlaceholder")}
                    className="rounded-xl h-11"
                  />
                </div>
              </div>

              {/* Tag editors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Interests */}
                <ProfileTagEditor
                  label={t("account.interestsLabel")}
                  helperText={t("account.interestsPlaceholder")}
                  tags={interests}
                  onChange={setInterests}
                  maxTags={8}
                  maxTagLength={30}
                  presets={locale === "ar" ? INTEREST_PRESETS.ar : INTEREST_PRESETS.en}
                  placeholder={t("account.interestsPlaceholder")}
                  testIdPrefix="account-interests"
                  disabled={isPending}
                />

                {/* Skills */}
                <ProfileTagEditor
                  label={t("account.skillsLabel")}
                  helperText={t("account.skillsPlaceholder")}
                  tags={skills}
                  onChange={setSkills}
                  maxTags={8}
                  maxTagLength={30}
                  presets={locale === "ar" ? SKILL_PRESETS.ar : SKILL_PRESETS.en}
                  placeholder={t("account.skillsPlaceholder")}
                  testIdPrefix="account-skills"
                  disabled={isPending}
                />

                {/* Languages */}
                <ProfileTagEditor
                  label={t("account.languagesLabel")}
                  helperText={t("account.languagesPlaceholder")}
                  tags={languages}
                  onChange={setLanguages}
                  maxTags={6}
                  maxTagLength={30}
                  presets={locale === "ar" ? LANGUAGE_PRESETS.ar : LANGUAGE_PRESETS.en}
                  placeholder={t("account.languagesPlaceholder")}
                  testIdPrefix="account-languages"
                  disabled={isPending}
                />

                {/* Volunteer Areas */}
                <ProfileTagEditor
                  label={t("account.volunteerAreasLabel")}
                  helperText={t("account.volunteerAreasPlaceholder")}
                  tags={volunteerAreas}
                  onChange={setVolunteerAreas}
                  maxTags={6}
                  maxTagLength={30}
                  presets={locale === "ar" ? VOLUNTEER_PRESETS.ar : VOLUNTEER_PRESETS.en}
                  placeholder={t("account.volunteerAreasPlaceholder")}
                  testIdPrefix="account-volunteer"
                  disabled={isPending}
                />
              </div>

              {/* Privacy Notice Card */}
              <div
                data-testid="account-privacy-notice"
                className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3 text-xs text-muted-foreground"
              >
                <Shield className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <p>{t("account.privacyNoticeText")}</p>
                  <Link
                    href="/privacy"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold mt-1"
                  >
                    <span>{t("account.privacyNoticeLink")}</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                disabled={isPending}
                data-testid="account-save-profile-btn"
                className="rounded-xl h-11 px-8 font-heading font-semibold"
              >
                {isPending ? t("account.savingProfile") : t("account.saveProfile")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: My Bookings */}
      {activeTab === "bookings" && (
        <div data-testid="account-bookings-section" className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
                {t("account.bookingsTitle")}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t("account.bookingsSubtitle")}
              </p>
            </div>
          </div>

          {bookings.length === 0 ? (
            <div
              data-testid="no-bookings-card"
              className="bg-card/70 backdrop-blur-xl border border-border/80 rounded-3xl p-10 sm:p-16 text-center shadow-lg shadow-black/5"
            >
              <div className="size-16 rounded-2xl bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center mb-4">
                <CalendarX2 className="size-8" />
              </div>
              <h3 className="text-lg font-heading font-bold text-foreground mb-2">
                {t("account.noBookingsTitle")}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                {t("account.noBookingsDesc")}
              </p>
              <Link href="/events">
                <Button data-testid="browse-events-btn" className="rounded-xl font-heading">
                  {t("account.browseEvents")}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {bookings.map((booking) => {
                const isConfirmed = booking.status === "CONFIRMED" || booking.confirmed;
                const isPendingStatus = booking.status === "PENDING";
                const isWaitlisted = booking.status === "WAITLISTED";
                const isRejected = booking.status === "REJECTED";

                const poster = booking.event.posterUrl || IMAGES.eventPoster;
                const eventTitle = isRTL ? booking.event.titleAr : booking.event.titleEn;

                return (
                  <div
                    key={booking.id}
                    data-testid={`booking-card-${booking.id}`}
                    className="bg-card/70 backdrop-blur-xl border border-border/80 rounded-3xl p-5 sm:p-7 shadow-lg shadow-black/5 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition-all hover:border-primary/30"
                  >
                    <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center w-full md:w-auto">
                      <div className="relative w-full sm:w-36 h-28 rounded-2xl overflow-hidden bg-muted shrink-0 border border-border/60">
                        <Image
                          src={poster}
                          alt={eventTitle}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="space-y-2">
                        {/* Status Badge */}
                        <div>
                          {isConfirmed && (
                            <span
                              data-testid={`booking-status-${booking.id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            >
                              <CheckCircle2 className="size-3.5" />
                              <span>{t("account.statusConfirmed")}</span>
                            </span>
                          )}
                          {isPendingStatus && (
                            <span
                              data-testid={`booking-status-${booking.id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            >
                              <Clock className="size-3.5" />
                              <span>{t("account.statusPending")}</span>
                            </span>
                          )}
                          {isWaitlisted && (
                            <span
                              data-testid={`booking-status-${booking.id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                            >
                              <ListOrdered className="size-3.5" />
                              <span>
                                {booking.waitlistOrder
                                  ? t("account.statusWaitlisted").replace(
                                      "#{order}",
                                      String(booking.waitlistOrder),
                                    )
                                  : t("account.statusWaitlistedGeneral")}
                              </span>
                            </span>
                          )}
                          {isRejected && (
                            <span
                              data-testid={`booking-status-${booking.id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            >
                              <XCircle className="size-3.5" />
                              <span>{t("account.statusRejected")}</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-heading font-bold text-foreground">
                          {eventTitle}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3.5 text-primary" />
                            <span>{booking.event.date}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5 text-primary" />
                            <span>{booking.event.time}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3.5 text-primary" />
                            <span>{booking.event.location}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-border/50">
                      <Link href={`/events/${booking.event.slug}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`view-event-btn-${booking.id}`}
                          className="rounded-xl flex items-center gap-1.5 text-xs font-heading"
                        >
                          <ExternalLink className="size-3.5" />
                          <span>{t("account.viewEvent")}</span>
                        </Button>
                      </Link>

                      {!booking.event.isEnded && !isRejected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={cancellingBookingId === booking.id}
                          data-testid={`cancel-booking-btn-${booking.id}`}
                          onClick={() => handleCancelBooking(booking)}
                          className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 text-xs font-heading"
                        >
                          {cancellingBookingId === booking.id
                            ? t("account.cancellingBooking")
                            : t("account.cancelBooking")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Security */}
      {activeTab === "security" && (
        <div
          data-testid="account-security-section"
          className="bg-card/70 backdrop-blur-xl border border-border/80 rounded-3xl p-6 sm:p-10 shadow-lg shadow-black/5 space-y-10"
        >
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-1">
              {t("account.securityTitle")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("account.securitySubtitle")}
            </p>
          </div>

          {userData.hasPassword ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-lg">
              <div className="space-y-2">
                <Label
                  htmlFor="account-current-password"
                  className="text-sm font-semibold text-foreground"
                >
                  {t("account.currentPassword")}
                </Label>
                <Input
                  id="account-current-password"
                  type="password"
                  data-testid="account-current-password-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="account-new-password"
                  className="text-sm font-semibold text-foreground"
                >
                  {t("account.newPassword")}
                </Label>
                <Input
                  id="account-new-password"
                  type="password"
                  data-testid="account-new-password-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl h-11"
                />

                {/* Password Rules Indicators */}
                {newPassword && (
                  <div className="mt-2 text-xs space-y-1 bg-muted/40 p-3 rounded-xl border border-border/50">
                    <div
                      className={`flex items-center gap-1.5 ${
                        passwordRules.length
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <CheckCircle2 className="size-3" />
                      <span>{t("auth.errPasswordShort")}</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${
                        passwordRules.uppercase && passwordRules.lowercase
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <CheckCircle2 className="size-3" />
                      <span>{t("auth.errPasswordLetter")}</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${
                        passwordRules.number
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <CheckCircle2 className="size-3" />
                      <span>{t("auth.errPasswordNumber")}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="account-confirm-password"
                  className="text-sm font-semibold text-foreground"
                >
                  {t("account.confirmNewPassword")}
                </Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  data-testid="account-confirm-password-input"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>

              <Button
                type="submit"
                disabled={isPending}
                data-testid="account-update-password-btn"
                className="rounded-xl h-11 px-6 font-heading font-semibold"
              >
                {isPending ? t("account.updatingPassword") : t("account.updatePassword")}
              </Button>
            </form>
          ) : (
            <div
              data-testid="google-account-notice"
              className="p-6 rounded-2xl bg-muted/40 border border-border/80 flex items-start gap-4"
            >
              <div className="size-10 rounded-xl bg-card border border-border/80 flex items-center justify-center shrink-0">
                <Shield className="size-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-foreground">
                  {t("account.googleAccount")}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t("account.googleAccountDesc")}
                </p>
              </div>
            </div>
          )}

          {/* Sign Out Section */}
          <div className="pt-8 border-t border-border/60 flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-foreground">
                {t("account.signOut")}
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {t("auth.backToLogin")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              data-testid="account-signout-btn"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center gap-2"
            >
              <LogOut className="size-4" />
              <span>{t("account.signOut")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Profile Avatar Cropper Dialog */}
      <ImageCropperDialog
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        imageSrc={rawCropImage}
        cropShape="round"
        aspect={1}
        maxDimensions={{ width: 1024, height: 1024 }}
        titleAr="اقتصاص الصورة الشخصية"
        titleEn="Crop Profile Photo"
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
