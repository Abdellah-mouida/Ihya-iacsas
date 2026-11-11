ALTER TABLE "GalleryPhoto"
  ADD COLUMN "blurDataUrl" TEXT,
  ADD COLUMN "imageWidth" INTEGER,
  ADD COLUMN "imageHeight" INTEGER;

ALTER TABLE "CarouselPost"
  ADD COLUMN "blurDataUrl" TEXT,
  ADD COLUMN "imageWidth" INTEGER,
  ADD COLUMN "imageHeight" INTEGER;

ALTER TABLE "Event"
  ADD COLUMN "posterBlurDataUrl" TEXT,
  ADD COLUMN "posterWidth" INTEGER,
  ADD COLUMN "posterHeight" INTEGER;

ALTER TABLE "User"
  ADD COLUMN "coverBlurDataUrl" TEXT,
  ADD COLUMN "coverWidth" INTEGER,
  ADD COLUMN "coverHeight" INTEGER;
