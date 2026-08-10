CREATE TABLE "PremiseAvailability" (
    "id" TEXT NOT NULL,
    "premiseId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startsAtMin" INTEGER NOT NULL,
    "endsAtMin" INTEGER NOT NULL,

    CONSTRAINT "PremiseAvailability_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PremiseAvailability_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
    CONSTRAINT "PremiseAvailability_minutes_check" CHECK (
        "startsAtMin" BETWEEN 0 AND 1439
        AND "endsAtMin" BETWEEN 1 AND 1440
        AND "startsAtMin" < "endsAtMin"
    )
);

CREATE UNIQUE INDEX "PremiseAvailability_premiseId_weekday_key"
ON "PremiseAvailability"("premiseId", "weekday");

CREATE INDEX "PremiseAvailability_premiseId_idx"
ON "PremiseAvailability"("premiseId");

ALTER TABLE "PremiseAvailability"
ADD CONSTRAINT "PremiseAvailability_premiseId_fkey"
FOREIGN KEY ("premiseId") REFERENCES "Premise"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
