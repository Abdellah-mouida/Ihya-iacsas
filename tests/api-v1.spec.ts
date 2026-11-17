import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { clearRateLimit } from "../src/lib/rate-limit";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

assertDevBranchDatabase("External API v1 E2E tests");

function strongPassword(): string {
  return `V1!${randomBytes(12).toString("base64url")}aA1`;
}

test.describe("External REST API /api/v1", () => {
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdContactIds: string[] = [];
  const rateLimitKeys: string[] = [];

  test.afterAll(async () => {
    for (const key of rateLimitKeys) {
      await clearRateLimit(key).catch(() => {});
    }
    if (createdContactIds.length > 0) {
      await prisma.contactMessage
        .deleteMany({ where: { id: { in: createdContactIds } } })
        .catch(() => {});
    }
    if (createdEventIds.length > 0) {
      await prisma.booking
        .deleteMany({ where: { eventId: { in: createdEventIds } } })
        .catch(() => {});
      await prisma.event
        .deleteMany({ where: { id: { in: createdEventIds } } })
        .catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await prisma.notification
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.message
        .deleteMany({ where: { senderId: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.booking
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.apiRefreshToken
        .deleteMany({ where: { session: { userId: { in: createdUserIds } } } })
        .catch(() => {});
      await prisma.apiSession
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => {});
    }
  });

  test("enforces strict CORS origin allowlist and handles preflight", async ({
    request,
  }) => {
    const allowedOrigin = "http://localhost:3000";

    const preflightAllowed = await request.fetch("/api/v1/events", {
      method: "OPTIONS",
      headers: { Origin: allowedOrigin },
    });
    expect(preflightAllowed.status()).toBe(204);
    expect(preflightAllowed.headers()["access-control-allow-origin"]).toBe(
      allowedOrigin,
    );
    expect(preflightAllowed.headers()["vary"]).toContain("Origin");

    const preflightDisallowed = await request.fetch("/api/v1/events", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    });
    expect(preflightDisallowed.status()).toBe(403);
    const preflightErr = await preflightDisallowed.json();
    expect(preflightErr.error.code).toBe("CORS_FORBIDDEN");

    const getDisallowed = await request.get("/api/v1/events", {
      headers: { Origin: "https://evil.example" },
    });
    expect(getDisallowed.status()).toBe(403);

    const getNative = await request.get("/api/v1/events");
    expect(getNative.status()).toBe(200);
    const nativeData = await getNative.json();
    expect(Array.isArray(nativeData.events)).toBe(true);
  });

  test("auth lifecycle: register, login, refresh rotation, reuse revocation, session revoke, password change", async ({
    request,
  }) => {
    test.setTimeout(90_000);
    const email = `v1-auth-${randomUUID()}@example.test`;
    const password = strongPassword();
    const newPassword = strongPassword();
    rateLimitKeys.push(`signup_email_${email}`, `login_${email}`);

    const regRes = await request.post("/api/v1/auth/register", {
      data: {
        name: "API Test User",
        email,
        password,
        termsAccepted: true,
        locale: "en",
        role: "ADMIN",
      },
    });
    expect(regRes.status()).toBe(201);
    const regJson = await regRes.json();
    expect(regJson.registered).toBe(true);

    const createdUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    expect(createdUser).not.toBeNull();
    expect(createdUser!.role).toBe("USER");
    createdUserIds.push(createdUser!.id);

    // Unverified login is rejected
    const unverifiedLogin = await request.post("/api/v1/auth/login", {
      data: { email, password },
    });
    expect(unverifiedLogin.status()).toBe(403);
    expect((await unverifiedLogin.json()).error.code).toBe("EMAIL_NOT_VERIFIED");

    // Mark email verified in dev DB
    await prisma.user.update({
      where: { id: createdUser!.id },
      data: { emailVerified: new Date() },
    });

    // Login succeeds
    const loginRes = await request.post("/api/v1/auth/login", {
      data: {
        email,
        password,
        deviceName: "iPhone 16 Pro",
        platform: "ios",
      },
    });
    expect(loginRes.status()).toBe(200);
    const loginJson = await loginRes.json();
    expect(typeof loginJson.accessToken).toBe("string");
    expect(typeof loginJson.refreshToken).toBe("string");
    expect(loginJson.tokenType).toBe("Bearer");
    expect(loginJson.user.id).toBe(createdUser!.id);
    expect(loginJson.user.passwordHash).toBeUndefined();
    expect(loginJson.user.sessionVersion).toBeUndefined();

    // Unauthenticated /users/me fails
    const unauthMe = await request.get("/api/v1/users/me");
    expect(unauthMe.status()).toBe(401);

    // Authenticated /users/me succeeds
    const meRes = await request.get("/api/v1/users/me", {
      headers: { Authorization: `Bearer ${loginJson.accessToken}` },
    });
    expect(meRes.status()).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.user.email).toBe(email);

    // List sessions
    const sessionsRes = await request.get("/api/v1/auth/sessions", {
      headers: { Authorization: `Bearer ${loginJson.accessToken}` },
    });
    expect(sessionsRes.status()).toBe(200);
    const sessionsJson = await sessionsRes.json();
    expect(sessionsJson.sessions.length).toBe(1);
    expect(sessionsJson.sessions[0].deviceName).toBe("iPhone 16 Pro");

    // Refresh rotation
    const refresh1 = await request.post("/api/v1/auth/refresh", {
      data: { refreshToken: loginJson.refreshToken },
    });
    expect(refresh1.status()).toBe(200);
    const refresh1Json = await refresh1.json();
    expect(refresh1Json.refreshToken).not.toBe(loginJson.refreshToken);

    // Reuse of old refreshToken1 triggers family revocation
    const reuseRes = await request.post("/api/v1/auth/refresh", {
      data: { refreshToken: loginJson.refreshToken },
    });
    expect(reuseRes.status()).toBe(401);
    expect((await reuseRes.json()).error.code).toBe("REFRESH_TOKEN_REUSED");

    // Even the rotated refreshToken2 and accessToken are now revoked
    const refresh2AfterReuse = await request.post("/api/v1/auth/refresh", {
      data: { refreshToken: refresh1Json.refreshToken },
    });
    expect(refresh2AfterReuse.status()).toBe(401);

    const meAfterReuse = await request.get("/api/v1/users/me", {
      headers: { Authorization: `Bearer ${refresh1Json.accessToken}` },
    });
    expect(meAfterReuse.status()).toBe(401);

    // Re-login and test explicit session revocation + change-password
    const login2Res = await request.post("/api/v1/auth/login", {
      data: { email, password, deviceName: "Android Pixel", platform: "android" },
    });
    expect(login2Res.status()).toBe(200);
    const login2 = await login2Res.json();

    const changePwRes = await request.post("/api/v1/auth/change-password", {
      headers: { Authorization: `Bearer ${login2.accessToken}` },
      data: {
        currentPassword: password,
        newPassword,
      },
    });
    expect(changePwRes.status()).toBe(200);

    // Old access token & refresh token invalidated after password change
    const meAfterPwChange = await request.get("/api/v1/users/me", {
      headers: { Authorization: `Bearer ${login2.accessToken}` },
    });
    expect(meAfterPwChange.status()).toBe(401);

    const refreshAfterPwChange = await request.post("/api/v1/auth/refresh", {
      data: { refreshToken: login2.refreshToken },
    });
    expect(refreshAfterPwChange.status()).toBe(401);
  });

  test("RBAC, onboarding, preferences guard, bookings, public endpoints, and chat endpoints", async ({
    request,
  }) => {
    test.setTimeout(90_000);
    const userEmail = `v1-user-${randomUUID()}@example.test`;
    const adminEmail = `v1-admin-${randomUUID()}@example.test`;
    const pw = strongPassword();
    const hash = await bcrypt.hash(pw, 10);

    const [regularUser, adminUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: userEmail,
          name: "Regular API User",
          passwordHash: hash,
          emailVerified: new Date(),
          role: "USER",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: adminEmail,
          name: "Admin API User",
          passwordHash: hash,
          emailVerified: new Date(),
          onboardingCompletedAt: new Date(),
          city: "Casablanca",
          age: 25,
          role: "ADMIN",
        },
        select: { id: true },
      }),
    ]);
    createdUserIds.push(regularUser.id, adminUser.id);
    rateLimitKeys.push(`login_${userEmail}`, `login_${adminEmail}`);

    const [userLoginRes, adminLoginRes] = await Promise.all([
      request.post("/api/v1/auth/login", {
        data: { email: userEmail, password: pw },
      }),
      request.post("/api/v1/auth/login", {
        data: { email: adminEmail, password: pw },
      }),
    ]);
    expect(userLoginRes.status()).toBe(200);
    expect(adminLoginRes.status()).toBe(200);
    const userToken = (await userLoginRes.json()).accessToken as string;
    const adminToken = (await adminLoginRes.json()).accessToken as string;

    // Regular user cannot hit admin routes
    const adminUsersDenied = await request.get("/api/v1/admin/users", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(adminUsersDenied.status()).toBe(403);

    const adminModDenied = await request.get("/api/v1/admin/moderation", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(adminModDenied.status()).toBe(403);

    // Admin creates an event
    const slug = `v1-event-${randomUUID().slice(0, 8)}`;
    const createEvRes = await request.post("/api/v1/events", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        titleAr: "فعالية اختبارية",
        titleEn: "V1 API Test Event",
        descriptionAr: "وصف",
        descriptionEn: "Description",
        date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        time: "18:00",
        location: "Casablanca",
        bookingOpen: true,
        capacityType: "LIMITED",
        capacity: 5,
        slug,
      },
    });
    expect(createEvRes.status()).toBe(201);
    const createdEvent = (await createEvRes.json()).event;
    createdEventIds.push(createdEvent.id);

    // Booking blocked before onboarding
    const bookBeforeOnboarding = await request.post("/api/v1/bookings", {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { eventId: createdEvent.id, motive: "Excited to join" },
    });
    expect(bookBeforeOnboarding.status()).toBe(403);
    expect((await bookBeforeOnboarding.json()).error.code).toBe(
      "ONBOARDING_REQUIRED",
    );

    // Complete onboarding
    const onboardRes = await request.post("/api/v1/users/me/onboarding", {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        city: "Rabat",
        age: 22,
        termsAccepted: true,
        locale: "en",
      },
    });
    expect(onboardRes.status()).toBe(200);

    // Preferences rejects unverified coverImage URL
    const badPrefRes = await request.patch("/api/v1/users/me/preferences", {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        coverImage: "https://evil.example/cover.png",
        coverImagePublicId: "other-folder/cover",
      },
    });
    expect(badPrefRes.status()).toBe(400);

    // Create booking succeeds after onboarding
    const bookRes = await request.post("/api/v1/bookings", {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { eventId: createdEvent.id, motive: "Ready to volunteer" },
    });
    expect(bookRes.status()).toBe(201);
    const bookJson = await bookRes.json();
    expect(bookJson.status).toBe("PENDING");

    // Cancel booking
    const cancelRes = await request.delete(
      `/api/v1/bookings/${bookJson.bookingId}`,
      {
        headers: { Authorization: `Bearer ${userToken}` },
      },
    );
    expect(cancelRes.status()).toBe(200);

    // Public + RBAC dashboard endpoints
    const [galleryRes, carouselRes, branchesRes, statsUnauthRes, statsUserRes, statsAdminRes, notifsRes] =
      await Promise.all([
        request.get("/api/v1/gallery"),
        request.get("/api/v1/carousel"),
        request.get("/api/v1/branches"),
        request.get("/api/v1/dashboard/stats"),
        request.get("/api/v1/dashboard/stats", {
          headers: { Authorization: `Bearer ${userToken}` },
        }),
        request.get("/api/v1/dashboard/stats", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        request.get("/api/v1/notifications/summary", {
          headers: { Authorization: `Bearer ${userToken}` },
        }),
      ]);
    expect(galleryRes.status()).toBe(200);
    expect(carouselRes.status()).toBe(200);
    expect(branchesRes.status()).toBe(200);
    expect(statsUnauthRes.status()).toBe(401);
    expect(statsUserRes.status()).toBe(403);
    expect(statsAdminRes.status()).toBe(200);
    expect(notifsRes.status()).toBe(200);

    // Contact form submission
    const contactRes = await request.post("/api/v1/contacts", {
      data: {
        name: "API Contact Tester",
        email: `contact-${randomUUID()}@example.test`,
        message: "Testing v1 contact submission",
      },
    });
    expect(contactRes.status()).toBe(201);
    const contactJson = await contactRes.json();
    createdContactIds.push(contactJson.id);

    // Chat terms + conversations + messages
    const termsRes = await request.post("/api/v1/chat/terms", {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { accepted: true },
    });
    expect(termsRes.status()).toBe(200);

    const convsRes = await request.get("/api/v1/chat/conversations", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(convsRes.status()).toBe(200);
    const convsJson = await convsRes.json();
    const publicConv = convsJson.conversations.find(
      (c: { type: string }) => c.type === "PUBLIC",
    );
    if (publicConv) {
      const sendMsgRes = await request.post("/api/v1/chat/messages", {
        headers: { Authorization: `Bearer ${userToken}` },
        data: {
          conversationId: publicConv.id,
          body: "Hello from /api/v1 test",
        },
      });
      expect(sendMsgRes.status()).toBe(201);
      const sentMsg = (await sendMsgRes.json()).message;

      const editMsgRes = await request.patch(
        `/api/v1/chat/messages/${sentMsg.id}`,
        {
          headers: { Authorization: `Bearer ${userToken}` },
          data: { body: "Edited from /api/v1 test" },
        },
      );
      expect(editMsgRes.status()).toBe(200);

      const delMsgRes = await request.delete(
        `/api/v1/chat/messages/${sentMsg.id}`,
        {
          headers: { Authorization: `Bearer ${userToken}` },
        },
      );
      expect(delMsgRes.status()).toBe(200);
    }

    const rtTokenRes = await request.get("/api/v1/chat/realtime/token", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(rtTokenRes.status()).toBe(200);

    const presenceRes = await request.get("/api/v1/chat/realtime/presence", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(presenceRes.status()).toBe(200);

    // Admin role change revokes user's active API session
    const roleRes = await request.patch(
      `/api/v1/admin/users/${regularUser.id}/role`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { role: "MODERATOR", reason: "API v1 test promotion" },
      },
    );
    expect(roleRes.status()).toBe(200);

    const meAfterRoleChange = await request.get("/api/v1/users/me", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(meAfterRoleChange.status()).toBe(401);
  });
});
