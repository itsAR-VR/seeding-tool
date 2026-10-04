import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  mergeCampaignPosts,
  normalizePostUrl,
} from "@/app/(platform)/campaigns/[campaignId]/_components/campaign-posts";

const creator = { id: "c1", name: "Ana", instagramHandle: "ana", tiktokHandle: null };

describe("campaign posts", () => {
  it("normalizes post links so the same post matches", () => {
    expect(normalizePostUrl("https://www.instagram.com/p/ABC/?igsh=x")).toBe(
      normalizePostUrl("https://instagram.com/p/ABC")
    );
  });

  it("merges tagged and hand-added posts without duplicates, newest first", () => {
    const posts = mergeCampaignPosts(
      [
        {
          id: "cp1",
          platform: "instagram",
          permalink: "https://www.instagram.com/p/ABC/",
          mediaType: "IMAGE",
          mediaUrl: "https://cdn.example.com/a.jpg",
          thumbnailUrl: null,
          caption: "love it",
          username: "ana",
          postedAt: new Date("2026-09-01"),
          createdAt: new Date("2026-09-01"),
          creator: { id: "c1", name: "Ana" },
        },
      ],
      [
        {
          id: "m1",
          platform: "instagram",
          mediaUrl: "https://instagram.com/p/ABC",
          type: "post",
          caption: null,
          postedAt: null,
          createdAt: new Date("2026-09-02"),
          creator,
        },
        {
          id: "m2",
          platform: "tiktok",
          mediaUrl: "https://tiktok.com/@ana/video/1",
          type: "video",
          caption: null,
          postedAt: new Date("2026-09-05"),
          createdAt: new Date("2026-09-05"),
          creator,
        },
      ]
    );

    expect(posts.map((p) => p.key)).toEqual(["mention-m2", "content-cp1"]);
    expect(posts[1]).toMatchObject({ source: "tagged", imageUrl: "https://cdn.example.com/a.jpg" });
  });
});
