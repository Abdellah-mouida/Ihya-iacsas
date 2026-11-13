import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Load .env.local first if it exists, to ensure dev database and environment vars are active in tests
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const outputDir = mkdtempSync(join(tmpdir(), "ihyaa-playwright-"));
process.on("exit", () => {
  rmSync(outputDir, { recursive: true, force: true });
  for (const directory of ["evidence", "test-results", "playwright-report", "blob-report"]) {
    rmSync(resolve(process.cwd(), directory), { recursive: true, force: true });
  }
});

export default defineConfig({
  testDir: "./tests",
  outputDir,
  globalTeardown: "./tests/global-teardown.mjs",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox-about",
      testMatch: "**/about-composition.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-about",
      testMatch: "**/about-composition.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
