-- CreateTable
CREATE TABLE "ProjectTelegramBotPreference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botIntegrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTelegramBotPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTelegramBotPreference_projectId_userId_key" ON "ProjectTelegramBotPreference"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectTelegramBotPreference_userId_idx" ON "ProjectTelegramBotPreference"("userId");

-- CreateIndex
CREATE INDEX "ProjectTelegramBotPreference_projectId_idx" ON "ProjectTelegramBotPreference"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTelegramBotPreference_botIntegrationId_idx" ON "ProjectTelegramBotPreference"("botIntegrationId");

-- AddForeignKey
ALTER TABLE "ProjectTelegramBotPreference" ADD CONSTRAINT "ProjectTelegramBotPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTelegramBotPreference" ADD CONSTRAINT "ProjectTelegramBotPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTelegramBotPreference" ADD CONSTRAINT "ProjectTelegramBotPreference_botIntegrationId_fkey" FOREIGN KEY ("botIntegrationId") REFERENCES "TelegramBotIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

