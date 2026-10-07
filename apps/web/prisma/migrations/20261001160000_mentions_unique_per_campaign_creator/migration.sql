-- Two brands can log the same public post; dedupe per campaign creator instead of globally.
DROP INDEX IF EXISTS "mention_assets_platform_media_url_key";
CREATE UNIQUE INDEX "mention_assets_campaign_creator_id_platform_media_url_key" ON "mention_assets"("campaign_creator_id", "platform", "media_url");
