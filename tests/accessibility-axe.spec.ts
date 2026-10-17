import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type ScanConfig = {
  theme: "light" | "dark";
  locale: "ar" | "en";
  viewport: { width: number; height: number };
};

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 360, height: 740 },
};

async function preparePage(page: Page, config: ScanConfig, path: string) {
  await page.setViewportSize(config.viewport);

  // Set localStorage prior to navigation to prevent flash/mismatch
  await page.addInitScript(
    ({ locale, theme }) => {
      window.localStorage.setItem("ihyaa-locale", locale);
      window.localStorage.setItem("theme", theme);
    },
    { locale: config.locale, theme: config.theme }
  );

  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500); // Allow Radix UI / animations to settle

  // Ensure HTML attributes match
  await page.evaluate(
    ({ locale, theme }) => {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      }
    },
    { locale: config.locale, theme: config.theme }
  );
}

function assertZeroSeriousOrCriticalViolations(
  results: Awaited<ReturnType<AxeBuilder["analyze"]>>,
  contextStr: string
) {
  const criticalOrSerious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact || "")
  );

  const minorOrModerate = results.violations.filter((v) =>
    ["minor", "moderate"].includes(v.impact || "")
  );

  if (minorOrModerate.length > 0) {
    console.warn(
      `\n[A11y Warning] (${contextStr}) Found ${minorOrModerate.length} minor/moderate notice(s):`
    );
    for (const v of minorOrModerate) {
      console.warn(
        `  - [${v.impact?.toUpperCase()}] ${v.id}: ${v.description} (${v.helpUrl})\n    Affected: ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(", "))
          .join(" | ")}`
      );
    }
  }

  if (criticalOrSerious.length > 0) {
    console.error(
      `\n[A11y FAILED] (${contextStr}) Found ${criticalOrSerious.length} serious/critical violation(s):`
    );
    for (const v of criticalOrSerious) {
      console.error(
        `  - [${v.impact?.toUpperCase()}] ${v.id}: ${v.description} (${v.helpUrl})\n    Nodes: ${JSON.stringify(
          v.nodes.map((n) => ({
            target: n.target,
            failureSummary: n.failureSummary,
          })),
          null,
          2
        )}`
      );
    }
  }

  expect(
    criticalOrSerious,
    `Accessibility violations in ${contextStr}:\n` +
      criticalOrSerious
        .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.helpUrl})`)
        .join("\n")
  ).toHaveLength(0);
}

test.describe("Accessibility Audits (Axe-core)", () => {
  // Test matrix covers key pages: /, /events, /login, /signup, /book
  // across Light/Dark, Arabic(RTL)/English(LTR), and Mobile(360px)/Desktop(1280px)

  test("1. Homepage / passes serious & critical axe scans across themes, locales & viewports", async ({
    page,
  }) => {
    // Desktop Arabic Light
    await preparePage(page, { theme: "light", locale: "ar", viewport: VIEWPORTS.desktop }, "/");
    let res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Home Desktop AR Light");

    // Desktop English Dark
    await preparePage(page, { theme: "dark", locale: "en", viewport: VIEWPORTS.desktop }, "/");
    res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Home Desktop EN Dark");

    // Mobile Arabic Dark (360px)
    await preparePage(page, { theme: "dark", locale: "ar", viewport: VIEWPORTS.mobile }, "/");
    res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Home Mobile AR Dark");

    // Mobile English Light (360px)
    await preparePage(page, { theme: "light", locale: "en", viewport: VIEWPORTS.mobile }, "/");
    res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Home Mobile EN Light");
  });

  test("2. Events /events passes serious & critical axe scans across themes, locales & viewports", async ({
    page,
  }) => {
    // Desktop Arabic Light
    await preparePage(page, { theme: "light", locale: "ar", viewport: VIEWPORTS.desktop }, "/events");
    let res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Events Desktop AR Light");

    // Desktop English Dark
    await preparePage(page, { theme: "dark", locale: "en", viewport: VIEWPORTS.desktop }, "/events");
    res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Events Desktop EN Dark");

    // Mobile Arabic Dark (360px)
    await preparePage(page, { theme: "dark", locale: "ar", viewport: VIEWPORTS.mobile }, "/events");
    res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Events Mobile AR Dark");
  });

  test("3. Auth pages (/login & /signup) pass serious & critical axe scans", async ({
    page,
  }) => {
    // /login Desktop Arabic Light
    await preparePage(page, { theme: "light", locale: "ar", viewport: VIEWPORTS.desktop }, "/login");
    let res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Login Desktop AR Light");

    // /login Mobile English Dark
    await preparePage(page, { theme: "dark", locale: "en", viewport: VIEWPORTS.mobile }, "/login");
    res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Login Mobile EN Dark");

    // /signup Desktop English Dark
    await preparePage(page, { theme: "dark", locale: "en", viewport: VIEWPORTS.desktop }, "/signup");
    res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Signup Desktop EN Dark");

    // /signup Mobile Arabic Light
    await preparePage(page, { theme: "light", locale: "ar", viewport: VIEWPORTS.mobile }, "/signup");
    res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Signup Mobile AR Light");
  });

  test("4. Booking page /book passes serious & critical axe scans", async ({
    page,
  }) => {
    // /book Desktop Arabic Light
    await preparePage(page, { theme: "light", locale: "ar", viewport: VIEWPORTS.desktop }, "/book");
    let res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Book Desktop AR Light");

    // /book Mobile English Dark
    await preparePage(page, { theme: "dark", locale: "en", viewport: VIEWPORTS.mobile }, "/book");
    res = await new AxeBuilder({ page }).analyze();
    assertZeroSeriousOrCriticalViolations(res, "Book Mobile EN Dark");
  });
});
