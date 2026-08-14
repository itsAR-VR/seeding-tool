-- Add warmupStartedAt column for email warmup tracking
-- Column names are camelCase to match the unmapped Prisma fields
-- (EmailAlias.isWarmedUp was created as "isWarmedUp" in 20260309050501).
ALTER TABLE "email_aliases" ADD COLUMN "warmupStartedAt" TIMESTAMP(3);

-- CRITICAL: Mark all existing aliases as warmed to prevent breaking sends on deploy
UPDATE "email_aliases" SET "isWarmedUp" = true WHERE "isWarmedUp" = false;
