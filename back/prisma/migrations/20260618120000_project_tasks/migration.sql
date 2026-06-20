-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('todo', 'in_progress', 'done', 'blocked');

-- CreateEnum
CREATE TYPE "ProjectTaskCategory" AS ENUM ('props', 'costume', 'light', 'sound', 'admin', 'production', 'other');

-- CreateEnum
CREATE TYPE "ProjectTaskSource" AS ENUM ('manual', 'requisite');

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'todo',
    "category" "ProjectTaskCategory" NOT NULL DEFAULT 'other',
    "source" "ProjectTaskSource" NOT NULL DEFAULT 'manual',
    "sourceKey" TEXT,
    "assigneeEmail" TEXT,
    "dueAt" TIMESTAMP(3),
    "refStepId" INTEGER,
    "refRequisiteId" INTEGER,
    "refAction" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_status_idx" ON "ProjectTask"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_sortOrder_idx" ON "ProjectTask"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectTask_assigneeEmail_idx" ON "ProjectTask"("assigneeEmail");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTask_projectId_sourceKey_key" ON "ProjectTask"("projectId", "sourceKey");

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
