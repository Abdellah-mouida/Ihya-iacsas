import { Prisma, Role } from "@prisma/client";
import { findMoroccanCity } from "@/data/morocco";
import { touchUserActive } from "@/lib/activity";
import { logActivity } from "@/lib/audit";
import { deleteImageFromCloudinary } from "@/lib/cloudinary";
import { isEventEnded } from "@/lib/event-time";
import { notify } from "@/lib/notifications";
import { can, ForbiddenError, UnauthorizedError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPublicProfile } from "@/lib/chat/friends";
import { TERMS_VERSION } from "@/lib/terms";
import { getCachedEnabledThemes } from "@/lib/theme-server";
import { isSafeLocalAssetPath, verifyUploadProof } from "@/lib/upload-security";
import { deleteUserAccount } from "@/lib/user-deletion";
import type { SelfUserDTO } from "@/lib/api/v1/dto";

export interface UsersActor {
  id: string;
  role: string;
  name?: string | null;
  email?: string | null;
}

export function sanitizePlainText(
  input: unknown,
  options?: { preserveNewlines?: boolean },
): string {
  if (typeof input !== "string") return "";
  let cleaned = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "");
  if (options?.preserveNewlines) {
    cleaned = cleaned
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, "")
      .replace(/\n{4,}/g, "\n\n\n");
  } else {
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  }
  return cleaned.trim();
}

export function normalizeValidatedTags(
  items: string[],
  maxTags: number,
  maxCharPerTag: number,
  fieldLabelEn: string,
  fieldLabelAr: string,
  isAr: boolean,
): string[] {
  const cleaned = items
    .map((tag) => sanitizePlainText(tag))
    .filter((tag) => tag.length > 0);

  const seen = new Set<string>();
  const uniqueTags: string[] = [];
  for (const tag of cleaned) {
    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueTags.push(tag);
    }
  }

  if (uniqueTags.length > maxTags) {
    throw new Error(
      isAr
        ? `تجاوز عدد وسوم ${fieldLabelAr} الحد المسموح به (بحد أقصى ${maxTags} وسوم)`
        : `Too many ${fieldLabelEn} tags (max ${maxTags} allowed)`,
    );
  }

  for (const tag of uniqueTags) {
    if (tag.length > maxCharPerTag) {
      throw new Error(
        isAr
          ? `لا يمكن أن يتجاوز طول وسم "${tag.slice(0, 15)}..." في ${fieldLabelAr} ${maxCharPerTag} حرفاً`
          : `Tag "${tag.slice(0, 15)}..." in ${fieldLabelEn} cannot exceed ${maxCharPerTag} characters`,
      );
    }
  }

  return uniqueTags;
}

