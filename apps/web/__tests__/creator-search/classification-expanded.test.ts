import { describe, expect, it } from "vitest";
import { classifyDiscoveryText } from "@/lib/creator-search/classification";
import { CANONICAL_DISCOVERY_CATEGORIES } from "@/lib/categories/catalog";

describe("expanded category taxonomy", () => {
  it("contains 17 categories including Other", () => {
    expect(CANONICAL_DISCOVERY_CATEGORIES).toHaveLength(17);
    expect(CANONICAL_DISCOVERY_CATEGORIES).toContain("Other");
  });

  it("contains all 10 new categories", () => {
    const newCategories = [
      "Tech",
      "Gaming",
      "Travel",
      "Parenting",
      "Pets",
      "Sports",
      "Education",
      "Entertainment",
      "Finance",
      "Automotive",
    ];
    for (const category of newCategories) {
      expect(CANONICAL_DISCOVERY_CATEGORIES).toContain(category);
    }
  });
});

describe("new category keyword matching", () => {
  it("classifies tech bio", () => {
    const result = classifyDiscoveryText({
      bio: "Software developer building startup tools",
    });
    expect(result.canonicalCategory).toBe("Tech");
    expect(result.confidence).not.toBe("low");
  });

  it("classifies gaming bio", () => {
    const result = classifyDiscoveryText({
      bio: "Pro gamer and esports streamer on Twitch",
    });
    expect(result.canonicalCategory).toBe("Gaming");
    expect(result.confidence).toBe("high");
  });

  it("classifies travel bio", () => {
    const result = classifyDiscoveryText({
      bio: "Travel blogger exploring destinations worldwide",
    });
    expect(result.canonicalCategory).toBe("Travel");
    expect(result.confidence).toBe("high");
  });

  it("classifies parenting bio", () => {
    const result = classifyDiscoveryText({
      bio: "Mom of two sharing parenting tips and baby products",
    });
    expect(result.canonicalCategory).toBe("Parenting");
    expect(result.confidence).toBe("high");
  });

  it("classifies pets bio", () => {
    const result = classifyDiscoveryText({
      bio: "Dog rescue advocate and pet care enthusiast",
    });
    expect(result.canonicalCategory).toBe("Pets");
    expect(result.confidence).toBe("high");
  });

  it("classifies sports bio", () => {
    const result = classifyDiscoveryText({
      bio: "Professional athlete competing in basketball league",
    });
    expect(result.canonicalCategory).toBe("Sports");
    expect(result.confidence).toBe("high");
  });

  it("classifies education bio", () => {
    const result = classifyDiscoveryText({
      bio: "Teacher creating learning tutorials for students",
    });
    expect(result.canonicalCategory).toBe("Education");
    expect(result.confidence).toBe("high");
  });

  it("classifies entertainment bio", () => {
    const result = classifyDiscoveryText({
      bio: "Comedy performer and singer at live concerts",
    });
    expect(result.canonicalCategory).toBe("Entertainment");
    expect(result.confidence).toBe("high");
  });

  it("classifies finance bio", () => {
    const result = classifyDiscoveryText({
      bio: "Crypto investing and stock trading tips",
    });
    expect(result.canonicalCategory).toBe("Finance");
    expect(result.confidence).toBe("high");
  });

  it("classifies automotive bio", () => {
    const result = classifyDiscoveryText({
      bio: "Vehicle detailing and automotive reviews",
    });
    expect(result.canonicalCategory).toBe("Automotive");
    expect(result.confidence).toBe("high");
  });
});

