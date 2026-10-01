import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CampaignHealthWidget } from "./components/campaign-health";
import type { HealthSnapshotData } from "@/lib/health/types";

// ── Health snapshot fetcher ──────────────────────────────────

async function fetchHealthSnapshots(
  brandId: string
): Promise<HealthSnapshotData[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { brandId, status: { in: ["active", "paused"] } },
    select: { id: true, name: true },
  });

  if (campaigns.length === 0) return [];

  const campaignIds = campaigns.map((c) => c.id);
  const campaignNames = new Map(campaigns.map((c) => [c.id, c.name]));

  const snapshots = await prisma.campaignHealthSnapshot.findMany({
    where: { campaignId: { in: campaignIds } },
    orderBy: { createdAt: "desc" },
  });

  // Keep only the latest snapshot per campaign
  const latestByCampaign = new Map<string, (typeof snapshots)[number]>();
  for (const snap of snapshots) {
    if (!latestByCampaign.has(snap.campaignId)) {
      latestByCampaign.set(snap.campaignId, snap);
    }
  }

  return Array.from(latestByCampaign.values()).map((snap) => ({
    id: snap.id,
    createdAt: snap.createdAt.toISOString(),
    campaignId: snap.campaignId,
    campaignName: campaignNames.get(snap.campaignId) ?? "Unknown",
    status: snap.status as HealthSnapshotData["status"],
    metrics: snap.metrics as unknown as HealthSnapshotData["metrics"],
    alerts: snap.alerts as unknown as HealthSnapshotData["alerts"],
  }));
}

// ── Home page ────────────────────────────────────────────────

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Not started",
  active: "Sending",
  paused: "Paused",
  completed: "Finished",
};

type Todo = { count: number; text: string; action: string; href: string };

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function DashboardPage() {
  let membership;
  try {
    membership = await getCurrentBrandMembership();
  } catch (error) {
    if (error instanceof BrandAccessError) {
      redirect("/onboarding");
    }
    return null;
  }

  const brandId = membership.brandId;

  // Gate: onboarding must be complete before accessing the dashboard
  const onboarding = await prisma.brandOnboarding.findUnique({
    where: { brandId },
    select: { isComplete: true },
  });

  if (!onboarding?.isComplete) {
    redirect("/onboarding");
  }

  const weekAgo = daysAgo(7);

  const [
    undecidedThreads,
    draftOrders,
    newPosts,
    rightsWaiting,
    openProblems,
    campaigns,
    healthSnapshots,
  ] = await Promise.all([
    prisma.conversationThread.findMany({
      where: { brandId, campaignCreator: { replyDecision: null } },
      select: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { direction: true } } },
    }),
    prisma.shopifyOrder.count({
      where: { campaignCreator: { campaign: { brandId } }, status: "draft_created" },
    }),
    prisma.contentPost.count({
      where: { brandId, hidden: false, rightsStatus: "none", createdAt: { gte: weekAgo } },
    }),
    prisma.contentPost.count({ where: { brandId, rightsStatus: "requested" } }),
    prisma.interventionCase.count({ where: { brandId, status: { in: ["open", "in_progress"] } } }),
    prisma.campaign.findMany({
      where: { brandId, status: { not: "archived" } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { _count: { select: { campaignCreators: true } } },
    }),
    fetchHealthSnapshots(brandId),
  ]);

  const repliesToAnswer = undecidedThreads.filter((t) => t.messages[0]?.direction === "inbound").length;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  const todos: Todo[] = [
    {
      count: repliesToAnswer,
      text: plural(repliesToAnswer, "creator replied and needs an answer", "creators replied and need an answer"),
      action: "Open inbox",
      href: "/inbox",
    },
    {
      count: draftOrders,
      text: plural(draftOrders, "gift order is ready to complete in Shopify", "gift orders are ready to complete in Shopify"),
      action: "See orders",
      href: "/orders",
    },
    {
      count: newPosts,
      text: plural(newPosts, "new post tagged you this week", "new posts tagged you this week"),
      action: "See posts",
      href: "/content?tab=none",
    },
    {
      count: rightsWaiting,
      text: plural(rightsWaiting, "usage-rights request is waiting on the creator", "usage-rights requests are waiting on creators"),
      action: "See requests",
      href: "/content?tab=requested",
    },
    {
      count: openProblems,
      text: plural(openProblems, "problem needs a look", "problems need a look"),
      action: "Fix it",
      href: "/interventions",
    },
  ].filter((t) => t.count > 0);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Home</h1>
        <p className="mt-1 text-muted-foreground">
          {todos.length === 0 ? "You're all caught up." : "Here's what needs you today."}
        </p>
      </header>

      <section aria-labelledby="todo-heading">
        <h2 id="todo-heading" className="sr-only">
          Needs you
        </h2>
        {todos.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border bg-card p-5">
            <CheckCircle2 className="size-5 text-green-700" aria-hidden />
            <p>Nothing needs you right now. New replies and posts show up here.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {todos.map((todo) => (
              <li key={todo.href}>
                <Link
                  href={todo.href}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <span className="w-10 text-2xl font-semibold tabular-nums">{todo.count}</span>
                  <span className="flex-1">{todo.text}</span>
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {todo.action}
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {healthSnapshots.length > 0 && <CampaignHealthWidget snapshots={healthSnapshots} />}

      <section aria-labelledby="campaigns-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="campaigns-heading" className="text-lg font-semibold">
            Campaigns
          </h2>
          <Link href="/campaigns/new" className="text-sm font-medium hover:underline">
            New campaign
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="rounded-xl border bg-card p-5">
            <p>No campaigns yet.</p>
            <Link href="/campaigns/new" className="mt-2 inline-block font-medium underline">
              Start your first campaign
            </Link>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <span className="flex-1 font-medium">{campaign.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {campaign._count.campaignCreators}{" "}
                    {plural(campaign._count.campaignCreators, "creator", "creators")}
                  </span>
                  <span className="w-24 text-right text-sm">
                    {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
