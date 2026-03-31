ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "portfolio_config" JSONB;

ALTER TABLE "creators"
  ADD COLUMN IF NOT EXISTS "validation_status" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "validation_error_code" TEXT,
  ADD COLUMN IF NOT EXISTS "validation_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_validated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_validation_error" TEXT,
  ADD COLUMN IF NOT EXISTS "influencer_identity_id" TEXT;

ALTER TABLE "creator_search_jobs"
  ADD COLUMN IF NOT EXISTS "requested_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "candidate_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "validated_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "invalid_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cached_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "progress_percent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "eta_seconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finished_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "campaign_id" TEXT;

ALTER TABLE "creator_search_results"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "primary_source" TEXT,
  ADD COLUMN IF NOT EXISTS "sources" JSONB,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "raw_source_category" TEXT,
  ADD COLUMN IF NOT EXISTS "seed_creator_id" TEXT,
  ADD COLUMN IF NOT EXISTS "validation_status" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "validation_error" TEXT,
  ADD COLUMN IF NOT EXISTS "validated_follower_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "validated_avg_views" INTEGER,
  ADD COLUMN IF NOT EXISTS "score_components" JSONB,
  ADD COLUMN IF NOT EXISTS "triage" TEXT,
  ADD COLUMN IF NOT EXISTS "source_confidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "source_confidence_tier" TEXT;

