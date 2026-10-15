"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  MapPin,
  Calendar,
  Camera,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
} from "lucide-react";

import { useLocale } from "@/i18n/locale-provider";
import { CityCombobox } from "@/components/common/city-combobox";
import { notify } from "@/lib/toast";
import { completeOnboarding, getOnboardingProfile } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { ImageCropperDialog } from "@/components/common/image-cropper-dialog";

interface OnboardingViewProps {
  initialProfile?: {
    name: string | null;
    email: string | null;
    city: string | null;
    age: number | null;
    image: string | null;
    termsAccepted: boolean;
    onboardingCompleted: boolean;
  };
}

export function OnboardingView({ initialProfile }: OnboardingViewProps) {
  const { t, locale, dir } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update: updateSession } = useSession();
  const [isPending, startTransition] = useTransition();

  const isAr = locale === "ar";
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Multi-step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form fields
  const [name, setName] = useState<string>(
    initialProfile?.name || session?.user?.name || "",
  );
  const [city, setCity] = useState<string>(
    initialProfile?.city || session?.user?.city || "",
  );
  const [age, setAge] = useState<string>(
    initialProfile?.age ? String(initialProfile.age) : "",
  );

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialProfile?.image || session?.user?.image || null,
  );
  const [clearImage, setClearImage] = useState<boolean>(false);
  const [cropperOpen, setCropperOpen] = useState<boolean>(false);
  const [rawCropImage, setRawCropImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Terms state (required if user signed in with Google and hasn't accepted yet)
  const [termsAccepted, setTermsAccepted] = useState<boolean>(
    initialProfile?.termsAccepted ?? false,
  );
  const [acceptTermsCheckbox, setAcceptTermsCheckbox] = useState<boolean>(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch initial profile if not provided
  useEffect(() => {
    if (!initialProfile) {
      getOnboardingProfile().then((res) => {
        if (res.success && res.user) {
          if (res.user.onboardingCompleted) {
            router.replace(callbackUrl);
            return;
          }
          if (res.user.name) setName(res.user.name);
          if (res.user.city) setCity(res.user.city);
          if (res.user.age) setAge(String(res.user.age));
          if (res.user.image) setImagePreview(res.user.image);
          setTermsAccepted(res.user.termsAccepted);
        } else if (res.unauthorized) {
          router.replace(`/login?callbackUrl=/onboarding`);
        }
      });
    } else if (initialProfile.onboardingCompleted) {
      router.replace(callbackUrl);
    }
  }, [initialProfile, router, callbackUrl]);

  // Image selection handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      notify.error(t("onboarding.errPhotoTooLarge"));
      e.target.value = "";
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setRawCropImage(blobUrl);
    setCropperOpen(true);
    e.target.value = "";
  };

  const handleCropComplete = (result: { file: File; blobUrl: string }) => {
    setImageFile(result.file);
    setImagePreview(result.blobUrl);
    setClearImage(false);
  };

  const handleRemovePhoto = () => {
    setImageFile(null);
    setImagePreview(null);
    setClearImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!city.trim()) {
      newErrors.city = t("onboarding.errCityRequired");
    }

    const ageNum = parseInt(age, 10);
    if (!age.trim()) {
      newErrors.age = t("onboarding.errAgeRequired");
    } else if (isNaN(ageNum) || ageNum < 10 || ageNum > 120) {
      newErrors.age = t("onboarding.errAgeInvalid");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle step progression
  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  // Handle final completion
  const handleSubmit = () => {
    if (!termsAccepted && !acceptTermsCheckbox) {
      notify.error(t("onboarding.errTermsRequired"));
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("city", city.trim());
      formData.set("age", age.trim());
      if (name.trim()) formData.set("name", name.trim());
      if (clearImage) formData.set("clearImage", "true");
      if (imageFile) formData.set("image", imageFile);
      if (!termsAccepted && acceptTermsCheckbox) {
        formData.set("termsAccepted", "true");
      }

      try {
        const res = await completeOnboarding(formData, locale);
        if (res.success) {
          notify.success(t("onboarding.successTitle"), {
            description: t("onboarding.successDesc"),
          });

          // Update client session state
          await updateSession({
            onboardingComplete: true,
            city: city.trim(),
            age: parseInt(age, 10),
            image: imagePreview,
          });

          // Redirect to user's destination
          router.replace(callbackUrl);
        } else {
          notify.error(res.error || t("onboarding.errFailed"));
        }
      } catch (err) {
        console.error("[onboarding] submit error:", err);
        notify.error(t("onboarding.errFailed"));
      }
    });
  };

  return (
    <div
      dir={dir}
      data-testid="onboarding-container"
      className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8"
    >
      {/* Background Islamic Watermark Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage: "url(/patterns/girih.svg)",
          backgroundSize: "260px 260px",
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl mx-auto">
        {/* Main Card */}
        <div className="relative overflow-hidden rounded-3xl border border-brass/20 bg-card/85 backdrop-blur-xl shadow-2xl p-6 sm:p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-3">
              <Sparkles className="size-3.5" />
              <span>{t("onboarding.title")}</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {step === 1 && t("onboarding.step1Title")}
              {step === 2 && t("onboarding.step2Title")}
              {step === 3 && t("onboarding.step3Title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {step === 1 && t("onboarding.step1Desc")}
              {step === 2 && t("onboarding.step2Desc")}
              {step === 3 && t("onboarding.step3Desc")}
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="mb-8" data-testid="onboarding-stepper-progress">
            <div className="flex items-center justify-between relative">
              {/* Progress Line */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border/60 -translate-y-1/2 z-0" />
              <div
                className="absolute top-1/2 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-300"
                style={{
                  [isAr ? "right" : "left"]: 0,
                  width: step === 1 ? "0%" : step === 2 ? "50%" : "100%",
                }}
              />

              {/* Step 1 Node */}
              <div
                data-testid="stepper-step-1"
                className={cn(
                  "relative z-10 flex size-9 sm:size-10 items-center justify-center rounded-full text-xs sm:text-sm font-bold border-2 transition-all",
                  step >= 1
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {step > 1 ? <Check className="size-4 stroke-[3]" /> : "1"}
              </div>

              {/* Step 2 Node */}
              <div
                data-testid="stepper-step-2"
                className={cn(
                  "relative z-10 flex size-9 sm:size-10 items-center justify-center rounded-full text-xs sm:text-sm font-bold border-2 transition-all",
                  step >= 2
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {step > 2 ? <Check className="size-4 stroke-[3]" /> : "2"}
              </div>

              {/* Step 3 Node */}
              <div
                data-testid="stepper-step-3"
                className={cn(
                  "relative z-10 flex size-9 sm:size-10 items-center justify-center rounded-full text-xs sm:text-sm font-bold border-2 transition-all",
                  step === 3
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                3
              </div>
            </div>
          </div>

          {/* Step 1: Personal Details */}
          {step === 1 && (
            <div data-testid="onboarding-step-1" className="space-y-5 animate-in fade-in duration-300">
              {/* Name (pre-filled or editable) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("onboarding.fullNameLabel")}
                </label>
                <input
                  type="text"
                  data-testid="onboarding-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="محمد المغربي"
                  className="w-full rounded-xl border border-border/80 bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* City Combobox */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("onboarding.cityLabel")} <span className="text-destructive">*</span>
                </label>
                <CityCombobox
                  value={city}
                  onChange={(val) => {
                    setCity(val);
                    if (errors.city) setErrors((prev) => ({ ...prev, city: "" }));
                  }}
                  locale={locale}
                  placeholder={t("onboarding.cityPlaceholder")}
                  hasError={Boolean(errors.city)}
                />
                {errors.city && (
                  <p data-testid="error-city" className="mt-1.5 text-xs font-medium text-destructive">
                    {errors.city}
                  </p>
                )}
              </div>

              {/* Age Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("onboarding.ageLabel")} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={120}
                    data-testid="onboarding-age-input"
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value);
                      if (errors.age) setErrors((prev) => ({ ...prev, age: "" }));
                    }}
                    placeholder={t("onboarding.agePlaceholder")}
                    className={cn(
                      "w-full rounded-xl border bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground outline-none transition-all",
                      errors.age
                        ? "border-destructive focus:ring-2 focus:ring-destructive/20"
                        : "border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20",
                    )}
                  />
                  <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                    {t("onboarding.yearsOld")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("onboarding.ageHelp")}</p>
                {errors.age && (
                  <p data-testid="error-age" className="mt-1.5 text-xs font-medium text-destructive">
                    {errors.age}
                  </p>
                )}
              </div>

              {/* Step 1 Actions */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  data-testid="onboarding-next-btn"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-[0.98]"
                >
                  <span>{t("onboarding.nextStep")}</span>
                  {isAr ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Profile Photo */}
          {step === 2 && (
            <div data-testid="onboarding-step-2" className="space-y-6 text-center animate-in fade-in duration-300">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                data-testid="onboarding-photo-input"
                onChange={handlePhotoSelect}
              />

              {/* Avatar Preview */}
              <div className="flex flex-col items-center justify-center">
                <div
                  data-testid="avatar-preview-container"
                  className="relative group size-28 sm:size-32 rounded-full p-1 border-2 border-dashed border-brass/30 bg-primary/5 shadow-inner flex items-center justify-center"
                >
                  {imagePreview ? (
                    <div className="relative size-full rounded-full overflow-hidden">
                      <Image
                        src={imagePreview}
                        alt="Profile preview"
                        fill
                        data-testid="avatar-preview-img"
                        className="object-cover"
                        unoptimized={imagePreview.startsWith("data:")}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Camera className="size-10 stroke-[1.5] text-primary/70 mb-1" />
                      <span className="text-[10px] font-semibold text-muted-foreground/80">
                        {t("onboarding.choosePhoto")}
                      </span>
                    </div>
                  )}

                  {/* Quick Change Overlay */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={t("onboarding.choosePhoto")}
                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold"
                  >
                    <Camera className="size-5" />
                  </button>
                </div>

                <p className="mt-3 text-xs text-muted-foreground max-w-xs leading-relaxed">
                  {t("onboarding.photoUploadHelp")}
                </p>
              </div>

              {/* Photo Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  data-testid="choose-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-all hover:bg-primary/20"
                >
                  <UploadCloud className="size-4" />
                  <span>{imagePreview ? t("onboarding.changePhoto") : t("onboarding.choosePhoto")}</span>
                </button>

                {imagePreview && (
                  <button
                    type="button"
                    data-testid="remove-photo-btn"
                    onClick={handleRemovePhoto}
                    className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive transition-all hover:bg-destructive/20"
                  >
                    <Trash2 className="size-4" />
                    <span>{t("onboarding.removePhoto")}</span>
                  </button>
                )}
              </div>

              {/* Step 2 Actions */}
              <div className="pt-4 flex items-center justify-between border-t border-border/50">
                <button
                  type="button"
                  data-testid="onboarding-back-btn"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  {isAr ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                  <span>{t("onboarding.prevStep")}</span>
                </button>

                <div className="flex items-center gap-2">
                  {!imagePreview && (
                    <button
                      type="button"
                      data-testid="skip-photo-btn"
                      onClick={handleNext}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 transition-colors"
                    >
                      {t("onboarding.skipPhoto")}
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="onboarding-next-btn"
                    onClick={handleNext}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90"
                  >
                    <span>{t("onboarding.nextStep")}</span>
                    {isAr ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review & Terms Confirmation */}
          {step === 3 && (
            <div data-testid="onboarding-step-3" className="space-y-6 animate-in fade-in duration-300">
              {/* Summary Card */}
              <div className="rounded-2xl border border-brass/15 bg-background/50 p-4 sm:p-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("onboarding.reviewTitle")}
                </h3>

                <div className="flex items-center gap-4">
                  <div className="relative size-14 rounded-full overflow-hidden border border-brass/30 bg-primary/10 shrink-0 flex items-center justify-center">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt="Avatar"
                        fill
                        className="object-cover"
                        unoptimized={imagePreview.startsWith("data:")}
                      />
                    ) : (
                      <Camera className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold text-sm text-foreground truncate">
                      {name || session?.user?.name || "Member"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40 text-xs">
                  <div>
                    <span className="text-muted-foreground block">{t("onboarding.reviewCity")}:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      {city}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t("onboarding.reviewAge")}:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="size-3.5 text-primary shrink-0" />
                      {age} {t("onboarding.yearsOld")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms Checkbox for Google OAuth users if not accepted yet */}
              {!termsAccepted && (
                <div
                  data-testid="terms-agreement-block"
                  className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2.5"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="onboarding-terms-check"
                      data-testid="onboarding-terms-checkbox"
                      checked={acceptTermsCheckbox}
                      onChange={(e) => setAcceptTermsCheckbox(e.target.checked)}
                      className="mt-1 size-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
                    />
                    <label
                      htmlFor="onboarding-terms-check"
                      className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none"
                    >
                      {isAr ? (
                        <>
                          أوافق على{" "}
                          <Link href="/terms" target="_blank" className="font-semibold text-primary underline underline-offset-2">
                            شروط الخدمة
                          </Link>{" "}
                          و{" "}
                          <Link href="/privacy" target="_blank" className="font-semibold text-primary underline underline-offset-2">
                            سياسة الخصوصية
                          </Link>{" "}
                          الخاصة ببرنامج إحياء.
                        </>
                      ) : (
                        <>
                          I agree to the{" "}
                          <Link href="/terms" target="_blank" className="font-semibold text-primary underline underline-offset-2">
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link href="/privacy" target="_blank" className="font-semibold text-primary underline underline-offset-2">
                            Privacy Policy
                          </Link>{" "}
                          of Ihyaa Program.
                        </>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Step 3 Actions */}
              <div className="pt-4 flex items-center justify-between border-t border-border/50">
                <button
                  type="button"
                  data-testid="onboarding-back-btn"
                  onClick={handleBack}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                >
                  {isAr ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                  <span>{t("onboarding.prevStep")}</span>
                </button>

                <button
                  type="button"
                  data-testid="onboarding-submit-btn"
                  onClick={handleSubmit}
                  disabled={isPending || (!termsAccepted && !acceptTermsCheckbox)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>{t("onboarding.completing")}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      <span>{t("onboarding.completeSetup")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Avatar Image Cropper Dialog */}
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
