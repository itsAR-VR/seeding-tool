/**
 * Inngest cron: Email Warmup Graduation
 *
 * Runs daily at 03:00 UTC. Finds all aliases still in warmup (isWarmedUp=false)
 * that have completed the 14-day warmup period, and graduates them to full volume.
 *
 * Note: Auto-pause on bounce rate is DEFERRED — SendingMetric.bounced and
 * SendingMetric.complained are never written by any code path. Will be
 * implemented when bounce webhook ingestion is added (future phase).
 */

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { isWarmupComplete } from "@/lib/outreach/warmup";

export const warmupCheck = inngest.createFunction(
  {
    id: "warmup-check",
    name: "Email Warmup Graduation",
    concurrency: [{ limit: 1 }],
  },
  { cron: "0 3 * * *" },
  async () => {
    const coldAliases = await prisma.emailAlias.findMany({
      where: {
        isWarmedUp: false,
        warmupStartedAt: { not: null },
      },
      select: {
        id: true,
        address: true,
        warmupStartedAt: true,
      },
    });

    const graduated: string[] = [];

    for (const alias of coldAliases) {
      if (isWarmupComplete(alias)) {
        await prisma.emailAlias.update({
          where: { id: alias.id },
          data: { isWarmedUp: true },
        });
        graduated.push(alias.address);
      }
    }

    return {
      checked: coldAliases.length,
      graduated: graduated.length,
      graduatedAddresses: graduated,
    };
  }
);
