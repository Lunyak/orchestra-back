-- Store 3D theater light console settings and light programs per scene
ALTER TABLE "Scene"
  ADD COLUMN IF NOT EXISTS "lightFaders" JSONB,
  ADD COLUMN IF NOT EXISTS "lightPrograms" JSONB;
