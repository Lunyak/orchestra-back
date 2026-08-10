-- CreateTable
CREATE TABLE "ProjectTeamRole" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTeamRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTeamRoleAssignment" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTeamRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectTeamRole_projectId_idx" ON "ProjectTeamRole"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTeamRole_parentId_idx" ON "ProjectTeamRole"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamRole_projectId_slug_key" ON "ProjectTeamRole"("projectId", "slug");

-- CreateIndex
CREATE INDEX "ProjectTeamRoleAssignment_roleId_idx" ON "ProjectTeamRoleAssignment"("roleId");

-- CreateIndex
CREATE INDEX "ProjectTeamRoleAssignment_email_idx" ON "ProjectTeamRoleAssignment"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamRoleAssignment_roleId_email_key" ON "ProjectTeamRoleAssignment"("roleId", "email");

-- AddForeignKey
ALTER TABLE "ProjectTeamRole" ADD CONSTRAINT "ProjectTeamRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamRole" ADD CONSTRAINT "ProjectTeamRole_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectTeamRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamRoleAssignment" ADD CONSTRAINT "ProjectTeamRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ProjectTeamRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
