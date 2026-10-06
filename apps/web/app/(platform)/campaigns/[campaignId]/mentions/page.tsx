import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { resolveProviderCredential } from "@/lib/integrations/state";
import { loadCampaignPosts, type CampaignPost } from "../_components/campaign-posts";
import { AddPostForm } from "./components/add-post-form";
import { formatDate } from "@/lib/format/date";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

const KIND_LABELS: Record<string, string> = {
  post: "post",
  story: "story",
  reel: "reel",
  video: "video",
};

/** "Tagged you on Instagram" / "Reel on TikTok, added by hand" */
function postDescription(post: CampaignPost): string {
  const where = PLATFORM_LABELS[post.platform] ?? "social media";
  if (post.source === "tagged") return `Tagged you on ${where}`;
  const kind = post.kind ? (KIND_LABELS[post.kind] ?? "post") : "post";
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} on ${where}, added by hand`;
}

export default async function CampaignPostsPage({ params }: PageProps) {
  const { campaignId } = await params;

  let brandId: string;
  try {
    brandId = (await getCurrentBrandMembership()).brandId;
  } catch (error) {
    if (error instanceof BrandAccessError) notFound();
    throw error;
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId },
    select: {
      id: true,
      campaignCreators: {
        select: { id: true, creator: { select: { name: true, email: true, instagramHandle: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!campaign) notFound();

  const [posts, instagram] = await Promise.all([
    loadCampaignPosts(brandId, campaignId),
    resolveProviderCredential(brandId, "instagram"),
  ]);

  const creatorOptions = campaign.campaignCreators.map((cc) => ({
    id: cc.id,
    name:
      cc.creator.name ||
      (cc.creator.instagramHandle ? `@${cc.creator.instagramHandle}` : null) ||
      cc.creator.email ||
      "Unnamed creator",
  }));

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Posts</h2>
        <p className="mt-1 text-muted-foreground">
          Posts this campaign&apos;s creators made about your gift.
        </p>
      </header>

      <AddPostForm creators={creatorOptions} />

      <section aria-labelledby="posts-heading" className="space-y-3">
        <h2 id="posts-heading" className="text-lg font-semibold">
          {posts.length === 1 ? "1 post" : `${posts.length} posts`}
        </h2>

        {posts.length === 0 ? (
          <div className="rounded-xl border bg-card p-5">
            {instagram.connected ? (
              <p>No posts from this campaign&apos;s creators yet. They show up here when a creator tags you.</p>
            ) : (
              <p>
                No posts yet. Connect Instagram so posts that tag you show up here on their own.{" "}
                <Link href="/settings/connections" className="font-medium underline">
                  Connect Instagram
                </Link>
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {posts.map((post) => (
              <li key={post.key} className="flex items-start gap-4 px-5 py-4">
                <a
                  href={post.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block size-16 shrink-0 overflow-hidden rounded-lg bg-muted"
                  aria-label="Open the post"
                >
                  {post.imageUrl && post.isVideoFile ? (
                    <video
                      src={post.imageUrl}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No photo
                    </span>
                  )}
                </a>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {post.creatorId ? (
                      <Link href={`/creators/${post.creatorId}`} className="font-medium hover:underline">
                        {post.handle ? `@${post.handle}` : (post.creatorName ?? "Unnamed creator")}
                      </Link>
                    ) : (
                      <span className="font-medium">
                        {post.handle ? `@${post.handle}` : "Unnamed creator"}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">{formatDate(post.date)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{postDescription(post)}</p>
                  {post.caption && <p className="line-clamp-2 text-sm">{post.caption}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-sm font-medium">
                  {post.url && (
                    <a href={post.url} target="_blank" rel="noreferrer" className="hover:underline">
                      Open post ↗
                    </a>
                  )}
                  {post.source === "tagged" && (
                    <Link href="/content" className="hover:underline">
                      See in Content
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
