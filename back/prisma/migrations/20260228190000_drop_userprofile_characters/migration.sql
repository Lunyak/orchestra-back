-- Drop obsolete characters field from UserProfile (role assignments moved to ProjectRole)
ALTER TABLE "UserProfile"
DROP COLUMN IF EXISTS "characters";

