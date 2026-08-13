-- CreateTable
CREATE TABLE "email_suppressions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration_snapshots" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brand_id" TEXT,
    "outcome_count" INTEGER NOT NULL,
    "report_json" JSONB NOT NULL,
    "adjustments_applied" BOOLEAN NOT NULL DEFAULT false,
    "weights_before" JSONB NOT NULL,
    "suggested_weights" JSONB NOT NULL,

    CONSTRAINT "calibration_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_health_snapshots" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "alerts" JSONB NOT NULL,

    CONSTRAINT "campaign_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_suppressions_email_key" ON "email_suppressions"("email");

-- CreateIndex
CREATE INDEX "calibration_snapshots_brand_id_idx" ON "calibration_snapshots"("brand_id");

-- CreateIndex
CREATE INDEX "campaign_health_snapshots_campaignId_createdAt_idx" ON "campaign_health_snapshots"("campaignId", "createdAt");

-- AddForeignKey
ALTER TABLE "campaign_health_snapshots" ADD CONSTRAINT "campaign_health_snapshots_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: invoice idempotency key for subscription credit minting
ALTER TABLE "brand_credit_transactions" ADD COLUMN "stripe_invoice_id" TEXT;

-- CreateIndex: one mint per (invoice, brand balance) — retries after a partial
-- invoice.paid failure hit this instead of double-minting earlier brands
CREATE UNIQUE INDEX "brand_credit_transactions_stripe_invoice_id_balanceId_key" ON "brand_credit_transactions"("stripe_invoice_id", "balanceId");
