import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { STUCK_AFTER_DAYS } from "@/lib/stats/campaign-counts";
import { findOutreachWaitingToSend, findStuckCreators } from "@/lib/stats/needs-you";

/**
 * System status (admin health), server component. Lives under Settings.
 *
 * Home is the one "needs you" list. This page shows the detail behind two of
 * its rows (stuck creators, emails waiting to send) using the same queries
 * from lib/stats/needs-you, so the numbers always match Home, plus failed
 * updates from Gmail, Shopify, and Instagram, which only show here.
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
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [stuckCreators, outreachWaiting, openProblems, failedWebhooks] = await Promise.all([
    findStuckCreators(brandId, { now }),
    findOutreachWaitingToSend(brandId),
    prisma.interventionCase.count({ where: { brandId, status: { in: ["open", "in_progress"] } } }),
    prisma.webhookEvent.findMany({
      where: { brandId, status: "failed", createdAt: { gte: twentyFourHoursAgo } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const shownStuck = stuckCreators.slice(0, 50);

  const allClear =
    stuckCreators.length === 0 &&
    openProblems === 0 &&
    failedWebhooks.length === 0 &&
    outreachWaiting.length === 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">System status</h1>
        <p className="mt-1 text-muted-foreground">
          The details behind what Home shows you, plus updates that failed. Your to-do list is on{" "}
          <Link href="/dashboard" className="font-medium text-foreground underline">
            Home
          </Link>
          . To check that Gmail, Shopify, and Instagram are connected, open{" "}
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
          <h2 className="font-semibold">Creators with no progress for {STUCK_AFTER_DAYS} days</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            In campaigns that are sending. People with a reply to answer, an address to check, or an
            order to finish are left out here, because Home already lists them.
          </p>
        </div>
        <StatusLine count={stuckCreators.length} okText="None. Every creator has moved recently." />
        {stuckCreators.length > shownStuck.length && (
          <p className="text-sm text-muted-foreground">Showing the {shownStuck.length} who have waited longest.</p>
        )}
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
                {shownStuck.map((cc) => (
                  <tr key={cc.id} className="border-b last:border-0">
                    <td className="py-2">{creatorName(cc.creator)}</td>
                    <td className="py-2">
                      <Link href={`/campaigns/${cc.campaign.id}?filter=stuck#creators`} className="underline">
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
          <h2 className="font-semibold">Problems</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Replies and errors the tool couldn&apos;t handle by itself.
          </p>
        </div>
        <StatusLine count={openProblems} okText="None open." />
        {openProblems > 0 && (
          <Link href="/interventions" className="inline-block text-sm font-medium underline">
            See problems
          </Link>
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
        <StatusLine count={failedWebhooks.length} max={50} okText="None. Everything came through." />
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
          <h2 className="font-semibold">Emails written and not sent yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            First emails to creators that are ready but still waiting for you to send them.
          </p>
        </div>
        <StatusLine
          count={outreachWaiting.reduce((sum, group) => sum + group.count, 0)}
          okText="None. Every written email has gone out."
        />
        {outreachWaiting.length > 0 && (
          <ul className="divide-y">
            {outreachWaiting.map((group) => (
              <li key={group.campaignId} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {group.campaignName}: {group.count} {group.count === 1 ? "email" : "emails"}
                </span>
                <Link href={`/campaigns/${group.campaignId}/outreach`} className="font-medium underline">
                  Send them
                </Link>
              </li>
            ))}
          </ul>
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

/** `max` is the most a list loads; at that size the real number may be higher. */
function StatusLine({ count, okText, max }: { count: number; okText: string; max?: number }) {
  if (count === 0) {
    return <p className="font-medium text-green-700 dark:text-green-400">{okText}</p>;
  }
  return (
    <p className="font-medium text-amber-800 dark:text-amber-300">
      {max != null && count >= max ? `${max} or more` : count} to look at
    </p>
  );
}
