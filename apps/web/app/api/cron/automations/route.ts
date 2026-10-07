import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { computeNextRunAt } from "@/lib/automations/schedule";
import { startAutomationSearch } from "@/lib/automations/start";
import { runCreatorSearchJob } from "@/lib/creator-search/job-runner";

/** One scheduled search runs inside this request; Apify can take minutes. */
export const maxDuration = 800;

/**
 * POST /api/cron/automations — called every 10 minutes by the Supabase
 * scheduler (pg_cron). Starts the oldest due "find creators on a schedule"
 * automation. One per call keeps each run inside the time limit; the rest
 * are picked up by the next calls.
 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.automation.findFirst({
    where: { enabled: true, type: "creator_discovery", nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
  });
  if (!due) return NextResponse.json({ status: "idle" });

  // Claim it so an overlapping call can't run the same automation twice.
  const claimed = await prisma.automation.updateMany({
    where: { id: due.id, nextRunAt: due.nextRunAt },
    data: { lastRunAt: now, nextRunAt: computeNextRunAt(due.schedule) },
  });
  if (claimed.count === 0) return NextResponse.json({ status: "already_claimed" });

  try {
    const data = await startAutomationSearch(due);
    after(async () => {
      try {
        await runCreatorSearchJob(data);
      } catch (error) {
        console.error("[cron/automations] search failed", { automationId: due.id, error });
      }
    });
    return NextResponse.json({ status: "started", automationId: due.id, jobId: data.jobId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.interventionCase
      .create({
        data: {
          type: "other",
          status: "open",
          priority: "normal",
          title: `Scheduled search "${due.name}" didn't start`,
          description: message,
          brandId: due.brandId,
        },
      })
      .catch(() => undefined);
    return NextResponse.json({ status: "failed", error: message }, { status: 500 });
  }
}