describe("category overlap disambiguation", () => {
  it("separates sports from fitness (athlete in sports context)", () => {
    const result = classifyDiscoveryText({
      bio: "Professional athlete in the basketball league, team captain",
    });
    expect(result.canonicalCategory).toBe("Sports");
  });

  it("separates fitness from sports (gym/workout context)", () => {
    const result = classifyDiscoveryText({
      bio: "Personal trainer helping clients with gym workouts and exercise plans",
    });
    expect(result.canonicalCategory).toBe("Fitness & Workout");
  });

  it("separates entertainment from gaming", () => {
    const result = classifyDiscoveryText({
      bio: "Actor and comedian performing in movies and shows",
    });
    expect(result.canonicalCategory).toBe("Entertainment");
  });

  it("separates gaming from entertainment", () => {
    const result = classifyDiscoveryText({
      bio: "Console gamer streaming on Twitch, esports competitor",
    });
    expect(result.canonicalCategory).toBe("Gaming");
  });

  it("separates education from tech", () => {
    const result = classifyDiscoveryText({
      bio: "Teacher building curriculum for classroom learning",
    });
    expect(result.canonicalCategory).toBe("Education");
  });
});

describe("multi-label secondaryCategories", () => {
  it("returns secondaryCategories when multiple categories match", () => {
    const result = classifyDiscoveryText({
      bio: "Mom blogger sharing parenting tips and healthy food recipes for the family",
    });
    expect(result.canonicalCategory).toBeDefined();
    expect(result.secondaryCategories).toBeDefined();
    expect(result.secondaryCategories!.length).toBeGreaterThanOrEqual(1);
    const allCategories = [
      result.canonicalCategory,
      ...result.secondaryCategories!.map((s) => s.category),
    ];
    expect(allCategories.length).toBeGreaterThanOrEqual(2);
  });

  it("omits secondaryCategories when only one category matches", () => {
    const result = classifyDiscoveryText({
      bio: "Skincare and makeup beauty creator",
    });
    expect(result.canonicalCategory).toBe("Beauty");
    expect(result.secondaryCategories).toBeUndefined();
  });

  it("primary category has most keyword hits", () => {
    const result = classifyDiscoveryText({
      bio: "Professional dog trainer sharing pet rescue stories and puppy care tips. Also love cooking.",
    });
    // Pets has more keyword hits (dog, pet, puppy) than Food (cooking)
    expect(result.canonicalCategory).toBe("Pets");
    if (result.secondaryCategories) {
      const foodSecondary = result.secondaryCategories.find(
        (s) => s.category === "Food & Drink"
      );
      expect(foodSecondary).toBeDefined();
    }
  });
});

describe("backward compatibility", () => {
  it("canonicalCategory always exists as a string", () => {
    const result = classifyDiscoveryText({
      bio: "Random person with no clear niche",
    });
    expect(typeof result.canonicalCategory).toBe("string");
  });

  it("confidence always exists as a string enum value", () => {
    const result = classifyDiscoveryText({
      bio: "Beauty guru and skincare expert",
    });
    expect(["high", "medium", "low"]).toContain(result.confidence);
  });

  it("existing Beauty classification still works", () => {
    const result = classifyDiscoveryText({
      rawSourceCategory: "Skincare",
      bio: "Beauty and skincare creator",
    });
    expect(result.canonicalCategory).toBe("Beauty");
    expect(result.confidence).toBe("high");
  });

  it("existing Health & Wellness alias still works", () => {
    const result = classifyDiscoveryText({
      rawSourceCategory: "Supplements",
    });
    expect(result.canonicalCategory).toBe("Health & Wellness");
  });

  it("new aliases map correctly", () => {
    expect(
      classifyDiscoveryText({ rawSourceCategory: "Technology" })
        .canonicalCategory,
    ).toBe("Tech");
    expect(
      classifyDiscoveryText({ rawSourceCategory: "Video Games" })
        .canonicalCategory,
    ).toBe("Gaming");
    expect(
      classifyDiscoveryText({ rawSourceCategory: "Tourism" })
        .canonicalCategory,
    ).toBe("Travel");
    expect(
      classifyDiscoveryText({ rawSourceCategory: "Cars" }).canonicalCategory,
    ).toBe("Automotive");
    expect(
      classifyDiscoveryText({ rawSourceCategory: "Investing" })
        .canonicalCategory,
    ).toBe("Finance");
  });

  it("Other is returned for unrecognized bios with low confidence", () => {
    const result = classifyDiscoveryText({
      bio: "Just vibing",
    });
    expect(result.canonicalCategory).toBe("Other");
    expect(result.confidence).toBe("low");
  });
});
