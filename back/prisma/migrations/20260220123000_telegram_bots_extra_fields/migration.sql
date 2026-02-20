-- Extra per-bot settings (owner/admin/quiz) for TelegramBotIntegration

ALTER TABLE "TelegramBotIntegration"
  ADD COLUMN IF NOT EXISTS "ownerTelegramId" TEXT;

ALTER TABLE "TelegramBotIntegration"
  ADD COLUMN IF NOT EXISTS "adminTelegramId" TEXT;

ALTER TABLE "TelegramBotIntegration"
  ADD COLUMN IF NOT EXISTS "quizGroupChatId" TEXT;

ALTER TABLE "TelegramBotIntegration"
  ADD COLUMN IF NOT EXISTS "quizThreadId" TEXT;