export async function getSelfUserProfile(userId: string): Promise<SelfUserDTO | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      city: true,
      age: true,
      image: true,
      coverImage: true,
      coverWidth: true,
      coverHeight: true,
      bio: true,
      studyLevel: true,
      institution: true,
      interests: true,
      skills: true,
      languages: true,
      volunteerAreas: true,
      theme: true,
      locale: true,
      reduceMotion: true,
      emailVerified: true,
      onboardingCompletedAt: true,
      mustChangePassword: true,
      passwordHash: true,
      friendRequestPolicy: true,
      showOnlineStatus: true,
      showFriendCount: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const friendCount = await prisma.friendship.count({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    city: user.city,
    age: user.age,
    image: user.image,
    coverImage: user.coverImage,
    coverWidth: user.coverWidth,
    coverHeight: user.coverHeight,
    bio: user.bio,
    studyLevel: user.studyLevel,
    institution: user.institution,
    interests: user.interests,
    skills: user.skills,
    languages: user.languages,
    volunteerAreas: user.volunteerAreas,
    theme: user.theme ?? "light",
    locale: user.locale ?? "ar",
    reduceMotion: Boolean(user.reduceMotion),
    emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    mustChangePassword: user.mustChangePassword,
    hasPassword: Boolean(user.passwordHash),
    friendRequestPolicy: user.friendRequestPolicy,
    showOnlineStatus: user.showOnlineStatus,
    showFriendCount: user.showFriendCount,
    friendCount,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getPublicUserProfileDto(
  viewerId: string,
  targetUserId: string,
) {
  return getPublicProfile(viewerId, targetUserId);
}

export async function updateUserProfileFields(params: {
  userId: string;
  name: string;
  city: string;
  age: number;
  bio?: string | null;
  studyLevel?: string | null;
  institution?: string | null;
  interests?: string[];
  skills?: string[];
  languages?: string[];
  volunteerAreas?: string[];
  locale?: string;
}): Promise<
  | {
      success: true;
      user: {
        name: string | null;
        city: string | null;
        age: number | null;
        image: string | null;
        bio: string | null;
        studyLevel: string | null;
        institution: string | null;
        interests: string[];
        skills: string[];
        languages: string[];
        volunteerAreas: string[];
      };
    }
  | { success: false; error: string; status: number }
> {
  const isAr = (params.locale ?? "ar") === "ar";
  const name = params.name.trim();
  const city = params.city.trim();

  if (!name || name.length < 2 || name.length > 100) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يرجى إدخال اسم صحيح (بين 2 و 100 حرف)"
        : "Please enter a valid name (between 2 and 100 characters)",
    };
  }

  const cityMatch = findMoroccanCity(city);
  if (!cityMatch) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يرجى اختيار مدينة صالحة من القائمة"
        : "Please select a valid city from the list",
    };
  }

  if (!Number.isInteger(params.age) || params.age < 10 || params.age > 120) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يرجى إدخال سن صحيح (بين 10 و 120 سنة)"
        : "Please enter a valid age (between 10 and 120 years)",
    };
  }

  const bio =
    params.bio !== undefined && params.bio !== null
      ? sanitizePlainText(params.bio, { preserveNewlines: true })
      : null;
  if (bio && bio.length > 280) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "لا يمكن أن تتجاوز النبذة 280 حرفاً"
        : "Short bio cannot exceed 280 characters",
    };
  }

  const studyLevel =
    params.studyLevel !== undefined && params.studyLevel !== null
      ? sanitizePlainText(params.studyLevel)
      : null;
  if (studyLevel && studyLevel.length > 100) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "لا يمكن أن يتجاوز المستوى الدراسي 100 حرف"
        : "Study level cannot exceed 100 characters",
    };
  }

  const institution =
    params.institution !== undefined && params.institution !== null
      ? sanitizePlainText(params.institution)
      : null;
  if (institution && institution.length > 120) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "لا يمكن أن يتجاوز اسم المؤسسة 120 حرفاً"
        : "Institution name cannot exceed 120 characters",
    };
  }

  let interests: string[] = [];
  let skills: string[] = [];
  let languages: string[] = [];
  let volunteerAreas: string[] = [];
  try {
    interests = normalizeValidatedTags(
      params.interests ?? [],
      8,
      30,
      "interests",
      "الاهتمامات",
      isAr,
    );
    skills = normalizeValidatedTags(
      params.skills ?? [],
      8,
      30,
      "skills",
      "المهارات",
      isAr,
    );
    languages = normalizeValidatedTags(
      params.languages ?? [],
      6,
      30,
      "languages",
      "اللغات",
      isAr,
    );
    volunteerAreas = normalizeValidatedTags(
      params.volunteerAreas ?? [],
      6,
      30,
      "volunteer preferences",
      "مجالات التطوع",
      isAr,
    );
  } catch (err) {
    return {
      success: false,
      status: 400,
      error: err instanceof Error ? err.message : "Invalid tags",
    };
  }

  const updatedUser = await prisma.user.update({
    where: { id: params.userId },
    data: {
      name,
      city: isAr ? cityMatch.nameAr : cityMatch.nameEn,
      age: params.age,
      bio: bio || null,
      studyLevel: studyLevel || null,
      institution: institution || null,
      interests,
      skills,
      languages,
      volunteerAreas,
    },
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      age: true,
      image: true,
      bio: true,
      studyLevel: true,
      institution: true,
      interests: true,
      skills: true,
      languages: true,
      volunteerAreas: true,
    },
  });

  await logActivity({
    actorId: updatedUser.id,
    actorName: updatedUser.name,
    actorEmail: updatedUser.email,
    action: "PROFILE_UPDATED",
    targetType: "User",
    targetId: updatedUser.id,
    targetName: updatedUser.name,
    targetEmail: updatedUser.email,
  });

  touchUserActive(params.userId).catch(() => {});

  return {
    success: true,
    user: {
      name: updatedUser.name,
      city: updatedUser.city,
      age: updatedUser.age,
      image: updatedUser.image,
      bio: updatedUser.bio,
      studyLevel: updatedUser.studyLevel,
      institution: updatedUser.institution,
      interests: updatedUser.interests,
      skills: updatedUser.skills,
      languages: updatedUser.languages,
      volunteerAreas: updatedUser.volunteerAreas,
    },
  };
}

