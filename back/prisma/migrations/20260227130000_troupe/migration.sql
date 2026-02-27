-- CreateTable
CREATE TABLE "Troupe" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Моя труппа',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Troupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TroupeMember" (
    "id" TEXT NOT NULL,
    "troupeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TroupeMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Troupe_ownerUserId_key" ON "Troupe"("ownerUserId");

-- CreateIndex
CREATE INDEX "Troupe_ownerUserId_idx" ON "Troupe"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TroupeMember_troupeId_email_key" ON "TroupeMember"("troupeId", "email");

-- CreateIndex
CREATE INDEX "TroupeMember_email_idx" ON "TroupeMember"("email");

-- CreateIndex
CREATE INDEX "TroupeMember_troupeId_idx" ON "TroupeMember"("troupeId");

-- AddForeignKey
ALTER TABLE "Troupe" ADD CONSTRAINT "Troupe_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TroupeMember" ADD CONSTRAINT "TroupeMember_troupeId_fkey" FOREIGN KEY ("troupeId") REFERENCES "Troupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

