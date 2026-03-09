ALTER TABLE "brands"
ADD COLUMN "website_url" TEXT;

ALTER TABLE "brand_settings"
ADD COLUMN "brandProfile" JSONB;

UPDATE "brands" AS b
SET "website_url" = extracted.website_url
FROM (
  SELECT
    "brandId",
    trim((regexp_match("brandVoice", 'Brand website: ([^\n\r]+)'))[1]) AS website_url
  FROM "brand_settings"
  WHERE "brandVoice" IS NOT NULL
    AND "brandVoice" ~ 'Brand website: '
) AS extracted
WHERE b."id" = extracted."brandId"
  AND b."website_url" IS NULL;

UPDATE "brand_settings"
SET "brandVoice" = NULLIF(
  btrim(
    regexp_replace(
      COALESCE("brandVoice", ''),
      E'(^|\\r?\\n)Brand website: [^\\n\\r]+',
      '',
      'g'
    ),
    E' \n\r\t'
  ),
  ''
)
WHERE "brandVoice" IS NOT NULL
  AND "brandVoice" ~ 'Brand website: ';
