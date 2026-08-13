import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { processReply } from "@/lib/inngest/functions/process-reply";
import { processDmReply } from "@/lib/inngest/functions/process-dm-reply";
import { scheduleReminders } from "@/lib/inngest/functions/reminders";
import { handleReminderSend } from "@/lib/inngest/functions/mention-check";
import { handleCreatorSearch } from "@/lib/inngest/functions/creator-search";
import { instagramMentionPoll } from "@/lib/inngest/functions/instagram-mention-poll";
import { instagramTokenRefresh } from "@/lib/inngest/functions/instagram-token-refresh";
import {
  registerTrack17Tracking,
  pollTrack17Status,
} from "@/lib/inngest/functions/track17-sync";
import { runAutomations } from "@/lib/inngest/functions/run-automation";
import {
  mentionMediaArchive,
  mentionMediaArchiveCron,
} from "@/lib/inngest/functions/mention-media-archive";
import { creatorValidationCleanup } from "@/lib/inngest/functions/creator-validation-cleanup";
import { creatorAvgViewsEnrichment } from "@/lib/inngest/functions/creator-avg-views-enrichment";
import { collectDailySnapshots } from "@/lib/inngest/functions/collect-daily-snapshots";
import { computeAuthenticity } from "@/lib/inngest/functions/compute-authenticity";
import { createOrderFromAddress } from "@/lib/inngest/functions/create-order-from-address";
import { warmupCheck } from "@/lib/inngest/functions/warmup-check";
import { weeklyCalibration } from "@/lib/inngest/functions/weekly-calibration";
import { stalledDetection } from "@/lib/inngest/functions/stalled-detection";
import { confirmPosted } from "@/lib/inngest/functions/confirm-posted";
import { campaignHealthCheck } from "@/lib/inngest/functions/campaign-health-check";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processReply,
    processDmReply,
    scheduleReminders,
    handleReminderSend,
    handleCreatorSearch,
    instagramMentionPoll,
    instagramTokenRefresh,
    registerTrack17Tracking,
    pollTrack17Status,
    runAutomations,
    mentionMediaArchive,
    mentionMediaArchiveCron,
    creatorValidationCleanup,
    creatorAvgViewsEnrichment,
    collectDailySnapshots,
    computeAuthenticity,
    createOrderFromAddress,
    warmupCheck,
    weeklyCalibration,
    stalledDetection,
    confirmPosted,
    campaignHealthCheck,
  ],
});
