-- CreateTable
CREATE TABLE "DirectorSessionComment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DirectorSessionComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectorSessionComment_sessionId_authorUserId_key" ON "DirectorSessionComment"("sessionId", "authorUserId");

-- CreateIndex
CREATE INDEX "DirectorSessionComment_sessionId_idx" ON "DirectorSessionComment"("sessionId");

-- CreateIndex
CREATE INDEX "DirectorSessionComment_authorUserId_idx" ON "DirectorSessionComment"("authorUserId");

-- CreateIndex
CREATE INDEX "DirectorSessionComment_authorEmail_idx" ON "DirectorSessionComment"("authorEmail");

-- AddForeignKey
ALTER TABLE "DirectorSessionComment" ADD CONSTRAINT "DirectorSessionComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DirectorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorSessionComment" ADD CONSTRAINT "DirectorSessionComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

