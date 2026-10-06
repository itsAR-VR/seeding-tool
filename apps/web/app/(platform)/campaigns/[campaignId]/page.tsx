import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { buttonVariants } from "@/components/ui/button-variants";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import { StatusPill } from "@/components/status-pill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GiftClaimLinkButton } from "./_components/GiftClaimLinkButton";
import { campaignNextStep } from "./_components/next-step";
import { loadCampaignPosts } from "./_components/campaign-posts";
import {
  CREATOR_FILTERS,
  STAGE_LABELS,
  countCampaignCreators,
  creatorStage,
  isCreatorFilterKey,
  postCountsByCreator,
  type CreatorStage,
} from "@/lib/stats/campaign-counts";
import { findOutreachWaitingToSend, findStuckCreators } from "@/lib/stats/needs-you";

/** Stages where nobody is waiting on anyone. */
const NOTHING_TO_DO: ReadonlySet<CreatorStage> = new Set(["said_no", "not_a_fit", "maybe_later", "not_now", "done"]);

/**
 * The Address link column: the copy-link button only while we're waiting on
 * an address (or need a new one after a cancelled order). Otherwise one word on why not.
 */
function addressLinkNote(stage: CreatorStage): string | null {
  switch (stage) {
    case "emailed":
    case "replied":
    case "order_cancelled":
      return null;
    case "needs_review":
      return "After review";
    case "ready":
      return "After you email them";
    case "not_a_fit":
    case "maybe_later":
      return "Not needed";
    case "said_no":
      return "Said no";
    case "not_now":
      return "Not right now";
    case "address_to_check":
    case "address_in":
    case "order_made":
    case "shipped":
    case "delivered":
    case "posted":
    case "done":
      return "Address in";
    default: {
      const unhandled: never = stage;
      return unhandled;
    }
  }
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

  const [campaign, brandSetup, stuckCreators, outreachWaiting, draftOrders, posts] = await Promise.all([
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
            shopifyOrder: { select: { status: true } },
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
    // Same list as the Posts tab, so "Posted" here matches it.
    loadCampaignPosts(membership.brandId, campaignId),
  ]);

  if (!campaign) return notFound();

  // Counts and filters share one definition (lib/stats/campaign-counts), so a
  // chip's number always matches the list it opens. Step chips are "ever
  // reached": Emailed counts everyone emailed, even if they've replied since.
  // Each creator's status comes from lib/stats creatorStage: stored status,
  // reply, gift order, and posts together.
  const stuckIds = new Set(stuckCreators.map((s) => s.id));
  const postCounts = postCountsByCreator(posts);
  const creators = campaign.campaignCreators.map((cc) => {
    const countable = {
      ...cc,
      latestMessageDirection: cc.conversationThread?.messages[0]?.direction ?? null,
      stuck: stuckIds.has(cc.id),
      orderStatus: cc.shopifyOrder?.status ?? null,
      postCount: postCounts.get(cc.creatorId) ?? 0,
    };
    return { ...countable, stage: creatorStage(countable) };
  });
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
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
            <CheckCircle2 className="size-5 text-green-700" aria-hidden />
            <p className="flex-1">Nothing to do right now. New replies and orders will show up here.</p>
            <Link
              href={`/campaigns/${campaignId}/discover`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Find more creators
            </Link>
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
          { label: CREATOR_FILTERS.order_made.label, value: counts.order_made, filter: "order_made" },
          { label: CREATOR_FILTERS.posted.label, value: counts.posted, filter: "posted" },
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
          ...(counts.order_cancelled > 0
            ? [{ label: CREATOR_FILTERS.order_cancelled.label, value: counts.order_cancelled, filter: "order_cancelled" }]
            : []),
          ...(counts.said_no > 0 ? [{ label: CREATOR_FILTERS.said_no.label, value: counts.said_no, filter: "said_no" }] : []),
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
                    const status = STAGE_LABELS[cc.stage];
                    const addressNote = addressLinkNote(cc.stage);
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
                          ) : NOTHING_TO_DO.has(cc.stage) ? (
                            <span className="text-muted-foreground">Nothing to do</span>
                          ) : (
                            <span className="text-muted-foreground">Waiting on them</span>
                          )}
                        </td>
                        <td className="py-3">
                          {addressNote ? (
                            <span className="text-muted-foreground">{addressNote}</span>
                          ) : (
                            <GiftClaimLinkButton
                              campaignId={campaignId}
                              creatorId={cc.creatorId}
                              disabled={!hasCampaignProducts}
                            />
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
