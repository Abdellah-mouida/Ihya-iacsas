"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TERMS_VERSION } from "@/lib/terms";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateNumericOtp, hashOtp, verifyOtpConstantTime } from "@/lib/otp";
import { sendAccountVerificationEmail, sendTempPasswordEmail } from "@/lib/email";
import { generateTempPassword, validatePasswordStrength } from "@/lib/password";
import { uploadImageToCloudinaryDetailed, deleteImageFromCloudinary } from "@/lib/cloudinary";
import { safeRevalidatePath } from "@/lib/cache";
import { MOROCCAN_CITIES } from "@/lib/moroccan-cities";

async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = headerList.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export interface SignUpResult {
  success: boolean;
  error?: string;
  email?: string;
}

export async function signUpWithCredentials(
  formData: FormData,
  locale: string = "ar",
): Promise<SignUpResult> {
  const name = (formData.get("name") as string)?.trim();
  const emailRaw = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const termsAccepted = formData.get("termsAccepted") === "true" || formData.get("termsAccepted") === "on";

  const isAr = locale === "ar";

  if (!name || name.length < 2) {
    return {
      success: false,
      error: isAr ? "يرجى إدخال اسم صحيح لا يقل عن حرفين" : "Please enter a valid name (at least 2 characters)",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRaw || !emailRegex.test(emailRaw)) {
    return {
      success: false,
      error: isAr ? "يرجى إدخال بريد إلكتروني صحيح" : "Please enter a valid email address",
    };
  }

  if (!termsAccepted) {
    return {
      success: false,
      error: isAr ? "يجب الموافقة على شروط الاستخدام وسياسة الخصوصية" : "You must accept the Terms of Service and Privacy Policy",
    };
  }

  const strength = validatePasswordStrength(password || "");
  if (!strength.valid) {
    return {
      success: false,
      error: isAr
        ? "يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل، وحرف كبير، وحرف صغير، ورقم، ورمز خاص"
        : "Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character",
    };
  }

  const clientIp = await getClientIp();

  // Rate limits: 5 per hour per email, 15 per hour per IP
  const emailRate = await checkRateLimit(`signup_email_${emailRaw}`, 5, 3600);
  if (!emailRate.allowed) {
    return {
      success: false,
      error: isAr ? "تم تجاوز حد إنشاء الحسابات، يرجى المحاولة لاحقاً" : "Too many signup attempts, please try again later",
    };
  }

  const ipRate = await checkRateLimit(`signup_ip_${clientIp}`, 15, 3600);
  if (!ipRate.allowed) {
    return {
      success: false,
      error: isAr ? "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً" : "Rate limit exceeded, please try again later",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: emailRaw },
  });

  if (existingUser && existingUser.emailVerified) {
    return {
      success: false,
      error: isAr ? "هذا البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول" : "This email is already registered, please sign in",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (existingUser && !existingUser.emailVerified) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name,
        passwordHash,
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        locale,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        email: emailRaw,
        name,
        passwordHash,
        emailVerified: null,
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        locale,
      },
    });
  }

  // Invalidate previous ACCOUNT_VERIFY OTPs for this email
  await prisma.otpVerification.updateMany({
    where: {
      email: emailRaw,
      purpose: "ACCOUNT_VERIFY",
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  const otp = generateNumericOtp();
  const otpHash = hashOtp(otp, emailRaw);

  await prisma.otpVerification.create({
    data: {
      email: emailRaw,
      otpHash,
      purpose: "ACCOUNT_VERIFY",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  const emailRes = await sendAccountVerificationEmail(emailRaw, otp, locale);
  if (!emailRes.success) {
    return {
      success: false,
      error: isAr ? "فشل إرسال رمز التحقق إلى بريدك الإلكتروني" : "Failed to send verification email",
    };
  }

  return {
    success: true,
    email: emailRaw,
  };
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  verified?: boolean;
}

export async function verifyAccountEmail(
  email: string,
  code: string,
  locale: string = "ar",
): Promise<VerifyResult> {
  const isAr = locale === "ar";
  const cleanEmail = email?.trim().toLowerCase();
  const cleanCode = code?.trim();

  if (!cleanEmail || !cleanCode || cleanCode.length !== 6) {
    return {
      success: false,
      error: isAr ? "يرجى إدخال رمز التحقق المكون من 6 أرقام" : "Please enter the 6-digit verification code",
    };
  }

  const rateCheck = await checkRateLimit(`verify_acc_${cleanEmail}`, 10, 900);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: isAr ? "تم تجاوز حد محاولات التحقق، يرجى المحاولة لاحقاً" : "Too many verification attempts, please try again later",
    };
  }

  const otpRecord = await prisma.otpVerification.findFirst({
    where: {
      email: cleanEmail,
      purpose: "ACCOUNT_VERIFY",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    return {
      success: false,
      error: isAr ? "رمز التحقق غير صالح أو انتهت صلاحيته" : "Verification code is invalid or has expired",
    };
  }

  if (otpRecord.attempts >= 5) {
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });
    return {
      success: false,
      error: isAr ? "تم تجاوز الحد الأقصى للمحاولات لهذا الرمز" : "Maximum attempts exceeded for this code",
    };
  }

  const isValid = verifyOtpConstantTime(cleanCode, otpRecord.otpHash, cleanEmail);

  if (!isValid) {
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    return {
      success: false,
      error: isAr ? "رمز التحقق غير صحيح" : "Invalid verification code",
    };
  }

  // Mark OTP used
  await prisma.otpVerification.update({
    where: { id: otpRecord.id },
    data: { usedAt: new Date() },
  });

  // Verify User
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user) {
    return {
      success: false,
      error: isAr ? "لم يتم العثور على الحساب" : "User account not found",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      mustChangePassword: false,
    },
  });

  // CRITICAL Task 3 requirement: Link any legacy unassigned bookings matching this email
  await prisma.booking.updateMany({
    where: {
      email: cleanEmail,
      userId: null,
    },
    data: {
      userId: user.id,
    },
  });

  return {
    success: true,
    verified: true,
  };
}

export async function resendAccountVerificationOtp(
  email: string,
  locale: string = "ar",
): Promise<{ success: boolean; error?: string }> {
  const isAr = locale === "ar";
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, error: isAr ? "البريد الإلكتروني مطلوب" : "Email is required" };
  }

  const rateCheck = await checkRateLimit(`resend_acc_${cleanEmail}`, 1, 60);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: isAr ? "يرجى الانتظار دقيقة قبل طلب رمز جديد" : "Please wait one minute before requesting a new code",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user) {
    return { success: false, error: isAr ? "الحساب غير موجود" : "Account not found" };
  }

  if (user.emailVerified) {
    return {
      success: false,
      error: isAr ? "تم تأكيد هذا الحساب مسبقاً، يرجى تسجيل الدخول" : "Account is already verified, please sign in",
    };
  }

  // Invalidate old OTPs
  await prisma.otpVerification.updateMany({
    where: {
      email: cleanEmail,
      purpose: "ACCOUNT_VERIFY",
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  const otp = generateNumericOtp();
  const otpHash = hashOtp(otp, cleanEmail);

  await prisma.otpVerification.create({
    data: {
      email: cleanEmail,
      otpHash,
      purpose: "ACCOUNT_VERIFY",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const emailRes = await sendAccountVerificationEmail(cleanEmail, otp, locale);
  if (!emailRes.success) {
    return {
      success: false,
      error: isAr ? "فشل إرسال رمز التحقق" : "Failed to send verification email",
    };
  }

  return { success: true };
}

export interface PasswordResetResult {
  success: boolean;
  error?: string;
  email?: string;
}

export async function requestPasswordReset(
  formData: FormData,
  locale: string = "ar",
): Promise<PasswordResetResult> {
  const isAr = locale === "ar";
  const emailRaw = (formData.get("email") as string)?.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRaw || !emailRegex.test(emailRaw)) {
    return {
      success: false,
      error: isAr ? "يرجى إدخال بريد إلكتروني صحيح" : "Please enter a valid email address",
    };
  }

  const clientIp = await getClientIp();

  // Rate limits: 3 per 15 minutes per email, 10 per 15 minutes per IP
  const emailRate = await checkRateLimit(`forgot_email_${emailRaw}`, 3, 15 * 60);
  if (!emailRate.allowed) {
    return {
      success: false,
      error: isAr
        ? "لقد تجاوزت عدد المحاولات المسموح بها لإعادة تعيين كلمة المرور. يرجى الانتظار 15 دقيقة."
        : "Too many password reset requests. Please wait 15 minutes before trying again.",
    };
  }

  const ipRate = await checkRateLimit(`forgot_ip_${clientIp}`, 10, 15 * 60);
  if (!ipRate.allowed) {
    return {
      success: false,
      error: isAr
        ? "لقد تجاوزت عدد المحاولات المسموح بها لإعادة تعيين كلمة المرور. يرجى الانتظار 15 دقيقة."
        : "Too many password reset requests. Please wait 15 minutes before trying again.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: emailRaw },
  });

  // Security: only proceed if user exists and email is verified
  // But always return success: true to caller to prevent email enumeration
  if (user && user.email && user.emailVerified) {
    const tempPassword = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 12);
    const tempPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.user.update({
      where: { id: user.id },
      data: {
        tempPasswordHash,
        tempPasswordExpiresAt,
        mustChangePassword: true,
      },
    });

    await sendTempPasswordEmail(user.email, tempPassword, locale);
  }

  return {
    success: true,
    email: emailRaw,
  };
}

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
  sessionVersion?: number;
}

export async function changePassword(
  formData: FormData,
  locale: string = "ar",
): Promise<ChangePasswordResult> {
  const isAr = locale === "ar";
  const session = await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      error: isAr ? "يجب تسجيل الدخول أولاً" : "You must be signed in to change your password",
    };
  }

  const currentPassword = (formData.get("currentPassword") as string) || "";
  const newPassword = (formData.get("newPassword") as string) || "";
  const confirmNewPassword = (formData.get("confirmNewPassword") as string) || "";

  if (!currentPassword) {
    return {
      success: false,
      error: isAr ? "يرجى إدخال كلمة المرور الحالية أو المؤقتة" : "Please enter your current or temporary password",
    };
  }

  if (newPassword !== confirmNewPassword) {
    return {
      success: false,
      error: isAr ? "كلمتا المرور غير متطابقتين" : "Passwords do not match",
    };
  }

  if (currentPassword === newPassword) {
    return {
      success: false,
      error: isAr
        ? "يجب أن تكون كلمة المرور الجديدة مختلفة عن كلمة المرور السابقة أو المؤقتة"
        : "New password must be different from previous or temporary password",
    };
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return {
      success: false,
      error: isAr
        ? "يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل، وحرف كبير، وحرف صغير، ورقم، ورمز خاص"
        : "Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character",
    };
  }

  // Rate limit: 5 attempts per 15 minutes per user
  const userRate = await checkRateLimit(`change_pwd_${session.user.id}`, 5, 15 * 60);
  if (!userRate.allowed) {
    return {
      success: false,
      error: isAr ? "تم تجاوز حد المحاولات المسموح به. يرجى المحاولة لاحقاً" : "Too many attempts. Please try again later",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return {
      success: false,
      error: isAr ? "لم يتم العثور على المستخدم" : "User not found",
    };
  }

  let isCurrentValid = false;
  if (user.passwordHash) {
    isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  }

  if (
    !isCurrentValid &&
    user.tempPasswordHash &&
    user.tempPasswordExpiresAt &&
    user.tempPasswordExpiresAt > new Date()
  ) {
    isCurrentValid = await bcrypt.compare(currentPassword, user.tempPasswordHash);
  }

  if (!isCurrentValid) {
    return {
      success: false,
      error: isAr
        ? "كلمة المرور الحالية أو المؤقتة غير صحيحة"
        : "Current or temporary password is incorrect",
    };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Increment sessionVersion to invalidate all other active sessions across devices
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      tempPasswordHash: null,
      tempPasswordExpiresAt: null,
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });

  return {
    success: true,
    sessionVersion: updatedUser.sessionVersion,
  };
}

