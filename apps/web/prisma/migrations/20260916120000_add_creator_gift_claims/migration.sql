-- CreateTable
CREATE TABLE "creator_gift_claims" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "campaign_creator_id" TEXT NOT NULL,
    "campaign_product_id" TEXT,
    "shipping_address_snapshot_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_gift_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creator_gift_claims_token_hash_key" ON "creator_gift_claims"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "creator_gift_claims_shipping_address_snapshot_id_key" ON "creator_gift_claims"("shipping_address_snapshot_id");

-- CreateIndex
CREATE INDEX "creator_gift_claims_campaign_creator_id_idx" ON "creator_gift_claims"("campaign_creator_id");

-- CreateIndex
CREATE INDEX "creator_gift_claims_expires_at_idx" ON "creator_gift_claims"("expires_at");

-- AddForeignKey
ALTER TABLE "creator_gift_claims" ADD CONSTRAINT "creator_gift_claims_campaign_creator_id_fkey" FOREIGN KEY ("campaign_creator_id") REFERENCES "campaign_creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_gift_claims" ADD CONSTRAINT "creator_gift_claims_campaign_product_id_fkey" FOREIGN KEY ("campaign_product_id") REFERENCES "campaign_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_gift_claims" ADD CONSTRAINT "creator_gift_claims_shipping_address_snapshot_id_fkey" FOREIGN KEY ("shipping_address_snapshot_id") REFERENCES "shipping_address_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
