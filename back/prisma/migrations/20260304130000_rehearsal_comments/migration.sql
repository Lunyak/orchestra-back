-- CreateTable
CREATE TABLE "RehearsalComment" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RehearsalComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RehearsalComment_rehearsalId_authorUserId_key" ON "RehearsalComment"("rehearsalId", "authorUserId");

-- CreateIndex
CREATE INDEX "RehearsalComment_rehearsalId_idx" ON "RehearsalComment"("rehearsalId");

-- CreateIndex
CREATE INDEX "RehearsalComment_authorUserId_idx" ON "RehearsalComment"("authorUserId");

-- CreateIndex
CREATE INDEX "RehearsalComment_authorEmail_idx" ON "RehearsalComment"("authorEmail");

-- AddForeignKey
ALTER TABLE "RehearsalComment" ADD CONSTRAINT "RehearsalComment_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalComment" ADD CONSTRAINT "RehearsalComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

