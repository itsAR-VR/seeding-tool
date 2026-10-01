import { prisma } from "@/lib/prisma";
import { uploadMentionMedia } from "@/lib/supabase/storage";
import { syncContentForBrand } from "@/lib/content/sync";

function isArchived(url: string | null): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && supabaseUrl && url.startsWith(supabaseUrl));
}

async function copyPostMedia(postId: string): Promise<void> {
  const post = await prisma.contentPost.findUniqueOrThrow({ where: { id: postId } });
  const data: { mediaUrl?: string; thumbnailUrl?: string } = {};

  if (post.mediaUrl && !isArchived(post.mediaUrl)) {
    data.mediaUrl = await uploadMentionMedia(`post-${post.id}`, post.mediaUrl, post.brandId, "content");
  }
  if (post.thumbnailUrl && !isArchived(post.thumbnailUrl)) {
    data.thumbnailUrl = await uploadMentionMedia(
      `post-${post.id}-thumb`,
      post.thumbnailUrl,
      post.brandId,
      "content"
    );
  }
  if (Object.keys(data).length > 0) {
    await prisma.contentPost.update({ where: { id: post.id }, data });
  }
}

/**
 * Saves a permanent copy of a post's photo or video (Instagram's links expire
 * after a few days). If the stored link has already expired, pulls fresh
 * links from Instagram and tries once more.
 */
export async function archiveContentPost(postId: string): Promise<void> {
  try {
    await copyPostMedia(postId);
  } catch {
    const post = await prisma.contentPost.findUnique({
      where: { id: postId },
      select: { brandId: true },
    });
    if (!post) return;
    await syncContentForBrand(post.brandId);
    await copyPostMedia(postId);
  }
}
