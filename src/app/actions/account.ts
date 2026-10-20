"use server";

import { auth } from "@/auth";
import { touchUserActive } from "@/lib/activity";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinaryDetailed,
} from "@/lib/cloudinary";
import { isEventEnded } from "@/lib/event-time";
import { MOROCCAN_CITIES } from "@/lib/moroccan-cities";
import { prisma } from "@/lib/prisma";
import { safeRevalidatePath } from "@/lib/cache";
import { sendWaitlistPromotionEmail } from "@/lib/email";

export interface AccountBookingItem {
  id: string;
  eventId: string;
  status: string;
  confirmed: boolean;
  waitlistOrder: number | null;
  createdAt: string;
  event: {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    date: string;
    time: string;
    location: string;
    posterUrl: string | null;
    capacityType: string;
    isEnded: boolean;
  };
}

export interface UserAccountData {
  user: {
    id: string;
    role: "ADMIN" | "MODERATOR" | "USER";
    name: string | null;
    email: string | null;
    city: string | null;
    age: number | null;
    image: string | null;
    coverImage: string | null;
    theme: string | null;
    reduceMotion: boolean;
    locale: string | null;
    emailVerified: string | null;
    hasPassword: boolean;
    termsAcceptedAt: string | null;
    createdAt: string;
    bio: string | null;
    studyLevel: string | null;
    institution: string | null;
    interests: string[];
    skills: string[];
    languages: string[];
    volunteerAreas: string[];
  };
  bookings: AccountBookingItem[];
}

function sanitizePlainText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim();
}

function parseAndValidateTags(
  raw: FormDataEntryValue | null,
  maxTags: number,
  maxCharPerTag: number,
  fieldLabelEn: string,
  fieldLabelAr: string,
  isAr: boolean,
): string[] {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  let items: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      items = parsed.map((x) => String(x));
    } else {
      items = raw.split(",");
    }
  } catch {
    items = raw.split(",");
  }

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

/**
 * Fetch authenticated user's account data and their bookings.
 */
export async function getUserAccountData(): Promise<{
  success: boolean;
  data?: UserAccountData;
  error?: string;
}> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        age: true,
        image: true,
        emailVerified: true,
        passwordHash: true,
        termsAcceptedAt: true,
        role: true,
        createdAt: true,
        bio: true,
        studyLevel: true,
        institution: true,
        interests: true,
        skills: true,
        languages: true,
        volunteerAreas: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Touch user activity timestamp asynchronously
    touchUserActive(user.id).catch(() => {});

    // Link any orphan bookings for this user's email if not already linked
    if (user.email) {
      await prisma.booking.updateMany({
        where: {
          email: user.email.toLowerCase(),
          userId: null,
        },
        data: {
          userId: user.id,
        },
      });
    }

    // Fetch user bookings
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: user.id },
          user.email ? { email: user.email.toLowerCase() } : { userId: user.id },
        ],
      },
      include: {
        event: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedBookings: AccountBookingItem[] = bookings.map((b) => ({
      id: b.id,
      eventId: b.eventId,
      status: b.status,
      confirmed: b.confirmed,
      waitlistOrder: b.waitlistOrder,
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
        capacityType: b.event.capacityType,
        isEnded: isEventEnded(b.event.date, b.event.time),
      },
    }));

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          city: user.city,
          age: user.age,
          image: user.image,
          emailVerified: user.emailVerified?.toISOString() || null,
          hasPassword: Boolean(user.passwordHash),
          termsAcceptedAt: user.termsAcceptedAt?.toISOString() || null,
          createdAt: user.createdAt.toISOString(),
          coverImage: (user as any).coverImage || null,
          theme: (user as any).theme || "oasis",
          reduceMotion: Boolean((user as any).reduceMotion),
          locale: (user as any).locale || "ar",
          bio: user.bio,
          studyLevel: user.studyLevel,
          institution: user.institution,
          interests: user.interests || [],
          skills: user.skills || [],
          languages: user.languages || [],
          volunteerAreas: user.volunteerAreas || [],
        },
        bookings: formattedBookings,
      },
    };
  } catch (err) {
    console.error("Error fetching user account data:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load account data",
    };
  }
}

