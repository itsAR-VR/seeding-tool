-- Add warmupStartedAt column for email warmup tracking
ALTER TABLE "email_aliases" ADD COLUMN "warmup_started_at" TIMESTAMP(3);

-- CRITICAL: Mark all existing aliases as warmed to prevent breaking sends on deploy
UPDATE "email_aliases" SET "is_warmed_up" = true WHERE "is_warmed_up" = false;
