import { describe, expect, it } from "vitest";
import {
  normalizeIgHandle,
  parseHeaderCounts,
  parseHeaderText,
  parseMetaDescription,
} from "@/lib/suggested-discovery/parse";

describe("normalizeIgHandle", () => {
  it("accepts bare handles", () => {
    expect(normalizeIgHandle("trail.kate")).toBe("trail.kate");
  });

  it("strips @ and lowercases", () => {
    expect(normalizeIgHandle("@Trail.Kate")).toBe("trail.kate");
  });

  it("extracts from profile URLs", () => {
    expect(normalizeIgHandle("https://www.instagram.com/Trail.Kate/")).toBe("trail.kate");
    expect(normalizeIgHandle("instagram.com/trail.kate?igsh=abc")).toBe("trail.kate");
  });

  it("rejects invalid handles", () => {
    expect(normalizeIgHandle("")).toBeNull();
    expect(normalizeIgHandle("not a handle!")).toBeNull();
    expect(normalizeIgHandle(null)).toBeNull();
    expect(normalizeIgHandle("a".repeat(31))).toBeNull();
  });
});

describe("parseHeaderCounts", () => {
  it("parses the three count lines", () => {
    const text = "431 posts\n84.2K followers\n610 following";
    expect(parseHeaderCounts(text)).toEqual({ posts: 431, followers: 84200, following: 610 });
  });

  it("tolerates missing counts", () => {
    expect(parseHeaderCounts("no counts here")).toEqual({
      posts: null,
      followers: null,
      following: null,
    });
  });
});

describe("parseHeaderText", () => {
  const headerText = [
    "trail.kate",
    "Follow",
    "Message",
    "431 posts",
    "84.2K followers",
    "610 following",
    "Kate Wilder",
    "Outdoor enthusiast",
    "Backpacking the PCT one section at a time",
    "Gear reviews & trail recipes",
    "trailkate.example.com",
  ].join("\n");

  it("extracts name, category, bio and counts", () => {
    const parsed = parseHeaderText(headerText, "trail.kate");
    expect(parsed.displayName).toBe("Kate Wilder");
    expect(parsed.category).toBe("Outdoor enthusiast");
    expect(parsed.bio).toBe(
      "Backpacking the PCT one section at a time\nGear reviews & trail recipes\ntrailkate.example.com"
    );
    expect(parsed.followers).toBe(84200);
    expect(parsed.posts).toBe(431);
  });

  it("handles minimal headers without a category line", () => {
    const minimal = ["someone", "10 posts", "100 followers", "50 following", "Just bio."].join(
      "\n"
    );
    const parsed = parseHeaderText(minimal, "someone");
    expect(parsed.displayName).toBe("Just bio.");
    expect(parsed.category).toBeNull();
  });
});

describe("parseMetaDescription", () => {
  it("parses the standard og:description contract", () => {
    const html =
      '<meta property="og:description" content="84.2K Followers, 610 Following, 431 Posts - See Instagram photos and videos from Kate Wilder (@trail.kate)" />';
    const parsed = parseMetaDescription(html);
    expect(parsed).not.toBeNull();
    expect(parsed?.displayName).toBe("Kate Wilder");
    expect(parsed?.followers).toBe(84200);
    expect(parsed?.following).toBe(610);
    expect(parsed?.posts).toBe(431);
  });

  it("returns null when the meta tag is absent", () => {
    expect(parseMetaDescription("<html><head></head></html>")).toBeNull();
  });
});
