-- AlterTable
ALTER TABLE "Step" ADD COLUMN "durationMin" INTEGER;

-- AlterTable
ALTER TABLE "Step" ADD COLUMN "kanbanStatus" TEXT;

-- AlterTable
ALTER TABLE "Step" ADD COLUMN "kanbanOrder" INTEGER;

-- AlterTable
ALTER TABLE "Step" ADD COLUMN "cast" JSONB;

