import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BrandAccessError, getCurrentBrandMembership } from "@/lib/integrations/brand-access";
import { STUCK_AFTER_DAYS } from "@/lib/stats/campaign-counts";
import { findStuckCreators } from "@/lib/stats/needs-you";
import { STAGE_DISPLAY, type DisplayStage } from "@/lib/stats/stage-display";
import { StatusPill } from "@/components/status-pill";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { ProblemsList } from "./_components/problems-list";

/** Most rows a section loads, so a long backlog never slows the page. */
const MAX_ROWS = 50;

/** Stored step to the status words used everywhere else (lib/stats/stage-display). */
const PROGRESS_STAGES: Record<string, DisplayStage> = {
  ready: "ready",
  outreach_sent: "emailed",
  replied: "replied",
  address_review: "address_to_check",
  address_confirmed: "address_in",
  order_created: "order_made",
  shipped: "shipped",
  delivered: "delivered",
  stalled: "not_now",
};

function progressLabel(lifecycleStatus: string): string {
  const stage = PROGRESS_STAGES[lifecycleStatus];
  return stage ? STAGE_DISPLAY[stage].label : lifecycleStatus.replace(/_/g, " ");
}

const PROVIDER_NAMES: Record<string, string> = {
  gmail: "Gmail",
  shopify: "Shopify",
  instagram: "Instagram",
  meta: "Instagram",
  unipile: "Instagram messages",
};

function providerName(provider: string): string {
  return PROVIDER_NAMES[provider.toLowerCase()] ?? provider;
}

function creatorName(creator: { name: string | null; instagramHandle: string | null }): string {
  if (creator.name) return creator.name;
  if (creator.instagramHandle) return `@${creator.instagramHandle.replace(/^@/, "")}`;
  return "Unnamed creator";
}

/**
 * Problems: the detail page behind Home's "problems need a look" row.
 * Open problems come first, then creators with no progress (the same query
 * Home uses, so the numbers match), then updates from Gmail, Shopify, or
 * Instagram that failed, shown only when there are some. This replaced the
 * old System status page (/admin/health), which now redirects here.
 */
export default async function ProblemsPage() {
  let membership;
  try {
    membership = await getCurrentBrandMembership();
  } catch (error) {
    if (error instanceof BrandAccessError && error.status !== 401) redirect("/onboarding");
    redirect("/login");
  }
  const brandId = membership.brandId;
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [stuckCreators, failedUpdates] = await Promise.all([
    findStuckCreators(brandId, { now }),
    prisma.webhookEvent.findMany({
      where: { brandId, status: "failed", createdAt: { gte: dayAgo } },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    }),
  ]);
  const shownStuck = stuckCreators.slice(0, MAX_ROWS);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Problems</h1>
        <p className="mt-1 text-muted-foreground">
          Things the tool couldn&apos;t handle on its own. Sort each one out, then mark it resolved. Your
          to-do list is on{" "}
          <Link href="/dashboard" className="font-medium text-foreground underline">
            Home
          </Link>
          .
        </p>
      </header>

      <section aria-labelledby="open-problems" className="space-y-3">
        <h2 id="open-problems" className="text-lg font-semibold">
          Open problems
        </h2>
        <ProblemsList />
      </section>

      <section aria-labelledby="stuck-creators" className="space-y-3">
        <div>
          <h2 id="stuck-creators" className="text-lg font-semibold">
            Stuck creators
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No progress for {STUCK_AFTER_DAYS} days in a campaign that&apos;s sending. Anyone with a reply to
            answer, an address to check, or an order to finish is on Home instead.
          </p>
        </div>
        {stuckCreators.length === 0 ? (
          <p className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-5">
            <StatusPill tone="good">All clear</StatusPill>
            <span>Every creator has moved recently.</span>
          </p>
        ) : (
          <div className="rounded-xl border bg-card p-5">
            <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <StatusPill tone="waiting">{stuckCreators.length} stuck</StatusPill>
              {stuckCreators.length > shownStuck.length && (
                <span className="text-muted-foreground">Showing the {shownStuck.length} who have waited longest.</span>
              )}
            </p>
            <ul className="divide-y">
              {shownStuck.map((cc) => (
                <li key={cc.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{creatorName(cc.creator)}</span>
                    <span className="block text-muted-foreground">
                      {progressLabel(cc.lifecycleStatus)}, last change{" "}
                      {formatDate(cc.updatedAt)}
                    </span>
                  </span>
                  <Link
                    href={`/campaigns/${cc.campaign.id}?filter=stuck#creators`}
                    className="inline-flex min-h-11 items-center font-medium underline"
                  >
                    Open {cc.campaign.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {failedUpdates.length > 0 && (
        <section aria-labelledby="failed-updates" className="space-y-3">
          <div>
            <h2 id="failed-updates" className="text-lg font-semibold">
              Updates that failed in the last day
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Messages from Gmail, Shopify, or Instagram the tool couldn&apos;t process. If this keeps happening,
              email us.
            </p>
          </div>
          <ul className="divide-y rounded-xl border bg-card px-5">
            {failedUpdates.map((wh) => (
              <li key={wh.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{providerName(wh.provider)}</span>
                  <span className="block truncate text-muted-foreground" title={wh.error ?? undefined}>
                    {wh.error || "No details"}
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground">{formatDateTime(wh.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
