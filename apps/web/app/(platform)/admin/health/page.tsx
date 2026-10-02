import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";

/**
 * System status (admin health), server component.
 *
 * Shows:
 * - Stuck CampaignCreators (lifecycleStatus not updated in >72h and not closed)
 * - Open InterventionCases count
 * - Failed WebhookEvents in last 24h
 * - AIDrafts in "draft" status older than 48h (pending human review)
 */
export default async function AdminHealthPage() {
  let membership;
  try {
    membership = await getCurrentBrandMembership();
  } catch (error) {
    if (error instanceof BrandAccessError) {
      if (error.status === 401) redirect("/login");
      redirect("/onboarding");
    }
    redirect("/login");
  }

  const brandId = membership.brandId;

  const now = new Date();
  const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const closedStatuses = [
    "posted",
    "completed",
    "opted_out",
    "closed",
  ];

  // Stuck CampaignCreators
  const stuckCreators = await prisma.campaignCreator.findMany({
    where: {
      campaign: { brandId },
      updatedAt: { lt: seventyTwoHoursAgo },
      lifecycleStatus: { notIn: closedStatuses },
    },
    include: {
      creator: { select: { name: true, instagramHandle: true } },
      campaign: { select: { name: true, id: true } },
    },
    take: 50,
  });

  // Open InterventionCases
  const openInterventions = await prisma.interventionCase.findMany({
    where: {
      brandId,
      status: { in: ["open", "in_progress"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Failed WebhookEvents in last 24h
  const failedWebhooks = await prisma.webhookEvent.findMany({
    where: {
      brandId,
      status: "failed",
      createdAt: { gte: twentyFourHoursAgo },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // AIDrafts in "draft" status older than 48h
  const staleDrafts = await prisma.aIDraft.findMany({
    where: {
      status: "draft",
      createdAt: { lt: fortyEightHoursAgo },
      campaignCreator: {
        campaign: { brandId },
      },
    },
    include: {
      campaignCreator: {
        include: {
          creator: { select: { name: true, instagramHandle: true } },
          campaign: { select: { name: true } },
        },
      },
    },
    take: 50,
  });

  const allClear =
    stuckCreators.length === 0 &&
    openInterventions.length === 0 &&
    failedWebhooks.length === 0 &&
    staleDrafts.length === 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">System status</h1>
        <p className="mt-1 text-muted-foreground">
          Things that may be stuck or waiting on you. To check that Gmail, Shopify, and Instagram
          are connected, open{" "}
          <Link href="/settings/connections" className="font-medium text-foreground underline">
            Connections
          </Link>
          .
        </p>
      </header>

      {allClear && (
        <p className="rounded-xl border bg-card p-5 font-medium">
          Everything looks fine. Nothing is stuck or waiting on you.
        </p>
      )}

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Creators with no progress for 3 days</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open the campaign to see if they need an email, a reply, or an order.
          </p>
        </div>
        <StatusLine count={stuckCreators.length} okText="None. Every creator has moved recently." />
        {stuckCreators.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Creator</th>
                  <th className="pb-2 font-medium">Campaign</th>
                  <th className="pb-2 font-medium">Where they are</th>
                  <th className="pb-2 font-medium">Last change</th>
                </tr>
              </thead>
              <tbody>
                {stuckCreators.map((cc) => (
                  <tr key={cc.id} className="border-b last:border-0">
                    <td className="py-2">{creatorName(cc.creator)}</td>
                    <td className="py-2">
                      <Link href={`/campaigns/${cc.campaign.id}`} className="underline">
                        {cc.campaign.name}
                      </Link>
                    </td>
                    <td className="py-2">{PROGRESS_LABELS[cc.lifecycleStatus] ?? cc.lifecycleStatus}</td>
                    <td className="py-2 text-muted-foreground">{formatWhen(cc.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Things that need attention</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Replies and problems the tool couldn&apos;t handle by itself.
          </p>
        </div>
        <StatusLine count={openInterventions.length} okText="Nothing waiting on you." />
        {openInterventions.length > 0 && (
          <>
            <ul className="divide-y">
              {openInterventions.map((ic) => (
                <li key={ic.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    {ic.title}
                    {(ic.priority === "critical" || ic.priority === "high") && (
                      <span className="ml-2 font-medium text-red-700 dark:text-red-400">Urgent</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">{formatWhen(ic.createdAt)}</span>
                </li>
              ))}
            </ul>
            <Link href="/interventions" className="inline-block text-sm font-medium underline">
              Go to Needs attention
            </Link>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Updates that failed in the last day</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages from Gmail, Shopify, or Instagram that the tool couldn&apos;t process. If this
            keeps happening, email us.
          </p>
        </div>
        <StatusLine count={failedWebhooks.length} okText="None. Everything came through." />
        {failedWebhooks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">From</th>
                  <th className="pb-2 font-medium">What went wrong</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {failedWebhooks.map((wh) => (
                  <tr key={wh.id} className="border-b last:border-0">
                    <td className="py-2">{providerName(wh.provider)}</td>
                    <td className="max-w-xs truncate py-2" title={wh.error ?? undefined}>
                      {wh.error || "No details"}
                    </td>
                    <td className="py-2 text-muted-foreground">{formatWhen(wh.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Drafts waiting more than 2 days</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-written emails no one has sent or thrown away yet. Review them in the inbox.
          </p>
        </div>
        <StatusLine count={staleDrafts.length} okText="None. No drafts are waiting." />
        {staleDrafts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Creator</th>
                  <th className="pb-2 font-medium">Campaign</th>
                  <th className="pb-2 font-medium">Written</th>
                </tr>
              </thead>
              <tbody>
                {staleDrafts.map((draft) => (
                  <tr key={draft.id} className="border-b last:border-0">
                    <td className="py-2">{creatorName(draft.campaignCreator.creator)}</td>
                    <td className="py-2">{draft.campaignCreator.campaign.name}</td>
                    <td className="py-2 text-muted-foreground">{formatWhen(draft.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const PROGRESS_LABELS: Record<string, string> = {
  ready: "Not emailed yet",
  outreach_sent: "Emailed",
  replied: "Replied",
  address_review: "Address to review",
  address_confirmed: "Address confirmed",
  order_created: "Order drafted",
  shipped: "Shipped",
  delivered: "Delivered",
  stalled: "No reply for a while",
};

const PROVIDER_NAMES: Record<string, string> = {
  gmail: "Gmail",
  shopify: "Shopify",
  instagram: "Instagram",
  meta: "Instagram",
  unipile: "Unipile",
};

function providerName(provider: string): string {
  return PROVIDER_NAMES[provider.toLowerCase()] ?? provider;
}

function creatorName(creator: { name: string | null; instagramHandle: string | null }): string {
  if (creator.name) return creator.name;
  if (creator.instagramHandle) return `@${creator.instagramHandle.replace(/^@/, "")}`;
  return "Unnamed creator";
}

function formatWhen(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusLine({ count, okText }: { count: number; okText: string }) {
  if (count === 0) {
    return <p className="font-medium text-green-700 dark:text-green-400">{okText}</p>;
  }
  return (
    <p className="font-medium text-amber-800 dark:text-amber-300">
      {count >= 50 ? "50 or more" : count} to look at
    </p>
  );
}
