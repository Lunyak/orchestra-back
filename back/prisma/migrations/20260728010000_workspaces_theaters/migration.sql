-- Phase 1: additive ownership and organization structures.
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'THEATER', 'TROUPE');
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL,
    "name" TEXT NOT NULL,
    "personalOwnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Troupe" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ProjectTroupe" ADD COLUMN "participationType" TEXT NOT NULL DEFAULT 'PARTNER';

CREATE TABLE "Theater" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Theater_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTheater" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "theaterId" TEXT NOT NULL,
    "participationType" TEXT NOT NULL DEFAULT 'PARTNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectTheater_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TheaterTroupe" (
    "id" TEXT NOT NULL,
    "theaterId" TEXT NOT NULL,
    "troupeId" TEXT NOT NULL,
    "participationType" TEXT NOT NULL DEFAULT 'PARTNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TheaterTroupe_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Premise" ALTER COLUMN "troupeId" DROP NOT NULL;
ALTER TABLE "Premise" ADD COLUMN "theaterId" TEXT;

-- Phase 2: backfill one personal workspace per user and preserve owner semantics.
INSERT INTO "Workspace" ("id", "type", "name", "personalOwnerId", "createdAt", "updatedAt")
SELECT 'personal_' || u."id", 'PERSONAL', 'Личное пространство', u."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt", "updatedAt")
SELECT 'member_personal_' || u."id", 'personal_' || u."id", u."id", 'OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("id") DO NOTHING;

UPDATE "Project"
SET "workspaceId" = 'personal_' || "ownerId"
WHERE "workspaceId" IS NULL;

-- Existing troupes receive independent TROUPE workspaces without changing project linkage.
INSERT INTO "Workspace" ("id", "type", "name", "createdAt", "updatedAt")
SELECT 'troupe_' || t."id", 'TROUPE', t."title", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Troupe" t
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt", "updatedAt")
SELECT 'member_troupe_' || t."id", 'troupe_' || t."id", t."ownerUserId", 'OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Troupe" t
ON CONFLICT ("id") DO NOTHING;

UPDATE "Troupe"
SET "workspaceId" = 'troupe_' || "id"
WHERE "workspaceId" IS NULL;

-- Abort before the constraint switch if any legacy project could not be mapped.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Project" WHERE "workspaceId" IS NULL) THEN
    RAISE EXCEPTION 'Project workspace backfill incomplete';
  END IF;
END $$;

-- Phase 3: constraints and indexes after verified backfill.
ALTER TABLE "Project" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Troupe" ALTER COLUMN "workspaceId" SET NOT NULL;

CREATE UNIQUE INDEX "Workspace_personalOwnerId_key" ON "Workspace"("personalOwnerId");
CREATE INDEX "Workspace_type_idx" ON "Workspace"("type");
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");
CREATE UNIQUE INDEX "Troupe_workspaceId_key" ON "Troupe"("workspaceId");
CREATE UNIQUE INDEX "Theater_workspaceId_key" ON "Theater"("workspaceId");
CREATE UNIQUE INDEX "ProjectTheater_projectId_theaterId_key" ON "ProjectTheater"("projectId", "theaterId");
CREATE INDEX "ProjectTheater_projectId_idx" ON "ProjectTheater"("projectId");
CREATE INDEX "ProjectTheater_theaterId_idx" ON "ProjectTheater"("theaterId");
CREATE UNIQUE INDEX "TheaterTroupe_theaterId_troupeId_key" ON "TheaterTroupe"("theaterId", "troupeId");
CREATE INDEX "TheaterTroupe_theaterId_idx" ON "TheaterTroupe"("theaterId");
CREATE INDEX "TheaterTroupe_troupeId_idx" ON "TheaterTroupe"("troupeId");
CREATE INDEX "Premise_theaterId_idx" ON "Premise"("theaterId");

ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_personalOwnerId_fkey"
FOREIGN KEY ("personalOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Troupe" ADD CONSTRAINT "Troupe_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Theater" ADD CONSTRAINT "Theater_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectTheater" ADD CONSTRAINT "ProjectTheater_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectTheater" ADD CONSTRAINT "ProjectTheater_theaterId_fkey"
FOREIGN KEY ("theaterId") REFERENCES "Theater"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TheaterTroupe" ADD CONSTRAINT "TheaterTroupe_theaterId_fkey"
FOREIGN KEY ("theaterId") REFERENCES "Theater"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TheaterTroupe" ADD CONSTRAINT "TheaterTroupe_troupeId_fkey"
FOREIGN KEY ("troupeId") REFERENCES "Troupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Premise" ADD CONSTRAINT "Premise_theaterId_fkey"
FOREIGN KEY ("theaterId") REFERENCES "Theater"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Premise" ADD CONSTRAINT "Premise_organization_owner_check"
CHECK (("troupeId" IS NOT NULL)::integer + ("theaterId" IS NOT NULL)::integer = 1);
