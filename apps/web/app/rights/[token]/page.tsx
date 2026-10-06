import { prisma } from "@/lib/prisma";
import { DEFAULT_RIGHTS_MONTHS, rightsTerms } from "@/lib/content/rights";
import { RightsForm, VideoUpload } from "./RightsForm";

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
  const image = post?.mediaType === "VIDEO" ? post.thumbnailUrl : post?.mediaUrl;

  return (
    <main className="min-h-screen bg-[#f8f3ec] px-4 py-8 text-neutral-950">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
          {post?.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.brand.logoUrl} alt={brandName} className="h-8 w-auto" />
          ) : (
            <p className="text-xl font-semibold">{post?.brand.name ?? ""}</p>
          )}
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Share your post with us</h1>

          {!post ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <p className="text-sm leading-6">
                This link isn&apos;t active. Please ask the {brandName} team for a new one.
              </p>
            </div>
          ) : post.rightsStatus === "approved" ? (
            <div className="mt-4 space-y-5">
              <p className="text-sm leading-6 text-neutral-700">
                Thank you! You already approved this post.
              </p>
              {post.mediaType === "VIDEO" && !post.mediaUrl && <VideoUpload token={token} />}
            </div>
          ) : post.rightsStatus === "declined" ? (
            <p className="mt-4 text-sm leading-6 text-neutral-700">
              Thanks for letting us know. We won&apos;t use this post.
            </p>
          ) : (
            <>
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt="Your post"
                  className="mt-6 aspect-square w-full rounded-3xl object-cover"
                />
              )}
              {post.permalink && (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex min-h-11 items-center text-sm text-neutral-600 underline"
                >
                  View post on Instagram
                </a>
              )}
              <div className="mt-6 space-y-3 text-sm leading-6 text-neutral-700">
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
