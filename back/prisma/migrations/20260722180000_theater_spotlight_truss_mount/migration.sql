ALTER TABLE "TheaterSpotlight"
ADD COLUMN "mountModelId" INTEGER,
ADD COLUMN "mountPointId" TEXT;

ALTER TABLE "TheaterModel"
ADD COLUMN "ignoreCollisions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "modelLowDetail" BOOLEAN NOT NULL DEFAULT false;