export async function completeOnboardingForUser(params: {
  userId: string;
  city: string;
  age: number;
  name?: string;
  termsAccepted: boolean;
  locale?: string;
}): Promise<{ success: boolean; error?: string; status?: number }> {
  const isAr = (params.locale ?? "ar") === "ar";
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, email: true, termsAcceptedAt: true },
  });

  if (!user) {
    return {
      success: false,
      status: 404,
      error: isAr ? "لم يتم العثور على الحساب" : "User account not found",
    };
  }

  const cityMatch = findMoroccanCity(params.city.trim());
  if (!cityMatch) {
    return {
      success: false,
      status: 400,
      error: isAr ? "يرجى اختيار مدينتك" : "Please select your city",
    };
  }

  if (!Number.isInteger(params.age) || params.age < 10 || params.age > 120) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يجب أن يكون العمر رقماً صحيحاً بين 10 و120 سنة"
        : "Age must be a valid number between 10 and 120 years",
    };
  }

  if (!user.termsAcceptedAt && !params.termsAccepted) {
    return {
      success: false,
      status: 400,
      error: isAr
        ? "يجب الموافقة على شروط الخدمة وسياسة الخصوصية للمتابعة"
        : "You must accept the Terms of Service and Privacy Policy to continue",
    };
  }

  const cleanName = params.name?.trim();
  const normalizedCity = isAr ? cityMatch.nameAr : cityMatch.nameEn;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      city: normalizedCity,
      age: params.age,
      ...(cleanName ? { name: cleanName } : {}),
      ...(!user.termsAcceptedAt
        ? {
            termsAcceptedAt: new Date(),
            termsVersion: TERMS_VERSION,
          }
        : {}),
      onboardingCompletedAt: new Date(),
    },
  });

  await logActivity({
    actorId: user.id,
    actorName: cleanName || user.name,
    actorEmail: user.email,
    action: "ONBOARDING_COMPLETED",
    targetType: "User",
    targetId: user.id,
    targetName: cleanName || user.name,
    targetEmail: user.email,
    details: { termsAccepted: Boolean(user.termsAcceptedAt || params.termsAccepted) },
  });

  return { success: true };
}

export async function updateUserPreferencesForUser(params: {
  userId: string;
  theme?: string;
  locale?: string;
  reduceMotion?: boolean;
  coverImage?: string | null;
  uploadProof?: string;
}): Promise<
  | {
      success: true;
      preferences: {
        theme: string | null;
        locale: string | null;
        reduceMotion: boolean;
        coverImage: string | null;
        coverWidth: number | null;
        coverHeight: number | null;
      };
    }
  | { success: false; error: string; status: number }
