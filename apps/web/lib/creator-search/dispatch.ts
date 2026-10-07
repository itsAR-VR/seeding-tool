import { after } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { runCreatorSearchJob, type CreatorSearchRequestedEvent } from "@/lib/creator-search/job-runner";

/**
 * Start a creator search. With Inngest configured it's queued there;
 * otherwise (our setup, no paid scheduler) it runs right after the response,
 * inside the same request, which the calling route keeps alive via maxDuration.
 */
export async function dispatchCreatorSearch(data: CreatorSearchRequestedEvent): Promise<void> {
  if (process.env.INNGEST_EVENT_KEY) {
    await inngest.send({ name: "creator-search/requested", data: {
        ...data,
        campaignId: data.campaignId ?? undefined,
        query: data.query as Record<string, unknown> | undefined,
      },
    });
    return;
  }
  after(async () => {
    try {
      await runCreatorSearchJob(data);
    } catch (error) {
      console.error("[creator-search] inline run failed", { jobId: data.jobId, error });
    }
  });
}
