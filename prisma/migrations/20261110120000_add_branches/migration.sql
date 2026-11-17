CREATE TYPE "BranchKind" AS ENUM ('CITY', 'PROVINCE', 'CUSTOM');

CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "kind" "BranchKind" NOT NULL,
    "geoId" TEXT,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "regionId" TEXT NOT NULL,
    "provinceId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Branch_active_sortOrder_idx" ON "Branch"("active", "sortOrder");
CREATE INDEX "Branch_regionId_active_idx" ON "Branch"("regionId", "active");
CREATE INDEX "Branch_provinceId_idx" ON "Branch"("provinceId");
CREATE INDEX "Branch_geoId_idx" ON "Branch"("geoId");

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
