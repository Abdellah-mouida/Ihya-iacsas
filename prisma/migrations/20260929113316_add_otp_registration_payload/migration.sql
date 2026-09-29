-- AlterTable
ALTER TABLE "OtpVerification" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "motive" TEXT;

-- CreateIndex
CREATE INDEX "OtpVerification_eventId_idx" ON "OtpVerification"("eventId");
