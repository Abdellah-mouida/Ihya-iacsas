-- AlterTable
ALTER TABLE "SystemSetting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "coverImagePublicId" TEXT,
ADD COLUMN     "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "theme" TEXT DEFAULT 'light';
