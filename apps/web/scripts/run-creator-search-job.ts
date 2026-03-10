#!/usr/bin/env npx tsx

import { runCreatorSearchJob } from "../lib/creator-search/job-runner";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const jobId = readFlag("--job-id");
  const brandId = readFlag("--brand-id");
  const campaignId = readFlag("--campaign-id");

  if (!jobId || !brandId) {
    throw new Error("--job-id and --brand-id are required");
  }

  const result = await runCreatorSearchJob({
    jobId,
    brandId,
    campaignId,
  });

  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
