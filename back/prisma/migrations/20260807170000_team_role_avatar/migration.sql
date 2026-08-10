-- AlterTable
ALTER TABLE "ProjectTeamRole" ADD COLUMN IF NOT EXISTS "avatarKey" TEXT;

-- AlterTable
ALTER TABLE "TeamRoleDefinition" ADD COLUMN IF NOT EXISTS "avatarKey" TEXT;
