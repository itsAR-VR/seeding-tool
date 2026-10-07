ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "apify_token_enc" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "use_shared_apify" BOOLEAN NOT NULL DEFAULT false;
-- Kalm keeps using the shared Apify account it already pays for.
UPDATE "brands" SET "use_shared_apify" = true WHERE "id" = 'c70e5d66-256e-4388-a33e-a2081c5799e0';

CREATE TABLE IF NOT EXISTS "learned_replies" (
  "id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learned_replies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learned_replies_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "learned_replies_brand_id_created_at_idx" ON "learned_replies"("brand_id", "created_at");
