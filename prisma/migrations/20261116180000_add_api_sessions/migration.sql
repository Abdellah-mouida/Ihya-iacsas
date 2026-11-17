-- CreateTable
CREATE TABLE "ApiSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "deviceName" TEXT,
    "platform" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRefreshToken" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "replacedById" TEXT,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiSession_familyId_key" ON "ApiSession"("familyId");

-- CreateIndex
CREATE INDEX "ApiSession_userId_revokedAt_idx" ON "ApiSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "ApiSession_expiresAt_idx" ON "ApiSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiRefreshToken_tokenHash_key" ON "ApiRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiRefreshToken_sessionId_idx" ON "ApiRefreshToken"("sessionId");

-- CreateIndex
CREATE INDEX "ApiRefreshToken_familyId_idx" ON "ApiRefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "ApiRefreshToken_expiresAt_idx" ON "ApiRefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "ApiSession" ADD CONSTRAINT "ApiSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRefreshToken" ADD CONSTRAINT "ApiRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ApiSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

