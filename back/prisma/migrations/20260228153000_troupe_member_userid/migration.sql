-- Add optional userId to troupe members (link to registered user when possible)
ALTER TABLE "TroupeMember"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "TroupeMember_userId_idx" ON "TroupeMember"("userId");

ALTER TABLE "TroupeMember"
  ADD CONSTRAINT "TroupeMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

