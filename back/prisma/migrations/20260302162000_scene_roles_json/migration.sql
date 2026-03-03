-- Store per-scene role links (sceneRoles v1) in DB
ALTER TABLE "Scene"
  ADD COLUMN IF NOT EXISTS "sceneRoles" JSONB;

