-- Schema fields that were added without migrations (review round 3)

-- AlterTable: Creator.tiktokHandle + (brandId, tiktokHandle) unique constraint
ALTER TABLE "creators" ADD COLUMN "tiktok_handle" TEXT;
CREATE UNIQUE INDEX "creators_brandId_tiktok_handle_key" ON "creators"("brandId", "tiktok_handle");

-- AlterTable: MentionAsset.attributionConfidence
ALTER TABLE "mention_assets" ADD COLUMN "attribution_confidence" TEXT;

-- AlterTable: InterventionCase.campaignId — enables per-campaign dedupe
-- of health-critical interventions (Phase 27d contract)
ALTER TABLE "intervention_cases" ADD COLUMN "campaign_id" TEXT;
CREATE INDEX "intervention_cases_campaign_id_idx" ON "intervention_cases"("campaign_id");
