-- Global team / troupe role trees were in schema but never migrated.
CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "roles" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamRoleDefinition" (
    "id" TEXT NOT NULL,
    "troupeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "avatarKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRoleDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamRoleAssignment" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_ownerUserId_email_key" ON "TeamMember"("ownerUserId", "email");
CREATE INDEX IF NOT EXISTS "TeamMember_email_idx" ON "TeamMember"("email");
CREATE INDEX IF NOT EXISTS "TeamMember_ownerUserId_idx" ON "TeamMember"("ownerUserId");
CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "TeamRoleDefinition_troupeId_slug_key" ON "TeamRoleDefinition"("troupeId", "slug");
CREATE INDEX IF NOT EXISTS "TeamRoleDefinition_troupeId_idx" ON "TeamRoleDefinition"("troupeId");
CREATE INDEX IF NOT EXISTS "TeamRoleDefinition_parentId_idx" ON "TeamRoleDefinition"("parentId");

CREATE UNIQUE INDEX IF NOT EXISTS "TeamRoleAssignment_roleId_teamMemberId_key" ON "TeamRoleAssignment"("roleId", "teamMemberId");
CREATE INDEX IF NOT EXISTS "TeamRoleAssignment_roleId_idx" ON "TeamRoleAssignment"("roleId");
CREATE INDEX IF NOT EXISTS "TeamRoleAssignment_teamMemberId_idx" ON "TeamRoleAssignment"("teamMemberId");

DO $$ BEGIN
  ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamRoleDefinition" ADD CONSTRAINT "TeamRoleDefinition_troupeId_fkey" FOREIGN KEY ("troupeId") REFERENCES "Troupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamRoleDefinition" ADD CONSTRAINT "TeamRoleDefinition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TeamRoleDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamRoleAssignment" ADD CONSTRAINT "TeamRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TeamRoleDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamRoleAssignment" ADD CONSTRAINT "TeamRoleAssignment_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "ProjectTeamRole" ADD COLUMN IF NOT EXISTS "avatarKey" TEXT;
ALTER TABLE "TeamRoleDefinition" ADD COLUMN IF NOT EXISTS "avatarKey" TEXT;