> {
  const data: Prisma.UserUpdateInput = {};

  if (params.theme !== undefined) {
    const enabledThemes = await getCachedEnabledThemes();
    if (!enabledThemes.some((t) => t.slug === params.theme)) {
      return { success: false, status: 400, error: "Invalid theme" };
    }
    data.theme = params.theme;
  }

  if (params.locale !== undefined) {
    if (params.locale !== "ar" && params.locale !== "en") {
      return { success: false, status: 400, error: "Invalid locale" };
    }
    data.locale = params.locale;
  }

  if (params.reduceMotion !== undefined) {
    data.reduceMotion = params.reduceMotion;
  }

  let previousCoverPublicIdToDelete: string | null = null;
  if (typeof params.uploadProof === "string" && params.uploadProof.trim()) {
    const verified = verifyUploadProof(
      params.uploadProof.trim(),
      params.userId,
      "covers",
    );
    if (!verified) {
      return { success: false, status: 400, error: "Invalid cover upload proof" };
    }
    const existing = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { coverImagePublicId: true },
    });
    if (
      existing?.coverImagePublicId?.startsWith("ihyaa-covers/") &&
      existing.coverImagePublicId !== verified.publicId
    ) {
      previousCoverPublicIdToDelete = existing.coverImagePublicId;
    }
    data.coverImage = verified.url;
    data.coverImagePublicId = verified.publicId;
    data.coverWidth = verified.imageWidth;
    data.coverHeight = verified.imageHeight;
  } else if (params.coverImage !== undefined) {
    if (params.coverImage === null) {
      const existing = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { coverImagePublicId: true },
      });
      if (existing?.coverImagePublicId?.startsWith("ihyaa-covers/")) {
        previousCoverPublicIdToDelete = existing.coverImagePublicId;
      }
      data.coverImage = null;
      data.coverImagePublicId = null;
      data.coverWidth = null;
      data.coverHeight = null;
    } else if (isSafeLocalAssetPath(params.coverImage)) {
      const existing = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { coverImagePublicId: true },
      });
      if (existing?.coverImagePublicId?.startsWith("ihyaa-covers/")) {
        previousCoverPublicIdToDelete = existing.coverImagePublicId;
      }
      data.coverImage = params.coverImage.trim();
      data.coverImagePublicId = null;
      data.coverWidth = null;
      data.coverHeight = null;
    } else {
      return { success: false, status: 400, error: "Invalid coverImage value" };
    }
  }

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data,
    select: {
      theme: true,
      locale: true,
      reduceMotion: true,
      coverImage: true,
      coverWidth: true,
      coverHeight: true,
    },
  });

  if (previousCoverPublicIdToDelete) {
    await deleteImageFromCloudinary(previousCoverPublicIdToDelete).catch(() => {});
  }

  return { success: true, preferences: updated };
}

export async function updateUserPrivacyForUser(
  userId: string,
  input: {
    friendRequestPolicy?: "EVERYONE" | "NOBODY";
    showOnlineStatus?: boolean;
    showFriendCount?: boolean;
  },
) {
  const data: Prisma.UserUpdateInput = {};
  if (input.friendRequestPolicy !== undefined) {
    data.friendRequestPolicy = input.friendRequestPolicy;
  }
  if (input.showOnlineStatus !== undefined) {
    data.showOnlineStatus = input.showOnlineStatus;
  }
  if (input.showFriendCount !== undefined) {
    data.showFriendCount = input.showFriendCount;
  }

  if (Object.keys(data).length === 0) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        friendRequestPolicy: true,
        showOnlineStatus: true,
        showFriendCount: true,
      },
    });
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      friendRequestPolicy: true,
      showOnlineStatus: true,
      showFriendCount: true,
    },
  });
}

