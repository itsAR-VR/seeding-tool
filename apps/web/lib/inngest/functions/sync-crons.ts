import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { syncContentForBrand } from "@/lib/content/sync";
import { syncRepliesForBrand } from "@/lib/gmail/sync";

async function brandsConnectedTo(provider: string): Promise<string[]> {
  const connections = await prisma.brandConnection.findMany({
    where: { provider, status: "connected" },
    select: { brandId: true },
    distinct: ["brandId"],
  });
  return connections.map((c) => c.brandId);
}

/** Every 15 minutes: pull new tagged posts for every brand with Instagram connected. */
export const contentSyncCron = inngest.createFunction(
  { id: "content-sync-cron", name: "Content sync (tagged posts)", concurrency: [{ limit: 1 }] },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const brandIds = await step.run("brands", () => brandsConnectedTo("instagram"));
    const results = [];
    for (const brandId of brandIds) {
      results.push(await step.run(`sync-${brandId}`, () => syncContentForBrand(brandId)));
    }
    return { brands: brandIds.length, results };
  }
);

/** Every 15 minutes: pull creator replies for every brand with Gmail connected. */
export const gmailReplySyncCron = inngest.createFunction(
  { id: "gmail-reply-sync-cron", name: "Gmail reply sync", concurrency: [{ limit: 1 }] },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const brandIds = await step.run("brands", () => brandsConnectedTo("gmail"));
    const results = [];
    for (const brandId of brandIds) {
      results.push(await step.run(`sync-${brandId}`, () => syncRepliesForBrand(brandId)));
    }
    return { brands: brandIds.length, results };
  }
);
