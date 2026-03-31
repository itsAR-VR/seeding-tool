import { describe, expect, it } from "vitest";
import {
  computeEmailDomainSignal,
  computeHandleMatchSignal,
  computeNameSimilaritySignal,
  computeWebsiteOverlapSignal,
} from "@/lib/identity/signals";

describe("identity signals", () => {
  it("scores exact cross-platform handle matches strongly", () => {
    expect(
      computeHandleMatchSignal("JaneDoe", "janedoe", "instagram", "tiktok")
    ).toMatchObject({ value: 1, weight: 0.25 });
  });

  it("detects matching website domains", () => {
    expect(
      computeWebsiteOverlapSignal("https://janedoe.com", "http://www.janedoe.com")
        .value
    ).toBe(1);
  });

  it("detects matching email domains", () => {
    expect(
      computeEmailDomainSignal("jane@brand.com", "team@brand.com").value
    ).toBe(1);
  });

  it("gives partial score to overlapping names", () => {
    expect(computeNameSimilaritySignal("Jane Doe", "Jane A. Doe").value).toBeGreaterThan(0.5);
  });
});
