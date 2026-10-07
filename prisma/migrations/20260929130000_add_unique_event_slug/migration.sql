-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Update existing slugs
UPDATE "Event" SET "slug" = 'majlis-ihyaa-2026' WHERE "id" = 'majlis-ihyaa-2026';
UPDATE "Event" SET "slug" = 'past-winter-retreat' WHERE "id" = 'past-winter-retreat';
UPDATE "Event" SET "slug" = 'past-football-cup' WHERE "id" = 'past-football-cup';
UPDATE "Event" SET "slug" = 'past-gathering-retreat' WHERE "id" = 'past-gathering-retreat';
UPDATE "Event" SET "slug" = 'a-new-event' WHERE "id" = 'cmutmu5ir0000jv04ry8m9r5o';
UPDATE "Event" SET "slug" = 'large-image-upload-test-event' WHERE "id" = 'cmuyehxdo0003k1xv9v157ech';
UPDATE "Event" SET "slug" = 'test-event-second' WHERE "id" = 'test-event-second';
UPDATE "Event" SET "slug" = "id" WHERE "slug" IS NULL;

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Event_slug_key" ON "Event"("slug");
