import { describe, expect, it } from "vitest";
import {
  buildUnifiedDiscoveryQueryFromAutomationConfig,
  buildUnifiedDiscoveryQueryFromCampaignSearch,
  buildUnifiedDiscoveryQueryFromManualSearch,
  normalizeUnifiedDiscoveryQuery,
} from "@/lib/creator-search/contracts";

describe("creator search contracts", () => {
  it("normalizes manual apify search requests into the unified query", () => {
    const query = buildUnifiedDiscoveryQueryFromManualSearch({
      searchMode: "profile",
      usernames: ["@creator_one", " creator_two "],
      limit: 40,
    });

    expect(query).toMatchObject({
      sources: ["apify_search"],
      usernames: ["creator_one", "creator_two"],
      limit: 40,
      filters: {
        excludeExistingCreators: false,
      },
    });
  });

  it("maps non-canonical campaign categories into keywords", () => {
    const query = buildUnifiedDiscoveryQueryFromCampaignSearch({
      keywords: ["sleep aid"],
      category: "Supplements",
      minFollowers: 1200,
      maxFollowers: 50000,
      limit: 15,
    });

    expect(query).toMatchObject({
      sources: ["collabstr"],
      keywords: ["sleep aid", "Supplements"],
      canonicalCategories: [],
      filters: {
        minFollowers: 1200,
        maxFollowers: 50000,
        requireCategory: false,
      },
    });
  });

  it("promotes canonical automation categories while preserving legacy hashtag input", () => {
    const query = buildUnifiedDiscoveryQueryFromAutomationConfig({
      hashtag: "#beautycreator",
      categories: {
        apify: ["Beauty"],
        collabstr: ["Supplements"],
      },
      limit: 75,
    });

    expect(query).toMatchObject({
      sources: ["apify_search"],
      keywords: ["beautycreator", "Supplements"],
      canonicalCategories: ["Beauty"],
      limit: 75,
    });
  });

  it("applies schema defaults when optional fields are omitted", () => {
    const query = normalizeUnifiedDiscoveryQuery({
      keywords: ["wellness"],
    });

    expect(query).toMatchObject({
      sources: ["collabstr", "apify_search"],
      keywords: ["wellness"],
      platform: "instagram",
      limit: 25,
      emailPrefetch: false,
    });
  });
});
