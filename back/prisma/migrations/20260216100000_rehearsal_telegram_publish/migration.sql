-- Extend rehearsal/participant fields for Telegram publishing + attendance timestamps

-- Add enum value "late" if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RehearsalParticipantStatus'
      AND e.enumlabel = 'late'
  ) THEN
    ALTER TYPE "RehearsalParticipantStatus" ADD VALUE 'late';
  END IF;
END $$;

-- Rehearsal: telegram publishing metadata + place
ALTER TABLE "Rehearsal"
  ADD COLUMN IF NOT EXISTS "place" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramThreadId" TEXT,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- RehearsalParticipant: telegram identity + late info + response timestamp
ALTER TABLE "RehearsalParticipant"
  ADD COLUMN IF NOT EXISTS "telegramId" TEXT,
  ADD COLUMN IF NOT EXISTS "userName" TEXT,
  ADD COLUMN IF NOT EXISTS "lateTime" TEXT,
  ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);

-- Helpful indexes (safe if already exist)
CREATE INDEX IF NOT EXISTS "RehearsalParticipant_telegramId_idx" ON "RehearsalParticipant"("telegramId");

