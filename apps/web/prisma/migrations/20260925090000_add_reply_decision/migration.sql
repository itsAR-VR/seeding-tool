-- AlterTable
ALTER TABLE "campaign_creators" ADD COLUMN "reply_decision" TEXT;
ALTER TABLE "campaign_creators" ADD COLUMN "reply_decided_at" TIMESTAMP(3);
ALTER TABLE "campaign_creators" ADD COLUMN "ai_suggestion" TEXT;
