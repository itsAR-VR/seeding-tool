import { describe, expect, it } from "vitest";
import {
  extractCampaignIdFromJobQuery,
  selectSelectableCreatorSearchResults,
  serializeCreatorSearchJob,
  serializeCreatorSearchResult,
} from "@/lib/creator-search/job-payload";

describe("creator search job payload helpers", () => {
  it("extracts campaign ids from job query payloads", () => {
    expect(
      extractCampaignIdFromJobQuery({ campaignId: "camp_123", limit: 25 })
    ).toBe("camp_123");
    expect(extractCampaignIdFromJobQuery({ campaignId: 12 })).toBeNull();
    expect(extractCampaignIdFromJobQuery(["camp_123"])).toBeNull();
  });

  it("serializes job progress fields and clamps progress percent", () => {
    const payload = serializeCreatorSearchJob({
      id: "job_123",
      status: "running",
      campaignId: "camp_123",
      requestedCount: 50,
      candidateCount: 12,
      validatedCount: 6,
      invalidCount: 4,
      cachedCount: 2,
      progressPercent: 120,
      etaSeconds: 45,
      resultCount: 6,
      error: null,
      startedAt: new Date("2026-03-09T10:00:00.000Z"),
      finishedAt: null,
      createdAt: new Date("2026-03-09T09:59:00.000Z"),
      updatedAt: new Date("2026-03-09T10:01:00.000Z"),
      query: { campaignId: "camp_123" },
    });

    expect(payload).toMatchObject({
      jobId: "job_123",
      status: "running",
      requestedCount: 50,
      candidateCount: 12,
      validatedCount: 6,
      invalidCount: 4,
      cachedCount: 2,
      progressPercent: 100,
      etaSeconds: 45,
      resultCount: 6,
      campaignId: "camp_123",
    });
  });

  it("prefers validated metrics when serializing search results", () => {
    const payload = serializeCreatorSearchResult({
      id: "result_123",
      handle: "creator_handle",
      source: "apify_search",
      primarySource: "apify_search",
      sources: ["apify_search", "collabstr"],
      name: "Creator",
      followerCount: 2400,
      engagementRate: 0.03,
      profileUrl: "https://instagram.com/creator_handle",
      imageUrl: null,
      bio: "Wellness creator",
      email: "creator@example.com",
      bioCategory: "Wellness",
      rawSourceCategory: "Wellness",
      seedCreatorId: null,
      metadata: { sample: true },
      platform: "instagram",
      fitScore: 0.81,
      fitReasoning: "Strong match",
      validationStatus: "valid",
      validationError: null,
      validatedFollowerCount: 3100,
      validatedAvgViews: 1800,
    });

    expect(payload).toMatchObject({
      handle: "creator_handle",
      primarySource: "apify_search",
      sources: ["apify_search", "collabstr"],
      followerCount: 3100,
      avgViews: 1800,
      email: "creator@example.com",
      validationStatus: "valid",
    });
  });

  it("only filters explicitly invalid results from selectable payloads", () => {
    const selectable = selectSelectableCreatorSearchResults([
      {
        id: "valid_1",
        handle: "valid_1",
        source: "apify_search",
        primarySource: null,
        sources: null,
        name: null,
        followerCount: null,
        engagementRate: null,
        profileUrl: null,
        imageUrl: null,
        bio: null,
        email: null,
        bioCategory: null,
        rawSourceCategory: null,
        seedCreatorId: null,
        metadata: null,
        platform: "instagram",
        fitScore: null,
        fitReasoning: null,
        validationStatus: "valid",
        validationError: null,
        validatedFollowerCount: null,
        validatedAvgViews: null,
      },
      {
        id: "unknown_1",
        handle: "unknown_1",
        source: "collabstr",
        primarySource: null,
        sources: null,
        name: null,
        followerCount: null,
        engagementRate: null,
        profileUrl: null,
        imageUrl: null,
        bio: null,
        email: null,
        bioCategory: null,
        rawSourceCategory: null,
        seedCreatorId: null,
        metadata: null,
        platform: "instagram",
        fitScore: null,
        fitReasoning: null,
        validationStatus: "unknown",
        validationError: null,
        validatedFollowerCount: null,
        validatedAvgViews: null,
      },
      {
        id: "invalid_1",
        handle: "invalid_1",
        source: "collabstr",
        primarySource: null,
        sources: null,
        name: null,
        followerCount: null,
        engagementRate: null,
        profileUrl: null,
        imageUrl: null,
        bio: null,
        email: null,
        bioCategory: null,
        rawSourceCategory: null,
        seedCreatorId: null,
        metadata: null,
        platform: "instagram",
        fitScore: null,
        fitReasoning: null,
        validationStatus: "invalid",
        validationError: "missing_profile",
        validatedFollowerCount: null,
        validatedAvgViews: null,
      },
    ]);

    expect(selectable.map((result) => result.id)).toEqual([
      "valid_1",
      "unknown_1",
    ]);
  });
});
