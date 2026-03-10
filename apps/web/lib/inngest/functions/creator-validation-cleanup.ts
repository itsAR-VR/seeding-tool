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
    const brands = await prisma.creator.findMany({
      where: {
        instagramHandle: { not: null },
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

      while (true) {
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
