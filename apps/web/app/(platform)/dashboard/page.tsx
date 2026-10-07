import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, BrandAccessError } from "@/lib/integrations/brand-access";
import { getActiveMembership, isBrandInSetup } from "@/lib/onboarding/setup-state";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { resolveProviderCredential } from "@/lib/integrations/state";
import { CampaignHealthWidget } from "./components/campaign-health";
import type { HealthSnapshotData } from "@/lib/health/types";
import { ADDRESS_TO_CHECK_WHERE, STUCK_AFTER_DAYS } from "@/lib/stats/campaign-counts";
import { campaignStatus } from "../campaigns/_components/campaign-status";
import {
  countNeedsAnswer,
  findOutreachWaitingToSend,
  countNeedsAnswerByCampaign,
  findStuckCreators,
  groupByCampaign,
} from "@/lib/stats/needs-you";

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

// ── Setup checklist (new companies) ─────────────────────────

type SetupItem = { done: boolean; text: string; href: string; action: string };

/** A broken or expired integration shows as "not connected" instead of crashing Home. */
async function connectedOrFalse(
  brandId: string,
  provider: Parameters<typeof resolveProviderCredential>[1],
): Promise<{ connected: boolean }> {
  try {
    const credential = await resolveProviderCredential(brandId, provider);
    return { connected: Boolean(credential?.connected) };
  } catch (error) {
    console.warn("[dashboard] couldn't check connection", { brandId, provider, error });
    return { connected: false };
  }
}

async function fetchSetupItems(brandId: string, hasCampaign: boolean): Promise<SetupItem[]> {
  const [brand, instagram, gmail, shopify] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: brandId },
      select: { productFacts: true, apifyTokenEnc: true, useSharedApify: true },
    }),
    connectedOrFalse(brandId, "instagram"),
    connectedOrFalse(brandId, "gmail"),
    connectedOrFalse(brandId, "shopify"),
  ]);
  return [
    { done: Boolean(brand?.productFacts?.trim()), text: "Write what creators should know about the gift", href: "/settings/brand-kit", action: "Open brand kit" },
    { done: gmail.connected, text: "Connect Gmail to send outreach", href: "/settings/connections", action: "Connect" },
    { done: instagram.connected, text: "Connect Instagram to catch posts that tag you", href: "/settings/connections", action: "Connect" },
    { done: shopify.connected, text: "Connect Shopify to create gift orders", href: "/settings/connections", action: "Connect" },
    { done: Boolean(brand?.apifyTokenEnc || brand?.useSharedApify), text: "Turn on creator search", href: "/settings/creator-search", action: "Set up" },
    { done: hasCampaign, text: "Start your first campaign", href: "/campaigns/new", action: "Start" },
  ];
}

// ── Home page ────────────────────────────────────────────────

