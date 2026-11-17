import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";

import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";

async function login(page: Page, email: string, password: string, callbackUrl: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.locator('[data-testid="login-email-input"]').fill(email);
  await page.locator('[data-testid="login-password-input"]').fill(password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await expect(page).not.toHaveURL(/\/login(?:\?.*)?$/, { timeout: 20_000 });
}

test.describe("Booking status is scoped to the authenticated user", () => {
  test.setTimeout(240_000);

  test("user B sees no booked state on events, /book, or the event booking page after A signs out", async ({ page }) => {
    assertDevBranchDatabase("Booking user isolation test");
    const userA = await createSyntheticUser("Booking user isolation A");
    const userB = await createSyntheticUser("Booking user isolation B");
    const suffix = randomBytes(8).toString("hex");
    const slug = `user-isolation-${suffix}`;
    let eventId: string | undefined;

    try {
      await prisma.user.updateMany({
        where: { id: { in: [userA.id, userB.id] } },
        data: {
          city: "Rabat",
          age: 25,
          onboardingCompletedAt: new Date(),
        },
      });
      const event = await prisma.event.create({
        data: {
          slug,
          titleAr: `اختبار عزل الحجز ${suffix}`,
          titleEn: `Booking Isolation ${suffix}`,
          descriptionAr: "اختبار حجز داخلي",
          descriptionEn: "Internal booking isolation test",
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          time: "18:00",
          location: "Rabat",
          posterUrl: "/images/event-poster.jpg",
          capacityType: "OPEN",
          bookingOpen: true,
        },
      });
      eventId = event.id;

      await login(page, userA.email, userA.password, "/events");
      await prisma.booking.create({
        data: {
          eventId: event.id,
          userId: userA.id,
          fullName: "Synthetic Ihyaa Member",
          email: userA.email,
          city: "Rabat",
          age: 25,
          confirmed: true,
          status: "CONFIRMED",
        },
      });

      await page.goto("/events");
      const eventCard = page.locator(`[data-testid="event-card-${event.id}"]`);
      await expect(eventCard).toBeVisible({ timeout: 30_000 });
      await expect(eventCard.locator('[data-testid="booked-state-badge"]')).toBeVisible();

      await page.evaluate(({ id }) => {
        localStorage.setItem(`ihyaa_booked_${id}`, "true");
        localStorage.setItem(`ihyaa_booking_ref_${id}`, "legacy-reference");
        document.cookie = `ihyaa_booked_${id}=true; path=/; SameSite=Lax`;
      }, { id: event.id });
      await page.locator('[data-testid="navbar-user-menu-btn"]').click();
      await page.locator('[data-testid="navbar-logout-btn"]').click();
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
      expect(await page.evaluate(({ id }) => localStorage.getItem(`ihyaa_booked_${id}`), { id: event.id })).toBeNull();
      expect(await page.evaluate(({ id }) => localStorage.getItem(`ihyaa_booking_ref_${id}`), { id: event.id })).toBeNull();
      expect(await page.evaluate(({ id }) => document.cookie.includes(`ihyaa_booked_${id}=true`), { id: event.id })).toBe(false);
      await login(page, userB.email, userB.password, "/events");

      await page.goto("/events");
      const userBEventCard = page.locator(`[data-testid="event-card-${event.id}"]`);
      await expect(userBEventCard).toBeVisible({ timeout: 30_000 });
      await expect(userBEventCard.locator('[data-testid="booked-state-badge"]')).toHaveCount(0);

      await page.goto(`/book?eventId=${encodeURIComponent(slug)}`);
      await expect(page.locator('[data-testid="booking-stepper"]')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-testid="already-booked-gate"]')).toHaveCount(0);

      await page.goto(`/events/${encodeURIComponent(slug)}/book`);
      await expect(page.locator('[data-testid="booking-stepper"]')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-testid="already-booked-gate"]')).toHaveCount(0);
    } finally {
      assertDevBranchDatabase("Booking user isolation cleanup");
      if (eventId) {
        await prisma.booking.deleteMany({ where: { eventId } });
        await prisma.event.delete({ where: { id: eventId } });
      }
      await prisma.session.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
      await removeSyntheticUser(userA.id);
      await removeSyntheticUser(userB.id);
    }
  });
});
