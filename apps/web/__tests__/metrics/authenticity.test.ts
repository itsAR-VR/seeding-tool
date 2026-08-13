import { describe, expect, it } from "vitest";
import { assessAuthenticity } from "@/lib/metrics/authenticity";

function snapshot(input: {
  date: string;
  followers: number;
  following?: number;
}) {
  return {
    id: input.date,
    profileId: "profile-1",
    date: new Date(input.date),
    followers: input.followers,
    following: input.following ?? 300,
    posts: 40,
    avgViews: 8_000,
    engagementRate: 0.04,
    likes: null,
    comments: null,
    source: "instagram_validated",
    sourceConfidence: 0.85,
    createdAt: new Date(input.date),
    updatedAt: new Date(input.date),
  };
}

describe("assessAuthenticity", () => {
  it("scores complete verified profiles above incomplete suspicious ones", () => {
    const trusted = assessAuthenticity({
      snapshots: [
        snapshot({ date: "2026-03-01T00:00:00.000Z", followers: 20_000 }),
        snapshot({ date: "2026-03-02T00:00:00.000Z", followers: 20_500 }),
        snapshot({ date: "2026-03-03T00:00:00.000Z", followers: 21_000 }),
      ],
      validationStatus: "valid",
      sourceConfidence: 0.85,
      isVerified: true,
      followerCount: 21_000,
      followingCount: 400,
      postCount: 80,
      engagementRate: 0.04,
      bioText: "Skincare creator",
      profileImageUrl: "https://cdn.example.com/avatar.jpg",
      websiteUrl: "https://creator.example.com",
    });

    const suspicious = assessAuthenticity({
      snapshots: [
        snapshot({ date: "2026-03-01T00:00:00.000Z", followers: 8_000, following: 5_000 }),
        snapshot({ date: "2026-03-02T00:00:00.000Z", followers: 12_000, following: 18_000 }),
      ],
      validationStatus: "unknown",
      sourceConfidence: 0.4,
      isVerified: false,
      followerCount: 12_000,
      followingCount: 18_000,
      postCount: 2,
      engagementRate: 0.18,
      bioText: null,
      profileImageUrl: null,
      websiteUrl: null,
    });

    expect(trusted.authScore).toBeGreaterThan(suspicious.authScore);
    expect(trusted.botRiskScore).toBeLessThan(suspicious.botRiskScore);
  });
});
