-- Add bot-related fields to UserProfile
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "characters" JSONB;

-- Add unique constraint to telegramId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'UserProfile_telegramId_key'
  ) THEN
    ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_telegramId_key" UNIQUE ("telegramId");
  END IF;
END
$$;

-- Add bot-related fields to Rehearsal
ALTER TABLE "Rehearsal" ADD COLUMN IF NOT EXISTS "place" TEXT;
ALTER TABLE "Rehearsal" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
ALTER TABLE "Rehearsal" ADD COLUMN IF NOT EXISTS "telegramMessageId" TEXT;
ALTER TABLE "Rehearsal" ADD COLUMN IF NOT EXISTS "telegramThreadId" TEXT;

-- Add 'late' status to RehearsalParticipantStatus enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'late' AND enumtypid = (
      SELECT oid FROM pg_type WHERE typname = 'RehearsalParticipantStatus'
    )
  ) THEN
    ALTER TYPE "RehearsalParticipantStatus" ADD VALUE 'late';
  END IF;
END
$$;

-- Add bot-related fields to RehearsalParticipant
ALTER TABLE "RehearsalParticipant" ADD COLUMN IF NOT EXISTS "telegramId" TEXT;
ALTER TABLE "RehearsalParticipant" ADD COLUMN IF NOT EXISTS "userName" TEXT;
ALTER TABLE "RehearsalParticipant" ADD COLUMN IF NOT EXISTS "lateTime" TEXT;

-- Create index on telegramId
CREATE INDEX IF NOT EXISTS "RehearsalParticipant_telegramId_idx" ON "RehearsalParticipant"("telegramId");

-- Create BotSettings table
CREATE TABLE IF NOT EXISTS "BotSettings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "groupChatId" TEXT,
  "attendanceThreadId" TEXT,
  "announcementsThreadId" TEXT,
  "projectSlug" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BotSettings_pkey" PRIMARY KEY ("id")
);

-- Insert default BotSettings record
INSERT INTO "BotSettings" ("id", "updatedAt")
VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
