-- AlterTable
ALTER TABLE "SceneRequisite" ADD COLUMN IF NOT EXISTS "theaterModelId" INTEGER;

-- AlterTable
ALTER TABLE "TheaterModel" ADD COLUMN IF NOT EXISTS "isRequisite" BOOLEAN NOT NULL DEFAULT false;
