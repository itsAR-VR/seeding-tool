import path from "node:path";
import { spawn } from "node:child_process";

export type LocalCreatorSearchFallbackInput = {
  jobId: string;
  brandId: string;
  campaignId?: string | null;
};

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
