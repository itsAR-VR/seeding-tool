import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TriggerSearchButton } from "./_components/TriggerSearchButton";
import { GiftClaimLinkButton } from "./_components/GiftClaimLinkButton";

/** One plain status per creator, combining review and progress. */
function creatorStatus(c: { reviewStatus: string; lifecycleStatus: string }): { label: string; tone: string } {
  if (c.reviewStatus === "pending") return { label: "Needs review", tone: "bg-amber-100 text-amber-900" };
  if (c.reviewStatus === "declined") return { label: "Not a fit", tone: "bg-slate-100 text-slate-700" };
  if (c.reviewStatus === "deferred") return { label: "Maybe later", tone: "bg-slate-100 text-slate-700" };
  const byStep: Record<string, { label: string; tone: string }> = {
    ready: { label: "Ready to email", tone: "bg-slate-100 text-slate-800" },
    outreach_sent: { label: "Emailed", tone: "bg-blue-100 text-blue-900" },
    replied: { label: "Replied", tone: "bg-purple-100 text-purple-900" },
    address_review: { label: "Address to check", tone: "bg-amber-100 text-amber-900" },
    address_confirmed: { label: "Address in", tone: "bg-green-100 text-green-900" },
    order_created: { label: "Order made", tone: "bg-teal-100 text-teal-900" },
    shipped: { label: "Shipped", tone: "bg-indigo-100 text-indigo-900" },
    delivered: { label: "Delivered", tone: "bg-emerald-100 text-emerald-900" },
    posted: { label: "Posted", tone: "bg-pink-100 text-pink-900" },
    completed: { label: "Done", tone: "bg-green-200 text-green-950" },
    opted_out: { label: "Said no", tone: "bg-red-100 text-red-900" },
    stalled: { label: "Not right now", tone: "bg-slate-100 text-slate-700" },
  };
  return byStep[c.lifecycleStatus] ?? { label: c.lifecycleStatus.replace(/_/g, " "), tone: "bg-slate-100 text-slate-800" };
}

type PageProps = {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ filter?: string }>;
};

/** Stat-box filters for the creator list. Keys match the ?filter= query value. */
const CREATOR_FILTERS: Record<string, { label: string; match: (c: { reviewStatus: string; lifecycleStatus: string }) => boolean }> = {
  pending: { label: "Needs review", match: (c) => c.reviewStatus === "pending" },
  approved: { label: "Approved", match: (c) => c.reviewStatus === "approved" },
  declined: { label: "Not a fit", match: (c) => c.reviewStatus === "declined" },
  to_email: {
    label: "Ready to email",
    match: (c) => c.reviewStatus === "approved" && c.lifecycleStatus === "ready",
  },
  emailed: {
    label: "Emailed",
    match: (c) => c.reviewStatus === "approved" && c.lifecycleStatus !== "ready",
  },
  replied: { label: "Replied", match: (c) => c.lifecycleStatus === "replied" },
  address_review: { label: "Address to check", match: (c) => c.lifecycleStatus === "address_review" },
  address_confirmed: { label: "Address in", match: (c) => c.lifecycleStatus === "address_confirmed" },
};

