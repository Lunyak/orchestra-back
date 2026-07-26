-- AlterTable
ALTER TABLE "SceneRequisite" ADD COLUMN IF NOT EXISTS "avatarKey" TEXT;
ALTER TABLE "SceneRequisite" ADD COLUMN IF NOT EXISTS "assigneeEmail" TEXT;
ALTER TABLE "SceneRequisite" ADD COLUMN IF NOT EXISTS "duty" TEXT;
ALTER TABLE "SceneRequisite" ADD COLUMN IF NOT EXISTS "placeNote" TEXT;
ALTER TABLE "SceneRequisite" ADD COLUMN IF NOT EXISTS "actionNote" TEXT;
