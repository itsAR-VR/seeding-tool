/**
 * Creator search pipeline.
 *
 * Discovery source: brand-scoped Collabstr creators from the database,
 * with JSONL fallback during the import cutover.
 * Verification path: Fly worker (real Playwright + OpenAI) with local OpenAI fallback.
 * Approval path: agent-driven via brand context + AI persona (recommend or auto mode).
 *
 * Approval modes (controlled by BrandSettings.metadata.approvalMode):
 *   "recommend" — AI decision is advisory; all creators land in "pending" queue
 *                 for human review (default — safer for live rollouts)
 *   "auto"      — AI decision is final; writes approved/declined directly (opt-in)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveBrandICP, icpToSearchHints, type BrandICP } from "@/lib/brands/icp";
import { buildUnifiedDiscoveryQueryFromCampaignSearch } from "@/lib/creator-search/contracts";
import { recordCreatorDiscoveryTouch } from "@/lib/creator-search/provenance";
import { CREDIT_COSTS, debit, getBalance } from "@/lib/credits";
import { sanitizeFollowerCount } from "@/lib/creators/follower-count";
import { validateInstagramCreators } from "@/lib/instagram/validator";

// ─── Types ──────────────────────────────────────────────────────────────────

type SearchCriteria = {
  platform?: string;
  keywords?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  category?: string;
  location?: string;
  limit?: number;
};

type CollabstrRow = {
  name: string | null;
  instagram: string | null;
  tiktok: string | null;
  profileDump: string | null;
  collabstrSlug: string;
  collabstrUrl: string;
  niche: string | null;
  location: string | null;
  bio: string | null;
  imageUrl: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  website: string | null;
  followerCount: number | null;
  price: string | null;
  rating: number | null;
  reviewCount: number | null;
  scrapedAt: string;
};

type ScoredCreator = CollabstrRow & {
  fitScore: number;
  fitReasoning: string;
  approved: boolean;
  confidence?: string;
  signals?: Record<string, number> | null;
  analysisSource: "worker" | "local";
};

type ValidatedScoredCreator = ScoredCreator & {
  validationStatus: "valid" | "invalid";
  validationError: string | null;
  validatedFollowerCount: number | null;
  validatedAvgViews: number | null;
};

/** Persona context forwarded to the Fly worker */
type PersonaContext = {
  name: string;
  tone: string;
  systemPrompt: string;
};

/** Single product forwarded to the Fly worker */
type ProductContext = {
  name: string;
  description?: string | null;
};

type WorkerResponse = {
  results?: Array<{
    handle?: string;
    collabstrSlug?: string;
    niche?: string;
    followerCount?: number | null;
    fitScore?: number;
    fitReasoning?: string;
    approved?: boolean;
    confidence?: string;
    signals?: Record<string, number> | null;
    instagramUrl?: string | null;
    error?: boolean;
  }>;
  analyzed?: number;
  approvalThreshold?: number;
  personaUsed?: boolean;
  productsProvided?: number;
  requestId?: string;
};

/** Approval mode from BrandSettings.metadata */
type ApprovalMode = "auto" | "recommend";

// ─── Config ──────────────────────────────────────────────────────────────────

const WORKER_BASE_URL = process.env.CREATOR_SEARCH_WORKER_BASE_URL?.trim().replace(/\/$/, "");
const WORKER_TOKEN = process.env.CREATOR_SEARCH_WORKER_TOKEN?.trim();
const WORKER_MAX_ANALYSIS = 75;

/**
 * Default approval threshold — creators at or above are approved.
 * Set to 0.75 for safer rollout (higher bar = fewer false-positives).
 * Override per-brand via BrandSettings.metadata.approvalThreshold.
 */
const DEFAULT_APPROVAL_THRESHOLD = 0.75;

// ─── Dataset helpers ─────────────────────────────────────────────────────────

function getCollabstrPath(): string {
  const webDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(webDir, "../../../scripts/collabstr-influencers.jsonl"),
    path.resolve(webDir, "../../../../scripts/collabstr-influencers.jsonl"),
    path.resolve(process.cwd(), "scripts/collabstr-influencers.jsonl"),
    path.resolve(process.cwd(), "../../scripts/collabstr-influencers.jsonl"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

function loadCollabstrDatasetFromFile(): CollabstrRow[] {
  const dataPath = getCollabstrPath();
  if (!fs.existsSync(dataPath)) {
    console.warn(`[creator-search] Collabstr dataset not found at ${dataPath}`);
    return [];
  }

  return fs
    .readFileSync(dataPath, "utf-8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as CollabstrRow];
      } catch {
        return [];
      }
    });
}