export default async function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { campaignId } = await params;
  const { filter } = await searchParams;
  const activeFilter = filter && CREATOR_FILTERS[filter] ? filter : null;

  let membership;
  try {
    membership = await getCurrentBrandMembership();
  } catch (error) {
    if (error instanceof BrandAccessError) return notFound();
    return null;
  }

  const [campaign, brandSetup] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
      include: {
        campaignProducts: {
          include: { product: true },
        },
        campaignCreators: {
          include: {
            creator: { include: { profiles: true } },
            conversationThread: { select: { id: true } },
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
  ]);

  if (!campaign) return notFound();

  const creators = campaign.campaignCreators;
  const visibleCreators = activeFilter
    ? creators.filter(CREATOR_FILTERS[activeFilter].match)
    : creators;
  const stats = {
    total: creators.length,
    pendingReview: creators.filter((c) => c.reviewStatus === "pending").length,
    approved: creators.filter((c) => c.reviewStatus === "approved").length,
    toEmail: creators.filter((c) => c.reviewStatus === "approved" && c.lifecycleStatus === "ready").length,
    declined: creators.filter((c) => c.reviewStatus === "declined").length,
    outreachSent: creators.filter(
      (c) => c.lifecycleStatus !== "ready" && c.reviewStatus === "approved"
    ).length,
    replied: creators.filter((c) => c.lifecycleStatus === "replied").length,
    addressReview: creators.filter((c) => c.lifecycleStatus === "address_review").length,
    addressConfirmed: creators.filter(
      (c) => c.lifecycleStatus === "address_confirmed"
    ).length,
  };

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
    stats.approved === 0
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {campaign.name}
            </h1>
            <Badge
              className={
                campaign.status === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }
            >
              {({ draft: "Not started", active: "Sending", paused: "Paused", completed: "Finished", archived: "Archived" } as Record<string, string>)[campaign.status] ?? campaign.status}
            </Badge>
          </div>
          {campaign.description && (
            <p className="mt-1 text-muted-foreground">
              {campaign.description}
            </p>
          )}
        </div>
        <nav aria-label="Campaign" className="flex flex-wrap items-center gap-2">
          {stats.pendingReview > 0 && (
            <Link href={`/campaigns/${campaignId}/review`}>
              <Button size="sm">Review {stats.pendingReview} new creators</Button>
            </Link>
          )}
          <Link href={`/campaigns/${campaignId}/orders`}>
            <Button variant="outline">Orders</Button>
          </Link>
          <Link href={`/campaigns/${campaignId}/mentions`}>
            <Button variant="outline">Posts</Button>
          </Link>
          <Link href={`/campaigns/${campaignId}/analytics`}>
            <Button variant="outline">Results</Button>
          </Link>
          <Link href={`/campaigns/${campaignId}/seed-list`}>
            <Button variant="outline">Shareable list</Button>
          </Link>
          <TriggerSearchButton campaignId={campaignId} />
        </nav>
      </div>

      {outreachBlockers.length === 0 ? (
        <Link
          href={`/campaigns/${campaignId}/outreach`}
          className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 transition-colors hover:bg-green-100"
        >
          <span className="font-medium">
            {stats.toEmail > 0
              ? `${stats.toEmail} creator${stats.toEmail === 1 ? " is" : "s are"} ready to email`
              : "Everyone approved has been emailed"}
          </span>
          <span className="text-green-800">
            {campaign.campaignProducts.length} product{campaign.campaignProducts.length === 1 ? "" : "s"} ·{" "}
            {hasEmailSender ? "Gmail" : "Instagram DMs"} connected
          </span>
          <span className="ml-auto font-medium">Email creators →</span>
        </Link>
      ) : (
      <Card
        className={
          outreachBlockers.length > 0
            ? "border-amber-200 bg-amber-50"
            : "border-green-200 bg-green-50"
        }
      >
        <CardHeader>
          <CardTitle className="text-base">Finish setup before emailing</CardTitle>
          <CardDescription>
            You need a product, at least one approved creator, and a connected email account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                label: "Products attached",
                href: `/campaigns/${campaignId}/products`,
                ready: hasCampaignProducts,
                helper: hasCampaignProducts
                  ? `${campaign.campaignProducts.length} product${campaign.campaignProducts.length === 1 ? "" : "s"} linked`
                  : "No products attached yet",
              },
              {
                label: "Approved creators",
                href: stats.approved > 0 ? `/campaigns/${campaignId}/outreach` : `/campaigns/${campaignId}/review`,
                ready: stats.approved > 0,
                helper:
                  stats.approved > 0
                    ? `${stats.approved} creator${stats.approved === 1 ? "" : "s"} ready for outreach`
                    : "No approved creators yet",
              },
              {
                label: "Send channels",
                href: "/settings/connections",
                ready: hasAnyOutreachChannel,
                helper: hasAnyOutreachChannel
                  ? [
                      hasEmailSender ? "Gmail" : null,
                      hasDmSender ? "Instagram DMs" : null,
                    ]
                      .filter(Boolean)
                      .join(" + ")
                  : "Connect Gmail to email creators",
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="block rounded-lg border bg-white p-4 transition-colors hover:border-foreground/30 hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  <Badge variant={item.ready ? "default" : "secondary"}>
                    {item.ready ? "Ready" : "Needs setup"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.helper} →</p>
              </Link>
            ))}
          </div>

          {outreachBlockers.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-900">Fix these before outreach:</p>
              <div className="flex flex-wrap gap-2">
                {outreachBlockers.map((blocker) => (
                  <Link key={blocker.label} href={blocker.href}>
                    <Button variant="outline" size="sm">
                      {blocker.cta}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-green-900">
              This campaign has the minimum setup needed for draft generation and sending.
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Progress: one row, each step filters the list below */}
      <nav aria-label="Filter creators by step" className="flex flex-wrap gap-2">
        {[
          { label: "All", value: stats.total, filter: null },
          { label: "Ready to email", value: stats.toEmail, filter: "to_email" },
          { label: "Emailed", value: stats.outreachSent, filter: "emailed" },
          { label: "Replied", value: stats.replied, filter: "replied" },
          { label: "Address to check", value: stats.addressReview, filter: "address_review" },
          { label: "Address in", value: stats.addressConfirmed, filter: "address_confirmed" },
          ...(stats.pendingReview > 0 ? [{ label: "Needs review", value: stats.pendingReview, filter: "pending" }] : []),
          ...(stats.declined > 0 ? [{ label: "Not a fit", value: stats.declined, filter: "declined" }] : []),
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
          <Link href={`/campaigns/${campaignId}/products`}>
            <Button variant="outline" size="sm">
              {campaign.campaignProducts.length > 0
                ? "Change product"
                : "Add a product"}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {campaign.campaignProducts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {campaign.campaignProducts.map((cp) => (
                <Badge key={cp.id} variant="outline">
                  {cp.product.name}
                  {cp.product.retailValue
                    ? ` ($${(cp.product.retailValue / 100).toFixed(2)})`
                    : ""}
                </Badge>
              ))}
            </div>
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
                <Link href={`/campaigns/${campaignId}/discover`}>
                  <Button size="sm">Find creators</Button>
                </Link>
                <Link href={`/campaigns/${campaignId}/import`}>
                  <Button size="sm" variant="outline">Add from a list</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Creator</th>
                    <th className="pb-2 font-medium">Followers</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Next step</th>
                    <th className="pb-2 font-medium">Address link</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCreators.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
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
                        <td className="py-3 tabular-nums">
                          {profile?.followerCount?.toLocaleString() ?? <span className="text-muted-foreground">Unknown</span>}
                        </td>
                        <td className="py-3">
                          <Badge className={status.tone}>{status.label}</Badge>
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
