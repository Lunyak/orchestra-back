-- Max / VK channels + primary→mirror bridge

CREATE TABLE IF NOT EXISTS "MessengerChannel" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "tokenEncrypted" TEXT NOT NULL,
  "webhookSecret" TEXT NOT NULL,
  "externalBotId" TEXT,
  "externalUsername" TEXT,
  "chatId" TEXT,
  "vkConfirmation" TEXT,
  "vkGroupId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessengerChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessengerBridge" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessengerBridge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessengerBridgeMember" (
  "id" TEXT NOT NULL,
  "bridgeId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "telegramBotId" TEXT,
  "channelId" TEXT,
  "chatId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessengerBridgeMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MirroredMessage" (
  "id" TEXT NOT NULL,
  "bridgeId" TEXT NOT NULL,
  "sourcePlatform" TEXT NOT NULL,
  "sourceMessageId" TEXT NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "targetPlatform" TEXT NOT NULL,
  "targetMessageId" TEXT NOT NULL,
  "targetRef" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MirroredMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MessengerChannel"
  ADD CONSTRAINT "MessengerChannel_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessengerBridge"
  ADD CONSTRAINT "MessengerBridge_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessengerBridgeMember"
  ADD CONSTRAINT "MessengerBridgeMember_bridgeId_fkey"
  FOREIGN KEY ("bridgeId") REFERENCES "MessengerBridge" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessengerBridgeMember"
  ADD CONSTRAINT "MessengerBridgeMember_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "MessengerChannel" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MirroredMessage"
  ADD CONSTRAINT "MirroredMessage_bridgeId_fkey"
  FOREIGN KEY ("bridgeId") REFERENCES "MessengerBridge" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "MessengerChannel_ownerUserId_idx" ON "MessengerChannel" ("ownerUserId");
CREATE INDEX IF NOT EXISTS "MessengerChannel_platform_idx" ON "MessengerChannel" ("platform");
CREATE UNIQUE INDEX IF NOT EXISTS "MessengerChannel_platform_externalBotId_key"
  ON "MessengerChannel" ("platform", "externalBotId");

CREATE INDEX IF NOT EXISTS "MessengerBridge_ownerUserId_idx" ON "MessengerBridge" ("ownerUserId");

CREATE INDEX IF NOT EXISTS "MessengerBridgeMember_bridgeId_idx" ON "MessengerBridgeMember" ("bridgeId");
CREATE INDEX IF NOT EXISTS "MessengerBridgeMember_telegramBotId_idx" ON "MessengerBridgeMember" ("telegramBotId");
CREATE INDEX IF NOT EXISTS "MessengerBridgeMember_channelId_idx" ON "MessengerBridgeMember" ("channelId");

CREATE UNIQUE INDEX IF NOT EXISTS "MirroredMessage_bridge_source_target_key"
  ON "MirroredMessage" ("bridgeId", "sourcePlatform", "sourceMessageId", "targetRef");
CREATE INDEX IF NOT EXISTS "MirroredMessage_bridgeId_idx" ON "MirroredMessage" ("bridgeId");
CREATE INDEX IF NOT EXISTS "MirroredMessage_source_idx"
  ON "MirroredMessage" ("sourcePlatform", "sourceMessageId");
