-- Make User.name and Hospital.city/state required (NOT NULL).
-- Normalize existing NULL values to empty strings first.

UPDATE "User" SET "name" = '' WHERE "name" IS NULL;
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;

UPDATE "Hospital" SET "city" = '' WHERE "city" IS NULL;
UPDATE "Hospital" SET "state" = '' WHERE "state" IS NULL;
ALTER TABLE "Hospital" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "Hospital" ALTER COLUMN "state" SET NOT NULL;
