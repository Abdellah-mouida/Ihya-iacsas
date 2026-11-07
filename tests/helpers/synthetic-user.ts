import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { prisma } from "../../src/lib/prisma";
import { assertDevBranchDatabase } from "./dev-guard";

/** Creates a throwaway credential account in the explicitly guarded Neon dev branch. */
export async function createSyntheticUser(context = "Synthetic test account") {
  assertDevBranchDatabase(context);
  const email = `codex-${randomBytes(16).toString("hex")}@example.test`;
  const password = randomBytes(32).toString("base64url");
  const user = await prisma.user.create({
    data: {
      email,
      name: "Synthetic Ihyaa Member",
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
      onboardingCompletedAt: null,
      role: "USER",
      sessionVersion: 1,
    },
    select: { id: true, email: true },
  });

  return { id: user.id, email: user.email!, password };
}

export async function removeSyntheticUser(userId: string) {
  assertDevBranchDatabase("Synthetic test account cleanup");
  await prisma.user.delete({ where: { id: userId } });
}
