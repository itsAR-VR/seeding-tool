import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { buttonVariants } from "@/components/ui/button";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GiftClaimLinkButton } from "./_components/GiftClaimLinkButton";
import { campaignNextStep } from "./_components/next-step";
import { CREATOR_FILTERS, countCampaignCreators, isCreatorFilterKey } from "@/lib/stats/campaign-counts";
import { findOutreachWaitingToSend, findStuckCreators } from "@/lib/stats/needs-you";

type CreatorPill = { label: string; tone: StatusTone };

const BY_STEP: Record<string, CreatorPill> = {
  ready: { label: "Ready to email", tone: "neutral" },
  outreach_sent: { label: "Emailed", tone: "good" },
  replied: { label: "Replied", tone: "good" },
  address_review: { label: "Address to check", tone: "waiting" },
  address_confirmed: { label: "Address in", tone: "good" },
  order_created: { label: "Order made", tone: "good" },
  shipped: { label: "Shipped", tone: "good" },
  delivered: { label: "Delivered", tone: "good" },
  posted: { label: "Posted", tone: "good" },
  completed: { label: "Done", tone: "good" },
  opted_out: { label: "Said no", tone: "neutral" },
  stalled: { label: "Not right now", tone: "neutral" },
};

/** One plain status per creator, combining review and progress. */
function creatorStatus(c: { reviewStatus: string; lifecycleStatus: string }): CreatorPill {
  if (c.reviewStatus === "pending") return { label: "Needs review", tone: "waiting" };
  if (c.reviewStatus === "declined") return { label: "Not a fit", tone: "neutral" };
  if (c.reviewStatus === "deferred") return { label: "Maybe later", tone: "neutral" };
  return BY_STEP[c.lifecycleStatus] ?? { label: c.lifecycleStatus.replace(/_/g, " "), tone: "neutral" };
}

