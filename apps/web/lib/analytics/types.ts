/**
 * Shared types for campaign analytics data.
 * Used by the API route, server page, and client components.
 */

export type ConversionRates = {
  readonly readyToOutreachSent: number;
  readonly outreachSentToReplied: number;
  readonly repliedToAddressConfirmed: number;
  readonly addressConfirmedToOrderCreated: number;
  readonly orderCreatedToShipped: number;
  readonly shippedToDelivered: number;
  readonly deliveredToPosted: number;
  readonly overallConversion: number;
};

export type CreatorLeaderboardEntry = {
  readonly creatorId: string;
  readonly creatorName: string;
  readonly handle: string;
  readonly platform: string;
  readonly totalLikes: number;
  readonly totalComments: number;
  readonly totalViews: number;
  readonly mentionCount: number;
};

export type AnalyticsResponse = {
  readonly campaignId: string;
  readonly summary: {
    readonly totalCreators: number;
    readonly totalMentions: number;
    readonly totalOrders: number;
    readonly totalLikes: number;
    readonly totalComments: number;
    readonly totalViews: number;
    readonly totalProductValueCents: number;
    readonly totalCostCents: number;
  };
  readonly lifecycle: Record<string, number>;
  readonly review: Record<string, number>;
  readonly mentions: {
    readonly total: number;
    readonly byPlatform: Record<string, number>;
    readonly engagement: {
      readonly likes: number;
      readonly comments: number;
      readonly views: number;
    };
  };
  readonly orders: {
    readonly total: number;
    readonly byStatus: Record<string, number>;
  };
  readonly conversionRates: ConversionRates;
  readonly timeToPost: readonly number[];
  readonly creatorLeaderboard: readonly CreatorLeaderboardEntry[];
  readonly costsByType: Record<string, number>;
};
