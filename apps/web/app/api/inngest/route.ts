import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { processReply } from "@/lib/inngest/functions/process-reply";
import { scheduleReminders } from "@/lib/inngest/functions/reminders";
import { handleReminderSend } from "@/lib/inngest/functions/mention-check";
import { handleCreatorSearch } from "@/lib/inngest/functions/creator-search";
import { instagramMentionPoll } from "@/lib/inngest/functions/instagram-mention-poll";
import {
  registerTrack17Tracking,
  pollTrack17Status,
} from "@/lib/inngest/functions/track17-sync";
import { apifyCreatorSearch } from "@/lib/inngest/functions/apify-creator-search";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processReply,
    scheduleReminders,
    handleReminderSend,
    handleCreatorSearch,
    instagramMentionPoll,
    registerTrack17Tracking,
    pollTrack17Status,
    apifyCreatorSearch,
  ],
});
