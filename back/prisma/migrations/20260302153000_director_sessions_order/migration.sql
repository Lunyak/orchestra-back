-- Add custom ordering for director sessions list
ALTER TABLE "DirectorSession"
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "DirectorSession_projectId_order_idx"
  ON "DirectorSession" ("projectId", "order");

