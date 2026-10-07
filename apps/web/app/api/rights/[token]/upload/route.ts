import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createMediaUploadUrl,
  getMentionMediaUrl,
  mediaFileExists,
} from "@/lib/supabase/storage";

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** Upload path for a creator's original file. Fixed per post so retries overwrite. */
function uploadPath(brandId: string, postId: string, ext: string): string {
  return `${brandId}/content/original-${postId}.${ext}`;
}

async function findApprovedPost(token: string) {
  return prisma.contentPost.findFirst({
    where: { rightsToken: token, rightsStatus: "approved" },
    select: { id: true, brandId: true },
  });
}

/**
 * POST /api/rights/:token/upload — after approving, a creator can send the
 * original video (Instagram hides the file for reels with licensed music).
 * Body: { contentType } → returns a one-time upload URL.
 * Body: { done: true, contentType } → records the uploaded file on the post.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    contentType?: unknown;
    done?: unknown;
  };
  const ext = typeof body.contentType === "string" ? VIDEO_TYPES[body.contentType] : undefined;
  if (!ext) {
    return NextResponse.json({ error: "Please choose an MP4 or MOV video" }, { status: 400 });
  }

  const post = await findApprovedPost(token);
  if (!post) {
    return NextResponse.json({ error: "This link is no longer active" }, { status: 410 });
  }
  const path = uploadPath(post.brandId, post.id, ext);

  if (body.done === true) {
    if (!(await mediaFileExists(path))) {
      return NextResponse.json({ error: "We didn't receive the file. Please try again." }, { status: 400 });
    }
    await prisma.contentPost.update({
      where: { id: post.id },
      data: { mediaUrl: getMentionMediaUrl(path) },
    });
    return NextResponse.json({ ok: true });
  }

  const upload = await createMediaUploadUrl(path);
  return NextResponse.json({ path: upload.path, token: upload.token });
}
