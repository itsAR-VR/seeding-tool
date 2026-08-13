/**
 * Suggested Discovery — shared types.
 *
 * The pipeline: start from a seed Instagram profile, walk the
 * "Suggested for you" profile carousel, screenshot each suggested
 * profile, classify niche fit (vision first, text fallback), and
 * keep matches in a tagged list. Enrichment (email/phone) is a
 * downstream seam, intentionally out of scope here.
 */

export type DiscoveryRunMode = "live" | "demo";

export type DiscoveryRunStatus =
  | "queued"
  | "running"
  | "classifying"
  | "needs_login"
  | "completed"
  | "failed";

export type CandidateStatus =
  | "discovered" // scraped, not yet classified
  | "classified" // classified, no match decision surfaced (kept for audit)
  | "match"
  | "rejected"
  | "error";

export interface SuggestedProfile {
  handle: string;
  displayName: string | null;
  bio: string | null;
  /** Instagram's own category label when the account exposes one. */
  category: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  externalUrl: string | null;
  isVerified: boolean;
  profileUrl: string;
  /** Seed handle whose suggestion rail surfaced this profile. */
  discoveredFrom: string;
  /** Screenshot filename inside the run directory, if captured. */
  screenshotFile: string | null;
}

export interface MatchVerdict {
  match: boolean;
  /** 0..1 */
  confidence: number;
  /** Canonical discovery categories. */
  tags: string[];
  reason: string;
  source: "vision" | "text" | "fixture";
}

export interface DiscoveryCandidate {
  profile: SuggestedProfile;
  verdict: MatchVerdict | null;
  status: CandidateStatus;
  error?: string;
}

export interface DiscoveryRunCounts {
  discovered: number;
  matched: number;
  rejected: number;
  errors: number;
}

export interface DiscoveryRun {
  id: string;
  seedHandle: string;
  niche: string;
  mode: DiscoveryRunMode;
  status: DiscoveryRunStatus;
  maxProfiles: number;
  brandId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  counts: DiscoveryRunCounts;
  candidates: DiscoveryCandidate[];
}

export const DEFAULT_MAX_PROFILES = 12;
export const HARD_MAX_PROFILES = 30;

export function emptyCounts(): DiscoveryRunCounts {
  return { discovered: 0, matched: 0, rejected: 0, errors: 0 };
}

export function recomputeCounts(run: DiscoveryRun): DiscoveryRunCounts {
  const counts = emptyCounts();
  for (const candidate of run.candidates) {
    counts.discovered += 1;
    if (candidate.status === "match") counts.matched += 1;
    else if (candidate.status === "rejected" || candidate.status === "classified")
      counts.rejected += 1;
    else if (candidate.status === "error") counts.errors += 1;
  }
  return counts;
}
