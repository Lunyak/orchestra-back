-- Add user availability calendar (per-day presence/absence)
ALTER TABLE "UserProfile"
ADD COLUMN "availabilityCalendar" JSONB;