function readJsonString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readJsonNumber(
  record: Record<string, unknown>,
  key: string
): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function loadCollabstrDataset(brandId: string): Promise<CollabstrRow[]> {
  const creators = await prisma.creator.findMany({
    where: {
      brandId,
      discoverySource: "collabstr",
    },
    include: {
      discoveryTouches: {
        where: { source: "collabstr" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      profiles: true,
    },
  });

  const rows = creators.flatMap((creator) => {
    const touch = creator.discoveryTouches[0];
    const metadata =
      touch?.metadata && typeof touch.metadata === "object" && !Array.isArray(touch.metadata)
        ? (touch.metadata as Record<string, unknown>)
        : {};
    const instagramProfile = creator.profiles.find(
      (profile) => profile.platform === "instagram"
    );
    const tiktokProfile = creator.profiles.find(
      (profile) => profile.platform === "tiktok"
    );
    const collabstrSlug =
      touch?.externalId ||
      readJsonString(metadata, "collabstrSlug") ||
      creator.instagramHandle ||
      null;

    if (!collabstrSlug) {
      return [];
    }

    return [
      {
        name: creator.name,
        instagram: creator.instagramHandle,
        tiktok: tiktokProfile?.handle ?? readJsonString(metadata, "tiktok"),
        profileDump: readJsonString(metadata, "profileDump"),
        collabstrSlug,
        collabstrUrl:
          readJsonString(metadata, "collabstrUrl") ||
          `https://collabstr.com/${collabstrSlug}`,
        niche:
          touch?.rawSourceCategory ||
          creator.bioCategory ||
          readJsonString(metadata, "niche"),
        location: readJsonString(metadata, "location"),
        bio: creator.bio,
        imageUrl: creator.imageUrl,
        instagramHandle: creator.instagramHandle,
        tiktokHandle: tiktokProfile?.handle ?? readJsonString(metadata, "tiktok"),
        instagramUrl:
          instagramProfile?.url ??
          readJsonString(metadata, "instagramUrl") ??
          (creator.instagramHandle
            ? `https://instagram.com/${creator.instagramHandle}`
            : null),
        tiktokUrl:
          tiktokProfile?.url ??
          readJsonString(metadata, "tiktokUrl") ??
          null,
        website: readJsonString(metadata, "website"),
        followerCount: creator.followerCount,
        price: readJsonString(metadata, "price"),
        rating: readJsonNumber(metadata, "rating"),
        reviewCount: readJsonNumber(metadata, "reviewCount"),
        scrapedAt:
          readJsonString(metadata, "scrapedAt") ||
          touch?.createdAt?.toISOString() ||
          creator.updatedAt.toISOString(),
      },
    ];
  });

  if (rows.length > 0) {
    return rows;
  }

  return loadCollabstrDatasetFromFile();
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function matchesIcp(row: CollabstrRow, keywords: string[]): boolean {
  if (!keywords.length) return true;

  const haystack = [
    row.niche,
    row.bio,
    row.name,
    row.profileDump?.slice(0, 1000),
    row.instagram,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function matchesCriteria(row: CollabstrRow, criteria: SearchCriteria): boolean {
  if (
    criteria.minFollowers != null &&
    (row.followerCount ?? 0) < criteria.minFollowers
  ) {
    return false;
  }

  if (
    criteria.maxFollowers != null &&
    (row.followerCount ?? 0) > criteria.maxFollowers
  ) {
    return false;
  }

  if (criteria.category) {
    const category = normalizeText(criteria.category);
    const niche = normalizeText(row.niche);
    if (!niche.includes(category)) return false;
  }

  if (criteria.location) {
    const location = normalizeText(criteria.location);
    const rowLocation = normalizeText(row.location);
    if (!rowLocation.includes(location)) return false;
  }

  return true;
}

function shortlistCreators(
  rows: CollabstrRow[],
  criteria: SearchCriteria,
  icpKeywords: string[],
  limit: number
): CollabstrRow[] {
  const mergedKeywords = Array.from(
    new Set([...(criteria.keywords ?? []), ...icpKeywords].filter(Boolean))
  );

  return rows
    .filter((row) => matchesCriteria(row, criteria))
    .filter((row) => matchesIcp(row, mergedKeywords))
    .sort((a, b) => (b.followerCount ?? 0) - (a.followerCount ?? 0))
    .slice(0, limit);
}

// ─── Brand context helpers ────────────────────────────────────────────────────

/**
 * Fetch the brand's active AI persona (default=true, else most recent).
 * Returns null if none configured.
 */
async function fetchBrandPersona(brandId: string): Promise<PersonaContext | null> {
  const persona = await prisma.aiPersona.findFirst({
    where: { brandId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { name: true, tone: true, systemPrompt: true },
  });

  return persona ?? null;
}

/**
 * Read approvalMode from BrandSettings.metadata.
 * Default: "recommend" — the safer mode; human reviews before any creator advances.
 * Opt-in: "auto" — AI decision is final; only set explicitly in BrandSettings.
 *
 * "recommend": all AI-scored creators land in pending queue for human review.
 * "auto": AI decision is final (approve/decline written immediately).
 */
async function fetchApprovalMode(brandId: string): Promise<ApprovalMode> {
  const settings = await prisma.brandSettings.findUnique({
    where: { brandId },
    select: { metadata: true },
  });

  const meta = settings?.metadata as Record<string, unknown> | null;
  const mode = meta?.approvalMode;

  // "auto" is opt-in — only if explicitly set. Everything else defaults to "recommend".
  return mode === "auto" ? "auto" : "recommend";
}

/**
 * Read brand's configured approval threshold (0-1).
 * Falls back to DEFAULT_APPROVAL_THRESHOLD.
 */
async function fetchApprovalThreshold(brandId: string): Promise<number> {
  const settings = await prisma.brandSettings.findUnique({
    where: { brandId },
    select: { metadata: true },
  });

  const meta = settings?.metadata as Record<string, unknown> | null;
  const t = meta?.approvalThreshold;

  if (typeof t === "number" && t > 0 && t <= 1) return t;
  if (typeof t === "string") {
    const parsed = parseFloat(t);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1) return parsed;
  }

  return DEFAULT_APPROVAL_THRESHOLD;
}

// ─── Local scoring (fallback) ─────────────────────────────────────────────────

async function scoreFitLocally(
  creator: CollabstrRow,
  icp: BrandICP,
  persona: PersonaContext | null,
  approvalThreshold: number,
  openai: OpenAI
): Promise<{ fitScore: number; fitReasoning: string; approved: boolean; confidence: string; signals: Record<string, number> | null }> {
  const snippet = (creator.profileDump ?? creator.bio ?? "").slice(0, 800);

  // Build a persona-aware prompt locally too
  const systemBlock = persona?.systemPrompt
    ? `=== BRAND PERSONA INSTRUCTIONS ===\n${persona.systemPrompt.trim()}\n===`
    : `=== BRAND CONTEXT ===\n${icp.summary}\n===`;

  const toneHint = persona?.tone
    ? `Evaluate through the lens of a ${persona.tone} brand voice.`
    : "";

  const productLines =
    icp.products.length
      ? `Campaign products: ${icp.products
          .slice(0, 5)
          .map((p) => (p.description ? `${p.name} (${p.description})` : p.name))
          .join("; ")}`
      : "";

  const prompt = `${systemBlock}

You are an expert influencer partnership analyst.
${toneHint}

Brand: ${icp.brandName}
${productLines}

Creator:
- Handle: @${creator.instagram ?? creator.name ?? "unknown"}
- Niche: ${creator.niche ?? "unknown"}
- Followers: ${creator.followerCount ?? "unknown"}
- Bio/profile: ${snippet || "(no data)"}

Score fit 0.0-1.0. Approved if score >= ${approvalThreshold}.
Reply JSON ONLY: {"score": 0.0, "reasoning": "2-3 sentences", "approved": false, "confidence": "high|medium|low", "signals": {"nicheAlignment": 0.0, "audienceFit": 0.0, "brandVoiceMatch": 0.0, "contentQuality": 0.0}}`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 300,
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as {
      score?: number;
      reasoning?: string;
      approved?: boolean;
      confidence?: string;
      signals?: Record<string, number>;
    };

    const fitScore = typeof parsed.score === "number"
      ? Math.min(Math.max(parsed.score, 0), 1)
      : 0;

    return {
      fitScore,
      fitReasoning: parsed.reasoning ?? "",
      approved: typeof parsed.approved === "boolean"
        ? parsed.approved
        : fitScore >= approvalThreshold,
      confidence: parsed.confidence ?? "medium",
      signals: parsed.signals ?? null,
    };
  } catch {
    return {
      fitScore: 0,
      fitReasoning: "scoring_error",
      approved: false,
      confidence: "low",
      signals: null,
    };
  }
}

// ─── Worker integration ──────────────────────────────────────────────────────

function canUseWorker(): boolean {
  return Boolean(WORKER_BASE_URL && WORKER_TOKEN);
}

async function scoreWithWorker(
  candidates: CollabstrRow[],
  payload: {
    campaignId: string;
    brandId: string;
    criteria: SearchCriteria;
    brandIdentity: string;
    icpCategories: string[];
    persona: PersonaContext | null;
    products: ProductContext[];
    approvalThreshold: number;
  }
): Promise<ScoredCreator[] | null> {
  if (!canUseWorker() || candidates.length === 0) return null;

  const response = await fetch(`${WORKER_BASE_URL}/v1/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WORKER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      campaignId: payload.campaignId,
      brandId: payload.brandId,
      criteria: payload.criteria,
      brandIdentity: payload.brandIdentity,
      icpCategories: payload.icpCategories,
      persona: payload.persona,
      products: payload.products,
      approvalThreshold: payload.approvalThreshold,
      creators: candidates.slice(0, WORKER_MAX_ANALYSIS),
    }),
  });

  if (!response.ok) {
    throw new Error(`worker_http_${response.status}`);
  }

  const data = (await response.json()) as WorkerResponse;
  const results = data.results ?? [];

  const scoredResults: Array<ScoredCreator | null> = results.map((result) => {
    const matched = candidates.find(
      (candidate) =>
        candidate.collabstrSlug === result.collabstrSlug ||
        candidate.instagram === result.handle ||
        candidate.name === result.handle
    );

    if (!matched) return null;

    return {
      ...matched,
      followerCount: result.followerCount ?? matched.followerCount,
      instagramUrl: result.instagramUrl ?? matched.instagramUrl,
      fitScore: result.fitScore ?? 0,
      fitReasoning: result.fitReasoning ?? "",
      approved: Boolean(result.approved),
      confidence: result.confidence ?? "medium",
      signals: result.signals ?? null,
      analysisSource: "worker" as const,
    };
  });

  return scoredResults.filter((creator): creator is ScoredCreator => creator !== null);
}

async function scoreLocally(
  candidates: CollabstrRow[],
  icp: BrandICP,
  persona: PersonaContext | null,
  approvalThreshold: number,
  limit: number
): Promise<ScoredCreator[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const results: ScoredCreator[] = [];

  for (const candidate of candidates.slice(0, limit)) {
    const scored = await scoreFitLocally(candidate, icp, persona, approvalThreshold, openai);
    results.push({
      ...candidate,
      ...scored,
      analysisSource: "local",
    });
  }

  return results;
}

async function validateScoredCreators(
  scoredCreators: ScoredCreator[],
  criteria: SearchCriteria
): Promise<{
  validCreators: ValidatedScoredCreator[];
  invalidCreators: ValidatedScoredCreator[];
}> {
  const creatorsWithHandles = scoredCreators.filter((creator) => creator.instagram);
  const validationResults = await validateInstagramCreators(
    creatorsWithHandles.map((creator) => ({
      creatorId: creator.collabstrSlug,
      handle: creator.instagram ?? creator.collabstrSlug,
      minFollowers: criteria.minFollowers ?? null,
      maxFollowers: criteria.maxFollowers ?? null,
    })),
    {
      concurrency: 1,
      includeAvgViews: false,
    }
  );

  const validationByHandle = new Map(
    validationResults.map((result) => [result.handle.toLowerCase(), result])
  );

  const validatedCreators = scoredCreators.map<ValidatedScoredCreator>((creator) => {
    const handle = creator.instagram?.toLowerCase();
    const validation = handle ? validationByHandle.get(handle) : null;

    if (!validation) {
      return {
        ...creator,
        validationStatus: "invalid",
        validationError: "missing_profile",
        validatedFollowerCount: null,
        validatedAvgViews: null,
      };
    }

    return {
      ...creator,
      validationStatus: validation.status,
      validationError: validation.error,
      validatedFollowerCount: validation.followerCount,
      validatedAvgViews: validation.avgViews,
    };
  });

  return {
    validCreators: validatedCreators.filter(
      (creator) => creator.validationStatus === "valid"
    ),
    invalidCreators: validatedCreators.filter(
      (creator) => creator.validationStatus === "invalid"
    ),
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function toProfileMetadata(
  creator: ScoredCreator | ValidatedScoredCreator
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify({
      collabstrSlug: creator.collabstrSlug,
      collabstrUrl: creator.collabstrUrl,
      niche: creator.niche,
      profileDumpPresent: Boolean(creator.profileDump),
      fitScore: creator.fitScore,
      fitReasoning: creator.fitReasoning,
      approved: creator.approved,
      confidence: creator.confidence,
      signals: creator.signals,
      analysisSource: creator.analysisSource,
      scrapedAt: creator.scrapedAt,
      validationStatus:
        "validationStatus" in creator ? creator.validationStatus : undefined,
      validationError:
        "validationError" in creator ? creator.validationError : undefined,
      validatedFollowerCount:
        "validatedFollowerCount" in creator
          ? creator.validatedFollowerCount
          : undefined,
      validatedAvgViews:
        "validatedAvgViews" in creator ? creator.validatedAvgViews : undefined,
    })
  ) as Prisma.InputJsonValue;
}

/**
 * Store an AIArtifact record for creator approval decisions.
 * This provides an audit trail: what AI decided, why, and with what context.
 */
async function storeApprovalArtifact(
  creator: ScoredCreator,
  brandId: string,
  campaignId: string,
  approvalMode: ApprovalMode
): Promise<void> {
  try {
    await prisma.aIArtifact.create({
      data: {
        type: "fit_score",
        input: {
          handle: creator.instagram ?? creator.collabstrSlug,
          niche: creator.niche,
          followerCount: creator.followerCount,
          analysisSource: creator.analysisSource,
          brandId,
          campaignId,
          approvalMode,
        } as Prisma.InputJsonValue,
        output: {
          fitScore: creator.fitScore,
          fitReasoning: creator.fitReasoning,
          approved: creator.approved,
          confidence: creator.confidence ?? "medium",
          signals: creator.signals,
          agentDecision: approvalMode === "auto" ? (creator.approved ? "approve" : "decline") : "recommend",
        } as Prisma.InputJsonValue,
        model: creator.analysisSource === "worker" ? "gpt-5-mini@fly-worker" : "gpt-5-mini@local",
      },
    });
  } catch (err) {
    // Non-fatal — log and continue
    console.warn("[creator-search] Failed to store AIArtifact", err);
  }
}

/**
 * Persist creators into the database.
 *
 * Approval mode controls how CampaignCreator.reviewStatus is set:
 *   - "auto":      reviewStatus = approved | declined (immediate AI decision)
 *   - "recommend": reviewStatus = pending (always), InterventionCase created for human review
 */
async function persistCreators(
  brandId: string,
  campaignId: string,
  jobId: string,
  scoredCreators: ValidatedScoredCreator[],
  approvalMode: ApprovalMode,
  approvalThreshold: number,
  attachLimit: number
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  let attached = 0;

  for (const creatorRow of scoredCreators) {
    try {
      const normalizedFollowerCount = sanitizeFollowerCount(
        "creator_marketplace",
        creatorRow.validatedFollowerCount ?? creatorRow.followerCount
      );
      const existingCreator = await prisma.creator.findFirst({
        where: {
          brandId,
          OR: [
            creatorRow.instagram
              ? { instagramHandle: creatorRow.instagram }
              : undefined,
            creatorRow.name ? { name: creatorRow.name } : undefined,
          ].filter(Boolean) as Prisma.CreatorWhereInput[],
        },
      });

      const creator = existingCreator
        ? await prisma.creator.update({
            where: { id: existingCreator.id },
            data: {
              name: creatorRow.name ?? existingCreator.name,
              instagramHandle:
                creatorRow.instagram ?? existingCreator.instagramHandle,
              followerCount:
                normalizedFollowerCount === undefined
                  ? existingCreator.followerCount
                  : normalizedFollowerCount,
              avgViews:
                creatorRow.validatedAvgViews ?? existingCreator.avgViews,
              bio: creatorRow.bio ?? existingCreator.bio,
              bioCategory: creatorRow.niche ?? existingCreator.bioCategory,
              imageUrl: creatorRow.imageUrl ?? existingCreator.imageUrl,
              discoverySource: "creator_marketplace",
              validationStatus: creatorRow.validationStatus,
              lastValidatedAt: new Date(),
              lastValidationError: creatorRow.validationError,
            },
          })
        : await prisma.creator.create({
            data: {
              name: creatorRow.name ?? creatorRow.collabstrSlug,
              instagramHandle: creatorRow.instagram,
              followerCount: normalizedFollowerCount,
              bio: creatorRow.bio,
              bioCategory: creatorRow.niche,
              imageUrl: creatorRow.imageUrl,
              avgViews: creatorRow.validatedAvgViews,
              discoverySource: "creator_marketplace",
              validationStatus: creatorRow.validationStatus,
              lastValidatedAt: new Date(),
              lastValidationError: creatorRow.validationError,
              brandId,
            },
          });

      if (creatorRow.instagram) {
        await prisma.creatorProfile.upsert({
          where: {
            creatorId_platform: {
              creatorId: creator.id,
              platform: "instagram",
            },
          },
          create: {
            creatorId: creator.id,
            platform: "instagram",
            handle: creatorRow.instagram,
            url:
              creatorRow.instagramUrl ??
              `https://instagram.com/${creatorRow.instagram}`,
            followerCount: normalizedFollowerCount,
            metadata: toProfileMetadata(creatorRow),
          },
          update: {
            handle: creatorRow.instagram,
            url:
              creatorRow.instagramUrl ??
              `https://instagram.com/${creatorRow.instagram}`,
            followerCount: normalizedFollowerCount,
            metadata: toProfileMetadata(creatorRow),
          },
        });
      }

      await recordCreatorDiscoveryTouch({
        creatorId: creator.id,
        source: "collabstr",
        externalId: creatorRow.collabstrSlug,
        searchJobId: jobId,
        rawSourceCategory: creatorRow.niche,
        canonicalCategory: creatorRow.niche,
        metadata: toProfileMetadata(creatorRow),
      });

      if (attached >= attachLimit) {
        continue;
      }

      const existingCampaignCreator = await prisma.campaignCreator.findUnique({
        where: {
          campaignId_creatorId: {
            campaignId,
            creatorId: creator.id,
          },
        },
        select: { id: true },
      });

      if (existingCampaignCreator) {
        skipped += 1;
        continue;
      }

      // ── Approval mode branching ──────────────────────────────────────────
      let reviewStatus: string;
      let lifecycleStatus: string;
      let declineReason: string | null;

      if (approvalMode === "recommend") {
        // Recommendation mode: everything lands in pending queue, human decides
        reviewStatus = "pending";
        lifecycleStatus = "ready"; // ready for human review
        declineReason = null;
      } else {
        // Auto mode: AI decision is final
        reviewStatus = creatorRow.approved ? "approved" : "declined";
        lifecycleStatus = creatorRow.approved ? "ready" : "stalled";
        declineReason = creatorRow.approved ? null : creatorRow.fitReasoning;
      }

      const campaignCreator = await prisma.campaignCreator.create({
        data: {
          campaignId,
          creatorId: creator.id,
          reviewStatus,
          lifecycleStatus,
          reviewedAt: approvalMode === "auto" ? new Date() : null,
          declineReason,
        },
      });

      // Store audit artifact for every creator decision
      await storeApprovalArtifact(creatorRow, brandId, campaignId, approvalMode);

      // In recommend mode: create an InterventionCase ONLY for genuinely borderline
      // creators — those within ±BORDERLINE_WINDOW of the threshold. This keeps
      // the intervention queue focused on ambiguous cases where human judgment
      // adds the most value. Clear approvals (well above threshold) and clear
      // rejects (well below) do not need special flagging; they land in pending
      // queue for routine review without an explicit intervention.
      if (approvalMode === "recommend") {
        const BORDERLINE_WINDOW = 0.15;
        const isBorderline =
          Math.abs(creatorRow.fitScore - approvalThreshold) <= BORDERLINE_WINDOW;
        if (isBorderline) {
          await prisma.interventionCase.create({
            data: {
              type: "manual_review",
              status: "open",
              priority: creatorRow.fitScore >= approvalThreshold ? "normal" : "low",
              title: `Creator review: @${creatorRow.instagram ?? creatorRow.name ?? creatorRow.collabstrSlug}`,
              description: [
                `AI fit score: ${(creatorRow.fitScore * 100).toFixed(0)}% (${creatorRow.confidence ?? "medium"} confidence).`,
                `Borderline: within ${(BORDERLINE_WINDOW * 100).toFixed(0)}% of ${(approvalThreshold * 100).toFixed(0)}% threshold.`,
                `Reasoning: ${creatorRow.fitReasoning}`,
                `Source: ${creatorRow.analysisSource}.`,
                `Campaign: ${campaignId}`,
              ].join(" "),
              brandId,
              campaignCreatorId: campaignCreator.id,
            },
          });
        }
      }

      added += 1;
      attached += 1;
    } catch (error) {
      console.error(
        `[creator-search] Failed to persist ${creatorRow.instagram ?? creatorRow.collabstrSlug}`,
        error
      );
      skipped += 1;
    }
  }

  return { added, skipped };
}

