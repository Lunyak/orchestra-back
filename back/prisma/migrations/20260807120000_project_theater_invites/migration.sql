-- CreateTable
CREATE TABLE "ProjectTheaterInvite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "acceptedTheaterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTheaterInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTheaterInvite_tokenHash_key" ON "ProjectTheaterInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ProjectTheaterInvite_projectId_idx" ON "ProjectTheaterInvite"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectTheaterInvite" ADD CONSTRAINT "ProjectTheaterInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTheaterInvite" ADD CONSTRAINT "ProjectTheaterInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTheaterInvite" ADD CONSTRAINT "ProjectTheaterInvite_acceptedTheaterId_fkey" FOREIGN KEY ("acceptedTheaterId") REFERENCES "Theater"("id") ON DELETE SET NULL ON UPDATE CASCADE;
