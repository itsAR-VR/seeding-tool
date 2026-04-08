import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeConversionRates,
  computeTimeToPost,
} from "@/lib/analytics/conversion";
import type {
  AnalyticsResponse,
  CreatorLeaderboardEntry,
} from "@/lib/analytics/types";
import { AnalyticsDashboard } from "./components/analytics-dashboard";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

const LIFECYCLE_STAGES = [
  { key: "ready", label: "Ready", color: "bg-gray-100 text-gray-800" },
  { key: "outreach_sent", label: "Outreach Sent", color: "bg-blue-100 text-blue-800" },
  { key: "replied", label: "Replied", color: "bg-purple-100 text-purple-800" },
  { key: "address_confirmed", label: "Address Confirmed", color: "bg-green-100 text-green-800" },
  { key: "order_created", label: "Order Created", color: "bg-teal-100 text-teal-800" },
  { key: "shipped", label: "Shipped", color: "bg-indigo-100 text-indigo-800" },
  { key: "delivered", label: "Delivered", color: "bg-emerald-100 text-emerald-800" },
  { key: "posted", label: "Posted", color: "bg-pink-100 text-pink-800" },
  { key: "completed", label: "Completed", color: "bg-green-200 text-green-900" },
  { key: "opted_out", label: "Opted Out", color: "bg-red-100 text-red-800" },
  { key: "stalled", label: "Stalled", color: "bg-yellow-100 text-yellow-800" },
] as const;

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export default async function CampaignAnalyticsPage({ params }: PageProps) {
  const { campaignId } = await params;

  let membership;
  try {
    membership = await getCurrentBrandMembership();
  } catch (error) {
    if (error instanceof BrandAccessError) return null;
    return null;
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId: membership.brandId },
  });

  if (!campaign) notFound();

  // Load all campaign creators
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { campaignId },
    select: {
      id: true,
      lifecycleStatus: true,
      reviewStatus: true,
      creatorId: true,
    },
  });

  const campaignCreatorIds = campaignCreators.map((cc) => cc.id);
  const totalCreators = campaignCreators.length;

  // Lifecycle breakdown
  const lifecycleBreakdown: Record<string, number> = {};
  for (const stage of LIFECYCLE_STAGES) {
    lifecycleBreakdown[stage.key] = campaignCreators.filter(
      (cc) => cc.lifecycleStatus === stage.key
    ).length;
  }

  // Mention assets
  const mentionAssets = campaignCreatorIds.length > 0
    ? await prisma.mentionAsset.findMany({
        where: { campaignCreatorId: { in: campaignCreatorIds } },
        select: {
          id: true,
          platform: true,
          likes: true,
          comments: true,
          views: true,
          campaignCreatorId: true,
        },
      })
    : [];

  const totalMentions = mentionAssets.length;
  const totalLikes = mentionAssets.reduce((sum, m) => sum + (m.likes ?? 0), 0);
  const totalComments = mentionAssets.reduce(
    (sum, m) => sum + (m.comments ?? 0),
    0
  );
  const totalViews = mentionAssets.reduce((sum, m) => sum + (m.views ?? 0), 0);

  // Orders
  const orders = campaignCreatorIds.length > 0
    ? await prisma.shopifyOrder.findMany({
        where: { campaignCreatorId: { in: campaignCreatorIds } },
        select: { id: true, status: true, totalPrice: true },
      })
    : [];

  const totalOrders = orders.length;
  const totalProductValueCents = orders.reduce(
    (sum, o) => sum + (o.totalPrice ?? 0),
    0
  );

  // Cost records
  const costRecords = campaignCreatorIds.length > 0
    ? await prisma.costRecord.findMany({
        where: { campaignCreatorId: { in: campaignCreatorIds } },
        select: { amount: true, type: true },
      })
    : [];

  const totalCostCents = costRecords.reduce((sum, c) => sum + c.amount, 0);

  // Creators who have posted
  const postedCount =
    (lifecycleBreakdown["posted"] ?? 0) +
    (lifecycleBreakdown["completed"] ?? 0);

  // --- Conversion rates ---
  const conversionRates = computeConversionRates(lifecycleBreakdown);

  // --- Time to post ---
  const outcomes = campaignCreatorIds.length > 0
    ? await prisma.campaignOutcome.findMany({
        where: { campaignCreatorId: { in: campaignCreatorIds } },
        select: { outreachSentAt: true, postedAt: true },
      })
    : [];

  const timeToPost = computeTimeToPost(outcomes);

  // --- Creator leaderboard ---
  const creatorIds = [...new Set(campaignCreators.map((cc) => cc.creatorId))];

  const creators = creatorIds.length > 0
    ? await prisma.creator.findMany({
        where: { id: { in: creatorIds } },
        select: {
          id: true,
          name: true,
          instagramHandle: true,
          tiktokHandle: true,
        },
      })
    : [];

  const creatorsById = new Map(creators.map((c) => [c.id, c]));
  const ccToCreator = new Map(
    campaignCreators.map((cc) => [cc.id, cc.creatorId])
  );

  const mentionsByCreator = new Map<
    string,
    { likes: number; comments: number; views: number; count: number }
  >();
  for (const m of mentionAssets) {
    const creatorId = ccToCreator.get(m.campaignCreatorId);
    if (!creatorId) continue;
    const existing = mentionsByCreator.get(creatorId) ?? {
      likes: 0,
      comments: 0,
      views: 0,
      count: 0,
    };
    mentionsByCreator.set(creatorId, {
      likes: existing.likes + (m.likes ?? 0),
      comments: existing.comments + (m.comments ?? 0),
      views: existing.views + (m.views ?? 0),
      count: existing.count + 1,
    });
  }

  const creatorLeaderboard: CreatorLeaderboardEntry[] = Array.from(
    mentionsByCreator.entries()
  )
    .map(([creatorId, stats]) => {
      const creator = creatorsById.get(creatorId);
      const handle = creator?.instagramHandle ?? creator?.tiktokHandle ?? "";
      const platform = creator?.instagramHandle ? "instagram" : "tiktok";
      return {
        creatorId,
        creatorName: creator?.name ?? "Unknown",
        handle,
        platform,
        totalLikes: stats.likes,
        totalComments: stats.comments,
        totalViews: stats.views,
        mentionCount: stats.count,
      };
    })
    .sort(
      (a, b) =>
        b.totalLikes +
        b.totalComments +
        b.totalViews -
        (a.totalLikes + a.totalComments + a.totalViews)
    )
    .slice(0, 20);

  // --- Costs by type ---
  const costsByType = costRecords.reduce<Record<string, number>>(
    (acc, c) => ({
      ...acc,
      [c.type]: (acc[c.type] ?? 0) + c.amount,
    }),
    {}
  );

  // --- Build initial data for client components ---
  const mentionsByPlatform = mentionAssets.reduce<Record<string, number>>(
    (acc, m) => ({
      ...acc,
      [m.platform]: (acc[m.platform] ?? 0) + 1,
    }),
    {}
  );

  const orderStatusBreakdown = orders.reduce<Record<string, number>>(
    (acc, o) => ({
      ...acc,
      [o.status]: (acc[o.status] ?? 0) + 1,
    }),
    {}
  );

  const initialData: AnalyticsResponse = {
    campaignId,
    summary: {
      totalCreators,
      totalMentions,
      totalOrders,
      totalLikes,
      totalComments,
      totalViews,
      totalProductValueCents,
      totalCostCents,
    },
    lifecycle: lifecycleBreakdown,
    review: {
      pending: campaignCreators.filter((cc) => cc.reviewStatus === "pending").length,
      approved: campaignCreators.filter((cc) => cc.reviewStatus === "approved").length,
      declined: campaignCreators.filter((cc) => cc.reviewStatus === "declined").length,
      deferred: campaignCreators.filter((cc) => cc.reviewStatus === "deferred").length,
    },
    mentions: {
      total: totalMentions,
      byPlatform: mentionsByPlatform,
      engagement: { likes: totalLikes, comments: totalComments, views: totalViews },
    },
    orders: {
      total: totalOrders,
      byStatus: orderStatusBreakdown,
    },
    conversionRates,
    timeToPost,
    creatorLeaderboard,
    costsByType,
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/campaigns" className="hover:underline">
              Campaigns
            </Link>
            <span>/</span>
            <Link href={`/campaigns/${campaignId}`} className="hover:underline">
              {campaign.name}
            </Link>
            <span>/</span>
            <span>Analytics</span>
          </div>
          <h1 className="text-2xl font-bold">{campaign.name} — Analytics</h1>
        </div>
        <Link href={`/campaigns/${campaignId}`}>
          <Button variant="outline">&larr; Back to Campaign</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Creators</CardDescription>
            <CardTitle className="text-3xl">{totalCreators}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Posted</CardDescription>
            <CardTitle className="text-3xl">{postedCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {totalCreators > 0
              ? `${Math.round((postedCount / totalCreators) * 100)}% conversion`
              : "\u2014"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Mentions</CardDescription>
            <CardTitle className="text-3xl">{totalMentions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Orders Created</CardDescription>
            <CardTitle className="text-3xl">{totalOrders}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {totalProductValueCents > 0
              ? formatCurrency(totalProductValueCents) + " product value"
              : "\u2014"}
          </CardContent>
        </Card>
      </div>

      {/* Lifecycle Funnel (static server-rendered view) */}
      <Card>
        <CardHeader>
          <CardTitle>Creator Lifecycle Funnel</CardTitle>
          <CardDescription>
            Distribution of creators across each stage of the seeding pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {LIFECYCLE_STAGES.map((stage) => {
              const count = lifecycleBreakdown[stage.key] ?? 0;
              const pct =
                totalCreators > 0
                  ? Math.round((count / totalCreators) * 100)
                  : 0;
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <div className="w-36 shrink-0">
                    <Badge className={`${stage.color} text-xs`}>
                      {stage.label}
                    </Badge>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-16 text-right text-sm font-medium">
                    {count}
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Engagement Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Metrics</CardTitle>
          <CardDescription>
            Aggregated engagement from creator mentions across all platforms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold">
                {formatNumber(totalLikes)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Likes</div>
            </div>
            <div>
              <div className="text-3xl font-bold">
                {formatNumber(totalComments)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Comments
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold">
                {formatNumber(totalViews)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Views</div>
            </div>
          </div>
          {totalMentions === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              No mention data yet. Metrics will appear once creators start
              posting.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cost Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Cost Overview</CardTitle>
          <CardDescription>
            Total investment across product fulfillment and seeding costs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">
                Product Value Sent
              </div>
              <div className="text-2xl font-bold mt-1">
                {totalProductValueCents > 0
                  ? formatCurrency(totalProductValueCents)
                  : "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Cost</div>
              <div className="text-2xl font-bold mt-1">
                {totalCostCents > 0 ? formatCurrency(totalCostCents) : "\u2014"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Dashboard (Client Components) */}
      <AnalyticsDashboard
        initialData={initialData}
        campaignName={campaign.name}
      />
    </div>
  );
}