async function recordSearchJobResults(
  jobId: string,
  results: ValidatedScoredCreator[]
): Promise<void> {
  for (const result of results) {
    await prisma.creatorSearchResult.create({
      data: {
        searchJobId: jobId,
        platform: "instagram",
        handle: result.instagram ?? result.collabstrSlug,
        source: "collabstr",
        primarySource: "collabstr",
        sources: ["collabstr"] as Prisma.InputJsonValue,
        name: result.name,
        followerCount: sanitizeFollowerCount(
          "creator_marketplace",
          result.followerCount
        ),
        profileUrl: result.instagramUrl ?? result.collabstrUrl,
        imageUrl: result.imageUrl,
        bio: result.bio,
        email: null,
        bioCategory: result.niche,
        rawSourceCategory: result.niche,
        seedCreatorId: null,
        metadata: toProfileMetadata(result),
        fitScore: result.fitScore,
        fitReasoning: result.fitReasoning,
        validationStatus: result.validationStatus,
        validationError: result.validationError,
        validatedFollowerCount: result.validatedFollowerCount,
        validatedAvgViews: result.validatedAvgViews,
      },
    });
  }
}

async function debitSearchCredits(
  brandId: string,
  analyzedCount: number,
  usedWorker: boolean,
  metadata: Record<string, unknown>
): Promise<number> {
  const cost =
    CREDIT_COSTS.collabstr_search +
    analyzedCount * CREDIT_COSTS.ai_fit_score +
    (usedWorker ? CREDIT_COSTS.creator_search : 0);

  const balance = await getBalance(brandId);
  if (balance < cost) {
    console.warn(
      `[creator-search] Low credits: need ${cost}, have ${balance}. Continuing for verification.`
    );
    return 0;
  }

  try {
    await debit(brandId, cost, "creator_search", metadata);
    return cost;
  } catch (error) {
    console.warn("[creator-search] Credit debit failed", error);
    return 0;
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function runCampaignCreatorSearchJob(
  campaignId: string,
  brandId: string,
  criteria: SearchCriteria,
  options?: { jobId?: string }
): Promise<{
  status: "completed" | "completed_with_shortfall";
  jobId: string;
  added?: number;
  analyzed?: number;
  invalid?: number;
  creditsConsumed?: number;
  icpKeywords?: string[];
  usedWorker?: boolean;
  approvalMode?: ApprovalMode;
  personaUsed?: boolean;
}> {
  const jobId = options?.jobId ?? randomUUID();
  const limit = Math.max(1, Math.min(criteria.limit ?? 20, 25));
  const rawCandidateLimit = Math.max(limit, limit * 3);

  // Load brand context in parallel
  const [icp, persona, approvalMode, approvalThreshold] = await Promise.all([
    deriveBrandICP(brandId, campaignId),
    fetchBrandPersona(brandId),
    fetchApprovalMode(brandId),
    fetchApprovalThreshold(brandId),
  ]);

  const { keywords: icpKeywords } = icpToSearchHints(icp);
  const unifiedQuery = buildUnifiedDiscoveryQueryFromCampaignSearch({
    ...criteria,
    limit,
  });
  const shortlist = shortlistCreators(
    await loadCollabstrDataset(brandId),
    criteria,
    icpKeywords,
    rawCandidateLimit
  );

  // Products for forwarding to worker
  const products: ProductContext[] = icp.products.map((p) => ({
    name: p.name,
    description: p.description ?? null,
  }));

  await prisma.creatorSearchJob.upsert({
    where: { id: jobId },
    create: {
      id: jobId,
      status: "running",
      platform: criteria.platform ?? "instagram",
      brandId,
      campaignId,
      requestedCount: limit,
      candidateCount: shortlist.length,
      progressPercent: shortlist.length > 0 ? 25 : 100,
      startedAt: new Date(),
      query: JSON.parse(
        JSON.stringify({
          ...unifiedQuery,
          derivedIcpKeywords: icpKeywords,
          shortlistCount: shortlist.length,
          approvalMode,
          personaUsed: Boolean(persona),
          approvalThreshold,
        })
      ) as Prisma.InputJsonValue,
    },
    update: {
      status: "running",
      campaignId,
      requestedCount: limit,
      candidateCount: shortlist.length,
      progressPercent: shortlist.length > 0 ? 25 : 100,
      startedAt: new Date(),
      finishedAt: null,
      error: null,
      query: JSON.parse(
        JSON.stringify({
          ...unifiedQuery,
          derivedIcpKeywords: icpKeywords,
          shortlistCount: shortlist.length,
          approvalMode,
          personaUsed: Boolean(persona),
          approvalThreshold,
        })
      ) as Prisma.InputJsonValue,
    },
  });

  try {
    let results: ScoredCreator[] = [];
    let usedWorker = false;

    if (shortlist.length > 0) {
      // ── Try Fly worker first ───────────────────────────────────────────
      if (canUseWorker()) {
        try {
          const workerResults = await scoreWithWorker(shortlist, {
            campaignId,
            brandId,
            criteria,
            brandIdentity: icp.summary,
            icpCategories: icpKeywords,
            persona,
            products,
            approvalThreshold,
          });

          if (workerResults && workerResults.length > 0) {
            results = workerResults.slice(0, rawCandidateLimit);
            usedWorker = true;
            console.log(
              `[creator-search] Worker scored ${results.length} creators (personaUsed=${Boolean(persona)}, threshold=${approvalThreshold})`
            );
          }
        } catch (error) {
          console.warn(
            "[creator-search] Worker call failed, falling back to local scoring",
            error
          );
        }
      }

      // ── Local fallback ─────────────────────────────────────────────────
      if (results.length === 0) {
        results = await scoreLocally(
          shortlist,
          icp,
          persona,
          approvalThreshold,
          rawCandidateLimit
        );
        console.log(
          `[creator-search] Local scored ${results.length} creators (personaUsed=${Boolean(persona)}, threshold=${approvalThreshold})`
        );
      }
    }

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        progressPercent: shortlist.length > 0 ? 60 : 100,
        etaSeconds:
          shortlist.length > 0 ? shortlist.length * 12 : 0,
      },
    });

    const { validCreators, invalidCreators } = await validateScoredCreators(
      results,
      criteria
    );

    const limitedValidCreators = validCreators.slice(0, limit);
    const allJobResults = [...validCreators, ...invalidCreators];

    const { added, skipped } = await persistCreators(
      brandId,
      campaignId,
      jobId,
      validCreators,
      approvalMode,
      approvalThreshold,
      limit
    );
    await recordSearchJobResults(jobId, allJobResults);

    const creditsConsumed = await debitSearchCredits(
      brandId,
      results.length,
      usedWorker,
      {
        campaignId,
        analyzed: results.length,
        added,
        skipped,
        usedWorker,
        approvalMode,
      }
    );

    const finalStatus =
      limitedValidCreators.length >= limit
        ? "completed"
        : "completed_with_shortfall";

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        resultCount: validCreators.length,
        candidateCount: shortlist.length,
        validatedCount: validCreators.length,
        invalidCount: invalidCreators.length,
        progressPercent: 100,
        etaSeconds: 0,
        finishedAt: new Date(),
      },
    });

    console.log(
      `[creator-search] complete campaign=${campaignId} analyzed=${results.length} valid=${limitedValidCreators.length} invalid=${invalidCreators.length} added=${added} skipped=${skipped} worker=${usedWorker} mode=${approvalMode} persona=${Boolean(persona)}`
    );

    return {
      status: finalStatus,
      jobId,
      added,
      analyzed: results.length,
      invalid: invalidCreators.length,
      creditsConsumed,
      icpKeywords,
      usedWorker,
      approvalMode,
      personaUsed: Boolean(persona),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: message,
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}
