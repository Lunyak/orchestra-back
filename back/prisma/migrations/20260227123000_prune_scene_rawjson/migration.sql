-- Prune heavy keys from Scene.rawJson now that data is normalized.
-- Keep all other keys (sessions, roleAssignments, images, voiceLines, etc).
UPDATE "Scene"
SET "rawJson" =
  CASE
    WHEN "rawJson" IS NULL THEN NULL
    WHEN jsonb_typeof("rawJson") <> 'object' THEN "rawJson"
    ELSE ("rawJson" - 'steps' - 'lightChannels' - 'theaterLayout' - 'playlist' - 'sounds')
  END;

