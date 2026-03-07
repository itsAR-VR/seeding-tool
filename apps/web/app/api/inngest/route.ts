import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { processReply } from "@/lib/inngest/functions/process-reply";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processReply],
});