export interface CompleteOnboardingResult {
  success: boolean;
  error?: string;
  onboardingComplete?: boolean;
}

export async function getOnboardingProfile(): Promise<{
  success: boolean;
  unauthorized?: boolean;
  user?: {
    name: string | null;
    email: string | null;
    city: string | null;
    age: number | null;
    image: string | null;
    termsAccepted: boolean;
    onboardingCompleted: boolean;
  };
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, unauthorized: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      city: true,
      age: true,
      image: true,
      termsAcceptedAt: true,
      onboardingCompletedAt: true,
    },
  });

  if (!user) {
    return { success: false, unauthorized: true };
  }

  return {
    success: true,
    user: {
      name: user.name,
      email: user.email,
      city: user.city,
      age: user.age,
      image: user.image,
      termsAccepted: Boolean(user.termsAcceptedAt),
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
    },
  };
}

export async function completeOnboarding(
  formData: FormData,
  locale: string = "ar",
): Promise<CompleteOnboardingResult> {
  const isAr = locale === "ar";
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: isAr ? "يرجى تسجيل الدخول أولاً" : "Please sign in first",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return {
      success: false,
      error: isAr ? "لم يتم العثور على الحساب" : "User account not found",
    };
  }

  const city = (formData.get("city") as string)?.trim();
  const ageRaw = formData.get("age");
  const name = (formData.get("name") as string)?.trim();
  const clearImage = formData.get("clearImage") === "true";
  const imageFile = formData.get("image") as File | null;
  const termsAccepted = formData.get("termsAccepted") === "true" || formData.get("termsAccepted") === "on";

  if (!city) {
    return {
      success: false,
      error: isAr ? "يرجى اختيار مدينتك" : "Please select your city",
    };
  }

  // Validate city against MOROCCAN_CITIES list or non-empty string
  const cityMatch = MOROCCAN_CITIES.find(
    (c) =>
      c.id.toLowerCase() === city.toLowerCase() ||
      c.nameAr.toLowerCase() === city.toLowerCase() ||
      c.nameEn.toLowerCase() === city.toLowerCase(),
  );

  const normalizedCity = cityMatch ? (isAr ? cityMatch.nameAr : cityMatch.nameEn) : city;

  const age = typeof ageRaw === "string" ? parseInt(ageRaw, 10) : Number(ageRaw);
  if (!age || isNaN(age) || age < 10 || age > 120) {
    return {
      success: false,
      error: isAr
        ? "يجب أن يكون العمر رقماً صحيحاً بين 10 و120 سنة"
        : "Age must be a valid number between 10 and 120 years",
    };
  }

  // If terms have not been accepted yet, require acceptance
  if (!user.termsAcceptedAt && !termsAccepted) {
    return {
      success: false,
      error: isAr
        ? "يجب الموافقة على شروط الخدمة وسياسة الخصوصية للمتابعة"
        : "You must accept the Terms of Service and Privacy Policy to continue",
    };
  }

  // Handle avatar image
  let newImageUrl: string | null = user.image;
  let newImagePublicId: string | null = user.imagePublicId;

  if (clearImage) {
    if (user.imagePublicId) {
      await deleteImageFromCloudinary(user.imagePublicId);
    }
    newImageUrl = null;
    newImagePublicId = null;
  } else if (imageFile && imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.size > 5 * 1024 * 1024) {
      return {
        success: false,
        error: isAr
          ? "يجب أن يكون حجم الصورة أقل من 5 ميغابايت"
          : "Photo must be less than 5MB",
      };
    }

    try {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadRes = await uploadImageToCloudinaryDetailed(buffer, "ihyaa-profiles");

      // Delete old photo if it was in Cloudinary and differs
      if (user.imagePublicId && user.imagePublicId !== uploadRes.public_id) {
        await deleteImageFromCloudinary(user.imagePublicId);
      }

      newImageUrl = uploadRes.secure_url;
      newImagePublicId = uploadRes.public_id;
    } catch (uploadErr) {
      console.error("[onboarding] Profile photo upload failed:", uploadErr);
      return {
        success: false,
        error: isAr
          ? "فشل تحميل الصورة الشخصية. يرجى المحاولة بصورة أخرى أو تخطي هذه الخطوة"
          : "Profile photo upload failed. Please try another image or skip this step",
      };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      city: normalizedCity,
      age,
      ...(name ? { name } : {}),
      image: newImageUrl,
      imagePublicId: newImagePublicId,
      ...(!user.termsAcceptedAt
        ? {
            termsAcceptedAt: new Date(),
            termsVersion: TERMS_VERSION,
          }
        : {}),
      onboardingCompletedAt: new Date(),
    },
  });

  safeRevalidatePath("/onboarding");
  safeRevalidatePath("/account");
  safeRevalidatePath("/book");

  return {
    success: true,
    onboardingComplete: true,
  };
}