type PageProps = {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export default async function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { campaignId } = await params;
  const { filter } = await searchParams;
  const activeFilter = isCreatorFilterKey(filter) ? filter : null;

  let membership;
  try {
    membership = await getCurrentBrandMembership();
  } catch (error) {
    if (error instanceof BrandAccessError) return notFound();
    return null;
  }

  const [campaign, brandSetup, stuckCreators, outreachWaiting, draftOrders] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
      include: {
        campaignProducts: {
          include: { product: true },
        },
        campaignCreators: {
          include: {
            creator: { include: { profiles: true } },
            conversationThread: {
              select: {
                id: true,
                messages: { orderBy: { createdAt: "desc" }, take: 1, select: { direction: true } },
              },
            },
            shippingSnapshots: { select: { isActive: true, confirmedAt: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.brand.findUnique({
      where: { id: membership.brandId },
      select: {
        emailAliases: {
          where: {
            isPrimary: true,
            isPaused: false,
          },
          select: { id: true },
          take: 1,
        },
        connections: {
          where: {
            provider: "unipile",
            status: "connected",
          },
          select: {
            id: true,
            provider: true,
          },
        },
      },
    }),
    findStuckCreators(membership.brandId, { campaignId }),
    findOutreachWaitingToSend(membership.brandId),
    prisma.shopifyOrder.count({
      where: { campaignCreator: { campaignId, campaign: { brandId: membership.brandId } }, status: "draft_created" },
    }),
  ]);

  if (!campaign) return notFound();

  // Counts and filters share one definition (lib/stats/campaign-counts), so a
  // chip's number always matches the list it opens. Step chips are "ever
  // reached": Emailed counts everyone emailed, even if they've replied since.
  const stuckIds = new Set(stuckCreators.map((s) => s.id));
  const creators = campaign.campaignCreators.map((cc) => ({
    ...cc,
    latestMessageDirection: cc.conversationThread?.messages[0]?.direction ?? null,
    stuck: stuckIds.has(cc.id),
  }));
  const visibleCreators = activeFilter
    ? creators.filter(CREATOR_FILTERS[activeFilter].match)
    : creators;
  const counts = countCampaignCreators(creators);
  const writtenEmailsWaiting = outreachWaiting.find((g) => g.campaignId === campaignId)?.count ?? 0;

  const hasCampaignProducts = campaign.campaignProducts.length > 0;
  const hasEmailSender = Boolean(brandSetup?.emailAliases.length);
  const hasDmSender = Boolean(
    brandSetup?.connections.some((connection) => connection.provider === "unipile")
  );
  const hasAnyOutreachChannel = hasEmailSender || hasDmSender;
  const outreachBlockers = [
    !hasCampaignProducts
      ? {
          label: "Attach at least one product",
          href: `/campaigns/${campaignId}/products`,
          cta: "Add products",
        }
      : null,
    counts.approved === 0
      ? {
          label: "Approve at least one creator before drafting outreach",
          href: `/campaigns/${campaignId}/review`,
          cta: "Open review queue",
        }
      : null,
    !hasAnyOutreachChannel
      ? {
          label: "Connect Gmail in Settings > Connections so you can email creators",
          href: "/settings/connections",
          cta: "Connect Gmail",
        }
      : null,
  ].filter(
    (value): value is { label: string; href: string; cta: string } => Boolean(value)
  );

  const nextStep = campaignNextStep({
    campaignId,
    needsAnswer: counts.needs_answer,
    writtenEmailsWaiting,
    readyToEmail: counts.to_email,
    addressesToCheck: counts.address_review,
    draftOrders,
    pendingReview: counts.pending,
    totalCreators: counts.total,
  });
  // Only show a column when at least one creator has something in it.
  const showFollowers = creators.some((cc) => cc.creator.profiles[0]?.followerCount != null);
  const columnCount = showFollowers ? 5 : 4;

  return (
    <div className="space-y-8">
      <section aria-labelledby="next-step-heading">
        <h2 id="next-step-heading" className="sr-only">
          Next step
        </h2>
        {nextStep ? (
          <Link href={nextStep.href} className={buttonVariants({ size: "lg", className: "h-11 gap-2 px-5 text-base" })}>
            {nextStep.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border bg-card p-5">
            <CheckCircle2 className="size-5 text-green-700" aria-hidden />
            <p>Nothing to do right now. New replies and orders will show up here.</p>
          </div>
        )}
      </section>

      {outreachBlockers.length > 0 && counts.total > 0 && (
        <section
          aria-labelledby="setup-heading"
          className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        >
          <h2 id="setup-heading" className="font-semibold">
            Finish setup before emailing
          </h2>
          <ul className="space-y-2">
            {outreachBlockers.map((blocker) => (
              <li key={blocker.label} className="flex flex-wrap items-center justify-between gap-3">
                <span>{blocker.label}</span>
                <Link href={blocker.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {blocker.cta}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Progress: one row, each step filters the list below */}
      <nav aria-label="Filter creators by step" className="flex flex-wrap gap-2">
        {[
          { label: "All", value: counts.total, filter: null },
          { label: CREATOR_FILTERS.to_email.label, value: counts.to_email, filter: "to_email" },
          { label: CREATOR_FILTERS.emailed.label, value: counts.emailed, filter: "emailed" },
          { label: CREATOR_FILTERS.replied.label, value: counts.replied, filter: "replied" },
          { label: CREATOR_FILTERS.address_in.label, value: counts.address_in, filter: "address_in" },
          // To-do chips: only shown when there's something to do.
          ...(counts.needs_answer > 0
            ? [{ label: CREATOR_FILTERS.needs_answer.label, value: counts.needs_answer, filter: "needs_answer" }]
            : []),
          ...(counts.address_review > 0
            ? [{ label: CREATOR_FILTERS.address_review.label, value: counts.address_review, filter: "address_review" }]
            : []),
          ...(counts.stuck > 0 ? [{ label: CREATOR_FILTERS.stuck.label, value: counts.stuck, filter: "stuck" }] : []),
          ...(counts.pending > 0 ? [{ label: CREATOR_FILTERS.pending.label, value: counts.pending, filter: "pending" }] : []),
          ...(counts.declined > 0 ? [{ label: CREATOR_FILTERS.declined.label, value: counts.declined, filter: "declined" }] : []),
        ].map((step) => {
          const selected = (step.filter ?? null) === activeFilter;
          return (
            <Link
              key={step.label}
              href={step.filter ? `/campaigns/${campaignId}?filter=${step.filter}#creators` : `/campaigns/${campaignId}#creators`}
              scroll={false}
              aria-current={selected ? "true" : undefined}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                selected ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted"
              }`}
            >
              {step.label} <span className="ml-1 font-semibold tabular-nums">{step.value}</span>
            </Link>
          );
        })}
      </nav>

      {/* Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Products</CardTitle>
          <Link href={`/campaigns/${campaignId}/products`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {campaign.campaignProducts.length > 0 ? "Change product" : "Add a product"}
          </Link>
        </CardHeader>
        <CardContent>
          {campaign.campaignProducts.length > 0 ? (
            <ul className="space-y-1">
              {campaign.campaignProducts.map((cp) => (
                <li key={cp.id}>
                  {cp.product.name}
                  {cp.product.retailValue ? (
                    <span className="text-muted-foreground"> (${(cp.product.retailValue / 100).toFixed(2)})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No products yet. Pick the product you are gifting. If the list is empty, connect Shopify in Settings &gt; Connections first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Creator List */}
      <Card id="creators">
        <CardHeader>
          <CardTitle className="text-base">
            Creators{activeFilter ? ` · ${CREATOR_FILTERS[activeFilter].label}` : ""}
          </CardTitle>
          <CardDescription>
            {activeFilter ? (
              <>
                Showing {visibleCreators.length} of {creators.length}.{" "}
                <Link href={`/campaigns/${campaignId}#creators`} scroll={false} className="text-blue-600 hover:underline">
                  Show all
                </Link>
              </>
            ) : (
              `${creators.length} creator${creators.length !== 1 ? "s" : ""} in this campaign`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {creators.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No creators added yet.
              </p>
              <div className="flex gap-2">
                <Link href={`/campaigns/${campaignId}/discover`} className={buttonVariants({ size: "sm" })}>
                  Find creators
                </Link>
                <Link
                  href={`/campaigns/${campaignId}/import`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Add from a list
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Creator</th>
                    {showFollowers && <th className="pb-2 font-medium">Followers</th>}
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Next step</th>
                    <th className="pb-2 font-medium">Address link</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCreators.length === 0 && (
                    <tr>
                      <td colSpan={columnCount} className="py-6 text-center text-muted-foreground">
                        No creators at this step right now.{" "}
                        <Link href={`/campaigns/${campaignId}#creators`} scroll={false} className="text-blue-600 hover:underline">
                          Show everyone
                        </Link>
                      </td>
                    </tr>
                  )}
                  {visibleCreators.map((cc) => {
                    const profile = cc.creator.profiles[0];
                    const status = creatorStatus(cc);
                    const pastFirstEmail =
                      cc.reviewStatus === "approved" && !["ready", "opted_out"].includes(cc.lifecycleStatus);
                    return (
                      <tr key={cc.id} className="border-b last:border-0">
                        <td className="py-3">
                          <Link href={`/creators/${cc.creatorId}`} className="font-medium hover:underline">
                            {cc.creator.name ?? "Unknown"}
                          </Link>
                          {(profile || cc.creator.instagramHandle) && (
                            <div className="text-muted-foreground">
                              <InstagramHandleLink
                                handle={profile?.handle ?? cc.creator.instagramHandle ?? ""}
                                url={profile?.url}
                                className="hover:text-foreground hover:underline"
                              />
                            </div>
                          )}
                        </td>
                        {showFollowers && (
                          <td className="py-3 tabular-nums">
                            {profile?.followerCount?.toLocaleString() ?? <span className="text-muted-foreground">Unknown</span>}
                          </td>
                        )}
                        <td className="py-3">
                          <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        </td>
                        <td className="py-3">
                          {cc.conversationThread ? (
                            <Link
                              href={`/inbox/${cc.conversationThread.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              Open conversation
                            </Link>
                          ) : cc.reviewStatus === "approved" && cc.lifecycleStatus === "ready" ? (
                            <Link
                              href={`/campaigns/${campaignId}/outreach?select=${cc.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              Email them
                            </Link>
                          ) : cc.reviewStatus === "pending" ? (
                            <Link
                              href={`/campaigns/${campaignId}/review`}
                              className="text-blue-600 hover:underline"
                            >
                              Review
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Waiting on them</span>
                          )}
                        </td>
                        <td className="py-3">
                          {pastFirstEmail ? (
                            <GiftClaimLinkButton
                              campaignId={campaignId}
                              creatorId={cc.creatorId}
                              disabled={!hasCampaignProducts}
                            />
                          ) : (
                            <span className="text-muted-foreground">After you email them</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
