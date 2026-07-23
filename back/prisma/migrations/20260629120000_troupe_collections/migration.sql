-- Troupe fund collections with tariffs and contributions

CREATE TYPE "TroupeCollectionStatus" AS ENUM ('draft', 'active', 'closed');

CREATE TABLE "TroupeCollection" (
  "id" TEXT NOT NULL,
  "troupeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TroupeCollectionStatus" NOT NULL DEFAULT 'active',
  "dueAt" TIMESTAMP(3),
  "premiseId" TEXT,
  "createdByEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TroupeCollection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TroupeCollection_troupeId_idx" ON "TroupeCollection" ("troupeId");
CREATE INDEX "TroupeCollection_premiseId_idx" ON "TroupeCollection" ("premiseId");

ALTER TABLE "TroupeCollection"
  ADD CONSTRAINT "TroupeCollection_troupeId_fkey"
  FOREIGN KEY ("troupeId") REFERENCES "Troupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TroupeCollection"
  ADD CONSTRAINT "TroupeCollection_premiseId_fkey"
  FOREIGN KEY ("premiseId") REFERENCES "Premise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TroupeCollectionTariff" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amountKopecks" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TroupeCollectionTariff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TroupeCollectionTariff_collectionId_idx" ON "TroupeCollectionTariff" ("collectionId");

ALTER TABLE "TroupeCollectionTariff"
  ADD CONSTRAINT "TroupeCollectionTariff_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "TroupeCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TroupeCollectionParticipant" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tariffId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TroupeCollectionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TroupeCollectionParticipant_collectionId_email_key"
  ON "TroupeCollectionParticipant" ("collectionId", "email");
CREATE INDEX "TroupeCollectionParticipant_collectionId_idx" ON "TroupeCollectionParticipant" ("collectionId");
CREATE INDEX "TroupeCollectionParticipant_email_idx" ON "TroupeCollectionParticipant" ("email");

ALTER TABLE "TroupeCollectionParticipant"
  ADD CONSTRAINT "TroupeCollectionParticipant_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "TroupeCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TroupeCollectionParticipant"
  ADD CONSTRAINT "TroupeCollectionParticipant_tariffId_fkey"
  FOREIGN KEY ("tariffId") REFERENCES "TroupeCollectionTariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TroupeContribution" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "amountKopecks" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedByEmail" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TroupeContribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TroupeContribution_collectionId_email_idx" ON "TroupeContribution" ("collectionId", "email");

ALTER TABLE "TroupeContribution"
  ADD CONSTRAINT "TroupeContribution_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "TroupeCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
