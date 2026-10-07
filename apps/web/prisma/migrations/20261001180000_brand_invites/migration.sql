CREATE TABLE "brand_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "company_name" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "brand_id" TEXT,
    "invited_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "brand_invites_token_hash_key" ON "brand_invites"("token_hash");
CREATE INDEX "brand_invites_email_idx" ON "brand_invites"("email");
CREATE INDEX "brand_invites_brand_id_idx" ON "brand_invites"("brand_id");
ALTER TABLE "brand_invites" ADD CONSTRAINT "brand_invites_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
