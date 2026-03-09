/**
 * Creator search pipeline.
 *
 * Discovery source today: the local Collabstr dataset, narrowed by brand ICP.
 * Verification path: the Fly worker when configured, with local OpenAI fallback.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveBrandICP, icpToSearchHints } from "@/lib/brands/icp";
import { CREDIT_COSTS, debit, getBalance } from "@/lib/credits";

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
  analysisSource: "worker" | "local";
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
    instagramUrl?: string | null;
  }>;
  analyzed?: number;
};

const WORKER_BASE_URL = process.env.CREATOR_SEARCH_WORKER_BASE_URL?.trim().replace(/\/$/, "");
const WORKER_TOKEN = process.env.CREATOR_SEARCH_WORKER_TOKEN?.trim();
const WORKER_MAX_ANALYSIS = 10;

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

function loadCollabstrDataset(): CollabstrRow[] {
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
    .slice(0, Math.max(limit * 3, limit));
}

async function scoreFitLocally(
  creator: CollabstrRow,
  brandSummary: string,
  openai: OpenAI
): Promise<{ fitScore: number; fitReasoning: string; approved: boolean }> {
  const snippet = (creator.profileDump ?? creator.bio ?? "").slice(0, 800);
  const prompt = `You are a brand partnership analyst. Score creator-brand fit.

Brand: ${brandSummary}
Creator handle: @${creator.instagram ?? creator.name ?? "unknown"}
Creator niche: ${creator.niche ?? "unknown"}
Creator bio/profile: ${snippet || "(no data)"}
Followers: ${creator.followerCount ?? "unknown"}

Rate fit 0.0-1.0. Approved if score >= 0.65.
Reply JSON only: {"score": 0.0, "reasoning": "1-2 sentence reason", "approved": false}`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 150,
      temperature: 0.2,
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as {
      score?: number;
      reasoning?: string;
      approved?: boolean;
    };

    const fitScore = typeof parsed.score === "number" ? parsed.score : 0;
    return {
      fitScore,
      fitReasoning: parsed.reasoning ?? "",
      approved: parsed.approved ?? fitScore >= 0.65,
    };
  } catch {
    return {
      fitScore: 0,
      fitReasoning: "scoring_error",
      approved: false,
    };
  }
}

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
      ...payload,
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
      analysisSource: "worker",
    };
  });

  return scoredResults.filter((creator): creator is ScoredCreator => creator !== null);
}

async function scoreLocally(
  candidates: CollabstrRow[],
  brandSummary: string,
  limit: number
): Promise<ScoredCreator[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const results: ScoredCreator[] = [];

  for (const candidate of candidates.slice(0, limit)) {
    const scored = await scoreFitLocally(candidate, brandSummary, openai);
    results.push({
      ...candidate,
      ...scored,
      analysisSource: "local",
    });
  }

  return results;
}

function toProfileMetadata(creator: ScoredCreator): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify({
      collabstrSlug: creator.collabstrSlug,
      collabstrUrl: creator.collabstrUrl,
      profileDumpPresent: Boolean(creator.profileDump),
      fitScore: creator.fitScore,
      fitReasoning: creator.fitReasoning,
      approved: creator.approved,
      analysisSource: creator.analysisSource,
      scrapedAt: creator.scrapedAt,
    })
  ) as Prisma.InputJsonValue;
}

async function persistCreators(
  brandId: string,
  campaignId: string,
  scoredCreators: ScoredCreator[]
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const creatorRow of scoredCreators) {
    try {
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
              followerCount: creatorRow.followerCount ?? existingCreator.followerCount,
              bio: creatorRow.bio ?? existingCreator.bio,
              bioCategory: creatorRow.niche ?? existingCreator.bioCategory,
              imageUrl: creatorRow.imageUrl ?? existingCreator.imageUrl,
              discoverySource: "creator_marketplace",
            },
          })
        : await prisma.creator.create({
            data: {
              name: creatorRow.name ?? creatorRow.collabstrSlug,
              instagramHandle: creatorRow.instagram,
              followerCount: creatorRow.followerCount,
              bio: creatorRow.bio,
              bioCategory: creatorRow.niche,
              imageUrl: creatorRow.imageUrl,
              discoverySource: "creator_marketplace",
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
            followerCount: creatorRow.followerCount,
            metadata: toProfileMetadata(creatorRow),
          },
          update: {
            handle: creatorRow.instagram,
            url:
              creatorRow.instagramUrl ??
              `https://instagram.com/${creatorRow.instagram}`,
            followerCount: creatorRow.followerCount,
            metadata: toProfileMetadata(creatorRow),
          },
        });
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

      await prisma.campaignCreator.create({
        data: {
          campaignId,
          creatorId: creator.id,
          reviewStatus: creatorRow.approved ? "approved" : "declined",
          lifecycleStatus: creatorRow.approved ? "ready" : "stalled",
          reviewedAt: new Date(),
          declineReason: creatorRow.approved ? null : creatorRow.fitReasoning,
        },
      });

      added += 1;
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
  results: ScoredCreator[]
): Promise<void> {
  for (const result of results) {
    await prisma.creatorSearchResult.create({
      data: {
        searchJobId: jobId,
        platform: "instagram",
        handle: result.instagram ?? result.collabstrSlug,
        name: result.name,
        followerCount: result.followerCount,
        profileUrl: result.instagramUrl ?? result.collabstrUrl,
        imageUrl: result.imageUrl,
        bio: result.bio,
        metadata: toProfileMetadata(result),
        fitScore: result.fitScore,
        fitReasoning: result.fitReasoning,
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

export async function searchCreatorsForCampaign(
  campaignId: string,
  brandId: string,
  criteria: SearchCriteria
): Promise<{
  status: "queued" | "complete";
  jobId: string;
  added?: number;
  analyzed?: number;
  creditsConsumed?: number;
  icpKeywords?: string[];
  usedWorker?: boolean;
}> {
  const jobId = randomUUID();
  const limit = Math.max(1, Math.min(criteria.limit ?? 20, 25));

  const icp = await deriveBrandICP(brandId, campaignId);
  const { keywords: icpKeywords } = icpToSearchHints(icp);
  const shortlist = shortlistCreators(
    loadCollabstrDataset(),
    criteria,
    icpKeywords,
    limit
  );

  await prisma.creatorSearchJob.create({
    data: {
      id: jobId,
      status: "running",
      platform: criteria.platform ?? "instagram",
      brandId,
      query: JSON.parse(
        JSON.stringify({
          ...criteria,
          derivedIcpKeywords: icpKeywords,
          shortlistCount: shortlist.length,
        })
      ) as Prisma.InputJsonValue,
    },
  });

  try {
    let results: ScoredCreator[] = [];
    let usedWorker = false;

    if (shortlist.length > 0) {
      try {
        const workerResults = await scoreWithWorker(shortlist, {
          campaignId,
          brandId,
          criteria,
          brandIdentity: icp.summary,
          icpCategories: icpKeywords,
        });

        if (workerResults && workerResults.length > 0) {
          results = workerResults.slice(0, limit);
          usedWorker = true;
        }
      } catch (error) {
        console.warn("[creator-search] Worker call failed, falling back to local scoring", error);
      }

      if (results.length === 0) {
        results = await scoreLocally(shortlist, icp.summary, limit);
      }
    }

    const { added, skipped } = await persistCreators(brandId, campaignId, results);
    await recordSearchJobResults(jobId, results);

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
      }
    );

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        resultCount: results.length,
      },
    });

    console.log(
      `[creator-search] complete campaign=${campaignId} analyzed=${results.length} added=${added} skipped=${skipped} worker=${usedWorker}`
    );

    return {
      status: "complete",
      jobId,
      added,
      analyzed: results.length,
      creditsConsumed,
      icpKeywords,
      usedWorker,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: message,
      },
    });

    throw error;
  }
}
