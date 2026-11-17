import bcrypt from "bcryptjs";
import { logActivity } from "@/lib/audit";
import { sendAccountVerificationEmail, sendTempPasswordEmail } from "@/lib/email";
import { generateNumericOtp, hashOtp, verifyOtpConstantTime } from "@/lib/otp";
import { generateTempPassword } from "@/lib/password";
import { validatePasswordStrength } from "@/lib/password-strength";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { signSessionRotationProof } from "@/lib/session-sync";
import { TERMS_VERSION } from "@/lib/terms";

export async function registerUserWithCredentials(params: {
  name: string;
  email: string;
  password: string;
  termsAccepted: boolean;
  locale?: string;
  clientIp: string;
}): Promise<{ success: boolean; error?: string; email?: string; status?: number }> {
  const locale = params.locale === "en" ? "en" : "ar";
  const isAr = locale === "ar";
  const name = params.name.trim();
  const emailRaw = params.email.trim().toLowerCase();
  const password = params.password;

  if (!name || name.length < 2) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يرجى إدخال اسم صحيح لا يقل عن حرفين"
        : "Please enter a valid name (at least 2 characters)",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRaw || !emailRegex.test(emailRaw)) {
    return {
      success: false,
      status: 400,
      error: isAr ? "يرجى إدخال بريد إلكتروني صحيح" : "Please enter a valid email address",
    };
  }

  if (!params.termsAccepted) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يجب الموافقة على شروط الاستخدام وسياسة الخصوصية"
        : "You must accept the Terms of Service and Privacy Policy",
    };
  }

  const strength = validatePasswordStrength(password || "");
  if (!strength.valid) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل، وحرف كبير، وحرف صغير، ورقم، ورمز خاص"
        : "Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character",
    };
  }

  const emailRate = await checkRateLimit(`signup_email_${emailRaw}`, 5, 3600);
  if (!emailRate.allowed) {
    return {
      success: false,
      status: 429,
      error: isAr
        ? "تم تجاوز حد إنشاء الحسابات، يرجى المحاولة لاحقاً"
        : "Too many signup attempts, please try again later",
    };
  }

  const ipRate = await checkRateLimit(`signup_ip_${params.clientIp}`, 15, 3600);
  if (!ipRate.allowed) {
    return {
      success: false,
      status: 429,
      error: isAr
        ? "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً"
        : "Rate limit exceeded, please try again later",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: emailRaw },
  });

  if (existingUser && existingUser.emailVerified) {
    return {
      success: false,
      status: 409,
      error: isAr
        ? "هذا البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول"
        : "This email is already registered, please sign in",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const registeredUser =
    existingUser && !existingUser.emailVerified
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            passwordHash,
            termsAcceptedAt: new Date(),
            termsVersion: TERMS_VERSION,
            locale,
          },
          select: { id: true, name: true, email: true },
        })
      : await prisma.user.create({
          data: {
            email: emailRaw,
            name,
            passwordHash,
            emailVerified: null,
            termsAcceptedAt: new Date(),
            termsVersion: TERMS_VERSION,
            locale,
          },
          select: { id: true, name: true, email: true },
        });

  await logActivity({
    actorId: registeredUser.id,
    actorName: registeredUser.name,
    actorEmail: registeredUser.email,
    action: "SIGN_UP_CREDENTIALS",
    targetType: "User",
    targetId: registeredUser.id,
    targetName: registeredUser.name,
    targetEmail: registeredUser.email,
  });

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
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const emailRes = await sendAccountVerificationEmail(emailRaw, otp, locale);
  if (!emailRes.success) {
    return {
      success: false,
      status: 502,
      error: isAr
        ? "فشل إرسال رمز التحقق إلى بريدك الإلكتروني"
        : "Failed to send verification email",
    };
  }

  return { success: true, email: emailRaw };
}

