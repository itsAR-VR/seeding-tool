#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runCreatorValidationSweep } from "../lib/creators/validation-sweep";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const envContent = fs.readFileSync(filePath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([A-Z_a-z][A-Z_a-z0-9]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

function loadEnvironment() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(scriptDir, "../../.env.local"),
    path.resolve(scriptDir, "../.env.local"),
  ];

  for (const candidate of candidates) {
    loadEnvFile(candidate);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const readValue = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    brandId: readValue("--brand-id"),
    campaignId: readValue("--campaign-id"),
    limit: Number(readValue("--limit") ?? 100),
    includeAvgViews: args.includes("--include-avg-views"),
    noCleanup: args.includes("--no-cleanup"),
  };
}

async function main() {
  loadEnvironment();

  const options = parseArgs();
  const result = await runCreatorValidationSweep({
    brandId: options.brandId,
    campaignId: options.campaignId,
    limit: options.limit,
    includeAvgViews: options.includeAvgViews,
    cleanupInvalidLinks: !options.noCleanup,
  });

  console.log(
    JSON.stringify(
      {
        ...result,
        brandId: options.brandId ?? null,
        campaignId: options.campaignId ?? null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
