import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";

import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase, loginAs } from "./helpers/admin-auth";

const widths = [360, 768, 1440] as const;
const themes = ["light", "sunset", "amoled", "black"] as const;
const locales = ["ar", "en"] as const;

async function selectLocale(page: Page, locale: (typeof locales)[number]) {
  await page.evaluate((value) => localStorage.setItem("ihyaa-locale", value), locale);
  await page.reload({ waitUntil: "domcontentloaded" });
  const direction = locale === "ar" ? "rtl" : "ltr";
  if (await page.locator("html").getAttribute("dir") !== direction) {
    await page.locator('[data-testid="language-switcher-btn"]').click();
  }
  await expect(page.locator("html")).toHaveAttribute("dir", direction);
}

async function revealScrollSections(page: Page) {
  await page.setViewportSize({ width: 360, height: 900 });
  for (const section of await page.locator("main section").all()) {
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

test("Task set 04 changed routes have 360/768/1440 RTL/LTR theme evidence", async ({ page, browser }) => {
  test.setTimeout(600_000);
  assertDevBranchDatabase("Task set 04 screenshot matrix");

  const suffix = randomBytes(16).toString("hex");
  const password = randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  const member = await prisma.user.create({
    data: {
      email: `closeout-member-${suffix}@example.test`,
      name: "Synthetic Closeout Member",
      passwordHash,
      emailVerified: new Date(),
      city: "Synthetic City",
      age: 25,
      onboardingCompletedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
      role: "USER",
    },
    select: { id: true, email: true },
  });
  const incomplete = await prisma.user.create({
    data: {
      email: `closeout-onboarding-${suffix}@example.test`,
      name: "Synthetic Incomplete Member",
      passwordHash,
      emailVerified: new Date(),
      role: "USER",
    },
    select: { id: true, email: true },
  });
  const event = await prisma.event.create({
    data: {
      slug: `closeout-${suffix}`,
      titleAr: "فعالية توثيق بصرية",
      titleEn: "Closeout Screenshot Event",
      descriptionAr: "فعالية اختبارية لالتقاط الصور فقط.",
      descriptionEn: "Synthetic event used only for screenshot coverage.",
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      time: "18:00",
      location: "Synthetic Screenshot Location",
      posterUrl: "/images/event-poster.jpg",
      capacityType: "LIMITED",
      capacity: 10,
    },
    select: { id: true, slug: true },
  });

  const evidenceDir = join(process.cwd(), "evidence/task-11");
  await mkdir(evidenceDir, { recursive: true });
  const memberRoutes = [
    ["gallery", "/gallery"],
    ["book", "/book"],
    ["majlis-booking", "/events/majlis-ihyaa/book"],
    ["dynamic-booking", `/events/${event.slug}/book`],
    ["settings-privacy", "/settings?tab=privacy"],
  ] as const;

  try {
    await loginAs(page, { email: member.email!, password, role: "USER" }, "/settings");
    for (const [name, route] of memberRoutes) {
      for (const locale of locales) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await selectLocale(page, locale);
        if (name === "gallery") await revealScrollSections(page);

        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          for (const theme of themes) {
            await page.evaluate((selectedTheme) => {
              document.documentElement.setAttribute("data-theme", selectedTheme);
              document.documentElement.classList.toggle("dark", selectedTheme === "amoled" || selectedTheme === "black");
            }, theme);
            expect(await page.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
            await page.screenshot({
              path: join(evidenceDir, `04-${name}-${locale}-${theme}-${width}.png`),
              fullPage: true,
            });
          }
        }
      }
    }

    const onboardingPage = await browser.newPage({ viewport: { width: 360, height: 900 } });
    try {
      await onboardingPage.goto("/login?callbackUrl=%2Fonboarding");
      await onboardingPage.fill('[data-testid="login-email-input"]', incomplete.email!);
      await onboardingPage.fill('[data-testid="login-password-input"]', password);
      await Promise.all([
        onboardingPage.waitForURL((url) => url.pathname === "/onboarding", { timeout: 30_000 }),
        onboardingPage.locator('[data-testid="login-submit-btn"]').click(),
      ]);
      for (const locale of locales) {
        await onboardingPage.goto("/onboarding", { waitUntil: "domcontentloaded" });
        await selectLocale(onboardingPage, locale);
        for (const width of widths) {
          await onboardingPage.setViewportSize({ width, height: 900 });
          for (const theme of themes) {
            await onboardingPage.evaluate((selectedTheme) => {
              document.documentElement.setAttribute("data-theme", selectedTheme);
              document.documentElement.classList.toggle("dark", selectedTheme === "amoled" || selectedTheme === "black");
            }, theme);
            expect(await onboardingPage.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
            await onboardingPage.screenshot({
              path: join(evidenceDir, `04-onboarding-${locale}-${theme}-${width}.png`),
              fullPage: true,
            });
          }
        }
      }
    } finally {
      await onboardingPage.close();
    }
  } finally {
    await prisma.auditLog.deleteMany({ where: { actorEmail: { in: [member.email!, incomplete.email!] } } });
    await prisma.booking.deleteMany({ where: { eventId: event.id } });
    await prisma.event.deleteMany({ where: { id: event.id } });
    await prisma.user.deleteMany({ where: { id: { in: [member.id, incomplete.id] } } });
  }
});
