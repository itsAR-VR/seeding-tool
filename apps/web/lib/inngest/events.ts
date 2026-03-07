export type AppEventName = "app/ping";

export type AppEventPayloads = {
  "app/ping": {
    name: "app/ping";
    data: {
      timestamp: string;
    };
  };
};
