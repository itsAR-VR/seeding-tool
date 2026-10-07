import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { computeNextRunAt } from "@/lib/automations/schedule";
import { startAutomationSearch } from "@/lib/automations/start";

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
    try {
      const now = new Date();

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
      let failed = 0;

      for (const automation of dueAutomations) {
        try {
          if (automation.type === "creator_discovery") {
            const data = await startAutomationSearch(automation);
            const job = { id: data.jobId };
            try {
              await inngest.send({
                name: "creator-search/requested",
                data: { ...data, campaignId: "", query: data.query as Record<string, unknown> | undefined },
              });
            } catch (dispatchError) {
              const dispatchMessage =
                dispatchError instanceof Error ? dispatchError.message : "Unknown dispatch error";
              await prisma.creatorSearchJob.update({
                where: { id: job.id },
                data: { status: "failed", error: dispatchMessage, finishedAt: new Date() },
              });
              throw dispatchError;
            }

            log("info", "run-automations.triggered", {
              automationId: automation.id,
              jobId: job.id,
            });
          }

          await prisma.automation.update({
            where: { id: automation.id },
            data: {
              lastRunAt: now,
              nextRunAt: computeNextRunAt(automation.schedule),
            },
          });

          processed++;
        } catch (error) {
          failed++;
          console.error(
            `[run-automations] Error processing automation ${automation.id}:`,
            error
          );

          try {
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
          } catch (interventionError) {
            console.error(
              `[run-automations] Failed to create intervention for automation ${automation.id}:`,
              interventionError
            );
          }
        }
      }

      return {
        status: failed > 0 ? "completed_with_errors" : "completed",
        processed,
        failed,
      };
    } catch (error) {
      console.error("[run-automations] Fatal cron failure", error);
      return {
        status: "error",
        processed: 0,
        failed: 1,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);
