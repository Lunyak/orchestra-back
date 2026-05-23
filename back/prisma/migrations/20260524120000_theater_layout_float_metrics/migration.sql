-- Метрические размеры зала и позиция кресел (дробные метры)
ALTER TABLE "TheaterLayout" ALTER COLUMN "hallWidth" SET DATA TYPE DOUBLE PRECISION USING "hallWidth"::double precision;
ALTER TABLE "TheaterLayout" ALTER COLUMN "hallDepth" SET DATA TYPE DOUBLE PRECISION USING "hallDepth"::double precision;
ALTER TABLE "TheaterLayout" ALTER COLUMN "wallHeight" SET DATA TYPE DOUBLE PRECISION USING "wallHeight"::double precision;
ALTER TABLE "TheaterLayout" ALTER COLUMN "audienceStartZ" SET DATA TYPE DOUBLE PRECISION USING "audienceStartZ"::double precision;
ALTER TABLE "TheaterLayout" ALTER COLUMN "stageWidth" SET DATA TYPE DOUBLE PRECISION USING "stageWidth"::double precision;
ALTER TABLE "TheaterLayout" ALTER COLUMN "stageDepth" SET DATA TYPE DOUBLE PRECISION USING "stageDepth"::double precision;
ALTER TABLE "TheaterLayout" ALTER COLUMN "stageHeight" SET DATA TYPE DOUBLE PRECISION USING "stageHeight"::double precision;
ALTER TABLE "TheaterLayout" ALTER COLUMN "stageZ" SET DATA TYPE DOUBLE PRECISION USING "stageZ"::double precision;
