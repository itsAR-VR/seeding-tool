-- Opt-outs are per brand (a "no" to one brand doesn't block another).
-- Bounces and complaints stay global (brand_id NULL).
DROP INDEX IF EXISTS "email_suppressions_email_key";
ALTER TABLE "email_suppressions" ADD COLUMN "brand_id" TEXT;
CREATE INDEX "email_suppressions_email_brand_id_idx" ON "email_suppressions"("email", "brand_id");
-- Every existing opt-out came from Kalm's outreach.
UPDATE "email_suppressions" SET "brand_id" = 'c70e5d66-256e-4388-a33e-a2081c5799e0'
WHERE "reason" NOT IN ('BOUNCE', 'COMPLAINT');