/**
 * Update authenticated user's profile details.
 */
export async function updateUserProfile(
  formData: FormData,
  locale: string = "ar",
): Promise<{
  success: boolean;
  error?: string;
  user?: {
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
}> {
  const isAr = locale === "ar";
  const session = await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      error: isAr ? "يجب تسجيل الدخول أولاً" : "You must be signed in",
    };
  }

  const name = (formData.get("name") as string)?.trim() || "";
  const city = (formData.get("city") as string)?.trim() || "";
  const ageRaw = formData.get("age");
  const removeImage = formData.get("removeImage") === "true";
  const imageFile = formData.get("image") as File | null;

  if (!name || name.length < 2 || name.length > 100) {
    return {
      success: false,
      error: isAr
        ? "يرجى إدخال اسم صحيح (بين 2 و 100 حرف)"
        : "Please enter a valid name (between 2 and 100 characters)",
    };
  }

  const validCity = MOROCCAN_CITIES.some(
    (c) => c.nameAr === city || c.nameEn.toLowerCase() === city.toLowerCase(),
  );
  if (!city || !validCity) {
    return {
      success: false,
      error: isAr
        ? "يرجى اختيار مدينة صالحة من القائمة"
        : "Please select a valid city from the list",
    };
  }

  const ageNum = ageRaw ? Number(ageRaw) : NaN;
  if (!Number.isInteger(ageNum) || ageNum < 10 || ageNum > 120) {
    return {
      success: false,
      error: isAr
        ? "يرجى إدخال سن صحيح (بين 10 و 120 سنة)"
        : "Please enter a valid age (between 10 and 120 years)",
    };
  }

  // Parse & sanitize optional fields (strip HTML tags, control chars)
  const rawBio = formData.get("bio");
  const bio = rawBio !== null ? sanitizePlainText(rawBio) : null;
  if (bio && bio.length > 280) {
    return {
      success: false,
      error: isAr
        ? "لا يمكن أن تتجاوز النبذة 280 حرفاً"
        : "Short bio cannot exceed 280 characters",
    };
  }

  const rawStudy = formData.get("studyLevel");
  const studyLevel = rawStudy !== null ? sanitizePlainText(rawStudy) : null;
  if (studyLevel && studyLevel.length > 100) {
    return {
      success: false,
      error: isAr
        ? "لا يمكن أن يتجاوز المستوى الدراسي 100 حرف"
        : "Study level cannot exceed 100 characters",
    };
  }

  const rawInst = formData.get("institution");
  const institution = rawInst !== null ? sanitizePlainText(rawInst) : null;
  if (institution && institution.length > 120) {
    return {
      success: false,
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
    interests = parseAndValidateTags(
      formData.get("interests"),
      8,
      30,
      "interests",
      "الاهتمامات",
      isAr,
    );
    skills = parseAndValidateTags(
      formData.get("skills"),
      8,
      30,
      "skills",
      "المهارات",
      isAr,
    );
    languages = parseAndValidateTags(
      formData.get("languages"),
      6,
      30,
      "languages",
      "اللغات",
      isAr,
    );
    volunteerAreas = parseAndValidateTags(
      formData.get("volunteerAreas"),
      6,
      30,
      "volunteer preferences",
      "مجالات التطوع",
      isAr,
    );
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Invalid tags",
    };
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        image: true,
        imagePublicId: true,
      },
    });

    if (!existingUser) {
      return {
        success: false,
        error: isAr ? "المستخدم غير موجود" : "User not found",
      };
    }

    let finalImageUrl = existingUser.image;
    let finalImagePublicId = existingUser.imagePublicId;

    if (removeImage && !imageFile?.size) {
      if (existingUser.imagePublicId) {
        await deleteImageFromCloudinary(existingUser.imagePublicId);
      }
      finalImageUrl = null;
      finalImagePublicId = null;
    } else if (imageFile && imageFile instanceof File && imageFile.size > 0) {
      if (imageFile.size > 5 * 1024 * 1024) {
        return {
          success: false,
          error: isAr
            ? "حجم الصورة يتجاوز الحد المسموح به (5 ميغابايت)"
            : "Image size exceeds 5MB limit",
        };
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
      if (!allowedTypes.includes(imageFile.type)) {
        return {
          success: false,
          error: isAr
            ? "صيغة الصورة غير مدعومة. يرجى اختيار JPG أو PNG أو WebP"
            : "Unsupported image format. Please select JPG, PNG, or WebP",
        };
      }

      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      if (existingUser.imagePublicId) {
        await deleteImageFromCloudinary(existingUser.imagePublicId);
      }

      const uploadRes = await uploadImageToCloudinaryDetailed(
        buffer,
        "ihyaa-profiles",
      );
      finalImageUrl = uploadRes.secure_url;
      finalImagePublicId = uploadRes.public_id;
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        city,
        age: ageNum,
        image: finalImageUrl,
        imagePublicId: finalImagePublicId,
        bio: bio || null,
        studyLevel: studyLevel || null,
        institution: institution || null,
        interests,
        skills,
        languages,
        volunteerAreas,
      },
    });

    // Asynchronously record user activity
    touchUserActive(session.user.id).catch(() => {});

    safeRevalidatePath("/account");
    safeRevalidatePath("/profile");
    safeRevalidatePath("/settings");
    safeRevalidatePath("/onboarding");

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
  } catch (err) {
    console.error("Error updating profile:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : isAr
            ? "فشل تحديث البيانات الشخصية"
            : "Failed to update profile",
    };
  }
}

