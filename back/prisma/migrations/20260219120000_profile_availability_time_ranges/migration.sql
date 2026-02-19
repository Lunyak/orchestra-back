-- Add user availability time ranges (per-date time windows)
ALTER TABLE "UserProfile"
ADD COLUMN "availabilityTimeRanges" JSONB;

