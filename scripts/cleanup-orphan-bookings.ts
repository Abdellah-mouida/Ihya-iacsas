import { PrismaClient } from "@prisma/client";

import { assertDevBranchDatabase } from "../tests/helpers/dev-guard";

assertDevBranchDatabase("Orphan booking cleanup script");

const prisma = new PrismaClient();

try {
  const [unlinkedBookings, deletionLogs] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: null },
      select: { id: true, email: true, eventId: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "USER_DELETE", targetType: "USER" },
      select: { targetEmail: true, details: true },
    }),
  ]);

  const deletedEmails = new Set(
    deletionLogs
      .flatMap((log) => {
        const details = log.details && typeof log.details === "object" ? log.details : {};
        const legacyEmail = "targetEmail" in details ? details.targetEmail : null;
        return [log.targetEmail, typeof legacyEmail === "string" ? legacyEmail : null];
      })
      .filter((email): email is string => Boolean(email))
      .map((email) => email.trim().toLowerCase()),
  );

  const candidates = unlinkedBookings.filter((booking) =>
    deletedEmails.has(booking.email.trim().toLowerCase()),
  );
  console.log(`Unlinked booking rows: ${unlinkedBookings.length}`);
  console.log(`Rows matched to prior USER_DELETE email snapshots: ${candidates.length}`);
  console.table(candidates.map(({ id, email, eventId, createdAt }) => ({ id, email, eventId, createdAt })));

  if (process.argv.includes("--apply")) {
    if (candidates.length === 0) {
      console.log("No identified orphan bookings to delete.");
    } else {
      const result = await prisma.booking.deleteMany({
        where: {
          id: { in: candidates.map((booking) => booking.id) },
          userId: null,
        },
      });
      console.log(`Deleted ${result.count} identified orphan booking rows.`);
    }
  } else {
    console.log("Dry run only. Pass --apply after reviewing the listed rows to delete them.");
  }
} finally {
  await prisma.$disconnect();
}
