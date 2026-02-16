-- Add selectedSteps to rehearsal (store array of { sceneId, stepId })
ALTER TABLE "Rehearsal"
ADD COLUMN IF NOT EXISTS "selectedSteps" JSONB;

