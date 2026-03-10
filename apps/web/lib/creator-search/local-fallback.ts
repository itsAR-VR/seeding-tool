import path from "node:path";
import { spawn } from "node:child_process";
import { prisma } from "@/lib/prisma";

export type LocalCreatorSearchFallbackInput = {
  jobId: string;
  brandId: string;
  campaignId?: string | null;
};

export const LOCAL_FALLBACK_RETRY_MS = 15_000;

export function isLocalCreatorSearchFallbackEnabled() {
  return (
    process.env.CREATOR_SEARCH_DISABLE_INLINE_FALLBACK !== "1" &&
    process.env.VERCEL !== "1"
  );
}

export function spawnLocalCreatorSearchJob(
  input: LocalCreatorSearchFallbackInput
) {
  if (!isLocalCreatorSearchFallbackEnabled()) {
    return false;
  }

  const scriptPath = path.join(process.cwd(), "scripts/run-creator-search-job.ts");
  const args = ["tsx", scriptPath, "--job-id", input.jobId, "--brand-id", input.brandId];

  if (input.campaignId) {
    args.push("--campaign-id", input.campaignId);
  }

  const child = spawn("npx", args, {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  return true;
}

export function shouldAttemptLocalCreatorSearchFallback(
  startedAt: Date | null,
  retryMs = LOCAL_FALLBACK_RETRY_MS
) {
  return (
    startedAt == null ||
    startedAt.getTime() < Date.now() - retryMs
  );
}

export async function scheduleLocalCreatorSearchJob(
  input: LocalCreatorSearchFallbackInput,
  retryMs = LOCAL_FALLBACK_RETRY_MS
) {
  if (!isLocalCreatorSearchFallbackEnabled()) {
    return false;
  }

  const reservedAt = new Date();
  const staleBefore = new Date(reservedAt.getTime() - retryMs);
  const reservation = await prisma.creatorSearchJob.updateMany({
    where: {
      id: input.jobId,
      brandId: input.brandId,
      status: "pending",
      OR: [{ startedAt: null }, { startedAt: { lt: staleBefore } }],
    },
    data: {
      startedAt: reservedAt,
    },
  });

  if (reservation.count === 0) {
    return false;
  }

  try {
    return spawnLocalCreatorSearchJob(input);
  } catch (error) {
    await prisma.creatorSearchJob.updateMany({
      where: {
        id: input.jobId,
        brandId: input.brandId,
        status: "pending",
        startedAt: reservedAt,
      },
      data: {
        startedAt: null,
      },
    });

    throw error;
  }
}
