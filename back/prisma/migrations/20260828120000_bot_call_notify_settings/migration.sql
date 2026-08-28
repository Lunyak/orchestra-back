-- Bot call notify schedule + monthly availability DMs

ALTER TABLE "TelegramBotIntegration"
ADD COLUMN IF NOT EXISTS "callNotifyMode" TEXT NOT NULL DEFAULT 'on_publish',
ADD COLUMN IF NOT EXISTS "callNotifyAdvanceDays" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "callNotifyHour" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN IF NOT EXISTS "availabilityRemindEnabled" BOOLEAN NOT NULL DEFAULT false;
