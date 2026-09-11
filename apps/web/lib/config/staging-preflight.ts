export type StagingEnvRequirement = "required" | "optional";

export type StagingEnvStatus = "present" | "missing";

export type StagingEnvCategory =
  | "core"
  | "database"
  | "auth"
  | "billing"
  | "automation"
  | "ai"
  | "discovery"
  | "outreach"
  | "commerce"
  | "social"
  | "shipping"
  | "media"
  | "marketing"
  | "observability"
  | "testing";

export type StagingEnvDefinition = {
  name: string;
  category: StagingEnvCategory;
  requirement: StagingEnvRequirement;
  sensitive: boolean;
  purpose: string;
  source: string;
};

export type StagingEnvCheck = StagingEnvDefinition & {
  status: StagingEnvStatus;
};

export type StagingPreflightResult = {
  ready: boolean;
  checkedAt: string;
  required: {
    total: number;
    present: number;
    missing: string[];
  };
  optional: {
    total: number;
    present: number;
    missing: string[];
  };
  variables: StagingEnvCheck[];
};

type Environment = Record<string, string | undefined>;

export const STAGING_ENV_DEFINITIONS: StagingEnvDefinition[] = [
  {
    name: "NEXT_PUBLIC_APP_URL",
    category: "core",
    requirement: "required",
    sensitive: false,
    purpose: "Canonical staging URL used for redirects, callbacks, links, and webhook registration.",
    source: "lib/config.ts, app/api/auth/shopify/callback/route.ts, lib/gmail/send.ts",
  },
  {
    name: "APP_ENV",
    category: "core",
    requirement: "optional",
    sensitive: false,
    purpose: "Human-readable app environment label.",
    source: ".env.example",
  },
  {
    name: "INTERNAL_API_TOKEN",
    category: "core",
    requirement: "optional",
    sensitive: true,
    purpose: "Reserved internal API token for protected internal calls.",
    source: ".env.example",
  },
  {
    name: "CRON_SECRET",
    category: "automation",
    requirement: "optional",
    sensitive: true,
    purpose: "Reserved shared secret for scheduled endpoint calls.",
    source: ".env.example",
  },
  {
    name: "DATABASE_URL",
    category: "database",
    requirement: "required",
    sensitive: true,
    purpose: "Primary Postgres connection string used by Prisma at runtime.",
    source: "lib/prisma.ts, prisma.config.ts",
  },
  {
    name: "DIRECT_URL",
    category: "database",
    requirement: "optional",
    sensitive: true,
    purpose: "Direct database URL for Prisma migration/config flows when different from DATABASE_URL.",
    source: "prisma.config.ts",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    category: "auth",
    requirement: "required",
    sensitive: false,
    purpose: "Supabase project URL for browser/server auth and storage clients.",
    source: "lib/supabase/client.ts, lib/supabase/server.ts, lib/supabase/storage.ts",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    category: "auth",
    requirement: "required",
    sensitive: false,
    purpose: "Supabase publishable anon key for browser/server auth clients.",
    source: "lib/supabase/client.ts, lib/supabase/server.ts",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    category: "auth",
    requirement: "required",
    sensitive: true,
    purpose: "Supabase service role key for storage/admin setup flows.",
    source: "lib/supabase/storage.ts, scripts/auth-user.ts",
  },
  {
    name: "APP_ENCRYPTION_KEY",
    category: "auth",
    requirement: "required",
    sensitive: true,
    purpose: "Encryption/HMAC key used for stored integration tokens and unsubscribe/suppression safety.",
    source: "lib/encryption.ts, lib/compliance/suppression.ts",
  },
  {
    name: "STRIPE_SECRET_KEY",
    category: "billing",
    requirement: "optional",
    sensitive: true,
    purpose: "Stripe server key. Required only when staging billing checkout/webhooks are exercised.",
    source: "lib/stripe.ts, app/api/billing/checkout/route.ts",
  },
  {
    name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    category: "billing",
    requirement: "optional",
    sensitive: false,
    purpose: "Stripe publishable key for client-side billing surfaces.",
    source: ".env.example",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    category: "billing",
    requirement: "optional",
    sensitive: true,
    purpose: "Stripe webhook signing secret. Required only when staging Stripe webhooks are enabled.",
    source: "app/api/billing/webhook/route.ts",
  },
  {
    name: "STRIPE_STARTER_PRICE_ID",
    category: "billing",
    requirement: "optional",
    sensitive: false,
    purpose: "Starter plan price ID used by checkout.",
    source: "app/api/billing/checkout/route.ts",
  },
  {
    name: "STRIPE_GROWTH_PRICE_ID",
    category: "billing",
    requirement: "optional",
    sensitive: false,
    purpose: "Growth plan price ID placeholder.",
    source: ".env.example",
  },
  {
    name: "CREDIT_ENFORCEMENT_ENABLED",
    category: "billing",
    requirement: "optional",
    sensitive: false,
    purpose: "Feature flag that turns credit enforcement on when set to true.",
    source: "lib/credits.ts",
  },
  {
    name: "INNGEST_APP_ID",
    category: "automation",
    requirement: "required",
    sensitive: false,
    purpose: "Inngest application ID for lifecycle/background jobs.",
    source: "lib/inngest/client.ts",
  },
  {
    name: "INNGEST_EVENT_KEY",
    category: "automation",
    requirement: "optional",
    sensitive: true,
    purpose: "Inngest event key. Required when staging sends jobs to hosted Inngest.",
    source: ".env.example",
  },
  {
    name: "INNGEST_SIGNING_KEY",
    category: "automation",
    requirement: "optional",
    sensitive: true,
    purpose: "Inngest signing key. Required when staging receives hosted Inngest calls.",
    source: ".env.example",
  },
  {
    name: "INNGEST_ENV",
    category: "automation",
    requirement: "optional",
    sensitive: false,
    purpose: "Inngest environment label.",
    source: ".env.example",
  },
  {
    name: "OPENAI_API_KEY",
    category: "ai",
    requirement: "optional",
    sensitive: true,
    purpose: "AI enrichment, classification fallback, inbox assistance, and outreach drafting.",
    source: "lib/ai/outreach-drafter.ts, lib/creator-search/classification-llm.ts, lib/inbox/ai.ts",
  },
  {
    name: "AI_MODEL",
    category: "ai",
    requirement: "optional",
    sensitive: false,
    purpose: "Model override for AI helpers.",
    source: "lib/ai/config.ts",
  },
  {
    name: "SHOPIFY_API_KEY",
    category: "commerce",
    requirement: "optional",
    sensitive: true,
    purpose: "Shopify app OAuth client ID. Required before live/staging Shopify connection tests.",
    source: "app/api/auth/shopify/route.ts, app/api/auth/shopify/callback/route.ts",
  },
  {
    name: "SHOPIFY_API_SECRET",
    category: "commerce",
    requirement: "optional",
    sensitive: true,
    purpose: "Shopify app OAuth client secret. Required before live/staging Shopify connection tests.",
    source: "app/api/auth/shopify/callback/route.ts",
  },
  {
    name: "SHOPIFY_APP_SCOPES",
    category: "commerce",
    requirement: "optional",
    sensitive: false,
    purpose: "Shopify OAuth scopes requested during connection.",
    source: "app/api/auth/shopify/route.ts",
  },
  {
    name: "SHOPIFY_WEBHOOK_SECRET",
    category: "commerce",
    requirement: "optional",
    sensitive: true,
    purpose: "Shopify webhook signing secret for fulfillment/order callbacks.",
    source: "app/api/webhooks/shopify/route.ts",
  },
  {
    name: "SHOPIFY_API_VERSION",
    category: "commerce",
    requirement: "optional",
    sensitive: false,
    purpose: "Shopify Admin API version override.",
    source: "lib/shopify/config.ts",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    category: "outreach",
    requirement: "optional",
    sensitive: true,
    purpose: "Google OAuth client ID for Gmail connection.",
    source: "app/api/auth/gmail/route.ts, app/api/auth/gmail/callback/route.ts, lib/gmail/token.ts",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    category: "outreach",
    requirement: "optional",
    sensitive: true,
    purpose: "Google OAuth client secret for Gmail connection.",
    source: "app/api/auth/gmail/callback/route.ts, lib/gmail/token.ts",
  },
  {
    name: "GOOGLE_PROJECT_ID",
    category: "outreach",
    requirement: "optional",
    sensitive: false,
    purpose: "Google project identifier for OAuth verification/admin context.",
    source: ".env.example",
  },
  {
    name: "GOOGLE_SERVICE_ACCOUNT_JSON",
    category: "outreach",
    requirement: "optional",
    sensitive: true,
    purpose: "Optional Google service account JSON for admin/test-user setup.",
    source: "lib/google/oauth-admin.ts",
  },
  {
    name: "META_APP_ID",
    category: "social",
    requirement: "optional",
    sensitive: true,
    purpose: "Meta app ID used for Instagram OAuth.",
    source: "app/api/auth/instagram/route.ts, app/api/auth/instagram/callback/route.ts",
  },
  {
    name: "META_APP_SECRET",
    category: "social",
    requirement: "optional",
    sensitive: true,
    purpose: "Meta app secret placeholder for Instagram connection setup.",
    source: ".env.example",
  },
  {
    name: "INSTAGRAM_APP_ID",
    category: "social",
    requirement: "optional",
    sensitive: true,
    purpose: "Instagram app ID fallback when META_APP_ID is not set.",
    source: "app/api/auth/instagram/route.ts, app/api/auth/instagram/callback/route.ts",
  },
  {
    name: "INSTAGRAM_APP_SECRET",
    category: "social",
    requirement: "optional",
    sensitive: true,
    purpose: "Instagram app secret for OAuth callback token exchange.",
    source: "app/api/auth/instagram/callback/route.ts",
  },
  {
    name: "INSTAGRAM_ACCESS_TOKEN",
    category: "social",
    requirement: "optional",
    sensitive: true,
    purpose: "Reserved Instagram token placeholder for manual/admin workflows.",
    source: ".env.example",
  },
  {
    name: "INSTAGRAM_USERNAME",
    category: "social",
    requirement: "optional",
    sensitive: false,
    purpose: "Reserved Instagram username placeholder for manual/admin workflows.",
    source: ".env.example",
  },
  {
    name: "INSTAGRAM_USER_ID",
    category: "social",
    requirement: "optional",
    sensitive: false,
    purpose: "Reserved Instagram user ID placeholder for manual/admin workflows.",
    source: ".env.example",
  },
  {
    name: "INSTAGRAM_GRAPH_ID",
    category: "social",
    requirement: "optional",
    sensitive: false,
    purpose: "Reserved Instagram graph ID placeholder for manual/admin workflows.",
    source: ".env.example",
  },
  {
    name: "UNIPILE_BASE_URL",
    category: "social",
    requirement: "optional",
    sensitive: false,
    purpose: "Unipile API base URL; defaults to the current API host if omitted.",
    source: "lib/unipile/client.ts",
  },
  {
    name: "UNIPILE_API_KEY",
    category: "social",
    requirement: "optional",
    sensitive: true,
    purpose: "Unipile API key for Instagram DM workflows.",
    source: ".env.example",
  },
  {
    name: "UNIPILE_ACCOUNT_ID",
    category: "social",
    requirement: "optional",
    sensitive: true,
    purpose: "Unipile connected account identifier for Instagram DM workflows.",
    source: ".env.example",
  },
  {
    name: "UNIPILE_WEBHOOK_SECRET",
    category: "social",
    requirement: "optional",
    sensitive: true,
    purpose: "Unipile webhook signing secret.",
    source: "app/api/webhooks/unipile/route.ts",
  },
  {
    name: "APIFY_API_TOKEN",
    category: "discovery",
    requirement: "optional",
    sensitive: true,
    purpose: "Apify actor token for creator discovery and email enrichment.",
    source: "lib/apify/client.ts, lib/enrichment/providers/apify-email.ts",
  },
  {
    name: "APIFY_TIKTOK_ACTOR_ID",
    category: "discovery",
    requirement: "optional",
    sensitive: false,
    purpose: "TikTok actor override for Apify enrichment.",
    source: "lib/apify/client.ts",
  },
  {
    name: "APIFY_PROXY_PASSWORD",
    category: "discovery",
    requirement: "optional",
    sensitive: true,
    purpose: "Reserved Apify proxy password placeholder.",
    source: ".env.example",
  },
  {
    name: "APIFY_USER_ID",
    category: "discovery",
    requirement: "optional",
    sensitive: true,
    purpose: "Reserved Apify user ID placeholder.",
    source: ".env.example",
  },
  {
    name: "CRAWLEE_PROXY_URLS",
    category: "discovery",
    requirement: "optional",
    sensitive: true,
    purpose: "Comma-separated proxy URLs for Crawlee Instagram validation.",
    source: "lib/instagram/validator.ts",
  },
  {
    name: "CREATOR_SEARCH_WORKER_BASE_URL",
    category: "discovery",
    requirement: "optional",
    sensitive: false,
    purpose: "Browser worker base URL for creator search.",
    source: ".env.example",
  },
  {
    name: "CREATOR_SEARCH_WORKER_TOKEN",
    category: "discovery",
    requirement: "optional",
    sensitive: true,
    purpose: "Browser worker auth token for creator search.",
    source: ".env.example",
  },
  {
    name: "CREATOR_SEARCH_DISABLE_INLINE_FALLBACK",
    category: "discovery",
    requirement: "optional",
    sensitive: false,
    purpose: "Disables local inline creator-search fallback when set to 1.",
    source: "lib/creator-search/local-fallback.ts",
  },
  {
    name: "CACHE_VALIDITY_HOURS",
    category: "discovery",
    requirement: "optional",
    sensitive: false,
    purpose: "Validation cache duration override.",
    source: "lib/creators/validation-policy.ts",
  },
  {
    name: "TRACK17_API_KEY",
    category: "shipping",
    requirement: "optional",
    sensitive: true,
    purpose: "17TRACK API key for shipment registration, sync, and webhook verification.",
    source: "lib/track17/client.ts, app/api/webhooks/track17/route.ts",
  },
  {
    name: "CLOUDINARY_CLOUD_NAME",
    category: "media",
    requirement: "optional",
    sensitive: false,
    purpose: "Cloudinary cloud name for mention media archiving.",
    source: "lib/cloudinary/client.ts, lib/mentions/media-archive.ts",
  },
  {
    name: "CLOUDINARY_API_KEY",
    category: "media",
    requirement: "optional",
    sensitive: true,
    purpose: "Cloudinary API key for mention media archiving.",
    source: "lib/cloudinary/client.ts",
  },
  {
    name: "CLOUDINARY_API_SECRET",
    category: "media",
    requirement: "optional",
    sensitive: true,
    purpose: "Cloudinary API secret for mention media archiving.",
    source: "lib/cloudinary/client.ts",
  },
  {
    name: "CLOUDINARY_URL",
    category: "media",
    requirement: "optional",
    sensitive: true,
    purpose: "Reserved Cloudinary URL placeholder.",
    source: ".env.example",
  },
  {
    name: "NEXT_PUBLIC_BOOKING_URL",
    category: "marketing",
    requirement: "optional",
    sensitive: false,
    purpose: "Marketing booking link override.",
    source: "app/(marketing)/components/analytics.ts",
  },
  {
    name: "NEXT_PUBLIC_CALENDLY_URL",
    category: "marketing",
    requirement: "optional",
    sensitive: false,
    purpose: "Marketing Calendly link override.",
    source: "app/(marketing)/components/analytics.ts",
  },
  {
    name: "FORM_WEBHOOK_URL",
    category: "marketing",
    requirement: "optional",
    sensitive: true,
    purpose: "Marketing lead form webhook destination.",
    source: "app/(marketing)/actions/submit-form.ts",
  },
  {
    name: "SENTRY_DSN",
    category: "observability",
    requirement: "optional",
    sensitive: false,
    purpose: "Sentry DSN for error reporting.",
    source: "lib/sentry.ts",
  },
  {
    name: "SUGGESTED_DISCOVERY_DIR",
    category: "testing",
    requirement: "optional",
    sensitive: false,
    purpose: "Local suggested-discovery fixture directory override.",
    source: "lib/suggested-discovery/store.ts",
  },
  {
    name: "IG_SESSION_DIR",
    category: "testing",
    requirement: "optional",
    sensitive: false,
    purpose: "Local Instagram browser-session directory override.",
    source: "lib/suggested-discovery/store.ts",
  },
  {
    name: "SUPABASE_E2E_ENABLED",
    category: "testing",
    requirement: "optional",
    sensitive: false,
    purpose: "Opt-in flag for live Supabase Playwright checks.",
    source: "e2e/*.spec.ts",
  },
  {
    name: "GMAIL_E2E_ENABLED",
    category: "testing",
    requirement: "optional",
    sensitive: false,
    purpose: "Opt-in flag for live Gmail Playwright checks.",
    source: "e2e/inbox.spec.ts",
  },
  {
    name: "E2E_EMAIL",
    category: "testing",
    requirement: "optional",
    sensitive: true,
    purpose: "Playwright production-cutover test email.",
    source: "e2e/production-cutover.spec.ts",
  },
  {
    name: "E2E_PASSWORD",
    category: "testing",
    requirement: "optional",
    sensitive: true,
    purpose: "Playwright production-cutover test password.",
    source: "e2e/production-cutover.spec.ts",
  },
];

