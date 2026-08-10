ALTER TABLE "Premise" ADD COLUMN "studioId" TEXT;

DROP INDEX IF EXISTS "Premise_organization_owner_check";
ALTER TABLE "Premise" DROP CONSTRAINT IF EXISTS "Premise_organization_owner_check";

CREATE INDEX "Premise_studioId_idx" ON "Premise"("studioId");

ALTER TABLE "Premise" ADD CONSTRAINT "Premise_studioId_fkey"
FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Premise" ADD CONSTRAINT "Premise_organization_owner_check"
CHECK (
  ("troupeId" IS NOT NULL)::integer
  + ("theaterId" IS NOT NULL)::integer
  + ("studioId" IS NOT NULL)::integer
  = 1
);
