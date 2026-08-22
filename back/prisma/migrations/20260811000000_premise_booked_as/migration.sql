-- CreateEnum
CREATE TYPE "PremiseBookedAsKind" AS ENUM ('user', 'troupe', 'theater', 'studio', 'external');

-- AlterTable
ALTER TABLE "PremiseRental" ADD COLUMN "bookedAsKind" "PremiseBookedAsKind" NOT NULL DEFAULT 'user';
ALTER TABLE "PremiseRental" ADD COLUMN "bookedAsId" TEXT;
ALTER TABLE "PremiseRental" ADD COLUMN "bookedAsTitle" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "PremiseRental_bookedAsKind_bookedAsId_idx" ON "PremiseRental"("bookedAsKind", "bookedAsId");
