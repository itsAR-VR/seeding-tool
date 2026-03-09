-- AlterTable
ALTER TABLE "provider_credentials"
ADD COLUMN "credentialType" TEXT NOT NULL DEFAULT 'api_key';

-- AlterTable
ALTER TABLE "brand_connections"
ADD COLUMN "connectionMethod" TEXT NOT NULL DEFAULT 'manual';

-- Backfill existing provider credentials to typed methods.
UPDATE "provider_credentials"
SET "credentialType" = CASE
  WHEN "provider" = 'gmail' THEN 'oauth_refresh_token'
  WHEN "provider" = 'instagram' THEN 'oauth_access_token'
  WHEN "provider" = 'shopify' THEN 'shopify_admin_token'
  WHEN "provider" = 'unipile' THEN 'api_key'
  ELSE 'api_key'
END;

-- Backfill existing brand connections to explicit methods.
UPDATE "brand_connections"
SET "connectionMethod" = CASE
  WHEN "provider" IN ('gmail', 'instagram') THEN 'oauth'
  ELSE 'manual'
END;
