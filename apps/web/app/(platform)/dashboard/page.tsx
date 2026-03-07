import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ── Status badge color maps ──────────────────────────────────

const campaignStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-500",
};

const interventionStatusColors: Record<string, string> = {
  open: "bg-red-100 text-red-800",
  in_progress: "bg-orange-100 text-orange-800",
  resolved: "bg-green-100 text-green-800",
  reopened: "bg-red-100 text-red-800",
};

const mentionTypeBadge: Record<string, string> = {
  post: "bg-blue-100 text-blue-800",
  story: "bg-purple-100 text-purple-800",
  reel: "bg-pink-100 text-pink-800",
  video: "bg-indigo-100 text-indigo-800",
};

const typeLabels: Record<string, string> = {
  captcha: "🔒 Captcha",
  auth_failure: "🔑 Auth",
  duplicate_order: "📦 Order",
  unclear_reply: "❓ Reply",
  manual_review: "👀 Review",
  other: "📋 Other",
};

// ── Dashboard page ───────────────────────────────────────────

export default async function DashboardPage() {
  // Auth
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) return null;

  // Get brand membership (follows existing pattern)
  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const brandId = membership.brandId;

  // ── Parallel data fetches ────────────────────────────────

  const [
    activeCampaignCount,
    creatorsInPipeline,
    pendingInterventions,
    ordersShipping,
    recentCampaigns,
    openInterventions,
    recentMentions,
    totalCampaigns,
  ] = await Promise.all([
    // Metric 1: Active campaigns
    prisma.campaign.count({
      where: { brandId, status: "active" },
    }),

    // Metric 2: Creators in pipeline (not closed/completed/opted_out)
    prisma.campaignCreator.count({
      where: {
        campaign: { brandId },
        lifecycleStatus: {
          notIn: ["completed", "opted_out"],
        },
      },
    }),

    // Metric 3: Pending interventions
    prisma.interventionCase.count({
      where: {
        brandId,
        status: { in: ["open", "in_progress"] },
      },
    }),

    // Metric 4: Orders shipping
    prisma.shopifyOrder.count({
      where: {
        campaignCreator: { campaign: { brandId } },
        status: { in: ["created", "processing", "shipped"] },
      },
    }),

    // Campaign activity feed — last 5 non-archived
    prisma.campaign.findMany({
      where: { brandId, status: { not: "archived" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        _count: { select: { campaignCreators: true } },
      },
    }),

    // Open interventions — latest 5
    prisma.interventionCase.findMany({
      where: {
        brandId,
        status: { in: ["open", "in_progress"] },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),

    // Recent mentions — latest 6
    prisma.mentionAsset.findMany({
      where: {
        campaignCreator: { campaign: { brandId } },
      },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        campaignCreator: {
          include: {
            creator: { select: { instagramHandle: true } },
          },
        },
      },
    }),

    // Total campaigns for sublabel
    prisma.campaign.count({
      where: { brandId },
    }),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your campaign overview and key metrics.
        </p>
      </div>

      {/* ── Section 1: Metric Cards ─────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Campaigns"
          value={activeCampaignCount}
          sublabel={`of ${totalCampaigns} total`}
          icon="📢"
        />
        <MetricCard
          title="Creators in Pipeline"
          value={creatorsInPipeline}
          sublabel={`across ${activeCampaignCount} active campaign${activeCampaignCount !== 1 ? "s" : ""}`}
          icon="👤"
        />
        <MetricCard
          title="Pending Interventions"
          value={pendingInterventions}
          sublabel="need attention"
          icon="🚨"
          highlight={pendingInterventions > 0}
        />
        <MetricCard
          title="Orders in Transit"
          value={ordersShipping}
          sublabel="created / processing / shipped"
          icon="📦"
        />
      </div>

      {/* ── Section 2: Two-column layout ────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column (60%): Campaign activity feed */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Recent Campaigns</CardTitle>
              <CardDescription>Latest activity across your campaigns</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {recentCampaigns.length === 0 ? (
                <EmptyState
                  icon="📢"
                  title="No campaigns yet"
                  description="Create your first campaign to start seeding products to creators."
                  actionHref="/campaigns/new"
                  actionLabel="Create Campaign"
                />
              ) : (
                <div className="space-y-3">
                  {recentCampaigns.map((campaign) => (
                    <Link
                      key={campaign.id}
                      href={`/campaigns/${campaign.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {campaign.name}
                          </span>
                          <Badge
                            className={
                              campaignStatusColors[campaign.status] ??
                              "bg-gray-100 text-gray-800"
                            }
                          >
                            {campaign.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {campaign._count.campaignCreators} creator
                          {campaign._count.campaignCreators !== 1 ? "s" : ""}{" "}
                          · created{" "}
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
            {recentCampaigns.length > 0 && (
              <CardFooter>
                <Link
                  href="/campaigns"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all campaigns →
                </Link>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Right column (40%): Action queue — interventions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Action Queue</CardTitle>
              <CardDescription>Issues needing your attention</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {openInterventions.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <span className="text-3xl">✅</span>
                  <p className="mt-2 text-sm font-medium text-green-700">
                    All clear
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No open interventions. Everything is running smoothly.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {openInterventions.map((intervention) => (
                    <Link
                      key={intervention.id}
                      href="/interventions"
                      className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="shrink-0 text-sm">
                        {typeLabels[intervention.type] ?? "📋"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {intervention.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            className={
                              interventionStatusColors[intervention.status] ??
                              "bg-gray-100 text-gray-800"
                            }
                          >
                            {intervention.status.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(intervention.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
            {openInterventions.length > 0 && (
              <CardFooter>
                <Link
                  href="/interventions"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all interventions →
                </Link>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {/* ── Section 3: Recent Mentions Strip ────────────────── */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Recent Mentions</CardTitle>
          <CardDescription>Latest creator posts about your products</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {recentMentions.length === 0 ? (
            <EmptyState
              icon="📸"
              title="No mentions yet"
              description="Keep seeding — creator posts will appear here as they mention your brand."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {recentMentions.map((mention) => (
                <div
                  key={mention.id}
                  className="rounded-lg border p-3 text-center"
                >
                  <p className="truncate text-sm font-medium">
                    @{mention.campaignCreator.creator.instagramHandle ?? "unknown"}
                  </p>
                  {mention.type && (
                    <Badge
                      className={cn(
                        "mt-1",
                        mentionTypeBadge[mention.type] ??
                          "bg-gray-100 text-gray-800"
                      )}
                    >
                      {mention.type}
                    </Badge>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(mention.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function MetricCard({
  title,
  value,
  sublabel,
  icon,
  highlight = false,
}: {
  title: string;
  value: number;
  sublabel: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "ring-2 ring-red-200" : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          <span className="text-xl">{icon}</span>
        </div>
        <CardTitle className="text-3xl font-bold">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {description}
      </p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}