CREATE TABLE IF NOT EXISTS "influencer_identities" (
  "id" TEXT NOT NULL,
  "display_name" TEXT,
  "primary_language" TEXT,
  "home_region" TEXT,
  "merged_into_id" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "influencer_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "influencer_platform_profiles" (
  "id" TEXT NOT NULL,
  "influencer_id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "platform_user_id" TEXT,
  "handle" TEXT NOT NULL,
  "normalized_handle" TEXT NOT NULL,
  "profile_url" TEXT,
  "profile_image_url" TEXT,
  "website_url" TEXT,
  "bio_text" TEXT,
  "email" TEXT,
  "region" TEXT,
  "language_detected" TEXT,
  "is_private" BOOLEAN NOT NULL DEFAULT false,
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "follower_count" INTEGER,
  "following_count" INTEGER,
  "post_count" INTEGER,
  "avg_views" INTEGER,
  "engagement_rate" DOUBLE PRECISION,
  "metadata" JSONB,
  "last_fetched_at" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "influencer_platform_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "identity_edges" (
  "id" TEXT NOT NULL,
  "from_profile_id" TEXT NOT NULL,
  "to_profile_id" TEXT NOT NULL,
  "match_score" DOUBLE PRECISION NOT NULL,
  "match_band" TEXT NOT NULL,
  "evidence_json" JSONB NOT NULL,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_outcome" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "identity_edges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "contact_points" (
  "id" TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
  "contact_type" TEXT NOT NULL,
  "contact_value" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "source" TEXT NOT NULL,
  "is_stale" BOOLEAN NOT NULL DEFAULT false,
  "last_verified_at" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contact_points_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "creator_discovery_touches" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "external_id" TEXT,
  "raw_source_category" TEXT,
  "canonical_category" TEXT,
  "email" TEXT,
  "metadata" JSONB,
  "seed_creator_id" TEXT,
  "creator_id" TEXT NOT NULL,
  "search_job_id" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "creator_discovery_touches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "creator_raw_payloads" (
  "id" TEXT NOT NULL,
  "creator_id" TEXT,
  "search_job_id" TEXT,
  "source" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "payload_hash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "creator_raw_payloads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "influencer_metrics_daily" (
  "id" TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "followers" INTEGER,
  "following" INTEGER,
  "posts" INTEGER,
  "avg_views" INTEGER,
  "engagement_rate" DOUBLE PRECISION,
  "likes" INTEGER,
  "comments" INTEGER,
  "source" TEXT NOT NULL,
  "source_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "influencer_metrics_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "influencer_authenticity_assessments" (
  "id" TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
  "auth_score" DOUBLE PRECISION NOT NULL,
  "bot_risk_score" DOUBLE PRECISION NOT NULL,
  "growth_anomaly_score" DOUBLE PRECISION NOT NULL,
  "engagement_quality_score" DOUBLE PRECISION NOT NULL,
  "model_version" TEXT NOT NULL,
  "notes_json" JSONB,
  "input_snapshot_count" INTEGER NOT NULL DEFAULT 0,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "influencer_authenticity_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "campaign_outcomes" (
  "id" TEXT NOT NULL,
  "campaign_creator_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "creator_id" TEXT NOT NULL,
  "identity_id" TEXT,
  "review_decision" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "decline_reason" TEXT,
  "outreach_sent_at" TIMESTAMP(3),
  "outreach_method" TEXT,
  "replied_at" TIMESTAMP(3),
  "reply_type" TEXT,
  "response_time_hours" DOUBLE PRECISION,
  "accepted_at" TIMESTAMP(3),
  "address_confirmed_at" TIMESTAMP(3),
  "shipped_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "posted_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "opted_out_at" TIMESTAMP(3),
  "stalled_at" TIMESTAMP(3),
  "stall_reason" TEXT,
  "content_quality" TEXT,
  "content_reach" INTEGER,
  "content_engagement" DOUBLE PRECISION,
  "cost_per_creator" DOUBLE PRECISION,
  "cost_per_engagement" DOUBLE PRECISION,
  "fit_score_at_seed" DOUBLE PRECISION,
  "triage_at_seed" TEXT,
  "score_components_at_seed" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "campaign_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "creators_influencer_identity_id_idx"
  ON "creators"("influencer_identity_id");

CREATE INDEX IF NOT EXISTS "creator_search_jobs_brandId_status_idx"
  ON "creator_search_jobs"("brandId", "status");

CREATE INDEX IF NOT EXISTS "creator_search_jobs_campaign_id_status_idx"
  ON "creator_search_jobs"("campaign_id", "status");

CREATE INDEX IF NOT EXISTS "creator_search_results_searchJobId_source_idx"
  ON "creator_search_results"("searchJobId", "source");

CREATE INDEX IF NOT EXISTS "influencer_identities_merged_into_id_idx"
  ON "influencer_identities"("merged_into_id");

CREATE INDEX IF NOT EXISTS "influencer_platform_profiles_influencer_id_idx"
  ON "influencer_platform_profiles"("influencer_id");

CREATE INDEX IF NOT EXISTS "influencer_platform_profiles_platform_platform_user_id_idx"
  ON "influencer_platform_profiles"("platform", "platform_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "influencer_platform_profiles_platform_normalized_handle_key"
  ON "influencer_platform_profiles"("platform", "normalized_handle");

CREATE INDEX IF NOT EXISTS "identity_edges_match_band_idx"
  ON "identity_edges"("match_band");

CREATE INDEX IF NOT EXISTS "identity_edges_review_outcome_idx"
  ON "identity_edges"("review_outcome");

CREATE UNIQUE INDEX IF NOT EXISTS "identity_edges_from_profile_id_to_profile_id_key"
  ON "identity_edges"("from_profile_id", "to_profile_id");

CREATE INDEX IF NOT EXISTS "contact_points_profile_id_idx"
  ON "contact_points"("profile_id");

CREATE INDEX IF NOT EXISTS "contact_points_contact_type_confidence_idx"
  ON "contact_points"("contact_type", "confidence");

CREATE INDEX IF NOT EXISTS "creator_discovery_touches_creator_id_source_idx"
  ON "creator_discovery_touches"("creator_id", "source");

CREATE INDEX IF NOT EXISTS "creator_discovery_touches_search_job_id_idx"
  ON "creator_discovery_touches"("search_job_id");

CREATE INDEX IF NOT EXISTS "creator_raw_payloads_creator_id_idx"
  ON "creator_raw_payloads"("creator_id");

CREATE INDEX IF NOT EXISTS "creator_raw_payloads_search_job_id_idx"
  ON "creator_raw_payloads"("search_job_id");

CREATE INDEX IF NOT EXISTS "creator_raw_payloads_source_createdAt_idx"
  ON "creator_raw_payloads"("source", "createdAt");

CREATE INDEX IF NOT EXISTS "influencer_metrics_daily_profile_id_date_idx"
  ON "influencer_metrics_daily"("profile_id", "date");

CREATE INDEX IF NOT EXISTS "influencer_metrics_daily_date_idx"
  ON "influencer_metrics_daily"("date");

CREATE UNIQUE INDEX IF NOT EXISTS "influencer_metrics_daily_profile_id_date_key"
  ON "influencer_metrics_daily"("profile_id", "date");

CREATE INDEX IF NOT EXISTS "influencer_authenticity_assessments_profile_id_computed_at_idx"
  ON "influencer_authenticity_assessments"("profile_id", "computed_at");

CREATE INDEX IF NOT EXISTS "influencer_authenticity_assessments_auth_score_idx"
  ON "influencer_authenticity_assessments"("auth_score");

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_outcomes_campaign_creator_id_key"
  ON "campaign_outcomes"("campaign_creator_id");

CREATE INDEX IF NOT EXISTS "campaign_outcomes_campaign_id_idx"
  ON "campaign_outcomes"("campaign_id");

CREATE INDEX IF NOT EXISTS "campaign_outcomes_creator_id_idx"
  ON "campaign_outcomes"("creator_id");

CREATE INDEX IF NOT EXISTS "campaign_outcomes_identity_id_idx"
  ON "campaign_outcomes"("identity_id");

CREATE INDEX IF NOT EXISTS "campaign_outcomes_review_decision_idx"
  ON "campaign_outcomes"("review_decision");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_search_jobs_campaign_id_fkey'
  ) THEN
    ALTER TABLE "creator_search_jobs"
      ADD CONSTRAINT "creator_search_jobs_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creators_influencer_identity_id_fkey'
  ) THEN
    ALTER TABLE "creators"
      ADD CONSTRAINT "creators_influencer_identity_id_fkey"
      FOREIGN KEY ("influencer_identity_id") REFERENCES "influencer_identities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'influencer_identities_merged_into_id_fkey'
  ) THEN
    ALTER TABLE "influencer_identities"
      ADD CONSTRAINT "influencer_identities_merged_into_id_fkey"
      FOREIGN KEY ("merged_into_id") REFERENCES "influencer_identities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'influencer_platform_profiles_influencer_id_fkey'
  ) THEN
    ALTER TABLE "influencer_platform_profiles"
      ADD CONSTRAINT "influencer_platform_profiles_influencer_id_fkey"
      FOREIGN KEY ("influencer_id") REFERENCES "influencer_identities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'identity_edges_from_profile_id_fkey'
  ) THEN
    ALTER TABLE "identity_edges"
      ADD CONSTRAINT "identity_edges_from_profile_id_fkey"
      FOREIGN KEY ("from_profile_id") REFERENCES "influencer_platform_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'identity_edges_to_profile_id_fkey'
  ) THEN
    ALTER TABLE "identity_edges"
      ADD CONSTRAINT "identity_edges_to_profile_id_fkey"
      FOREIGN KEY ("to_profile_id") REFERENCES "influencer_platform_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contact_points_profile_id_fkey'
  ) THEN
    ALTER TABLE "contact_points"
      ADD CONSTRAINT "contact_points_profile_id_fkey"
      FOREIGN KEY ("profile_id") REFERENCES "influencer_platform_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_discovery_touches_creator_id_fkey'
  ) THEN
    ALTER TABLE "creator_discovery_touches"
      ADD CONSTRAINT "creator_discovery_touches_creator_id_fkey"
      FOREIGN KEY ("creator_id") REFERENCES "creators"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_discovery_touches_search_job_id_fkey'
  ) THEN
    ALTER TABLE "creator_discovery_touches"
      ADD CONSTRAINT "creator_discovery_touches_search_job_id_fkey"
      FOREIGN KEY ("search_job_id") REFERENCES "creator_search_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_raw_payloads_creator_id_fkey'
  ) THEN
    ALTER TABLE "creator_raw_payloads"
      ADD CONSTRAINT "creator_raw_payloads_creator_id_fkey"
      FOREIGN KEY ("creator_id") REFERENCES "creators"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_raw_payloads_search_job_id_fkey'
  ) THEN
    ALTER TABLE "creator_raw_payloads"
      ADD CONSTRAINT "creator_raw_payloads_search_job_id_fkey"
      FOREIGN KEY ("search_job_id") REFERENCES "creator_search_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'influencer_metrics_daily_profile_id_fkey'
  ) THEN
    ALTER TABLE "influencer_metrics_daily"
      ADD CONSTRAINT "influencer_metrics_daily_profile_id_fkey"
      FOREIGN KEY ("profile_id") REFERENCES "influencer_platform_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'influencer_authenticity_assessments_profile_id_fkey'
  ) THEN
    ALTER TABLE "influencer_authenticity_assessments"
      ADD CONSTRAINT "influencer_authenticity_assessments_profile_id_fkey"
      FOREIGN KEY ("profile_id") REFERENCES "influencer_platform_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_outcomes_campaign_creator_id_fkey'
  ) THEN
    ALTER TABLE "campaign_outcomes"
      ADD CONSTRAINT "campaign_outcomes_campaign_creator_id_fkey"
      FOREIGN KEY ("campaign_creator_id") REFERENCES "campaign_creators"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_outcomes_campaign_id_fkey'
  ) THEN
    ALTER TABLE "campaign_outcomes"
      ADD CONSTRAINT "campaign_outcomes_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_outcomes_creator_id_fkey'
  ) THEN
    ALTER TABLE "campaign_outcomes"
      ADD CONSTRAINT "campaign_outcomes_creator_id_fkey"
      FOREIGN KEY ("creator_id") REFERENCES "creators"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_outcomes_identity_id_fkey'
  ) THEN
    ALTER TABLE "campaign_outcomes"
      ADD CONSTRAINT "campaign_outcomes_identity_id_fkey"
      FOREIGN KEY ("identity_id") REFERENCES "influencer_identities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
