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

  it("rejects non-profile Instagram routes and lookalike hosts", () => {
    expect(normalizeIgHandle("https://www.instagram.com/p/ABC123/")).toBeNull();
    expect(normalizeIgHandle("https://www.instagram.com/explore/")).toBeNull();
    expect(normalizeIgHandle("https://www.instagram.com/reels/")).toBeNull();
    expect(normalizeIgHandle("https://evil.example/?next=instagram.com/victim")).toBeNull();
    expect(normalizeIgHandle("https://instagram.com.evil.com/victim")).toBeNull();
  });

  it("accepts bare handles that contain the instagram.com substring", () => {
    expect(normalizeIgHandle("instagram.comedy")).toBe("instagram.comedy");
    expect(normalizeIgHandle("myinstagram.com")).toBe("myinstagram.com");
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

  it("does not let bio text overwrite real counts", () => {
    const text = [
      "8K followers",
      "120 following",
      "Some Creator",
      "Helping 50K followers grow their audience",
    ].join("\n");
    expect(parseHeaderCounts(text).followers).toBe(8000);
  });

  it("keeps bio lines that merely start with count-like text", () => {
    // Not a standalone count line — it must survive into the bio.
    const text = [
      "creator.two",
      "100 posts",
      "12K followers",
      "300 following",
      "50K followers learning skincare together",
    ].join("\n");
    const parsed = parseHeaderText(text, "creator.two");
    expect(parsed.followers).toBe(12000);
    expect(parsed.bio).toBe("50K followers learning skincare together");
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

  it("extracts name, bio and counts without fabricating a category", () => {
    // The name is only stripped from the bio when it matches the reliable
    // meta-derived signal.
    const parsed = parseHeaderText(headerText, "trail.kate", "Kate Wilder");
    expect(parsed.displayName).toBe("Kate Wilder");
    expect(parsed.category).toBeNull();
    expect(parsed.bio).toBe(
      "Outdoor enthusiast\nBackpacking the PCT one section at a time\nGear reviews & trail recipes\ntrailkate.example.com"
    );
    expect(parsed.followers).toBe(84200);
    expect(parsed.posts).toBe(431);
  });

  it("keeps the name line in the bio when no meta name is available", () => {
    const parsed = parseHeaderText(headerText, "trail.kate");
    expect(parsed.displayName).toBeNull();
    expect(parsed.bio).toContain("Kate Wilder");
  });

  it("treats a lone content line as bio, not display name", () => {
    // Display name is optional on IG; a single remaining line is more
    // likely bio text, and the bio drives classification.
    const minimal = ["someone", "10 posts", "100 followers", "50 following", "Just bio."].join(
      "\n"
    );
    const parsed = parseHeaderText(minimal, "someone");
    expect(parsed.displayName).toBeNull();
    expect(parsed.bio).toBe("Just bio.");
    expect(parsed.category).toBeNull();
  });

  it("never promotes bio lines into the category field", () => {
    // Category-less profile with a multi-line bio: the first bio line is
    // short and punctuation-free — it must NOT be reported as the
    // authoritative Instagram category. Without a meta name signal the
    // display-name line conservatively stays in the bio too.
    const text = [
      "creator.one",
      "100 posts",
      "12K followers",
      "300 following",
      "Derm approved skincare",
      "Sensitive-skin routines",
    ].join("\n");
    const parsed = parseHeaderText(text, "creator.one");
    expect(parsed.category).toBeNull();
    expect(parsed.displayName).toBeNull();
    expect(parsed.bio).toBe("Derm approved skincare\nSensitive-skin routines");
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

  it("preserves comma-grouped numbers in meta counts", () => {
    const html =
      '<meta property="og:description" content="1,234 Followers, 610 Following, 431 Posts - See Instagram photos and videos from Kate Wilder (@trail.kate)" />';
    expect(parseMetaDescription(html)?.followers).toBe(1234);
    const big =
      '<meta property="og:description" content="1,234,567 Followers, 10 Following, 5 Posts - See Instagram photos and videos from Kate Wilder (@trail.kate)" />';
    expect(parseMetaDescription(big)?.followers).toBe(1234567);
  });

  it("returns null when the meta tag is absent", () => {
    expect(parseMetaDescription("<html><head></head></html>")).toBeNull();
  });

  it("parses meta content containing apostrophes", () => {
    const html =
      '<meta property="og:description" content="84.2K Followers, 610 Following, 431 Posts - See Instagram photos and videos from Kate\'s Bakery (@kates.bakery)" />';
    expect(parseMetaDescription(html)?.displayName).toBe("Kate's Bakery");
  });
});
