-- Telegram multi-bot integrations + per-bot variables

CREATE TABLE IF NOT EXISTS "TelegramBotIntegration" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "tokenEncrypted" TEXT NOT NULL,
  "botUsername" TEXT,
  "botTelegramUserId" TEXT,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "webhookSecret" TEXT NOT NULL,
  "groupChatId" TEXT,
  "attendanceThreadId" TEXT,
  "announcementsThreadId" TEXT,
  "defaultProjectSlug" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramBotIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BotVariable" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "isSecret" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotVariable_pkey" PRIMARY KEY ("id")
);

-- Relations
ALTER TABLE "TelegramBotIntegration"
  ADD CONSTRAINT "TelegramBotIntegration_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BotVariable"
  ADD CONSTRAINT "BotVariable_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "TelegramBotIntegration" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "TelegramBotIntegration_ownerUserId_idx"
  ON "TelegramBotIntegration" ("ownerUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramBotIntegration_botTelegramUserId_unique"
  ON "TelegramBotIntegration" ("botTelegramUserId");

CREATE INDEX IF NOT EXISTS "BotVariable_botId_idx" ON "BotVariable" ("botId");

CREATE UNIQUE INDEX IF NOT EXISTS "BotVariable_bot_key_unique"
  ON "BotVariable" ("botId", "key");

