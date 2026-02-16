-- Add selectedSceneIds to rehearsal (store array of Scene.id)
ALTER TABLE "Rehearsal"
ADD COLUMN IF NOT EXISTS "selectedSceneIds" JSONB;

