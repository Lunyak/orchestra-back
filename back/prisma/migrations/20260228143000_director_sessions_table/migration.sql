-- Create DirectorSession table (replaces Scene.rawJson storage for director sessions)
CREATE TABLE IF NOT EXISTS "DirectorSession" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DirectorSession_pkey" PRIMARY KEY ("id")
);

-- FKs
ALTER TABLE "DirectorSession"
  ADD CONSTRAINT "DirectorSession_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectorSession"
  ADD CONSTRAINT "DirectorSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "DirectorSession_projectId_idx" ON "DirectorSession"("projectId");
CREATE INDEX IF NOT EXISTS "DirectorSession_userId_idx" ON "DirectorSession"("userId");
CREATE INDEX IF NOT EXISTS "DirectorSession_projectId_startsAt_idx" ON "DirectorSession"("projectId", "startsAt");

-- Keep updatedAt in sync (Prisma @updatedAt equivalent)
CREATE OR REPLACE FUNCTION set_director_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS director_session_set_updated_at ON "DirectorSession";
CREATE TRIGGER director_session_set_updated_at
BEFORE UPDATE ON "DirectorSession"
FOR EACH ROW
EXECUTE FUNCTION set_director_session_updated_at();