/**
 * Cancel a user's booking from their account dashboard.
 * If the cancelled booking was CONFIRMED on a LIMITED event, auto-promotes the next in waitlist!
 */
export async function cancelUserBooking(
  bookingId: string,
  locale: string = "ar",
): Promise<{
  success: boolean;
  error?: string;
}> {
  const isAr = locale === "ar";
  const session = await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      error: isAr ? "يجب تسجيل الدخول أولاً" : "You must be signed in",
    };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        event: true,
      },
    });

    if (!booking) {
      return {
        success: false,
        error: isAr ? "الحجز غير موجود" : "Booking not found",
      };
    }

    // Verify ownership
    const isOwner =
      booking.userId === session.user.id ||
      (session.user.email &&
        booking.email.toLowerCase() === session.user.email.toLowerCase());

    if (!isOwner) {
      return {
        success: false,
        error: isAr
          ? "غير مصرح لك بإلغاء هذا الحجز"
          : "You are not authorized to cancel this booking",
      };
    }

    // Check if event has ended
    if (isEventEnded(booking.event.date, booking.event.time)) {
      return {
        success: false,
        error: isAr
          ? "لا يمكن إلغاء الحجز لفعالية قد انتهت"
          : "Cannot cancel booking for an event that has already ended",
      };
    }

    const wasConfirmed = booking.status === "CONFIRMED" || booking.confirmed;

    // Delete the booking record
    await prisma.booking.delete({
      where: { id: bookingId },
    });

    // If confirmed on limited event, auto-promote next waitlisted attendee
    if (wasConfirmed && booking.event.capacityType === "LIMITED") {
      const nextWaitlisted = await prisma.booking.findFirst({
        where: {
          eventId: booking.eventId,
          status: "WAITLISTED",
        },
        orderBy: [
          { waitlistOrder: "asc" },
          { createdAt: "asc" },
        ],
      });

      if (nextWaitlisted) {
        await prisma.booking.update({
          where: { id: nextWaitlisted.id },
          data: {
            status: "CONFIRMED",
            confirmed: true,
            waitlistOrder: null,
          },
        });

        try {
          await sendWaitlistPromotionEmail(nextWaitlisted.email, {
            titleAr: booking.event.titleAr,
            titleEn: booking.event.titleEn,
            date: booking.event.date,
            time: booking.event.time,
            location: booking.event.location,
          });
        } catch (emailErr) {
          console.error("Error sending auto-promotion email:", emailErr);
        }
      }
    }

    safeRevalidatePath("/account");
    safeRevalidatePath("/events");
    safeRevalidatePath("/admin/bookings");

    return { success: true };
  } catch (err) {
    console.error("Error cancelling user booking:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : isAr
            ? "فشل إلغاء الحجز"
            : "Failed to cancel booking",
    };
  }
}
