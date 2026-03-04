-- Normalize User.email to lower-case for uniformity.
-- Safety: abort if there are duplicates differing only by case.

DO $$
BEGIN
  IF EXISTS (
    SELECT lower("email")
    FROM "User"
    GROUP BY lower("email")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot normalize User.email: duplicates differing only by case exist';
  END IF;

  UPDATE "User"
  SET "email" = lower("email")
  WHERE "email" <> lower("email");
END
$$;

