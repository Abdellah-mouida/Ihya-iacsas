-- Preserve a user's audit history while account deletion removes their bookings.
ALTER TABLE "Booking"
  DROP CONSTRAINT IF EXISTS "Booking_userId_fkey";

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
  ADD COLUMN "actorName" TEXT,
  ADD COLUMN "actorEmail" TEXT,
  ADD COLUMN "targetName" TEXT,
  ADD COLUMN "targetEmail" TEXT;
