-- Actor inline annotations per step text range
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActorAnnotationField') THEN
    CREATE TYPE "ActorAnnotationField" AS ENUM ('markdown', 'playMarkdown');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "ActorAnnotation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sceneId" TEXT NOT NULL,
  "stepSourceId" INTEGER NOT NULL,
  "field" "ActorAnnotationField" NOT NULL,
  "startOffset" INTEGER NOT NULL,
  "endOffset" INTEGER NOT NULL,
  "selectedText" TEXT,
  "noteText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActorAnnotation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActorAnnotation"
  ADD CONSTRAINT "ActorAnnotation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActorAnnotation"
  ADD CONSTRAINT "ActorAnnotation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActorAnnotation"
  ADD CONSTRAINT "ActorAnnotation_sceneId_fkey"
  FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ActorAnnotation_lookup_idx"
  ON "ActorAnnotation" ("userId", "sceneId", "stepSourceId", "field");

CREATE INDEX IF NOT EXISTS "ActorAnnotation_projectId_idx"
  ON "ActorAnnotation" ("projectId");

