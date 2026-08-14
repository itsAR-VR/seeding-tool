import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { runCreatorValidationSweep } from "@/lib/creators/validation-sweep";

export const creatorValidationCleanup = inngest.createFunction(
  {
    id: "creator-validation-cleanup",
    name: "Creator Validation Cleanup",
    retries: 1,
  },
  { cron: "0 3 * * *" },
  async () => {
    // Query brands with creators on ANY platform (not just Instagram)
    const brands = await prisma.creator.findMany({
      where: {
        OR: [
          { instagramHandle: { not: null } },
          { tiktokHandle: { not: null } },
        ],
      },
      distinct: ["brandId"],
      select: { brandId: true },
    });

    const summary = [];

    for (const brand of brands) {
      let scanned = 0;
      let valid = 0;
      let invalid = 0;
      let removedCampaignLinks = 0;
      let retainedCampaignLinks = 0;

      // Bound the loop: invalid creators stay invalid after revalidation,
      // so a brand with >=100 permanently invalid creators would otherwise
      // rescan the same batch forever within one run. Remaining stale
      // creators are picked up on the next scheduled run.
      const MAX_BATCHES_PER_RUN = 10;
      let batches = 0;

      while (batches < MAX_BATCHES_PER_RUN) {
        batches += 1;
        const batch = await runCreatorValidationSweep({
          brandId: brand.brandId,
          limit: 100,
          cleanupInvalidLinks: true,
          includeAvgViews: false,
        });

        scanned += batch.scanned;
        valid += batch.valid;
        invalid += batch.invalid;
        removedCampaignLinks += batch.removedCampaignLinks;
        retainedCampaignLinks += batch.retainedCampaignLinks;

        if (batch.scanned < 100) {
          break;
        }
      }

      summary.push({
        brandId: brand.brandId,
        scanned,
        valid,
        invalid,
        removedCampaignLinks,
        retainedCampaignLinks,
      });
    }

    return {
      brandsProcessed: summary.length,
      summary,
    };
  }
);
