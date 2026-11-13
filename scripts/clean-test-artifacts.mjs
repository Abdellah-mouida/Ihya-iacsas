import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const tempRoot = tmpdir();
const tempEntries = await readdir(tempRoot, { withFileTypes: true });
const outputDirectories = tempEntries
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("ihyaa-playwright-"))
  .map((entry) => join(tempRoot, entry.name));

await Promise.all([
  ...outputDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  ...["evidence", "test-results", "playwright-report", "blob-report"].map((directory) =>
    rm(resolve(process.cwd(), directory), { recursive: true, force: true }),
  ),
]);

process.stdout.write(`Removed ${outputDirectories.length} temporary Playwright output directories and repository artifact folders.\n`);
