import { prisma } from "@/lib/prisma";
import { sendOutreachBatch, type DraftToSend } from "@/lib/outreach/send-pipeline";

/** Gap between queued emails: 3 minutes each, so a batch goes out at a steady, hand-sent pace. */
export const MIN_GAP_MS = 180_000;
export const MAX_GAP_MS = 180_000;

export function spacedSendTimes(count: number, start: Date, random: () => number = Math.random): Date[] {
  const times: Date[] = [];
  let t = start.getTime();
  for (let i = 0; i < count; i++) {
    times.push(new Date(t));
    t += MIN_GAP_MS + Math.round(random() * (MAX_GAP_MS - MIN_GAP_MS));
  }
  return times;
}

/**
 * Queue drafts for one campaign. Creators already waiting in the queue are
 * skipped so nobody gets the same email twice. Returns what was queued.
 */
export async function queueOutreach(params: {
  brandId: string;
  campaignId: string;
  userId: string | null;
  drafts: DraftToSend[];
}) {
  const alreadyQueued = await prisma.outreachQueueItem.findMany({
    where: {
      campaignCreatorId: { in: params.drafts.map((d) => d.campaignCreatorId) },
      status: { in: ["queued", "sending"] },
    },
    select: { campaignCreatorId: true },
  });
  const skip = new Set(alreadyQueued.map((q) => q.campaignCreatorId));
  const fresh = params.drafts.filter((d) => !skip.has(d.campaignCreatorId));

  // Start after anything this brand already has waiting, keeping the spacing.
  const last = await prisma.outreachQueueItem.findFirst({
    where: { brandId: params.brandId, status: "queued" },
    orderBy: { sendAt: "desc" },
    select: { sendAt: true },
  });
  const start = last ? new Date(last.sendAt.getTime() + MIN_GAP_MS) : new Date();
  const times = spacedSendTimes(fresh.length, start);

  await prisma.outreachQueueItem.createMany({
    data: fresh.map((d, i) => ({
      brandId: params.brandId,
      campaignId: params.campaignId,
      campaignCreatorId: d.campaignCreatorId,
      creatorId: d.creatorId,
      channel: d.channel,
      subject: d.subject ?? null,
      body: d.body,
      sendAt: times[i],
      createdById: params.userId,
    })),
  });

  return {
    queued: fresh.length,
    skipped: skip.size,
    finishesAt: times.length ? times[times.length - 1] : null,
  };
}

/**
 * Send whatever is due. Each item is claimed first (queued -> sending), so
 * two overlapping runs can never send the same email.
 */
export async function sendDueOutreach(limit = 10) {
  const due = await prisma.outreachQueueItem.findMany({
    where: { status: "queued", sendAt: { lte: new Date() } },
    orderBy: { sendAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const item of due) {
    const claimed = await prisma.outreachQueueItem.updateMany({
      where: { id: item.id, status: "queued" },
      data: { status: "sending" },
    });
    if (claimed.count === 0) continue;

    try {
      const [result] = await sendOutreachBatch(
        [
          {
            campaignCreatorId: item.campaignCreatorId,
            creatorId: item.creatorId,
            channel: item.channel === "instagram_dm" ? "instagram_dm" : "email",
            subject: item.subject ?? undefined,
            body: item.body,
          },
        ],
        item.brandId,
      );
      const ok = result?.status === "sent";
      if (result?.status === "daily_limit_reached") {
        // Today's limit for this inbox is used up: try again in a day.
        await prisma.outreachQueueItem.update({
          where: { id: item.id },
          data: { status: "queued", sendAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
        continue;
      }
      await prisma.outreachQueueItem.update({
        where: { id: item.id },
        data: ok
          ? { status: "sent", sentAt: new Date() }
          : { status: "failed", error: result?.error ?? result?.status ?? "Not sent" },
      });
      if (ok) sent++;
      else failed++;
    } catch (error) {
      failed++;
      await prisma.outreachQueueItem.update({
        where: { id: item.id },
        data: { status: "failed", error: error instanceof Error ? error.message : "Not sent" },
      });
    }
  }
  return { due: due.length, sent, failed };
}
