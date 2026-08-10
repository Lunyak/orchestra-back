CREATE TYPE "PremiseUsageType" AS ENUM ('internal', 'friendly', 'commercial');
CREATE TYPE "PremiseRecurrenceType" AS ENUM ('once', 'weekly');
CREATE TYPE "PremiseRentalStatus" AS ENUM ('pending', 'active', 'cancelled', 'completed');
CREATE TYPE "PremiseAgreementStatus" AS ENUM ('draft', 'awaiting_signature', 'active', 'terminated', 'expired');
CREATE TYPE "PremiseAgreementDocumentKind" AS ENUM ('generated', 'uploaded', 'signed');
CREATE TYPE "PremiseRentalPaymentStatus" AS ENUM ('unpaid', 'paid', 'waived');

ALTER TABLE "Premise"
DROP CONSTRAINT IF EXISTS "Premise_paymentDueDay_check",
DROP COLUMN IF EXISTS "paymentDueDay";

CREATE TABLE "PremiseRental" (
    "id" TEXT NOT NULL,
    "premiseId" TEXT NOT NULL,
    "usageType" "PremiseUsageType" NOT NULL,
    "recurrenceType" "PremiseRecurrenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "rentalNotes" TEXT,
    "contactEmail" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "timezoneOffsetMin" INTEGER NOT NULL DEFAULT 0,
    "monthlyAmountKopecks" INTEGER,
    "paymentDueDay" INTEGER,
    "agreementRequested" BOOLEAN NOT NULL DEFAULT false,
    "status" "PremiseRentalStatus" NOT NULL DEFAULT 'pending',
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiseRental_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PremiseRental_monthlyAmountKopecks_check" CHECK (
        "monthlyAmountKopecks" IS NULL OR "monthlyAmountKopecks" >= 0
    ),
    CONSTRAINT "PremiseRental_paymentDueDay_check" CHECK (
        "paymentDueDay" IS NULL OR "paymentDueDay" BETWEEN 1 AND 31
    )
);

CREATE TABLE "PremiseRentalSchedule" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startsAtMin" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,

    CONSTRAINT "PremiseRentalSchedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PremiseRentalSchedule_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
    CONSTRAINT "PremiseRentalSchedule_time_check" CHECK (
        "startsAtMin" BETWEEN 0 AND 1439
        AND "durationMin" > 0
        AND "startsAtMin" + "durationMin" <= 1440
    )
);

CREATE TABLE "PremiseRentalAgreement" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PremiseAgreementStatus" NOT NULL DEFAULT 'draft',
    "landlordName" TEXT NOT NULL,
    "landlordDetails" TEXT,
    "tenantName" TEXT NOT NULL,
    "tenantDetails" TEXT,
    "termsSnapshot" JSONB NOT NULL,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiseRentalAgreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PremiseRentalAgreementDocument" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "kind" "PremiseAgreementDocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremiseRentalAgreementDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PremiseRentalPayment" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "amountKopecks" INTEGER NOT NULL,
    "status" "PremiseRentalPaymentStatus" NOT NULL DEFAULT 'unpaid',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiseRentalPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PremiseRentalPayment_amountKopecks_check" CHECK ("amountKopecks" >= 0)
);

ALTER TABLE "PremiseSlot"
ADD COLUMN "rentalId" TEXT;

CREATE INDEX "PremiseRental_premiseId_startsOn_idx" ON "PremiseRental"("premiseId", "startsOn");
CREATE INDEX "PremiseRental_status_idx" ON "PremiseRental"("status");
CREATE UNIQUE INDEX "PremiseRentalSchedule_rentalId_weekday_key" ON "PremiseRentalSchedule"("rentalId", "weekday");
CREATE INDEX "PremiseRentalSchedule_rentalId_idx" ON "PremiseRentalSchedule"("rentalId");
CREATE UNIQUE INDEX "PremiseRentalAgreement_rentalId_key" ON "PremiseRentalAgreement"("rentalId");
CREATE INDEX "PremiseRentalAgreement_status_idx" ON "PremiseRentalAgreement"("status");
CREATE INDEX "PremiseRentalAgreementDocument_agreementId_kind_idx" ON "PremiseRentalAgreementDocument"("agreementId", "kind");
CREATE UNIQUE INDEX "PremiseRentalPayment_rentalId_periodStart_key" ON "PremiseRentalPayment"("rentalId", "periodStart");
CREATE INDEX "PremiseRentalPayment_rentalId_dueAt_idx" ON "PremiseRentalPayment"("rentalId", "dueAt");
CREATE INDEX "PremiseSlot_rentalId_idx" ON "PremiseSlot"("rentalId");

ALTER TABLE "PremiseRental"
ADD CONSTRAINT "PremiseRental_premiseId_fkey"
FOREIGN KEY ("premiseId") REFERENCES "Premise"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PremiseRentalSchedule"
ADD CONSTRAINT "PremiseRentalSchedule_rentalId_fkey"
FOREIGN KEY ("rentalId") REFERENCES "PremiseRental"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PremiseRentalAgreement"
ADD CONSTRAINT "PremiseRentalAgreement_rentalId_fkey"
FOREIGN KEY ("rentalId") REFERENCES "PremiseRental"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PremiseRentalAgreementDocument"
ADD CONSTRAINT "PremiseRentalAgreementDocument_agreementId_fkey"
FOREIGN KEY ("agreementId") REFERENCES "PremiseRentalAgreement"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PremiseRentalPayment"
ADD CONSTRAINT "PremiseRentalPayment_rentalId_fkey"
FOREIGN KEY ("rentalId") REFERENCES "PremiseRental"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PremiseSlot"
ADD CONSTRAINT "PremiseSlot_rentalId_fkey"
FOREIGN KEY ("rentalId") REFERENCES "PremiseRental"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
