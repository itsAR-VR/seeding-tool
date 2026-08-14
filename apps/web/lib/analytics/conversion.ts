/**
 * Pure functions for computing campaign analytics metrics.
 * No database access — operates on pre-fetched data.
 */

import type { ConversionRates } from "./types";

/**
 * Primary lifecycle stages in order.
 * opted_out and stalled are terminal/dropout — excluded from conversion chain.
 */
const PRIMARY_STAGES = [
  "ready",
  "outreach_sent",
  "replied",
  "address_confirmed",
  "order_created",
  "shipped",
  "delivered",
  "posted",
  "completed",
] as const;

/**
 * Counts how many creators have reached at least a given stage.
 * A creator at stage N has also passed through stages 0..N-1.
 *
 * KNOWN LIMITATION (review follow-up): lifecycle counts reflect CURRENT
 * status, so terminal creators (opted_out, stalled) are absent from every
 * denominator — funnels overstate conversion once creators churn. The
 * canonical fix is to compute stage-reached counts from CampaignOutcome
 * timestamps (durable event record) instead of current lifecycle state.
 */
function countAtOrBeyondStage(
  lifecycle: Readonly<Record<string, number>>,
  stageIndex: number
): number {
  let count = 0;
  for (let i = stageIndex; i < PRIMARY_STAGES.length; i++) {
    count += lifecycle[PRIMARY_STAGES[i]] ?? 0;
  }
  return count;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

/**
 * Computes conversion rates between adjacent lifecycle stages.
 * Each rate = (creators at stage N+1 or beyond) / (creators at stage N or beyond).
 */
export function computeConversionRates(
  lifecycle: Readonly<Record<string, number>>
): ConversionRates {
  const atReady = countAtOrBeyondStage(lifecycle, 0);
  const atOutreachSent = countAtOrBeyondStage(lifecycle, 1);
  const atReplied = countAtOrBeyondStage(lifecycle, 2);
  const atAddressConfirmed = countAtOrBeyondStage(lifecycle, 3);
  const atOrderCreated = countAtOrBeyondStage(lifecycle, 4);
  const atShipped = countAtOrBeyondStage(lifecycle, 5);
  const atDelivered = countAtOrBeyondStage(lifecycle, 6);
  const atPosted = countAtOrBeyondStage(lifecycle, 7);

  return {
    readyToOutreachSent: safeRate(atOutreachSent, atReady),
    outreachSentToReplied: safeRate(atReplied, atOutreachSent),
    repliedToAddressConfirmed: safeRate(atAddressConfirmed, atReplied),
    addressConfirmedToOrderCreated: safeRate(atOrderCreated, atAddressConfirmed),
    orderCreatedToShipped: safeRate(atShipped, atOrderCreated),
    shippedToDelivered: safeRate(atDelivered, atShipped),
    deliveredToPosted: safeRate(atPosted, atDelivered),
    overallConversion: safeRate(atPosted, atReady),
  };
}

/**
 * Computes time-to-post in hours from outreachSentAt to postedAt.
 * Filters out records missing either timestamp.
 */
export function computeTimeToPost(
  outcomes: readonly {
    readonly outreachSentAt: Date | string | null;
    readonly postedAt: Date | string | null;
  }[]
): readonly number[] {
  return outcomes.reduce<number[]>((acc, o) => {
    if (o.outreachSentAt == null || o.postedAt == null) return acc;
    const sent = new Date(o.outreachSentAt).getTime();
    const posted = new Date(o.postedAt).getTime();
    if (Number.isNaN(sent) || Number.isNaN(posted)) return acc;
    const hours = Math.max(0, (posted - sent) / (1000 * 60 * 60));
    return [...acc, Math.round(hours * 100) / 100];
  }, []);
}

/**
 * Buckets time-to-post hours into histogram bins.
 */
export type TimeToPostBucket = {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly count: number;
};

const BUCKET_DEFS = [
  { label: "0-24h", min: 0, max: 24 },
  { label: "1-3d", min: 24, max: 72 },
  { label: "3-7d", min: 72, max: 168 },
  { label: "7-14d", min: 168, max: 336 },
  { label: "14-30d", min: 336, max: 720 },
  { label: "30d+", min: 720, max: Infinity },
] as const;

export function bucketTimeToPost(
  hours: readonly number[]
): readonly TimeToPostBucket[] {
  return BUCKET_DEFS.map((def) => ({
    ...def,
    count: hours.filter((h) => h >= def.min && h < def.max).length,
  }));
}
