import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env.local first if it exists, to ensure dev database and environment vars are active in tests
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3005",
    headless: true,
  },
  webServer: {
    command: "PORT=3005 npm run start",
    port: 3005,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
