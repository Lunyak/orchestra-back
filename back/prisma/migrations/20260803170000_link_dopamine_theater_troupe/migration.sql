-- Release data: ensure troupe «Дофамин» is attached to theater «Дофамин».
-- Idempotent: no-op if either entity is missing or already linked.

DO $$
DECLARE
  dopamine_theater_id TEXT;
  dopamine_troupe_id TEXT;
BEGIN
  SELECT t."id"
  INTO dopamine_theater_id
  FROM "Theater" t
  WHERE lower(trim(t."title")) = lower('Дофамин')
  ORDER BY t."createdAt" ASC
  LIMIT 1;

  SELECT tr."id"
  INTO dopamine_troupe_id
  FROM "Troupe" tr
  WHERE lower(trim(tr."title")) = lower('Дофамин')
  ORDER BY tr."createdAt" ASC
  LIMIT 1;

  IF dopamine_theater_id IS NULL OR dopamine_troupe_id IS NULL THEN
    RAISE NOTICE
      'Дофамин link skipped: theater=% troupe=%',
      dopamine_theater_id,
      dopamine_troupe_id;
    RETURN;
  END IF;

  UPDATE "Troupe"
  SET "theaterId" = dopamine_theater_id,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = dopamine_troupe_id
    AND "theaterId" IS DISTINCT FROM dopamine_theater_id;

  INSERT INTO "TheaterTroupe" (
    "id",
    "theaterId",
    "troupeId",
    "participationType",
    "createdAt"
  )
  VALUES (
    md5(random()::text || clock_timestamp()::text || dopamine_theater_id || dopamine_troupe_id),
    dopamine_theater_id,
    dopamine_troupe_id,
    'HOME',
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("theaterId", "troupeId") DO UPDATE
  SET "participationType" = 'HOME';
END $$;
