CREATE TABLE IF NOT EXISTS "BillingPayment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planName" TEXT NOT NULL,
  "amountRub" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "confirmationUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillingPayment_userId_idx" ON "BillingPayment"("userId");
CREATE INDEX IF NOT EXISTS "BillingPayment_status_idx" ON "BillingPayment"("status");

ALTER TABLE "BillingPayment"
ADD CONSTRAINT "BillingPayment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
