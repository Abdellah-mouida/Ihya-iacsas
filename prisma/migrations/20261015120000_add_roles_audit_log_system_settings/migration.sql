-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_idx" ON "AuditLog"("targetType");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- Data migration: promote oldest verified user to ADMIN and record first_admin_claimed flag + audit log
DO $$
DECLARE
  oldest_user_id TEXT;
  oldest_user_email TEXT;
BEGIN
  SELECT "id", "email" INTO oldest_user_id, oldest_user_email
  FROM "User"
  WHERE "emailVerified" IS NOT NULL
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF oldest_user_id IS NOT NULL THEN
    UPDATE "User" SET "role" = 'ADMIN' WHERE "id" = oldest_user_id;

    INSERT INTO "SystemSetting" ("key", "value", "createdAt", "updatedAt")
    VALUES ('first_admin_claimed', 'true', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO NOTHING;

    INSERT INTO "AuditLog" ("id", "actorId", "action", "targetType", "targetId", "details", "createdAt")
    VALUES (
      concat('mig_', substr(md5(random()::text), 1, 16)),
      oldest_user_id,
      'SYSTEM_INIT_FIRST_ADMIN',
      'User',
      oldest_user_id,
      jsonb_build_object(
        'reason', 'Initial migration: promoted oldest verified user to ADMIN',
        'email', oldest_user_email
      ),
      CURRENT_TIMESTAMP
    );
  END IF;
END $$;
