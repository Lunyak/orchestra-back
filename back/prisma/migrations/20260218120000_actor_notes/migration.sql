-- Actor notes ("actor notebook") per project/scene/step
CREATE TABLE IF NOT EXISTS "ActorNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sceneId" TEXT,
  "stepSourceId" INTEGER,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActorNote_pkey" PRIMARY KEY ("id")
);

-- Relations
ALTER TABLE "ActorNote"
  ADD CONSTRAINT "ActorNote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActorNote"
  ADD CONSTRAINT "ActorNote_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActorNote"
  ADD CONSTRAINT "ActorNote_sceneId_fkey"
  FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "ActorNote_projectId_idx" ON "ActorNote" ("projectId");
CREATE INDEX IF NOT EXISTS "ActorNote_userId_idx" ON "ActorNote" ("userId");
CREATE INDEX IF NOT EXISTS "ActorNote_sceneId_idx" ON "ActorNote" ("sceneId");

-- One note per user per step (nulls allowed: project-level notes remain possible)
CREATE UNIQUE INDEX IF NOT EXISTS "ActorNote_user_scene_step_unique"
  ON "ActorNote" ("userId", "sceneId", "stepSourceId");

