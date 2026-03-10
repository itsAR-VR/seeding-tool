import type {
  CanonicalDiscoveryCategory,
  UnifiedDiscoverySource,
} from "@/lib/creator-search/contracts";
import type { DiscoveryClassification } from "@/lib/creator-search/classification";

export type UnifiedDiscoveryCandidate = {
  creatorId: string | null;
  handle: string;
  name: string | null;
  bio: string | null;
  profileDump: string | null;
  rawSourceCategory: string | null;
  canonicalCategory: CanonicalDiscoveryCategory | null;
  classificationConfidence: DiscoveryClassification["confidence"] | null;
  matchedCategorySignals: string[];
  followerCount: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  profileUrl: string | null;
  imageUrl: string | null;
  isVerified: boolean;
  email: string | null;
  seedCreatorId: string | null;
  isCached: boolean;
  existingValidationStatus: string | null;
  lastValidatedAt: string | null;
  primarySource: UnifiedDiscoverySource;
  sources: UnifiedDiscoverySource[];
  sourceMetadata: Record<string, unknown>;
  relevanceScore: number;
};