type Todo = { count: number; text: string; action: string; href: string };

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function DashboardPage() {
  let user;
  try {
    user = await getCurrentUserRecord();
  } catch (error) {
    // No app account yet: the setup page explains what to do (invite link).
    if (error instanceof BrandAccessError) redirect("/onboarding");
    throw error;
  }

  // Cookie brand, or the oldest one when the cookie is missing or stale.
  const membership = await getActiveMembership(user.id);
  if (!membership) redirect("/onboarding");

  const brandId = membership.brandId;

  // Only a company this person is still setting up sends them to setup. It's
  // the same rule /api/onboarding/status uses, so the two pages can't bounce
  // between each other. Teams someone was invited into always open Home.
  if (await isBrandInSetup(user.id, brandId)) {
    redirect("/onboarding");
  }

  const weekAgo = daysAgo(7);

  const [
    repliesToAnswer,
    draftOrders,
    newPosts,
    rightsWaiting,
    openProblems,
    addressesToConfirm,
    campaigns,
    healthSnapshots,
    outreachWaiting,
    stuckCreators,
    toEmailRows,
    toAnswerByCampaign,
    unwrittenRows,
  ] = await Promise.all([
    countNeedsAnswer(brandId),
    prisma.shopifyOrder.count({
      where: { campaignCreator: { campaign: { brandId } }, status: "draft_created" },
    }),
    prisma.contentPost.count({
      where: { brandId, hidden: false, rightsStatus: "none", createdAt: { gte: weekAgo } },
    }),
    prisma.contentPost.count({ where: { brandId, hidden: false, rightsStatus: "requested" } }),
    prisma.interventionCase.count({ where: { brandId, status: "open" } }),
    prisma.campaignCreator.count({
      where: { campaign: { brandId }, ...ADDRESS_TO_CHECK_WHERE },
    }),
    prisma.campaign.findMany({
      where: { brandId, status: { not: "archived" } },
      // Same order as the Campaigns page, newest first.
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { _count: { select: { campaignCreators: true } } },
    }),
    fetchHealthSnapshots(brandId),
    findOutreachWaitingToSend(brandId),
    findStuckCreators(brandId),
    prisma.campaignCreator.groupBy({
      by: ["campaignId"],
      where: { campaign: { brandId }, reviewStatus: "approved", lifecycleStatus: "ready" },
      _count: { _all: true },
    }),
    countNeedsAnswerByCampaign(brandId),
    // Not emailed yet and no email written: these need "Email them", not "Send them".
    prisma.campaignCreator.findMany({
      where: {
        campaign: { brandId, status: { in: ["draft", "active", "paused"] } },
        reviewStatus: "approved",
        lifecycleStatus: "ready",
        aiDrafts: { none: { type: "outreach", status: "draft" } },
      },
      select: { campaign: { select: { id: true, name: true } } },
    }),
  ]);
  const toEmailByCampaign = new Map(toEmailRows.map((r) => [r.campaignId, r._count._all]));

  const setupItems = await fetchSetupItems(brandId, campaigns.length > 0);
  const setupDone = setupItems.filter((i) => i.done).length;
  const showSetup = setupDone < setupItems.length;

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  // One row per campaign; the campaign name only shows when there's more than one.
  const outreachTodos: Todo[] = outreachWaiting.map((group) => {
    const where = outreachWaiting.length > 1 ? ` for ${group.campaignName}` : "";
    return {
      count: group.count,
      text: plural(
        group.count,
        `email${where} is written and waiting for you to send`,
        `emails${where} are written and waiting for you to send`,
      ),
      action: "Send them",
      href: `/campaigns/${group.campaignId}/outreach?written=1`,
    };
  });
  // Approved, not emailed, and nothing written yet: they need their first email.
  const unwrittenGroups = groupByCampaign(unwrittenRows);
  const unwrittenTodos: Todo[] = unwrittenGroups.map((group) => ({
    count: group.count,
    text: plural(
      group.count,
      `creator in ${group.campaignName} is approved and not emailed yet`,
      `creators in ${group.campaignName} are approved and not emailed yet`,
    ),
    action: "Email them",
    href: `/campaigns/${group.campaignId}/outreach`,
  }));

  const stuckGroups = groupByCampaign(stuckCreators);
  const now = daysAgo(0).getTime();
  const stuckTodos: Todo[] = stuckGroups.map((group) => {
    // Always name the campaign: the link opens that campaign, not every stuck creator.
    const where = ` in ${group.campaignName}`;
    // The real wait, from the quietest one, so "3 days" never hides 12.
    const oldest = Math.min(
      ...stuckCreators.filter((c) => c.campaign.id === group.campaignId).map((c) => new Date(c.updatedAt).getTime()),
    );
    const days = Math.max(STUCK_AFTER_DAYS, Math.floor((now - oldest) / 86_400_000));
    const span = group.count > 1 && days > STUCK_AFTER_DAYS ? `${STUCK_AFTER_DAYS} to ${days} days` : `${days} days`;
    return {
      count: group.count,
      text: plural(
        group.count,
        `creator${where} hasn't moved in ${span}`,
        `creators${where} haven't moved in ${span}`,
      ),
      action: "See who",
      href: `/campaigns/${group.campaignId}?filter=stuck#creators`,
    };
  });

  const todos: Todo[] = [
    {
      count: repliesToAnswer,
      text: plural(repliesToAnswer, "creator needs your answer", "creators need your answer"),
      action: "Open inbox",
      href: "/inbox",
    },
    ...outreachTodos,
    ...unwrittenTodos,
    {
      count: addressesToConfirm,
      text: plural(addressesToConfirm, "address to check", "addresses to check"),
      action: "Open inbox",
      href: "/inbox",
    },
    {
      count: draftOrders,
      text: plural(draftOrders, "gift order is ready to complete in Shopify", "gift orders are ready to complete in Shopify"),
      action: "See orders",
      href: "/orders",
    },
    ...stuckTodos,
    {
      count: newPosts,
      text: plural(newPosts, "new post tagged you this week", "new posts tagged you this week"),
      action: "See posts",
      href: "/content?tab=none&new=1",
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
      action: "See problems",
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

      {showSetup && (
        <section aria-labelledby="setup-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="setup-heading" className="text-lg font-semibold">
              Finish setting up
            </h2>
            <span className="text-sm text-muted-foreground">
              {setupDone} of {setupItems.length} done
            </span>
          </div>
          <ul className="divide-y rounded-xl border bg-card">
            {setupItems.map((item) => (
              <li key={item.text}>
                {item.done ? (
                  <div className="flex items-center gap-4 px-5 py-4 text-muted-foreground">
                    <CheckCircle2 className="size-5 text-green-700" aria-hidden />
                    <span className="flex-1 line-through decoration-muted-foreground/40">{item.text}</span>
                    <span className="sr-only">Done</span>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                  >
                    <Circle className="size-5 text-muted-foreground" aria-hidden />
                    <span className="flex-1">{item.text}</span>
                    <span className="flex items-center gap-1 text-sm font-medium">
                      {item.action}
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
              <li key={`${todo.href}|${todo.text}`}>
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
                  <span className="w-28 text-right text-sm">
                    {
                      campaignStatus(campaign.status, {
                        total: campaign._count.campaignCreators,
                        toEmail: toEmailByCampaign.get(campaign.id) ?? 0,
                        toAnswer: toAnswerByCampaign.get(campaign.id) ?? 0,
                      }).label
                    }
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