export async function updateUserAvatarForUser(params: {
  userId: string;
  imageUrl?: string | null;
  uploadProof?: string;
  locale?: string;
}): Promise<{ success: boolean; image?: string | null; error?: string; status?: number }> {
  const isAr = (params.locale ?? "ar") === "ar";

  let verifiedUrl: string | null = null;
  let verifiedPublicId: string | null = null;

  if (typeof params.uploadProof === "string" && params.uploadProof.trim()) {
    const proof = verifyUploadProof(
      params.uploadProof.trim(),
      params.userId,
      "avatars",
    );
    if (!proof) {
      return {
        success: false,
        status: 400,
        error: isAr ? "تعذر التحقق من رفع الصورة" : "Invalid image upload proof",
      };
    }
    verifiedUrl = proof.url;
    verifiedPublicId = proof.publicId;
  } else if (params.imageUrl === null) {
    verifiedUrl = null;
    verifiedPublicId = null;
  } else if (typeof params.imageUrl === "string" && isSafeLocalAssetPath(params.imageUrl)) {
    verifiedUrl = params.imageUrl.trim();
    verifiedPublicId = null;
  } else {
    return {
      success: false,
      status: 400,
      error: isAr ? "رابط الصورة غير صالح" : "Invalid image URL",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, email: true, imagePublicId: true },
  });
  if (!existing) {
    return {
      success: false,
      status: 404,
      error: isAr ? "المستخدم غير موجود" : "User not found",
    };
  }

  if (
    existing.imagePublicId?.startsWith("ihyaa-profiles/") &&
    existing.imagePublicId !== verifiedPublicId
  ) {
    await deleteImageFromCloudinary(existing.imagePublicId).catch(() => {});
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { image: verifiedUrl, imagePublicId: verifiedPublicId },
    select: { id: true, image: true, name: true, email: true },
  });

  await logActivity({
    actorId: updated.id,
    actorName: updated.name,
    actorEmail: updated.email,
    action: "PROFILE_UPDATED",
    targetType: "User",
    targetId: updated.id,
    targetName: updated.name,
    targetEmail: updated.email,
  });

  return { success: true, image: updated.image };
}

export async function listAdminUsersForActor(
  actor: UsersActor | null,
  params: { page?: number; limit?: number; search?: string; role?: string } = {},
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "users:view")) throw new ForbiddenError();

  const safePage = Math.max(1, params.page ?? 1);
  const safeLimit = Math.min(100, Math.max(1, params.limit ?? 10));
  const skip = (safePage - 1) * safeLimit;
  const where: Prisma.UserWhereInput = {};

  if (
    params.role &&
    params.role !== "ALL" &&
    Object.values(Role).includes(params.role as Role)
  ) {
    where.role = params.role as Role;
  }

  const cleanSearch = (params.search ?? "").trim();
  if (cleanSearch) {
    where.OR = [
      { name: { contains: cleanSearch, mode: "insensitive" } },
      { email: { contains: cleanSearch, mode: "insensitive" } },
      { city: { contains: cleanSearch, mode: "insensitive" } },
    ];
  }

  const [users, total, totalUsers, totalAdmins, totalModerators, thirtyDaysActive] =
    await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          city: true,
          age: true,
          locale: true,
          bio: true,
          studyLevel: true,
          institution: true,
          interests: true,
          skills: true,
          languages: true,
          volunteerAreas: true,
          lastLoginAt: true,
          lastActiveAt: true,
          createdAt: true,
          updatedAt: true,
          accounts: { select: { provider: true } },
          _count: { select: { bookings: true, auditLogs: true } },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.user.count({ where: { role: Role.MODERATOR } }),
      prisma.user.count({
        where: {
          lastActiveAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    users,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    stats: {
      totalUsers,
      totalAdmins,
      totalModerators,
      activeLast30Days: thirtyDaysActive,
    },
  };
}

export async function updateUserRoleForActor(
  actor: UsersActor | null,
  params: { userId: string; newRole: Role; reason?: string },
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "users:manage_roles")) throw new ForbiddenError();

  if (!Object.values(Role).includes(params.newRole)) {
    throw new Error("Invalid role specified.");
  }

  if (actor.id === params.userId) {
    throw new Error("You cannot change your own administrative role.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, role: true, name: true },
  });

  if (!targetUser) {
    throw new Error("User not found.");
  }

  if (targetUser.role === Role.ADMIN && params.newRole !== Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN },
    });
    if (adminCount <= 1) {
      throw new Error("Cannot demote the only remaining administrator.");
    }
  }

  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: params.userId },
      data: {
        role: params.newRole,
        sessionVersion: { increment: 1 },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    }),
    prisma.apiSession.updateMany({
      where: { userId: params.userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: "ROLE_CHANGED" },
    }),
    prisma.apiRefreshToken.updateMany({
      where: { session: { userId: params.userId }, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "USER_ROLE_UPDATE",
    targetType: "USER",
    targetId: params.userId,
    targetName: updated.name,
    targetEmail: updated.email,
    details: {
      targetEmail: targetUser.email,
      previousRole: targetUser.role,
      newRole: params.newRole,
      reason: params.reason?.trim() || "Role updated in admin panel",
    },
  });

  await notify(params.userId, "ADMIN_ROLE_CHANGED", {
    params: { role: params.newRole },
    data: { role: params.newRole },
    dedupeKey: `role:${params.userId}:${params.newRole}:${actor.id}`,
  });

  return updated;
}