export async function verifyAccountEmailWithOtp(params: {
  email: string;
  code: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string; verified?: boolean; status?: number }> {
  const isAr = (params.locale ?? "ar") === "ar";
  const cleanEmail = params.email?.trim().toLowerCase();
  const cleanCode = params.code?.trim();

  if (!cleanEmail || !cleanCode || cleanCode.length !== 6) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يرجى إدخال رمز التحقق المكون من 6 أرقام"
        : "Please enter the 6-digit verification code",
    };
  }

  const rateCheck = await checkRateLimit(`verify_acc_${cleanEmail}`, 10, 900);
  if (!rateCheck.allowed) {
    return {
      success: false,
      status: 429,
      error: isAr
        ? "تم تجاوز حد محاولات التحقق، يرجى المحاولة لاحقاً"
        : "Too many verification attempts, please try again later",
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
      status: 400,
      error: isAr
        ? "رمز التحقق غير صالح أو انتهت صلاحيته"
        : "Verification code is invalid or has expired",
    };
  }

  if (otpRecord.attempts >= 5) {
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });
    return {
      success: false,
      status: 429,
      error: isAr
        ? "تم تجاوز الحد الأقصى للمحاولات لهذا الرمز"
        : "Maximum attempts exceeded for this code",
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
      status: 400,
      error: isAr ? "رمز التحقق غير صحيح" : "Invalid verification code",
    };
  }

  await prisma.otpVerification.update({
    where: { id: otpRecord.id },
    data: { usedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user) {
    return {
      success: false,
      status: 404,
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

  await prisma.booking.updateMany({
    where: {
      email: cleanEmail,
      userId: null,
    },
    data: {
      userId: user.id,
    },
  });

  return { success: true, verified: true };
}

export async function resendAccountVerificationOtpService(params: {
  email: string;
  locale?: string;
  clientIp?: string;
}): Promise<{ success: boolean; error?: string; status?: number }> {
  const locale = params.locale === "en" ? "en" : "ar";
  const isAr = locale === "ar";
  const cleanEmail = params.email?.trim().toLowerCase();

  if (!cleanEmail) {
    return {
      success: false,
      status: 400,
      error: isAr ? "البريد الإلكتروني مطلوب" : "Email is required",
    };
  }

  const rateCheck = await checkRateLimit(`resend_acc_${cleanEmail}`, 1, 60);
  if (!rateCheck.allowed) {
    return {
      success: false,
      status: 429,
      error: isAr
        ? "يرجى الانتظار دقيقة قبل طلب رمز جديد"
        : "Please wait one minute before requesting a new code",
    };
  }

  if (params.clientIp) {
    const ipRate = await checkRateLimit(`resend_acc_ip_${params.clientIp}`, 10, 900);
    if (!ipRate.allowed) {
      return {
        success: false,
        status: 429,
        error: isAr
          ? "يرجى الانتظار قبل طلب رمز جديد"
          : "Please wait before requesting a new code",
      };
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user || user.emailVerified) {
    return { success: true };
  }

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
      status: 502,
      error: isAr ? "فشل إرسال رمز التحقق" : "Failed to send verification email",
    };
  }

  return { success: true };
}

export async function requestPasswordResetService(params: {
  email: string;
  locale?: string;
  clientIp: string;
}): Promise<{ success: boolean; error?: string; email?: string; status?: number }> {
  const locale = params.locale === "en" ? "en" : "ar";
  const isAr = locale === "ar";
  const emailRaw = params.email.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRaw || !emailRegex.test(emailRaw)) {
    return {
      success: false,
      status: 400,
      error: isAr ? "يرجى إدخال بريد إلكتروني صحيح" : "Please enter a valid email address",
    };
  }

  const emailRate = await checkRateLimit(`forgot_email_${emailRaw}`, 3, 15 * 60);
  if (!emailRate.allowed) {
    return {
      success: false,
      status: 429,
      error: isAr
        ? "لقد تجاوزت عدد المحاولات المسموح بها لإعادة تعيين كلمة المرور. يرجى الانتظار 15 دقيقة."
        : "Too many password reset requests. Please wait 15 minutes before trying again.",
    };
  }

  const ipRate = await checkRateLimit(`forgot_ip_${params.clientIp}`, 10, 15 * 60);
  if (!ipRate.allowed) {
    return {
      success: false,
      status: 429,
      error: isAr
        ? "لقد تجاوزت عدد المحاولات المسموح بها لإعادة تعيين كلمة المرور. يرجى الانتظار 15 دقيقة."
        : "Too many password reset requests. Please wait 15 minutes before trying again.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: emailRaw },
  });

  if (user && user.email && user.emailVerified) {
    const tempPassword = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 12);
    const tempPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        tempPasswordHash,
        tempPasswordExpiresAt,
        mustChangePassword: true,
      },
    });

    await logActivity({
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      action: "PASSWORD_RESET",
      targetType: "User",
      targetId: user.id,
      targetName: user.name,
      targetEmail: user.email,
      details: { method: "temporary_password" },
    });

    await sendTempPasswordEmail(user.email, tempPassword, locale);
  }

  return { success: true, email: emailRaw };
}

export async function changePasswordForUser(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword?: string;
  locale?: string;
}): Promise<{
  success: boolean;
  error?: string;
  status?: number;
  sessionRotationProof?: string;
}> {
  const isAr = (params.locale ?? "ar") === "ar";
  const { userId, currentPassword, newPassword } = params;
  const confirmNewPassword = params.confirmNewPassword ?? newPassword;

  if (!currentPassword) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يرجى إدخال كلمة المرور الحالية أو المؤقتة"
        : "Please enter your current or temporary password",
    };
  }

  if (newPassword !== confirmNewPassword) {
    return {
      success: false,
      status: 400,
      error: isAr ? "كلمتا المرور غير متطابقتين" : "Passwords do not match",
    };
  }

  if (currentPassword === newPassword) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يجب أن تكون كلمة المرور الجديدة مختلفة عن كلمة المرور السابقة أو المؤقتة"
        : "New password must be different from previous or temporary password",
    };
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل، وحرف كبير، وحرف صغير، ورقم، ورمز خاص"
        : "Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character",
    };
  }

  const userRate = await checkRateLimit(`change_pwd_${userId}`, 5, 15 * 60);
  if (!userRate.allowed) {
    return {
      success: false,
      status: 429,
      error: isAr
        ? "تم تجاوز حد المحاولات المسموح به. يرجى المحاولة لاحقاً"
        : "Too many attempts. Please try again later",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      success: false,
      status: 404,
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
      status: 400,
      error: isAr
        ? "كلمة المرور الحالية أو المؤقتة غير صحيحة"
        : "Current or temporary password is incorrect",
    };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date();

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        tempPasswordHash: null,
        tempPasswordExpiresAt: null,
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.apiSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now, revokedReason: "PASSWORD_CHANGED" },
    }),
    prisma.apiRefreshToken.updateMany({
      where: { session: { userId: user.id }, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "PASSWORD_CHANGED",
    targetType: "User",
    targetId: user.id,
    targetName: user.name,
    targetEmail: user.email,
  });

  return {
    success: true,
    sessionRotationProof: signSessionRotationProof(
      user.id,
      user.sessionVersion,
      updatedUser.sessionVersion,
    ),
  };
}
