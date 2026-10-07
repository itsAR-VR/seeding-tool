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
import { STAGE_GROUPS, countStageGroups, groupForFilter } from "./_components/stage-groups";
import {
  CREATOR_FILTERS,
  countCampaignCreators,
  isCreatorFilterKey,
  postCountsByCreator,
} from "@/lib/stats/campaign-counts";
import {
  DISPLAY_STAGE_ORDER,
  STAGE_DISPLAY,
  STAGE_HELP,
  displayStage,
  stageNextStep,
  type DisplayStage,
} from "@/lib/stats/stage-display";
import { findOutreachWaitingToSend, findStuckCreators } from "@/lib/stats/needs-you";

/**
 * The Address link column: the copy-link button only once they've said yes
 * and we're waiting on an address (or need a new one after a cancelled order),
 * "Address received" once it's in, and a quiet dash otherwise.
 */
function addressLinkNote(stage: DisplayStage): string | null {
  switch (stage) {
    case "said_yes":
    case "order_cancelled":
      return null;
    // Before a yes, or not going ahead: nothing to do here yet, so the column stays quiet.
    case "needs_review":
    case "maybe_later":
    case "ready":
    case "emailed":
    case "needs_answer":
    case "replied":
    case "not_a_fit":
    case "said_no":
    case "not_now":
      return "–";
    case "address_to_check":
    case "address_in":
    case "order_made":
    case "shipped":
    case "delivered":
    case "posted":
    case "done":
      return "Address received";
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
  // ?filter= opens one of the four chip groups. Older keys (a single stage,
  // pending, to_email, ...) map to their group. "stuck" (from Home) and
  // "approved" have no group and keep filtering exactly as before.
  const groupFilter = groupForFilter(filter);
  const legacyFilter = !groupFilter && isCreatorFilterKey(filter) ? filter : null;

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
            aiDrafts: { where: { type: "outreach", status: "draft" }, select: { id: true }, take: 1 },
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

  // Each creator is at exactly one stage today (lib/stats creatorStage, split
  // by lib/stats/stage-display), so the chips add up to everyone and a chip's
  // number always matches the list it opens. Cumulative "so far" numbers live
  // on Results only.
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
    return { ...countable, stage: displayStage(countable) };
  });
  // Rows go in chip order (Needs you, Waiting, Done, Said no or not a fit), then by
  // stage within each, so people at the same step sit together.
  const stageRank = new Map(
    STAGE_GROUPS.flatMap((g) => g.stages).map((stage, index) => [stage, index] as const),
  );
  const filteredCreators = groupFilter
    ? creators.filter((cc) => groupFilter.stages.includes(cc.stage))
    : legacyFilter
      ? creators.filter(CREATOR_FILTERS[legacyFilter].match)
      : creators;
  const visibleCreators = [...filteredCreators].sort(
    (a, b) => (stageRank.get(a.stage) ?? 99) - (stageRank.get(b.stage) ?? 99),
  );
  const activeFilterLabel = groupFilter
    ? groupFilter.label
    : legacyFilter
      ? CREATOR_FILTERS[legacyFilter].label
      : null;
  const counts = countCampaignCreators(creators);
  const groupCounts = countStageGroups(creators.map((cc) => cc.stage));
  const groupChips = STAGE_GROUPS.filter(
    (g) => g.always || groupCounts[g.key] > 0 || g.key === groupFilter?.key,
  ).map((g) => ({ key: g.key, label: g.label, value: groupCounts[g.key] }));
  const filterHref = (key: string | null) =>
    key ? `/campaigns/${campaignId}?filter=${key}#creators` : `/campaigns/${campaignId}#creators`;
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

      {/* Where everyone is now: four groups that add up to All. */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <nav aria-label="Filter creators by where they are now" className="flex flex-wrap gap-2">
            {[{ key: null, label: "All", value: counts.total }, ...groupChips].map((chip) => {
              const selected = chip.key === (groupFilter?.key ?? null) && !legacyFilter;
              return (
                <Link
                  key={chip.label}
                  href={filterHref(chip.key)}
                  scroll={false}
                  aria-current={selected ? "true" : undefined}
                  aria-label={`${chip.label}: ${chip.value}`}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    selected ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted"
                  }`}
                >
                  {chip.label} <span className="ml-1 font-semibold tabular-nums">{chip.value}</span>
                </Link>
              );
            })}
          </nav>
          {(counts.stuck > 0 || legacyFilter === "stuck") && (
            <Link
              href={filterHref("stuck")}
              scroll={false}
              aria-current={legacyFilter === "stuck" ? "true" : undefined}
              className={`text-sm underline-offset-2 hover:underline ${
                legacyFilter === "stuck" ? "font-semibold text-foreground underline" : "text-blue-600"
              }`}
            >
              {CREATOR_FILTERS.stuck.label} ({counts.stuck})
            </Link>
          )}
        </div>
        <details className="group text-sm">
          <summary className="w-fit cursor-pointer text-blue-600 underline-offset-2 hover:underline">
            What do these mean?
          </summary>
          <div className="mt-3 space-y-4 rounded-xl border bg-card p-5">
            {STAGE_GROUPS.map((g) => (
              <div key={g.key} className="space-y-2">
                <h3 className="font-semibold">{g.label}</h3>
                <dl className="space-y-2">
                  {DISPLAY_STAGE_ORDER.filter(({ stage }) => g.stages.includes(stage)).map(({ stage }) => (
                    <div key={stage} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <dt>
                        <StatusPill tone={STAGE_DISPLAY[stage].tone}>{STAGE_DISPLAY[stage].label}</StatusPill>
                      </dt>
                      <dd className="text-muted-foreground">{STAGE_HELP[stage]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Creator List */}
      <Card id="creators">
        <CardHeader>
          <CardTitle className="text-base">
            Creators{activeFilterLabel ? ` · ${activeFilterLabel}` : ""}
          </CardTitle>
          <CardDescription>
            {activeFilterLabel ? (
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
                    const status = STAGE_DISPLAY[cc.stage];
                    const next = stageNextStep(cc.stage, {
                      campaignId,
                      campaignCreatorId: cc.id,
                      threadId: cc.conversationThread?.id ?? null,
                      hasWrittenEmail: cc.aiDrafts.length > 0,
                    });
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
                            {profile?.followerCount?.toLocaleString() ?? (
                              <span className="text-muted-foreground" aria-label="Unknown">
                                –
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-3">
                          <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        </td>
                        <td className="py-3">
                          {next?.href ? (
                            <Link href={next.href} className="text-blue-600 hover:underline">
                              {next.label}
                            </Link>
                          ) : next ? (
                            <span className="text-muted-foreground">{next.label}</span>
                          ) : (
                            <span className="text-muted-foreground" aria-label="No next step">
                              –
                            </span>
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
                              label={cc.stage === "order_cancelled" ? "Copy a new address link" : undefined}
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
