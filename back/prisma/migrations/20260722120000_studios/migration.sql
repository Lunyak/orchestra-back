-- Independent learning studios with members, invites, program, assignments, videos

CREATE TYPE "StudioMemberRole" AS ENUM ('owner', 'teacher', 'student');

CREATE TABLE "Studio" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Studio_ownerUserId_idx" ON "Studio"("ownerUserId");

ALTER TABLE "Studio"
  ADD CONSTRAINT "Studio_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudioMember" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "role" "StudioMemberRole" NOT NULL DEFAULT 'student',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioMember_studioId_email_key" ON "StudioMember"("studioId", "email");
CREATE INDEX "StudioMember_email_idx" ON "StudioMember"("email");
CREATE INDEX "StudioMember_studioId_idx" ON "StudioMember"("studioId");
CREATE INDEX "StudioMember_userId_idx" ON "StudioMember"("userId");

ALTER TABLE "StudioMember"
  ADD CONSTRAINT "StudioMember_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioMember"
  ADD CONSTRAINT "StudioMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudioInvite" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "role" "StudioMemberRole" NOT NULL DEFAULT 'student',
  "email" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioInvite_tokenHash_key" ON "StudioInvite"("tokenHash");
CREATE INDEX "StudioInvite_studioId_idx" ON "StudioInvite"("studioId");
CREATE INDEX "StudioInvite_email_idx" ON "StudioInvite"("email");

ALTER TABLE "StudioInvite"
  ADD CONSTRAINT "StudioInvite_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioInvite"
  ADD CONSTRAINT "StudioInvite_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudioProgramModule" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioProgramModule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioProgramModule_studioId_sortOrder_idx" ON "StudioProgramModule"("studioId", "sortOrder");

ALTER TABLE "StudioProgramModule"
  ADD CONSTRAINT "StudioProgramModule_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudioProgramLesson" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioProgramLesson_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioProgramLesson_moduleId_sortOrder_idx" ON "StudioProgramLesson"("moduleId", "sortOrder");

ALTER TABLE "StudioProgramLesson"
  ADD CONSTRAINT "StudioProgramLesson_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "StudioProgramModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudioAssignment" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "lessonId" TEXT,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioAssignment_studioId_idx" ON "StudioAssignment"("studioId");
CREATE INDEX "StudioAssignment_createdByUserId_idx" ON "StudioAssignment"("createdByUserId");
CREATE INDEX "StudioAssignment_lessonId_idx" ON "StudioAssignment"("lessonId");

ALTER TABLE "StudioAssignment"
  ADD CONSTRAINT "StudioAssignment_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioAssignment"
  ADD CONSTRAINT "StudioAssignment_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioAssignment"
  ADD CONSTRAINT "StudioAssignment_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "StudioProgramLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudioAssignmentTarget" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioAssignmentTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioAssignmentTarget_assignmentId_email_key"
  ON "StudioAssignmentTarget"("assignmentId", "email");
CREATE INDEX "StudioAssignmentTarget_email_idx" ON "StudioAssignmentTarget"("email");

ALTER TABLE "StudioAssignmentTarget"
  ADD CONSTRAINT "StudioAssignmentTarget_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "StudioAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudioSubmission" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "body" TEXT,
  "videoUrl" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grade" INTEGER,
  "gradeComment" TEXT,
  "gradedAt" TIMESTAMP(3),
  "gradedByUserId" TEXT,
  CONSTRAINT "StudioSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioSubmission_assignmentId_email_key"
  ON "StudioSubmission"("assignmentId", "email");
CREATE INDEX "StudioSubmission_email_idx" ON "StudioSubmission"("email");
CREATE INDEX "StudioSubmission_gradedByUserId_idx" ON "StudioSubmission"("gradedByUserId");

ALTER TABLE "StudioSubmission"
  ADD CONSTRAINT "StudioSubmission_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "StudioAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioSubmission"
  ADD CONSTRAINT "StudioSubmission_gradedByUserId_fkey"
  FOREIGN KEY ("gradedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudioVideo" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "description" TEXT,
  "uploadedByEmail" TEXT NOT NULL,
  "assignmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioVideo_studioId_idx" ON "StudioVideo"("studioId");
CREATE INDEX "StudioVideo_assignmentId_idx" ON "StudioVideo"("assignmentId");
CREATE INDEX "StudioVideo_uploadedByEmail_idx" ON "StudioVideo"("uploadedByEmail");

ALTER TABLE "StudioVideo"
  ADD CONSTRAINT "StudioVideo_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudioVideo"
  ADD CONSTRAINT "StudioVideo_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "StudioAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudioVideoMarker" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "timeSec" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "authorEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioVideoMarker_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioVideoMarker_videoId_timeSec_idx" ON "StudioVideoMarker"("videoId", "timeSec");
CREATE INDEX "StudioVideoMarker_authorEmail_idx" ON "StudioVideoMarker"("authorEmail");

ALTER TABLE "StudioVideoMarker"
  ADD CONSTRAINT "StudioVideoMarker_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "StudioVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
