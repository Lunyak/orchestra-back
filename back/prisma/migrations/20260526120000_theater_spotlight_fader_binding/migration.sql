-- Persist spotlight ↔ fader binding and editor grid placement
ALTER TABLE "TheaterSpotlight"
  ADD COLUMN IF NOT EXISTS "faderId" INTEGER,
  ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "gridCol" INTEGER,
  ADD COLUMN IF NOT EXISTS "gridRow" INTEGER;
