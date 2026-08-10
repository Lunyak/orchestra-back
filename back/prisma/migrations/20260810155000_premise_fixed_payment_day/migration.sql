ALTER TABLE "Premise"
ADD COLUMN "paymentDueDay" INTEGER;

ALTER TABLE "Premise"
ADD CONSTRAINT "Premise_paymentDueDay_check"
CHECK ("paymentDueDay" IS NULL OR "paymentDueDay" BETWEEN 1 AND 31);

ALTER TABLE "PremiseSlot"
DROP COLUMN "paymentDueAt";
