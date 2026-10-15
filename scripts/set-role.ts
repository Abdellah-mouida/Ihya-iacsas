import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { createAuditLog } from "../src/lib/audit";

const VALID_ROLES = ["USER", "MODERATOR", "ADMIN"] as const;

function printUsageAndExit() {
  console.log(`
Usage:
  npx tsx scripts/set-role.ts <email> <ROLE> [--reason <reason>]

Arguments:
  email     The email address of the user.
  ROLE      One of: USER, MODERATOR, ADMIN
  --reason  Optional note explaining why the role was changed.

Examples:
  npx tsx scripts/set-role.ts user@example.com ADMIN --reason "Promoting lead organizer"
  npx tsx scripts/set-role.ts staff@example.com MODERATOR
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    printUsageAndExit();
  }

  const email = args[0].trim().toLowerCase();
  const rawRole = args[1].trim().toUpperCase();

  if (!VALID_ROLES.includes(rawRole as Role)) {
    console.error(`Error: Invalid role "${rawRole}". Must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const newRole = rawRole as Role;

  let reason = "CLI execution: scripts/set-role.ts";
  const reasonIndex = args.indexOf("--reason");
  if (reasonIndex !== -1 && args[reasonIndex + 1]) {
    reason = args.slice(reasonIndex + 1).join(" ");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    console.error(`Error: User with email "${email}" not found.`);
    process.exit(1);
  }

  if (user.role === newRole) {
    console.log(`User "${email}" already has role "${newRole}". No update needed.`);
    process.exit(0);
  }

  const oldRole = user.role;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { role: newRole },
    });

    if (newRole === "ADMIN") {
      await tx.systemSetting.upsert({
        where: { key: "first_admin_claimed" },
        create: { key: "first_admin_claimed", value: "true" },
        update: { value: "true" },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: null, // Executed from CLI
        action: "ROLE_CHANGE",
        targetType: "User",
        targetId: user.id,
        details: {
          email: user.email,
          oldRole,
          newRole,
          reason,
          source: "cli",
        },
      },
    });
  });

  console.log(`Successfully changed role of "${email}" (${user.id}) from ${oldRole} to ${newRole}.`);
  console.log(`Audit log entry recorded with reason: "${reason}".`);
}

main()
  .catch((err) => {
    console.error("Failed to set role:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
