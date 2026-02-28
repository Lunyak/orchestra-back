-- Project roles and assignments (normalize casting)

CREATE TABLE IF NOT EXISTS "ProjectRole" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectRole_projectId_key_key" ON "ProjectRole" ("projectId", "key");
CREATE INDEX IF NOT EXISTS "ProjectRole_projectId_idx" ON "ProjectRole" ("projectId");

ALTER TABLE "ProjectRole"
  ADD CONSTRAINT "ProjectRole_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProjectRoleAlias" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  CONSTRAINT "ProjectRoleAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectRoleAlias_roleId_key_key" ON "ProjectRoleAlias" ("roleId", "key");
CREATE INDEX IF NOT EXISTS "ProjectRoleAlias_key_idx" ON "ProjectRoleAlias" ("key");

ALTER TABLE "ProjectRoleAlias"
  ADD CONSTRAINT "ProjectRoleAlias_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "ProjectRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProjectRoleAssignment" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectRoleAssignment_roleId_email_key" ON "ProjectRoleAssignment" ("roleId", "email");
CREATE INDEX IF NOT EXISTS "ProjectRoleAssignment_email_idx" ON "ProjectRoleAssignment" ("email");

ALTER TABLE "ProjectRoleAssignment"
  ADD CONSTRAINT "ProjectRoleAssignment_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "ProjectRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProjectRoleNote" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "authorEmail" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectRoleNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectRoleNote_roleId_idx" ON "ProjectRoleNote" ("roleId");
CREATE INDEX IF NOT EXISTS "ProjectRoleNote_authorUserId_idx" ON "ProjectRoleNote" ("authorUserId");

ALTER TABLE "ProjectRoleNote"
  ADD CONSTRAINT "ProjectRoleNote_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "ProjectRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectRoleNote"
  ADD CONSTRAINT "ProjectRoleNote_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- updatedAt triggers
CREATE OR REPLACE FUNCTION set_project_role_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_role_set_updated_at ON "ProjectRole";
CREATE TRIGGER project_role_set_updated_at
BEFORE UPDATE ON "ProjectRole"
FOR EACH ROW
EXECUTE FUNCTION set_project_role_updated_at();

CREATE OR REPLACE FUNCTION set_project_role_assignment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_role_assignment_set_updated_at ON "ProjectRoleAssignment";
CREATE TRIGGER project_role_assignment_set_updated_at
BEFORE UPDATE ON "ProjectRoleAssignment"
FOR EACH ROW
EXECUTE FUNCTION set_project_role_assignment_updated_at();

CREATE OR REPLACE FUNCTION set_project_role_note_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_role_note_set_updated_at ON "ProjectRoleNote";
CREATE TRIGGER project_role_note_set_updated_at
BEFORE UPDATE ON "ProjectRoleNote"
FOR EACH ROW
EXECUTE FUNCTION set_project_role_note_updated_at();