export async function deleteOrAnonymizeUserForActor(
  actor: UsersActor | null,
  params: { userId: string; action: "delete" | "anonymize"; reason?: string },
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "users:delete")) throw new ForbiddenError();

  if (actor.id === params.userId) {
    throw new Error("You cannot delete or anonymize your own account.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, role: true, name: true },
  });

  if (!targetUser) {
    throw new Error("User not found.");
  }

  if (targetUser.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN },
    });
    if (adminCount <= 1) {
      throw new Error("Cannot remove the only remaining administrator.");
    }
  }

  if (params.action === "anonymize") {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.account.deleteMany({ where: { userId: params.userId } });
      await tx.session.deleteMany({ where: { userId: params.userId } });
      await tx.apiSession.updateMany({
        where: { userId: params.userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: "USER_ANONYMIZED" },
      });
      await tx.apiRefreshToken.updateMany({
        where: { session: { userId: params.userId }, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.user.update({
        where: { id: params.userId },
        data: {
          name: "Anonymous User",
          email: `anonymized-${params.userId}@ihyaa.internal`,
          emailVerified: null,
          image: null,
          passwordHash: null,
          city: null,
          age: null,
          imagePublicId: null,
          role: Role.USER,
          sessionVersion: { increment: 1 },
        },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action: "USER_ANONYMIZE",
      targetType: "USER",
      targetId: params.userId,
      targetName: targetUser.name,
      targetEmail: targetUser.email,
      details: {
        targetRole: targetUser.role,
        action: params.action,
        reason: params.reason?.trim() || "User anonymized via admin panel",
      },
    });
  } else {
    await deleteUserAccount({
      targetUserId: params.userId,
      actorId: actor.id,
      action: "USER_DELETE",
      reason: params.reason?.trim() || "User deleted via admin panel",
    });
  }
}

export async function getFormattedBookingsForUser(
  userId: string,
  userEmail?: string | null,
) {
  if (userEmail) {
    await prisma.booking.updateMany({
      where: {
        email: userEmail.toLowerCase(),
        userId: null,
      },
      data: { userId },
    });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { userId },
        userEmail ? { email: userEmail.toLowerCase() } : { userId },
      ],
    },
    include: { event: true },
    orderBy: { createdAt: "desc" },
  });

  return bookings.map((b) => ({
    id: b.id,
    eventId: b.eventId,
    status: b.status,
    confirmed: b.confirmed,
    waitlistOrder: b.waitlistOrder,
    motive: b.motive,
    createdAt: b.createdAt.toISOString(),
    event: {
      id: b.event.id,
      slug: b.event.slug,
      titleAr: b.event.titleAr,
      titleEn: b.event.titleEn,
      date: b.event.date.toISOString().split("T")[0],
      time: b.event.time,
      location: b.event.location,
      posterUrl: b.event.posterUrl,
      posterWidth: b.event.posterWidth,
      posterHeight: b.event.posterHeight,
      capacityType: b.event.capacityType,
      isEnded: isEventEnded(b.event.date, b.event.time),
    },
  }));
}
