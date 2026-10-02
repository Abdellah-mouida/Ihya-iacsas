import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

function getKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    const val = obj[k];
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      keys.push(...getKeys(val as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

test.describe("i18n Localization Audit & Key Parity", () => {
  const arPath = path.resolve(process.cwd(), "locales/ar.json");
  const enPath = path.resolve(process.cwd(), "locales/en.json");
  const ar = JSON.parse(fs.readFileSync(arPath, "utf8"));
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
  const arKeys = new Set(getKeys(ar));
  const enKeys = new Set(getKeys(en));

  test("1. locales/ar.json and locales/en.json have 100% key parity with no missing keys", () => {
    const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
    const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));

    expect(missingInEn, "Keys in ar.json missing from en.json").toEqual([]);
    expect(missingInAr, "Keys in en.json missing from ar.json").toEqual([]);
  });

  test("2. booking.nextStep translation key is correctly translated and not raw", () => {
    expect(ar.booking?.nextStep).toBe("الخطوة التالية");
    expect(en.booking?.nextStep).toBe("Next Step");
  });

  test("3. All t(...) calls across codebase resolve to valid translation keys in both locales", () => {
    function walk(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(fullPath));
        } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = walk(path.resolve(process.cwd(), "src"));
    const regex = /\bt\(\s*["'`]([a-zA-Z0-9_.-]+)["'`]/g;
    const missingInAr: Array<{ file: string; key: string }> = [];
    const missingInEn: Array<{ file: string; key: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        const key = m[1];
        if (!arKeys.has(key)) {
          missingInAr.push({ file: path.relative(process.cwd(), file), key });
        }
        if (!enKeys.has(key)) {
          missingInEn.push({ file: path.relative(process.cwd(), file), key });
        }
      }
    }

    expect(missingInAr, "Code t() keys missing from ar.json").toEqual([]);
    expect(missingInEn, "Code t() keys missing from en.json").toEqual([]);
  });

  test("4. Booking page renders translated nextStep text instead of raw key 'booking.nextStep'", async ({
    page,
  }) => {
    await page.goto("/book");
    await expect(page.locator("body")).not.toContainText("booking.nextStep");
    await expect(page.locator('button[type="submit"]')).toContainText("الخطوة التالية");
  });
});
