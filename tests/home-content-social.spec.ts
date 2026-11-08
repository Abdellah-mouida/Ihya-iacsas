import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const socialLinks = [
  { href: "https://www.facebook.com/share/1F5TaTamYB/", label: { ar: "تابعوا برنامج إحياء الشبابي على فيسبوك", en: "Follow Ihyaa Youth Program on Facebook" } },
  { href: "https://www.instagram.com/i7yae_shabab", label: { ar: "تابعوا برنامج إحياء الشبابي على إنستغرام", en: "Follow Ihyaa Youth Program on Instagram" } },
  { href: "https://youtube.com/@i7yae_shababi", label: { ar: "تابعوا برنامج إحياء الشبابي على يوتيوب", en: "Follow Ihyaa Youth Program on YouTube" } },
];

const homeCopy = {
  ar: {
    title: "برنامج إحياء الشبابي",
    activities: [
      "لقاءات شبابية ومجالس تربوية.",
      "خرجات ترفيهية وأنشطة رياضية.",
      "نقاشات فكرية وحوارات ثقافية.",
      "دورات تكوينية وورشات تدريبية.",
    ],
  },
  en: {
    title: "Ihyaa Youth Program",
    activities: [
      "Youth gatherings and educational circles.",
      "Recreational outings and sports activities.",
      "Intellectual discussions and cultural dialogues.",
      "Training courses and workshops.",
    ],
  },
};

test("home content and official social links stay localized and responsive", async ({ page }) => {
  test.setTimeout(300_000);
  const screenshotDir = join(process.cwd(), "evidence/task-10");
  await mkdir(screenshotDir, { recursive: true });

  for (const locale of ["ar", "en"] as const) {
    await page.goto("/");
    await page.evaluate((nextLocale) => localStorage.setItem("ihyaa-locale", nextLocale), locale);
    await page.reload();
    const expectedDirection = locale === "ar" ? "rtl" : "ltr";
    if (await page.locator("html").getAttribute("dir") !== expectedDirection) {
      await page.locator('[data-testid="language-switcher-btn"]').click();
    }
    await expect(page.locator("html")).toHaveAttribute("dir", expectedDirection);

    for (const route of ["/", "/terms", "/privacy"] as const) {
      if (route !== "/") await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      const socialContainers = route === "/"
        ? [page.locator("#contact"), page.locator("footer")]
        : [page.locator("body")];
      for (const container of socialContainers) {
        const socialAnchors = container.locator('a[target="_blank"]');
        const placementsPerLink = route === "/" ? 1 : 2;
        await expect(socialAnchors).toHaveCount(3 * placementsPerLink);
        for (const social of socialLinks) {
          const specific = container.locator(`a[href="${social.href}"][target="_blank"]`);
          await expect(specific).toHaveCount(placementsPerLink);
          for (const link of await specific.all()) {
            await expect(link).toHaveAttribute("rel", "noopener noreferrer");
            await expect(link).toHaveAttribute("aria-label", social.label[locale]);
            const box = await link.boundingBox();
            expect(box?.width).toBeGreaterThanOrEqual(44);
            expect(box?.height).toBeGreaterThanOrEqual(44);
          }
        }
      }

      if (route === "/") {
        await expect(page.locator("#program h2")).toHaveText(homeCopy[locale].title);
        const cards = page.locator('[data-testid="home-activity-card"]');
        await expect(cards).toHaveCount(4);
        for (const [index, activity] of homeCopy[locale].activities.entries()) {
          await expect(cards.nth(index).locator("h3")).toHaveText(activity);
        }
        await expect(page.locator("body")).not.toContainText(/community|جمعية/i);
      }

      await page.setViewportSize({ width: 360, height: 900 });
      for (const section of await page.locator("main section").all()) {
        await section.scrollIntoViewIfNeeded();
        await page.waitForTimeout(650);
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(650);

      for (const width of [360, 768, 1440] as const) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ["light", "sunset", "amoled", "black"] as const) {
          await page.evaluate((selectedTheme) => {
            document.documentElement.setAttribute("data-theme", selectedTheme);
            document.documentElement.classList.toggle("dark", selectedTheme === "amoled" || selectedTheme === "black");
          }, theme);
          await page.screenshot({
            path: join(screenshotDir, `home-content-social-${route.slice(1) || "home"}-${locale}-${theme}-${width}.png`),
            fullPage: true,
          });
          expect(await page.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
        }
      }
    }
  }
});
