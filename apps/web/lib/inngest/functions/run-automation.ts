import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { computeNextRunAt } from "@/lib/automations/schedule";

function toHashtag(value: string | undefined) {
  if (!value) return undefined;

  const normalized = value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");

  return normalized || undefined;
}

/**
 * Inngest cron function: checks for due automations every 5 minutes
 * and dispatches the appropriate actions.
 *
 * For `creator_discovery` type: triggers an Apify search with stored config.
 * Updates lastRunAt and nextRunAt after each execution.
 */
export const runAutomations = inngest.createFunction(
  {
    id: "run-automations",
    name: "Run Due Automations",
    retries: 1,
    concurrency: [{ limit: 1 }],
  },
  { cron: "*/5 * * * *" }, // every 5 minutes
  async () => {
    const now = new Date();

    // Find all enabled automations that are due to run
    const dueAutomations = await prisma.automation.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
    });

    if (dueAutomations.length === 0) {
      return { status: "idle", processed: 0 };
    }

    let processed = 0;

    for (const automation of dueAutomations) {
      try {
        if (automation.type === "creator_discovery") {
          const config = automation.config as {
            searchMode?: "hashtag" | "profile";
            hashtag?: string;
            usernames?: string[];
            limit?: number;
            platform?: string;
            autoImport?: boolean;
            query?: Record<string, unknown>;
            categories?: {
              apify?: string[];
              collabstr?: string[];
            };
          };
          const derivedHashtag =
            config.hashtag ||
            toHashtag(config.categories?.apify?.[0]) ||
            toHashtag(config.categories?.collabstr?.[0]);

          // Create a search job
          const job = await prisma.creatorSearchJob.create({
            data: {
              status: "pending",
              platform: config.platform || "instagram",
              requestedCount: config.limit || 50,
              progressPercent: 0,
              query:
                config.query && typeof config.query === "object"
                  ? {
                      ...(config.query as Record<string, unknown>),
                      automationId: automation.id,
                    }
                  : {
                      searchMode: config.searchMode || "hashtag",
                      hashtag: derivedHashtag,
                      usernames: config.usernames,
                      limit: config.limit || 50,
                      categories: config.categories,
                      automationId: automation.id,
                    },
              brandId: automation.brandId,
            },
          });

          // Fire Inngest event to run the Apify search
          await inngest.send({
            name: "creator-search/requested",
            data: {
              jobId: job.id,
              campaignId: "",
              brandId: automation.brandId,
              discoverySource: "apify",
              criteria: {
                platform: config.platform || "instagram",
                searchMode: config.searchMode || "hashtag",
                hashtag: derivedHashtag,
                usernames: config.usernames,
                limit: config.limit || 50,
                categories: config.categories,
              },
            },
          });

          console.log(
            `[run-automations] Triggered creator_discovery for automation ${automation.id} (job ${job.id})`
          );
        }

        // Update lastRunAt and compute next run
        await prisma.automation.update({
          where: { id: automation.id },
          data: {
            lastRunAt: now,
            nextRunAt: computeNextRunAt(automation.schedule),
          },
        });

        processed++;
      } catch (error) {
        console.error(
          `[run-automations] Error processing automation ${automation.id}:`,
          error
        );

        // Create intervention for failed automation
        await prisma.interventionCase.create({
          data: {
            type: "other",
            status: "open",
            priority: "normal",
            title: `Automation "${automation.name}" failed`,
            description: `Automation ${automation.id} (${automation.type}) failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            brandId: automation.brandId,
          },
        });
      }
    }

    return { status: "completed", processed };
  }
);
