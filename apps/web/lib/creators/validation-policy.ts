export const DEFAULT_CACHE_VALIDITY_HOURS = Math.max(
  1,
  Number.parseInt(process.env.CACHE_VALIDITY_HOURS ?? "72", 10) || 72
);

export function isCreatorValidationFresh(
  lastValidatedAt: Date | null | undefined,
  now = new Date(),
  cacheValidityHours = DEFAULT_CACHE_VALIDITY_HOURS
) {
  if (!lastValidatedAt) {
    return false;
  }

  const ageMs = now.getTime() - lastValidatedAt.getTime();
  return ageMs <= cacheValidityHours * 60 * 60 * 1000;
}

export type CampaignCleanupCandidate = {
  reviewStatus: string;
  lifecycleStatus: string;
  outreachCount: number;
  lastOutreachAt: Date | null;
  lastReplyAt: Date | null;
  hasConversationThread: boolean;
  hasShopifyOrder: boolean;
  shippingSnapshotCount: number;
  reminderScheduleCount: number;
  costRecordCount: number;
  mentionAssetCount: number;
};

export function canAutoRemoveInvalidCampaignCreator(
  candidate: CampaignCleanupCandidate
) {
  return (
    candidate.lifecycleStatus === "ready" &&
    candidate.outreachCount === 0 &&
    candidate.lastOutreachAt == null &&
    candidate.lastReplyAt == null &&
    !candidate.hasConversationThread &&
    !candidate.hasShopifyOrder &&
    candidate.shippingSnapshotCount === 0 &&
    candidate.reminderScheduleCount === 0 &&
    candidate.costRecordCount === 0 &&
    candidate.mentionAssetCount === 0
  );
}
