import { describe, expect, it } from "vitest";

import {
  formatStagingPreflightResult,
  runStagingPreflight,
  STAGING_ENV_DEFINITIONS,
} from "@/lib/config/staging-preflight";

describe("staging preflight", () => {
  it("marks staging not ready when required variables are missing", () => {
    const result = runStagingPreflight({}, "2026-09-11T19:00:00.000Z");

    expect(result.ready).toBe(false);
    expect(result.required.missing).toEqual([
      "NEXT_PUBLIC_APP_URL",
      "DATABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "APP_ENCRYPTION_KEY",
      "INNGEST_APP_ID",
    ]);
  });

  it("marks staging ready when required variables are present even if optional integrations are missing", () => {
    const result = runStagingPreflight(
      {
        NEXT_PUBLIC_APP_URL: "https://staging.seedscale.test",
        DATABASE_URL: "postgres://user:password@example.test/db",
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        APP_ENCRYPTION_KEY: "01234567890123456789012345678901",
        INNGEST_APP_ID: "seed-scale-staging",
      },
      "2026-09-11T19:00:00.000Z"
    );

    expect(result.ready).toBe(true);
    expect(result.required.missing).toEqual([]);
    expect(result.optional.missing).toContain("SHOPIFY_API_KEY");
    expect(result.optional.missing).toContain("OPENAI_API_KEY");
  });

  it("does not include environment values in structured or formatted reports", () => {
    const environment = {
      NEXT_PUBLIC_APP_URL: "https://staging.seedscale.test",
      DATABASE_URL: "postgres://user:super-secret@example.test/db",
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-secret",
      SUPABASE_SERVICE_ROLE_KEY: "service-secret",
      APP_ENCRYPTION_KEY: "encryption-secret",
      INNGEST_APP_ID: "seed-scale-staging",
      OPENAI_API_KEY: "sk-secret",
    };

    const result = runStagingPreflight(
      environment,
      "2026-09-11T19:00:00.000Z"
    );
    const serialized = JSON.stringify(result);
    const formatted = formatStagingPreflightResult(result);

    Object.values(environment).forEach((value) => {
      expect(serialized).not.toContain(value);
      expect(formatted).not.toContain(value);
    });
  });

  it("keeps every env definition name unique", () => {
    const names = STAGING_ENV_DEFINITIONS.map((definition) => definition.name);

    expect(new Set(names).size).toBe(names.length);
  });
});
