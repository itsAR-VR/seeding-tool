import { inngest } from "@/lib/inngest/client";
import {
  runCreatorSearchJob,
  type CreatorSearchRequestedEvent,
} from "@/lib/creator-search/job-runner";

export const handleCreatorSearch = inngest.createFunction(
  {
    id: "handle-creator-search",
    name: "Handle Creator Search Request",
    retries: 1,
    concurrency: [{ limit: 2 }],
  },
  { event: "creator-search/requested" },
  async ({ event }) => {
    return await runCreatorSearchJob(
      event.data as CreatorSearchRequestedEvent
    );
  }
);
