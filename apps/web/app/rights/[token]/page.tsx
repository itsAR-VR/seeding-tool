import { prisma } from "@/lib/prisma";
import { DEFAULT_RIGHTS_MONTHS, rightsTerms } from "@/lib/content/rights";
import { isStoredCopy } from "@/lib/content/sync";
import { RightsForm, VideoUpload } from "./RightsForm";
import { PostPreview } from "./post-preview";

/**
 * The picture to show for a post: a stored copy first (it never expires), then
 * Instagram's link. A video's own file can't show as a picture, so videos use
 * their thumbnail only.
 */
function previewImage(post: { mediaType: string | null; mediaUrl: string | null; thumbnailUrl: string | null }) {
  const candidates = post.mediaType === "VIDEO" ? [post.thumbnailUrl] : [post.mediaUrl, post.thumbnailUrl];
  const urls = candidates.filter((url): url is string => Boolean(url));
  return urls.find(isStoredCopy) ?? urls[0] ?? null;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RightsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const post = await prisma.contentPost.findUnique({
    where: { rightsToken: token },
    include: { brand: { select: { name: true, logoUrl: true } } },
  });

  const brandName = post?.brand.name ?? "the brand";
  const image = post ? previewImage(post) : null;
  // When there's nothing to approve, the reason is the heading (same as the claim page).
  const closed = !post
    ? { title: "This link isn't active", body: "Please ask the brand that sent it for a new one." }
    : post.rightsStatus === "approved"
      ? {
          title: "You already approved this post",
          body:
            post.mediaType === "VIDEO" && !post.mediaUrl
              ? "Thank you! One more thing below, if you can."
              : "Thank you! There's nothing left to do here.",
        }
      : post.rightsStatus === "declined"
        ? { title: "Thanks for letting us know", body: "We won't use this post." }
        : null;

  return (
    <main className="min-h-screen bg-muted px-4 py-8 text-foreground">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[2rem] border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
          {post?.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.brand.logoUrl} alt={brandName} className="h-8 w-auto" />
          ) : (
            <p className="text-xl font-semibold">{post?.brand.name ?? ""}</p>
          )}
          {closed ? (
            <>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">{closed.title}</h1>
              <p className="mt-3 text-base leading-7 text-foreground/80">{closed.body}</p>
              {post?.rightsStatus === "approved" && post.mediaType === "VIDEO" && !post.mediaUrl && (
                <div className="mt-5">
                  <VideoUpload token={token} />
                </div>
              )}
            </>
          ) : !post ? null : (
            <>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">Share your post with us</h1>
              <PostPreview src={image} />
              {post.permalink && (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex min-h-11 items-center text-sm text-muted-foreground underline"
                >
                  View post on Instagram
                </a>
              )}
              <div className="mt-6 space-y-3 text-sm leading-6 text-foreground/80">
                {rightsTerms(brandName, post.rightsMonths ?? DEFAULT_RIGHTS_MONTHS).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div className="mt-6">
                <RightsForm token={token} askForVideo={post.mediaType === "VIDEO" && !post.mediaUrl} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
