import { describe, expect, it } from "vitest";
import type { BrandProfileSnapshot } from "@/lib/brands/profile";
import { deriveBrandProfileSignals } from "@/lib/brands/signals";
import {
  applyBusinessDnaEdits,
  getBusinessDnaModel,
  mergeBrandProfileWithBusinessDna,
  synthesizeBusinessDna,
} from "@/lib/brands/synthesis";

function createProfile(): BrandProfileSnapshot {
  return {
    sourceUrl: "https://sleepkalm.com/",
    domain: "sleepkalm.com",
    fetchedAt: "2026-03-10T00:00:00.000Z",
    title: "Kalm",
    description: "Vitamin-infused mouth tape for deeper sleep.",
    siteName: "Kalm",
    ogTitle: "Sleep better with Kalm",
    ogDescription: "Soft, breathable mouth tape that stays put all night.",
    ogImage: "https://sleepkalm.com/images/og.png",
    twitterTitle: "Kalm mouth tape",
    twitterDescription: "Unlock deeper and more energized sleep.",
    twitterImage: "https://sleepkalm.com/images/twitter.png",
    heroHeadings: ["new vitamin infused mouth tape"],
    heroImageCandidates: [
      "https://sleepkalm.com/images/hero-1.jpg",
      "https://sleepkalm.com/images/hero-2.jpg",
    ],
    textSignals: [
      "Soft, breathable, and stays put all night.",
      "Comfort-first, skin-friendly support with easy-peel removal.",
    ],
    bodyExcerpt:
      "Soft, breathable, and stays put all night. Comfort-first, skin-friendly support with easy-peel removal.",
  };
}

describe("business dna synthesis", () => {
  it("normalizes parsed business dna into compatibility-friendly fields", async () => {
    const profile = createProfile();
    const fakeClient = {
      chat: {
        completions: {
          parse: async () => ({
            choices: [
              {
                message: {
                  parsed: {
                    brandSummary:
                      "A sleep wellness brand focused on vitamin-infused mouth tape.",
                    targetAudience: "Adults trying to improve nightly recovery",
                    niche: "Sleep wellness",
                    category: "Health & wellness",
                    tone: "Comfort-first and quietly premium",
                    brandVoice: "Warm, modern, and reassuring",
                    keyProducts: ["Vitamin-infused mouth tape"],
                    proofSignals: [
                      "Breathable mouth tape",
                      "Easy-peel nightly support",
                    ],
                    keywords: ["sleep wellness", "mouth tape", "night routine"],
                    visualDirection: [
                      "soft neutral photography",
                      "clean premium wellness",
                    ],
                    imageCandidates: [
                      "https://sleepkalm.com/images/hero-1.jpg",
                      "https://not-allowed.example/ignore.jpg",
                    ],
                  },
                },
              },
            ],
          }),
        },
      },
    };

    const businessDna = await synthesizeBusinessDna(
      {
        brandName: "Kalm",
        websiteUrl: "https://sleepkalm.com/",
        profile,
      },
      fakeClient
    );

    expect(businessDna).toMatchObject({
      brandSummary:
        "A sleep wellness brand focused on vitamin-infused mouth tape.",
      targetAudience: "Adults trying to improve nightly recovery",
      audience: "Adults trying to improve nightly recovery",
      niche: "Sleep wellness",
      category: "Health & wellness",
      industry: "Health & wellness",
      tone: "Comfort-first and quietly premium",
      brandVoice: "Warm, modern, and reassuring",
      keyProducts: ["Vitamin-infused mouth tape"],
      proofSignals: ["Breathable mouth tape", "Easy-peel nightly support"],
    });
    expect(businessDna?.imageCandidates).toEqual([
      "https://sleepkalm.com/images/hero-1.jpg",
    ]);

    const mergedProfile = mergeBrandProfileWithBusinessDna(profile, {
      businessDna,
      status: "complete",
      model: getBusinessDnaModel(),
      analyzedAt: "2026-03-10T00:10:00.000Z",
    });

    expect(mergedProfile.businessDna?.brandSummary).toBe(
      businessDna?.brandSummary
    );
    expect(mergedProfile.targetAudience).toBe(
      "Adults trying to improve nightly recovery"
    );
    expect(mergedProfile.brandVoice).toBe("Warm, modern, and reassuring");
    expect(mergedProfile.analysisStatus).toBe("complete");
  });

  it("returns null when the model call fails", async () => {
    const result = await synthesizeBusinessDna(
      {
        brandName: "Kalm",
        websiteUrl: "https://sleepkalm.com/",
        profile: createProfile(),
      },
      {
        chat: {
          completions: {
            parse: async () => {
              throw new Error("boom");
            },
          },
        },
      }
    );

    expect(result).toBeNull();
  });

  it("keeps ICP field-name compatibility after merge", () => {
    const mergedProfile = mergeBrandProfileWithBusinessDna(createProfile(), {
      businessDna: {
        brandSummary: "Premium sleep support.",
        targetAudience: "Adults who want better sleep",
        audience: "Adults who want better sleep",
        niche: "Sleep wellness",
        category: "Wellness",
        industry: "Wellness",
        tone: "Quiet luxury",
        brandVoice: "Refined and calming",
        keyProducts: ["Vitamin-infused mouth tape"],
        proofSignals: ["Skin-friendly adhesive"],
        keywords: ["sleep", "mouth tape"],
        visualDirection: ["editorial glow"],
        imageCandidates: ["https://sleepkalm.com/images/hero-1.jpg"],
      },
      status: "complete",
      model: getBusinessDnaModel(),
    });

    expect(deriveBrandProfileSignals(mergedProfile, null)).toEqual({
      targetAudience: "Adults who want better sleep",
      niche: "Sleep wellness",
      brandVoice: "Quiet luxury",
    });
  });

  it("applies save-on-continue edits without dropping raw scrape fields", () => {
    const editedProfile = applyBusinessDnaEdits(createProfile(), {
      brandSummary: "A refined recovery brand for sleep-conscious adults.",
      targetAudience: "Sleep-conscious adults building a night routine",
      brandVoice: "Refined, calm, and quietly luxurious",
      keywords: ["sleep wellness", "night routine", "mouth tape"],
    });

    expect(editedProfile.description).toBe(
      "Vitamin-infused mouth tape for deeper sleep."
    );
    expect(editedProfile.brandSummary).toBe(
      "A refined recovery brand for sleep-conscious adults."
    );
    expect(editedProfile.targetAudience).toBe(
      "Sleep-conscious adults building a night routine"
    );
    expect(editedProfile.brandVoice).toBe(
      "Refined, calm, and quietly luxurious"
    );
    expect(editedProfile.tone).toBe(
      "Refined, calm, and quietly luxurious"
    );
    expect(editedProfile.keywords).toEqual([
      "sleep wellness",
      "night routine",
      "mouth tape",
    ]);
    expect(editedProfile.businessDna?.keywords).toEqual([
      "sleep wellness",
      "night routine",
      "mouth tape",
    ]);
  });
});
