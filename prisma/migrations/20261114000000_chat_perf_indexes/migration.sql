-- CreateIndex
CREATE INDEX IF NOT EXISTS "Report_createdAt_idx" ON "Report"("createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_name_lower_pattern_idx" ON "User" (LOWER("name") text_pattern_ops) WHERE "onboardingCompletedAt" IS NOT NULL AND "chatBannedAt" IS NULL;
