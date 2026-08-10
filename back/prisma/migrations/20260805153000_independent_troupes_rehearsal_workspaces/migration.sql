ALTER TABLE "Troupe"
  ALTER COLUMN "theaterId" DROP NOT NULL;

ALTER TABLE "Troupe"
  DROP CONSTRAINT IF EXISTS "Troupe_theaterId_fkey";

ALTER TABLE "Troupe"
  ADD CONSTRAINT "Troupe_theaterId_fkey"
  FOREIGN KEY ("theaterId") REFERENCES "Theater"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RehearsalWorkspace" (
  "rehearsalId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RehearsalWorkspace_pkey" PRIMARY KEY ("rehearsalId", "workspaceId")
);

CREATE INDEX "RehearsalWorkspace_workspaceId_idx"
  ON "RehearsalWorkspace"("workspaceId");

ALTER TABLE "RehearsalWorkspace"
  ADD CONSTRAINT "RehearsalWorkspace_rehearsalId_fkey"
  FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RehearsalWorkspace"
  ADD CONSTRAINT "RehearsalWorkspace_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RehearsalWorkspace" ("rehearsalId", "workspaceId")
SELECT rehearsal."id", project."workspaceId"
FROM "Rehearsal" rehearsal
JOIN "Project" project ON project."id" = rehearsal."projectId"
ON CONFLICT DO NOTHING;

INSERT INTO "RehearsalWorkspace" ("rehearsalId", "workspaceId")
SELECT rehearsal."id", theater."workspaceId"
FROM "Rehearsal" rehearsal
JOIN "ProjectTheater" project_theater
  ON project_theater."projectId" = rehearsal."projectId"
JOIN "Theater" theater ON theater."id" = project_theater."theaterId"
ON CONFLICT DO NOTHING;

CREATE TABLE "RehearsalProject" (
  "rehearsalId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RehearsalProject_pkey" PRIMARY KEY ("rehearsalId", "projectId")
);

CREATE INDEX "RehearsalProject_projectId_idx"
  ON "RehearsalProject"("projectId");

ALTER TABLE "RehearsalProject"
  ADD CONSTRAINT "RehearsalProject_rehearsalId_fkey"
  FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RehearsalProject"
  ADD CONSTRAINT "RehearsalProject_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RehearsalProject" ("rehearsalId", "projectId")
SELECT "id", "projectId"
FROM "Rehearsal"
ON CONFLICT DO NOTHING;

INSERT INTO "Rehearsal" (
  "id",
  "projectId",
  "title",
  "startsAt",
  "durationMin",
  "notes",
  "publishedAt",
  "createdAt",
  "updatedAt",
  "createdBy",
  "createdVia"
)
SELECT
  session."id",
  session."projectId",
  session."title",
  session."startsAt",
  NULL,
  NULL,
  CASE
    WHEN session."payload"->>'publishedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
      THEN (session."payload"->>'publishedAt')::timestamptz
    ELSE NULL
  END,
  session."createdAt",
  session."updatedAt",
  session."userId",
  'director-session'
FROM "DirectorSession" session;

INSERT INTO "RehearsalProject" ("rehearsalId", "projectId")
SELECT DISTINCT session."id", project."id"
FROM "DirectorSession" session
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(session."payload"->'slots', '[]'::jsonb)
) slot
JOIN "Project" project
  ON project."slug" = slot->'ref'->>'projectSlug'
ON CONFLICT DO NOTHING;

INSERT INTO "RehearsalProject" ("rehearsalId", "projectId")
SELECT session."id", session."projectId"
FROM "DirectorSession" session
WHERE NOT EXISTS (
  SELECT 1
  FROM "RehearsalProject" rehearsal_project
  WHERE rehearsal_project."rehearsalId" = session."id"
)
ON CONFLICT DO NOTHING;

INSERT INTO "RehearsalWorkspace" ("rehearsalId", "workspaceId")
SELECT rehearsal_project."rehearsalId", project."workspaceId"
FROM "RehearsalProject" rehearsal_project
JOIN "Project" project ON project."id" = rehearsal_project."projectId"
ON CONFLICT DO NOTHING;

INSERT INTO "RehearsalWorkspace" ("rehearsalId", "workspaceId")
SELECT rehearsal_project."rehearsalId", theater."workspaceId"
FROM "RehearsalProject" rehearsal_project
JOIN "ProjectTheater" project_theater
  ON project_theater."projectId" = rehearsal_project."projectId"
JOIN "Theater" theater ON theater."id" = project_theater."theaterId"
ON CONFLICT DO NOTHING;

ALTER TABLE "DirectorSession"
  ADD CONSTRAINT "DirectorSession_id_fkey"
  FOREIGN KEY ("id") REFERENCES "Rehearsal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
