import type { UnifiedDiscoveryPlatform } from "@/lib/creator-search/contracts";

/**
 * A handle to validate on a specific platform.
 */
export interface ValidationTarget {
  handle: string;
  creatorId?: string;
  existingProfile?: {
    followerCount?: number | null;
    engagementRate?: number | null;
  };
}

/**
 * Validation outcome for a single handle.
 * Platform-agnostic — each validator maps its native response into this shape.
 */
export interface ValidationResult {
  handle: string;
  creatorId: string | null;
  url: string | null;
  status: "valid" | "invalid" | "unknown" | "retry";
  followerCount: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  isVerified: boolean;
  errorCode: string | null;
  error: string | null;
  attemptCount: number;
  metadata: Record<string, unknown>;
}

/**
 * Per-platform validation options.
 * Each platform validator can extend this with platform-specific fields.
 */
export interface PlatformValidationOptions {
  concurrency?: number;
  timeout?: number;
  includeAvgViews?: boolean;
}

/**
 * Interface every platform validator must implement.
 * Uses a BATCH interface because Instagram and TikTok have fundamentally
 * different concurrency/delay/error models.
 */
export interface PlatformValidator {
  readonly platform: UnifiedDiscoveryPlatform;

  validateBatch(
    targets: readonly ValidationTarget[],
    options?: PlatformValidationOptions
  ): Promise<readonly ValidationResult[]>;
}
