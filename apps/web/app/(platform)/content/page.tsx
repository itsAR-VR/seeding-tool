import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SyncContent } from "./sync-content";

const RIGHTS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  none: { label: "No rights yet", variant: "outline" },
  requested: { label: "Rights requested", variant: "secondary" },
  approved: { label: "Rights approved", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
};

const TABS = [
  { key: "all", label: "All" },
  { key: "none", label: "No rights yet" },
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  let brandId: string;
  try {
    brandId = (await getCurrentBrandMembership()).brandId;
  } catch (error) {
    if (error instanceof BrandAccessError) return null;
    throw error;
  }

  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "all";

  const [posts, counts] = await Promise.all([
    prisma.contentPost.findMany({
      where: { brandId, hidden: false, ...(tab === "all" ? {} : { rightsStatus: tab }) },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { postedAt: "desc" },
      take: 200,
    }),
    prisma.contentPost.groupBy({
      by: ["rightsStatus"],
      where: { brandId, hidden: false },
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
          <p className="text-muted-foreground">Posts that tag you on Instagram.</p>
        </div>
        <SyncContent />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/content" : `/content?tab=${t.key}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              tab === t.key ? "bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            {t.label} <span className="opacity-70">{countFor(t.key)}</span>
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No posts here yet. When someone tags you in a post, it shows up here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {posts.map((post) => {
            const image = post.mediaType === "VIDEO" ? post.thumbnailUrl : post.mediaUrl;
            const rights = RIGHTS_LABELS[post.rightsStatus] ?? RIGHTS_LABELS.none;
            return (
              <Card key={post.id} className="overflow-hidden">
                <a
                  href={post.permalink ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block aspect-square bg-muted"
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Open on Instagram
                    </span>
                  )}
                  {post.mediaType === "VIDEO" && (
                    <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                      Video
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
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {post.postedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ♥ {post.likes ?? 0} · 💬 {post.comments ?? 0}
                    {post.creator ? " · Your creator" : ""}
                  </p>
                  <Badge variant={rights.variant}>{rights.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
