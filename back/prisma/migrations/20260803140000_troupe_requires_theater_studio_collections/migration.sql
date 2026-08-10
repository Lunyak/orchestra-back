-- Troupe always belongs to a theater; studio fund collections

-- 1) Add nullable theaterId, backfill, then require
ALTER TABLE "Troupe" ADD COLUMN "theaterId" TEXT;

-- Prefer existing TheaterTroupe link (oldest)
UPDATE "Troupe" t
SET "theaterId" = sub."theaterId"
FROM (
  SELECT DISTINCT ON ("troupeId") "troupeId", "theaterId"
  FROM "TheaterTroupe"
  ORDER BY "troupeId", "createdAt" ASC
) AS sub
WHERE t."id" = sub."troupeId" AND t."theaterId" IS NULL;

-- Orphans: create a home theater (+ workspace) per owner from troupe title
DO $$
DECLARE
  r RECORD;
  ws_id TEXT;
  th_id TEXT;
BEGIN
  FOR r IN
    SELECT t."id" AS troupe_id, t."ownerUserId", t."title"
    FROM "Troupe" t
    WHERE t."theaterId" IS NULL
  LOOP
    ws_id := md5(random()::text || clock_timestamp()::text);
    th_id := md5(random()::text || clock_timestamp()::text || r.troupe_id);

    INSERT INTO "Workspace" ("id", "type", "name", "createdAt", "updatedAt")
    VALUES (ws_id, 'THEATER', r."title", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt", "updatedAt")
    VALUES (
      md5(random()::text || clock_timestamp()::text || ws_id),
      ws_id,
      r."ownerUserId",
      'OWNER',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );

    INSERT INTO "Theater" ("id", "workspaceId", "title", "createdAt", "updatedAt")
    VALUES (th_id, ws_id, r."title", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    UPDATE "Troupe" SET "theaterId" = th_id WHERE "id" = r.troupe_id;

    INSERT INTO "TheaterTroupe" ("id", "theaterId", "troupeId", "participationType", "createdAt")
    VALUES (
      md5(random()::text || clock_timestamp()::text || th_id),
      th_id,
      r.troupe_id,
      'HOME',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("theaterId", "troupeId") DO NOTHING;
  END LOOP;
END $$;

ALTER TABLE "Troupe" ALTER COLUMN "theaterId" SET NOT NULL;

CREATE INDEX "Troupe_theaterId_idx" ON "Troupe"("theaterId");

ALTER TABLE "Troupe"
  ADD CONSTRAINT "Troupe_theaterId_fkey"
  FOREIGN KEY ("theaterId") REFERENCES "Theater"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ensure HOME TheaterTroupe for every troupe home theater
INSERT INTO "TheaterTroupe" ("id", "theaterId", "troupeId", "participationType", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || t."id"),
  t."theaterId",
  t."id",
  'HOME',
  CURRENT_TIMESTAMP
FROM "Troupe" t
WHERE NOT EXISTS (
  SELECT 1 FROM "TheaterTroupe" tt
  WHERE tt."theaterId" = t."theaterId" AND tt."troupeId" = t."id"
);

-- 2) Studio collections
CREATE TYPE "StudioCollectionStatus" AS ENUM ('draft', 'active', 'closed');

CREATE TABLE "StudioCollection" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "StudioCollectionStatus" NOT NULL DEFAULT 'active',
  "dueAt" TIMESTAMP(3),
  "createdByEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioCollection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioCollection_studioId_idx" ON "StudioCollection"("studioId");

ALTER TABLE "StudioCollection"
  ADD CONSTRAINT "StudioCollection_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudioCollectionTariff" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amountKopecks" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioCollectionTariff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioCollectionTariff_collectionId_idx" ON "StudioCollectionTariff"("collectionId");

ALTER TABLE "StudioCollectionTariff"
  ADD CONSTRAINT "StudioCollectionTariff_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "StudioCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudioCollectionParticipant" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tariffId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioCollectionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioCollectionParticipant_collectionId_email_key"
  ON "StudioCollectionParticipant"("collectionId", "email");
CREATE INDEX "StudioCollectionParticipant_collectionId_idx" ON "StudioCollectionParticipant"("collectionId");
CREATE INDEX "StudioCollectionParticipant_email_idx" ON "StudioCollectionParticipant"("email");

ALTER TABLE "StudioCollectionParticipant"
  ADD CONSTRAINT "StudioCollectionParticipant_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "StudioCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioCollectionParticipant"
  ADD CONSTRAINT "StudioCollectionParticipant_tariffId_fkey"
  FOREIGN KEY ("tariffId") REFERENCES "StudioCollectionTariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StudioContribution" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "amountKopecks" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedByEmail" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioContribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioContribution_collectionId_email_idx"
  ON "StudioContribution"("collectionId", "email");

ALTER TABLE "StudioContribution"
  ADD CONSTRAINT "StudioContribution_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "StudioCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
