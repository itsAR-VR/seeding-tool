import { EventSchemas, Inngest } from "inngest";
import type { AppEventPayloads } from "./events";

export const inngest = new Inngest({
  id: process.env.INNGEST_APP_ID || "seed-scale",
  schemas: new EventSchemas().fromRecord<AppEventPayloads>(),
});
