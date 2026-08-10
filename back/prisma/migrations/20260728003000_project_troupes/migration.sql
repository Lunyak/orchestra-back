-- Separate autonomous troupes from project membership.
DROP INDEX "Troupe_ownerUserId_key";

CREATE TABLE "ProjectTroupe" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "troupeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTroupe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectTroupe_projectId_troupeId_key"
  ON "ProjectTroupe" ("projectId", "troupeId");
CREATE INDEX "ProjectTroupe_projectId_idx" ON "ProjectTroupe" ("projectId");
CREATE INDEX "ProjectTroupe_troupeId_idx" ON "ProjectTroupe" ("troupeId");

ALTER TABLE "ProjectTroupe"
  ADD CONSTRAINT "ProjectTroupe_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTroupe"
  ADD CONSTRAINT "ProjectTroupe_troupeId_fkey"
  FOREIGN KEY ("troupeId") REFERENCES "Troupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the old implicit owner-project association for existing data.
INSERT INTO "ProjectTroupe" ("id", "projectId", "troupeId")
SELECT CONCAT('legacy:', project."id", ':', troupe."id"), project."id", troupe."id"
FROM "Project" AS project
JOIN "Troupe" AS troupe ON troupe."ownerUserId" = project."ownerId"
WHERE project."deletedAt" IS NULL
ON CONFLICT ("projectId", "troupeId") DO NOTHING;
