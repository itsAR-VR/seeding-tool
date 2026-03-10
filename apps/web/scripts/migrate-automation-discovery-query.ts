#!/usr/bin/env npx tsx

import type { Prisma } from "@prisma/client";
import { buildUnifiedDiscoveryQueryFromAutomationConfig } from "@/lib/creator-search/contracts";
import { prisma } from "@/lib/prisma";

type AutomationConfig = {
  [key: string]: unknown;
  query?: unknown;
};

function normalizeJson(value: unknown) {
  return JSON.stringify(value);
}

async function main() {
  const automations = await prisma.automation.findMany({
    where: {
      type: "creator_discovery",
    },
    select: {
      id: true,
      name: true,
      config: true,
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const automation of automations) {
    const config =
      automation.config && typeof automation.config === "object" && !Array.isArray(automation.config)
        ? ({ ...(automation.config as Record<string, unknown>) } as AutomationConfig)
        : {};

    const nextQuery = buildUnifiedDiscoveryQueryFromAutomationConfig(config);
    const currentQuery = config.query;

    if (currentQuery && normalizeJson(currentQuery) === normalizeJson(nextQuery)) {
      skipped += 1;
      continue;
    }

    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        config: {
          ...config,
          query: nextQuery,
        } as Prisma.InputJsonValue,
      },
    });

    updated += 1;
    console.log(`[automation-query] migrated ${automation.name} (${automation.id})`);
  }

  console.log(
    `[automation-query] complete: ${updated} updated, ${skipped} already current`
  );
}

main()
  .catch((error) => {
    console.error("[automation-query] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
