export type AppEventName =
  | "app/ping"
  | "gmail/message.received"
  | "mention/media.archive";

export type AppEventPayloads = {
  "app/ping": {
    name: "app/ping";
    data: {
      timestamp: string;
    };
  };
  "gmail/message.received": {
    name: "gmail/message.received";
    data: {
      threadId: string;
      messageId: string;
      brandId: string;
      campaignCreatorId: string;
    };
  };
  "mention/media.archive": {
    name: "mention/media.archive";
    data: {
      mentionAssetId: string;
    };
  };
};
