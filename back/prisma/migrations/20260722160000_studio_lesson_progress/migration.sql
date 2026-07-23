-- Lesson task type and per-student progress tracking

CREATE TYPE "StudioLessonTaskType" AS ENUM ('complete', 'video');
CREATE TYPE "StudioLessonProgressStatus" AS ENUM ('pending', 'submitted', 'completed', 'rejected');

ALTER TABLE "StudioProgramLesson"
  ADD COLUMN "taskType" "StudioLessonTaskType" NOT NULL DEFAULT 'complete',
  ADD COLUMN "taskPrompt" TEXT;

CREATE TABLE "StudioLessonProgress" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" "StudioLessonProgressStatus" NOT NULL DEFAULT 'pending',
  "videoUrl" TEXT,
  "note" TEXT,
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "reviewComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioLessonProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioLessonProgress_lessonId_email_key"
  ON "StudioLessonProgress"("lessonId", "email");
CREATE INDEX "StudioLessonProgress_email_idx" ON "StudioLessonProgress"("email");
CREATE INDEX "StudioLessonProgress_lessonId_status_idx"
  ON "StudioLessonProgress"("lessonId", "status");
CREATE INDEX "StudioLessonProgress_reviewedByUserId_idx"
  ON "StudioLessonProgress"("reviewedByUserId");

ALTER TABLE "StudioLessonProgress"
  ADD CONSTRAINT "StudioLessonProgress_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "StudioProgramLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioLessonProgress"
  ADD CONSTRAINT "StudioLessonProgress_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
