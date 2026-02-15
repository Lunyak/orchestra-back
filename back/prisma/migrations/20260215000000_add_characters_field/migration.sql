-- Add characters field to UserProfile (array of strings stored as JSON)
ALTER TABLE "UserProfile"
ADD COLUMN "characters" JSONB;
