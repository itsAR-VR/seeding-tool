CREATE TABLE IF NOT EXISTS "outreach_queue" (
  "id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "campaign_creator_id" TEXT NOT NULL,
  "creator_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "send_at" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "error" TEXT,
  "created_by_id" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outreach_queue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "outreach_queue_status_send_at_idx" ON "outreach_queue"("status", "send_at");
CREATE INDEX IF NOT EXISTS "outreach_queue_campaign_id_status_idx" ON "outreach_queue"("campaign_id", "status");
