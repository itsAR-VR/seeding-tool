import { describe, expect, it, vi } from "vitest";
import {
  buildClaimUrl,
  createClaimToken,
  hashClaimToken,
} from "@/lib/gift-claims/tokens";

describe("gift claim tokens", () => {
  it("generates opaque tokens and stores only stable hashes", () => {
    const token = createClaimToken();
    const hash = hashClaimToken(token);

    expect(token).toHaveLength(43);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(hashClaimToken(token)).toBe(hash);
  });

  it("builds a claim URL without adding PII", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://seed.example.com/");

    expect(buildClaimUrl("raw-token")).toBe(
      "https://seed.example.com/claim/raw-token"
    );
  });
});
