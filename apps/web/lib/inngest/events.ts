/**
 * Typed Inngest event catalog.
 *
 * Every event emitted via inngest.send() must be declared here.
 * The Inngest client uses these types for compile-time safety.
 */
export type AppEventPayloads = {
  // --- Existing events ---

  /** Dead event — no senders or consumers. Kept for ping/healthcheck testing. */
  "app/ping": {
    data: {
      timestamp: string;
    };
  };

  "gmail/message.received": {
    data: {
      threadId: string;
      messageId: string;
      brandId: string;
      campaignCreatorId: string;
    };
  };

  "mention/media.archive": {
    data: {
      mentionAssetId: string;
    };
  };

  // --- New declarations ---

  "creator-search/requested": {
    data: {
      jobId: string;
      brandId: string;
      campaignId?: string;
      query?: Record<string, unknown>;
      /** Apify consumer expects these fields for backward compat */
      discoverySource?: string;
      criteria?: Record<string, unknown>;
    };
  };

  "creator-avg-views/requested": {
    data: {
      creatorIds: string[];
    };
  };

  "reminder/send": {
    data: {
      campaignCreatorId: string;
      brandId: string;
      reminderNumber: number;
      orderId: string;
    };
  };

  "shopify/order.fulfilled": {
    data: {
      orderId: string;
      shopifyOrderId: string;
      campaignCreatorId: string;
    };
  };

  /** Fire-and-forget — no consumer yet. TODO: add consumer when needed. */
  "shopify/fulfillment.updated": {
    data: {
      orderId: string;
      shopifyOrderId: string;
      campaignCreatorId: string;
      status: string;
    };
  };

  /** Consumed by process-dm-reply — classifies DM, extracts address, generates draft. */
  "unipile/message.received": {
    data: {
      threadId: string;
      messageId: string;
      brandId: string;
      campaignCreatorId: string;
      chatId: string;
    };
  };

  "metrics/snapshots-collected": {
    data: {
      profileIds: string[];
    };
  };

  "shipping/address.approved": {
    data: {
      snapshotId: string;
      campaignCreatorId: string;
      brandId: string;
      campaignId: string;
    };
  };

  "mention/attributed": {
    data: {
      mentionAssetId: string;
      campaignCreatorId: string;
      attributionConfidence: string;
    };
  };

  "mention/posted.confirm": {
    data: {
      campaignCreatorId: string;
      mentionAssetId: string;
    };
  };
};
