export function assertDevBranchDatabase(contextName = "Operation") {
  const url = process.env.DATABASE_URL || process.env.DIRECT_URL || "";
  // Check if target database is the authorized Neon dev branch
  // Dev compute endpoint: ep-bold-queen-b2qojux5 (branch: dev / br-hidden-wind-b20jiqxp)
  const isDevBranch = url.includes("ep-bold-queen-b2qojux5");
  if (!isDevBranch) {
    throw new Error(
      `[DEV GUARD] ${contextName} refused: Target database is NOT the Neon dev branch (ep-bold-queen-b2qojux5). ` +
      `Seeding, test data mutations, and automated test cleanups are strictly prohibited against production!`
    );
  }
}
