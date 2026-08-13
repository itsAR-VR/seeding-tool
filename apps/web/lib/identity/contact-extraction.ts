import type { ContactPoint, InfluencerPlatformProfile } from "@prisma/client";
import { getSourceConfidence } from "@/lib/creator-search/source-confidence";

type RawContact = {
  type: string;
  value: string;
  source: string;
};

function isTruthyString(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

export function isAgencyEmail(email: string) {
  const normalized = email.toLowerCase();
  return ["agency", "mgmt", "management", "talent", "pr"].some((token) =>
    normalized.includes(token)
  );
}

export function scoreContactConfidence(contact: RawContact, source: string) {
  const base = getSourceConfidence(source).weight;
  if (contact.type === "agency_email") {
    return Math.min(1, base + 0.1);
  }
  if (contact.type === "website_contact") {
    return Math.min(1, base + 0.05);
  }
  return base;
}

export function extractContactPoints(input: {
  profile: Pick<InfluencerPlatformProfile, "email" | "websiteUrl" | "platform">;
  sources: string[];
}): Array<Pick<ContactPoint, "contactType" | "contactValue" | "confidence" | "source" | "isStale">> {
  const points: Array<
    Pick<ContactPoint, "contactType" | "contactValue" | "confidence" | "source" | "isStale">
  > = [];
  const primarySource = input.sources[0] ?? "manual";

  if (isTruthyString(input.profile.email)) {
    const type = isAgencyEmail(input.profile.email) ? "agency_email" : "email";
    points.push({
      contactType: type,
      contactValue: input.profile.email,
      confidence: scoreContactConfidence(
        { type, value: input.profile.email, source: primarySource },
        primarySource
      ),
      source: primarySource,
      isStale: false,
    });
  }

  if (isTruthyString(input.profile.websiteUrl)) {
    points.push({
      contactType: "website_contact",
      contactValue: input.profile.websiteUrl,
      confidence: scoreContactConfidence(
        {
          type: "website_contact",
          value: input.profile.websiteUrl,
          source: primarySource,
        },
        primarySource
      ),
      source: primarySource,
      isStale: false,
    });
  }

  if (input.profile.platform === "instagram") {
    points.push({
      contactType: "dm",
      contactValue: "instagram_dm",
      confidence: 0.35,
      source: "instagram_validated",
      isStale: false,
    });
  }

  return points;
}
