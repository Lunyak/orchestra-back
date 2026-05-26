-- Theater model decor fields + kind (prop | decor)
ALTER TABLE "TheaterModel" ADD COLUMN IF NOT EXISTS "file" TEXT;
ALTER TABLE "TheaterModel" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'prop';
ALTER TABLE "TheaterModel" ADD COLUMN IF NOT EXISTS "decorSize" JSONB;
ALTER TABLE "TheaterModel" ADD COLUMN IF NOT EXISTS "decorColor" TEXT;
ALTER TABLE "TheaterModel" ADD COLUMN IF NOT EXISTS "decorTexture" TEXT;
ALTER TABLE "TheaterModel" ADD COLUMN IF NOT EXISTS "decorTextureRepeat" DOUBLE PRECISION;
ALTER TABLE "TheaterModel" ADD COLUMN IF NOT EXISTS "decorTextureMode" TEXT;
ALTER TABLE "TheaterModel" ADD COLUMN IF NOT EXISTS "decorTextureFaces" JSONB;
