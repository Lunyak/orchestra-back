-- Add user profile fields (sex, role, phone, birthday)
ALTER TABLE "UserProfile"
ADD COLUMN "sex" TEXT,
ADD COLUMN "role" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "birthday" TEXT;
