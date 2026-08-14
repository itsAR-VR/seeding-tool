import { describe, expect, it } from "vitest";
import {
  buildVerdictPrompt,
  parseVerdictJson,
} from "@/lib/suggested-discovery/vision";

describe("buildVerdictPrompt", () => {
  it("embeds the niche and canonical category list", () => {
    const prompt = buildVerdictPrompt("clean skincare for sensitive skin");
    expect(prompt).toContain("clean skincare for sensitive skin");
    expect(prompt).toContain("Beauty");
    expect(prompt).toContain("JSON");
  });
});

describe("parseVerdictJson", () => {
  it("parses a clean verdict", () => {
    const raw = JSON.stringify({
      match: true,
      confidence: 0.9,
      tags: ["Beauty", "Fashion"],
      reason: "Bio and grid are derm-skincare focused.",
    });
    const verdict = parseVerdictJson(raw);
    expect(verdict?.match).toBe(true);
    expect(verdict?.confidence).toBe(0.9);
    expect(verdict?.tags).toEqual(["Beauty", "Fashion"]);
    expect(verdict?.source).toBe("vision");
  });

  it("tolerates code fences and prose around the JSON", () => {
    const raw = 'Here is my analysis:\n```json\n{"match": false, "confidence": 0.7, "tags": [], "reason": "Off niche."}\n```';
    expect(parseVerdictJson(raw)?.match).toBe(false);
  });

  it("clamps confidence and drops non-canonical tags", () => {
    const raw = JSON.stringify({
      match: true,
      confidence: 42,
      tags: ["Beauty", "Not A Category", 7],
      reason: "x",
    });
    const verdict = parseVerdictJson(raw);
    expect(verdict?.confidence).toBe(1);
    expect(verdict?.tags).toEqual(["Beauty"]);
  });

  it("returns null on unrecoverable output", () => {
    expect(parseVerdictJson("no json here")).toBeNull();
    expect(parseVerdictJson("{broken")).toBeNull();
    expect(parseVerdictJson("[1,2,3]")).toBeNull();
  });

  it("rejects malformed verdicts missing a boolean match", () => {
    expect(parseVerdictJson('{"confidence": 0.9}')).toBeNull();
    expect(parseVerdictJson('{"match": "yes", "confidence": 0.9}')).toBeNull();
    expect(parseVerdictJson('{"match": null, "tags": []}')).toBeNull();
  });
});
