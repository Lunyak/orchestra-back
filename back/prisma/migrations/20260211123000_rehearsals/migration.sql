-- CreateEnum
CREATE TYPE "RehearsalParticipantStatus" AS ENUM ('unknown', 'present', 'absent');

-- CreateTable
CREATE TABLE "Rehearsal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdVia" TEXT,

    CONSTRAINT "Rehearsal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RehearsalParticipant" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "RehearsalParticipantStatus" NOT NULL DEFAULT 'unknown',
    "roles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RehearsalParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rehearsal_projectId_startsAt_idx" ON "Rehearsal"("projectId", "startsAt");

-- CreateIndex
CREATE INDEX "RehearsalParticipant_email_idx" ON "RehearsalParticipant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RehearsalParticipant_rehearsalId_email_key" ON "RehearsalParticipant"("rehearsalId", "email");

-- AddForeignKey
ALTER TABLE "Rehearsal" ADD CONSTRAINT "Rehearsal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalParticipant" ADD CONSTRAINT "RehearsalParticipant_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