export function runStagingPreflight(
  environment: Environment = process.env,
  checkedAt = new Date().toISOString()
): StagingPreflightResult {
  const variables: StagingEnvCheck[] = STAGING_ENV_DEFINITIONS.map(
    (definition) => ({
      ...definition,
      status: hasValue(environment[definition.name]) ? "present" : "missing",
    })
  );

  const requiredVariables = variables.filter(
    (variable) => variable.requirement === "required"
  );
  const optionalVariables = variables.filter(
    (variable) => variable.requirement === "optional"
  );
  const missingRequired = missingNames(requiredVariables);
  const missingOptional = missingNames(optionalVariables);

  return {
    ready: missingRequired.length === 0,
    checkedAt,
    required: {
      total: requiredVariables.length,
      present: requiredVariables.length - missingRequired.length,
      missing: missingRequired,
    },
    optional: {
      total: optionalVariables.length,
      present: optionalVariables.length - missingOptional.length,
      missing: missingOptional,
    },
    variables,
  };
}

export function formatStagingPreflightResult(
  result: StagingPreflightResult
): string {
  const lines = [
    "Seed Scale staging preflight",
    `Checked at: ${result.checkedAt}`,
    `Ready: ${result.ready ? "yes" : "no"}`,
    `Required: ${result.required.present}/${result.required.total} present`,
    `Optional: ${result.optional.present}/${result.optional.total} present`,
    "",
    "Required variables",
    ...formatVariables(result.variables, "required"),
    "",
    "Optional / feature-gated variables",
    ...formatVariables(result.variables, "optional"),
    "",
    "Safety: this report only prints variable names and present/missing status, never values.",
  ];

  return lines.join("\n");
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function missingNames(variables: StagingEnvCheck[]): string[] {
  return variables
    .filter((variable) => variable.status === "missing")
    .map((variable) => variable.name);
}

function formatVariables(
  variables: StagingEnvCheck[],
  requirement: StagingEnvRequirement
): string[] {
  return variables
    .filter((variable) => variable.requirement === requirement)
    .map(
      (variable) =>
        `- ${variable.name}: ${variable.status} (${variable.category}) — ${variable.purpose}`
    );
}
