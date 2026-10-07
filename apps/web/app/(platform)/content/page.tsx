import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { NoCompanyNotice } from "@/components/no-company-notice";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { formatDate } from "@/lib/format/date";
import { Card, CardContent } from "@/components/ui/card";
import { rightsEndDate } from "@/lib/content/rights";
import { getBrandKit } from "@/lib/brand/kit";
import { SyncContent } from "./sync-content";
import { PostThumbnail } from "./post-thumbnail";
import { pickPostMedia } from "./post-media";
import { isStoredCopy } from "@/lib/content/sync";
import { RightsAction } from "./rights-action";
import { AdAction, PartnershipCodeAction } from "./ad-action";

const RIGHTS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  none: { label: "No rights yet", tone: "neutral" },
  requested: { label: "Rights requested", tone: "waiting" },
  approved: { label: "Rights approved", tone: "good" },
  declined: { label: "Declined", tone: "problem" },
};

const SOURCE_LABELS: Record<string, string> = {
  story: "Story",
  mention: "Caption mention",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "none", label: "No rights yet" },
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; new?: string }>;
}) {
  let brandId: string;
  try {
    brandId = (await getCurrentBrandMembership()).brandId;
  } catch (error) {
    if (error instanceof BrandAccessError) return <NoCompanyNotice title="Content" />;
    throw error;
  }

  const { tab: rawTab, new: onlyNew } = await searchParams;
  // ?new=1 narrows to the last 7 days, matching the "new posts this week" count on Home.
  const since = onlyNew ? daysAgo(7) : null;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "all";

  const kit = await getBrandKit(brandId);
  const adDefaults = {
    message: kit?.adDefaultText ?? "",
    headline: kit?.adDefaultHeadline ?? "",
    link: kit?.adDefaultLink ?? "",
  };

  const [posts, counts] = await Promise.all([
    prisma.contentPost.findMany({
      where: {
        brandId,
        hidden: false,
        ...(tab === "all" ? {} : { rightsStatus: tab }),
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { postedAt: "desc" },
      take: 200,
    }),
    prisma.contentPost.groupBy({
      by: ["rightsStatus"],
      where: { brandId, hidden: false, ...(since ? { createdAt: { gte: since } } : {}) },
      _count: true,
    }),
  ]);

  const countFor = (key: TabKey) =>
    key === "all"
      ? counts.reduce((sum, c) => sum + c._count, 0)
      : (counts.find((c) => c.rightsStatus === key)?._count ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content</h1>
          <p className="text-muted-foreground">Posts, reels, and stories that tag or mention you on Instagram.</p>
        </div>
        <SyncContent />
      </div>

      {since && (
        <p className="text-sm text-muted-foreground">
          Showing posts from the last 7 days.{" "}
          <Link
            href={tab === "all" ? "/content" : `/content?tab=${tab}`}
            className="font-medium text-foreground underline"
          >
            Show all
          </Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/content?${new URLSearchParams({
              ...(t.key === "all" ? {} : { tab: t.key }),
              ...(since ? { new: "1" } : {}),
            })}`}
            aria-label={`${t.label}: ${countFor(t.key)}`}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm md:min-h-9 md:px-3 ${
              tab === t.key ? "bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            {t.label} <span className="font-semibold tabular-nums opacity-80">{countFor(t.key)}</span>
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No posts here yet. When someone tags you on Instagram, the post shows up here. If you
            haven&apos;t yet,{" "}
            <Link href="/settings/connections" className="font-medium text-foreground underline">
              connect Instagram in Settings &gt; Connections
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post, index) => {
            const media = pickPostMedia(post, isStoredCopy);
            const rights = RIGHTS_LABELS[post.rightsStatus] ?? RIGHTS_LABELS.none;
            return (
              <Card key={post.id} className="overflow-hidden">
                <a
                  href={post.permalink ?? post.mediaUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open this ${post.mediaType === "VIDEO" ? "video" : "post"} on Instagram`}
                  className="relative block aspect-square bg-muted"
                >
                  <PostThumbnail
                    image={media.image}
                    video={media.video}
                    mediaType={post.mediaType ?? null}
                    source={post.source}
                    caption={post.caption}
                    handle={post.username}
                    index={index}
                  />
                  {(post.mediaType === "VIDEO" || post.source !== "tag") && (
                    <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-sm text-white">
                      {SOURCE_LABELS[post.source] ?? "Video"}
                    </span>
                  )}
                </a>
                <CardContent className="space-y-2 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    {post.creator ? (
                      <Link href={`/creators/${post.creator.id}`} className="truncate font-medium hover:underline">
                        @{post.username}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">@{post.username ?? "unknown"}</span>
                    )}
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatDate(post.postedAt)}
                    </span>
                  </div>
                  <StatusPill tone={rights.tone}>{rights.label}</StatusPill>
                  {post.rightsStatus === "approved" && (
                    <p className="text-sm text-muted-foreground">
                      By {post.rightsSignerName}
                      {(() => {
                        const end = rightsEndDate(post.rightsRespondedAt, post.rightsMonths);
                        return end
                          ? ` · until ${formatDate(end)}`
                          : " · no end date";
                      })()}
                    </p>
                  )}
                  {post.mediaUrl && (post.rightsStatus === "approved" || post.source === "story") && (
                    <a
                      href={post.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-11 items-center text-sm font-medium underline md:min-h-0"
                    >
                      Download {post.mediaType === "IMAGE" ? "photo" : "file"}
                    </a>
                  )}
                  {post.metaAdId ? (
                    <Link href="/ads" className="flex min-h-11 items-center text-sm font-medium underline md:min-h-0">
                      {post.metaAdKind === "partnership" ? "Partnership ad" : "Paused ad"} created · See ads
                    </Link>
                  ) : (
                    <>
                      {post.rightsStatus === "approved" && (
                        <>
                          <AdAction postId={post.id} defaults={adDefaults} />
                          <PartnershipCodeAction postId={post.id} />
                        </>
                      )}
                    </>
                  )}
                  {(post.rightsStatus === "none" || post.rightsStatus === "requested") && (
                    <RightsAction postId={post.id} status={post.rightsStatus} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
