CREATE TABLE "content_posts" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "external_id" TEXT NOT NULL,
    "permalink" TEXT,
    "media_type" TEXT,
    "media_url" TEXT,
    "thumbnail_url" TEXT,
    "caption" TEXT,
    "username" TEXT,
    "likes" INTEGER,
    "comments" INTEGER,
    "posted_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'tag',
    "rights_status" TEXT NOT NULL DEFAULT 'none',
    "rights_token" TEXT,
    "rights_requested_at" TIMESTAMP(3),
    "rights_responded_at" TIMESTAMP(3),
    "rights_signer_name" TEXT,
    "rights_terms_version" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "brand_id" TEXT NOT NULL,
    "creator_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "content_posts_rights_token_key" ON "content_posts"("rights_token");
CREATE INDEX "content_posts_brand_id_posted_at_idx" ON "content_posts"("brand_id", "posted_at");
CREATE UNIQUE INDEX "content_posts_brand_id_platform_external_id_key" ON "content_posts"("brand_id", "platform", "external_id");
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
