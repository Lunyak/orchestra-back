-- Create UserProfile table
CREATE TABLE IF NOT EXISTS "UserProfile" (
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "telegramUsername" TEXT,
  "telegramId" TEXT,
  "avatarUrl" TEXT,
  "availabilityCalendar" JSONB,
  "sex" TEXT,
  "role" TEXT,
  "characters" JSONB,
  "phone" TEXT,
  "birthday" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("email")
);

-- Create unique index on telegramId
CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_telegramId_key" ON "UserProfile"("telegramId");

-- Create RehearsalParticipantStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RehearsalParticipantStatus') THEN
    CREATE TYPE "RehearsalParticipantStatus" AS ENUM ('unknown', 'present', 'absent', 'late');
  END IF;
END
$$;

-- Create Rehearsal table
CREATE TABLE IF NOT EXISTS "Rehearsal" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "durationMin" INTEGER,
  "notes" TEXT,
  "place" TEXT,
  "telegramChatId" TEXT,
  "telegramMessageId" TEXT,
  "telegramThreadId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "createdVia" TEXT,

  CONSTRAINT "Rehearsal_pkey" PRIMARY KEY ("id")
);

-- Create index on projectId and startsAt
CREATE INDEX IF NOT EXISTS "Rehearsal_projectId_startsAt_idx" ON "Rehearsal"("projectId", "startsAt");

-- Add foreign key to Project
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Rehearsal_projectId_fkey'
  ) THEN
    ALTER TABLE "Rehearsal" ADD CONSTRAINT "Rehearsal_projectId_fkey" 
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- Create RehearsalParticipant table
CREATE TABLE IF NOT EXISTS "RehearsalParticipant" (
  "id" TEXT NOT NULL,
  "rehearsalId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telegramId" TEXT,
  "userName" TEXT,
  "status" "RehearsalParticipantStatus" NOT NULL DEFAULT 'unknown',
  "roles" JSONB,
  "lateTime" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RehearsalParticipant_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on rehearsalId and email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'RehearsalParticipant_rehearsalId_email_key'
  ) THEN
    ALTER TABLE "RehearsalParticipant" ADD CONSTRAINT "RehearsalParticipant_rehearsalId_email_key" 
      UNIQUE ("rehearsalId", "email");
  END IF;
END
$$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "RehearsalParticipant_email_idx" ON "RehearsalParticipant"("email");
CREATE INDEX IF NOT EXISTS "RehearsalParticipant_telegramId_idx" ON "RehearsalParticipant"("telegramId");

-- Add foreign key to Rehearsal with CASCADE delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'RehearsalParticipant_rehearsalId_fkey'
  ) THEN
    ALTER TABLE "RehearsalParticipant" ADD CONSTRAINT "RehearsalParticipant_rehearsalId_fkey" 
      FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
