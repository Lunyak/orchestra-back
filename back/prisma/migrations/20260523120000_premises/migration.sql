-- CreateEnum
CREATE TYPE "PremiseKind" AS ENUM ('OWNED', 'RENTED');

-- CreateEnum
CREATE TYPE "PremiseMemberRole" AS ENUM ('owner', 'manager', 'tenant', 'viewer');

-- CreateEnum
CREATE TYPE "PremiseSlotStatus" AS ENUM ('confirmed', 'pending', 'cancelled');

-- CreateTable
CREATE TABLE "Premise" (
    "id" TEXT NOT NULL,
    "troupeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PremiseKind" NOT NULL DEFAULT 'OWNED',
    "address" TEXT,
    "capacity" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Premise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiseMember" (
    "id" TEXT NOT NULL,
    "premiseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "PremiseMemberRole" NOT NULL DEFAULT 'viewer',
    "canBook" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiseMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiseSlot" (
    "id" TEXT NOT NULL,
    "premiseId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "rentalNotes" TEXT,
    "contactEmail" TEXT,
    "contactName" TEXT,
    "status" "PremiseSlotStatus" NOT NULL DEFAULT 'confirmed',
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiseSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Premise_troupeId_idx" ON "Premise"("troupeId");

-- CreateIndex
CREATE UNIQUE INDEX "PremiseMember_premiseId_email_key" ON "PremiseMember"("premiseId", "email");

-- CreateIndex
CREATE INDEX "PremiseMember_email_idx" ON "PremiseMember"("email");

-- CreateIndex
CREATE INDEX "PremiseMember_premiseId_idx" ON "PremiseMember"("premiseId");

-- CreateIndex
CREATE INDEX "PremiseSlot_premiseId_startsAt_idx" ON "PremiseSlot"("premiseId", "startsAt");

-- AddForeignKey
ALTER TABLE "Premise" ADD CONSTRAINT "Premise_troupeId_fkey" FOREIGN KEY ("troupeId") REFERENCES "Troupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiseMember" ADD CONSTRAINT "PremiseMember_premiseId_fkey" FOREIGN KEY ("premiseId") REFERENCES "Premise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiseSlot" ADD CONSTRAINT "PremiseSlot_premiseId_fkey" FOREIGN KEY ("premiseId") REFERENCES "Premise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
