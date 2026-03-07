import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { processReply } from "@/lib/inngest/functions/process-reply";
import { scheduleReminders } from "@/lib/inngest/functions/reminders";
import { handleReminderSend } from "@/lib/inngest/functions/mention-check";
import { handleCreatorSearch } from "@/lib/inngest/functions/creator-search";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processReply, scheduleReminders, handleReminderSend, handleCreatorSearch],
});
