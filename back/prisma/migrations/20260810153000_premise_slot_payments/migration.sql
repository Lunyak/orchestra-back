CREATE TYPE "PremiseSlotPaymentStatus" AS ENUM ('unpaid', 'paid', 'waived');

ALTER TABLE "PremiseSlot"
ADD COLUMN "rentalAmountKopecks" INTEGER,
ADD COLUMN "paymentDueAt" TIMESTAMP(3),
ADD COLUMN "paymentStatus" "PremiseSlotPaymentStatus" NOT NULL DEFAULT 'unpaid';

ALTER TABLE "PremiseSlot"
ADD CONSTRAINT "PremiseSlot_rentalAmountKopecks_check"
CHECK ("rentalAmountKopecks" IS NULL OR "rentalAmountKopecks" >= 0);
