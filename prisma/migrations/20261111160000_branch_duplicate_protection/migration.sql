CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION "normalize_branch_name"(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT btrim(
    regexp_replace(
      translate(
        regexp_replace(lower(unaccent(value)), U&'[\064B-\065F\0670\0640]', '', 'g'),
        'أإآٱىة',
        'اااايه'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

ALTER TABLE "Branch"
  ADD COLUMN "nameArKey" TEXT,
  ADD COLUMN "nameEnKey" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

UPDATE "Branch"
SET "nameArKey" = "normalize_branch_name"("nameAr"),
    "nameEnKey" = CASE WHEN "nameEn" IS NULL OR btrim("nameEn") = '' THEN NULL ELSE "normalize_branch_name"("nameEn") END;

ALTER TABLE "Branch" ALTER COLUMN "nameArKey" SET NOT NULL;

CREATE UNIQUE INDEX "Branch_nameArKey_key" ON "Branch"("nameArKey");
CREATE UNIQUE INDEX "Branch_nameEnKey_key" ON "Branch"("nameEnKey");
CREATE UNIQUE INDEX "Branch_idempotencyKey_key" ON "Branch"("idempotencyKey");
CREATE UNIQUE INDEX "Branch_city_geoId_key" ON "Branch"("geoId") WHERE "kind" = 'CITY' AND "geoId" IS NOT NULL;

DROP FUNCTION "normalize_branch_name"(TEXT);
