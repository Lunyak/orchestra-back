-- Who confirmed a booking request (manager approve / signed agreement).
ALTER TABLE "PremiseRental" ADD COLUMN "confirmedByEmail" TEXT;
ALTER TABLE "PremiseRental" ADD COLUMN "confirmedAt" TIMESTAMP(3);
