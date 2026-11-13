import { rm } from "node:fs/promises";
import { resolve } from "node:path";

export default async function globalTeardown() {
  for (const directory of ["evidence", "test-results", "playwright-report", "blob-report"]) {
    await rm(resolve(process.cwd(), directory), { recursive: true, force: true });
  }
}
