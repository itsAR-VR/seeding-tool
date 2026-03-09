import "server-only";

import { createClient } from "@supabase/supabase-js";
import { log } from "@/lib/logger";

/**
 * Supabase admin client for storage operations.
 *
 * Uses service role key for server-side uploads (bypasses RLS).
 * Do NOT expose this client to the browser.
 */
function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

const BUCKET = "mention-media";

/**
 * Ensure the mention-media bucket exists. Creates it if missing.
 * Safe to call multiple times (idempotent).
 */
async function ensureBucket(): Promise<void> {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.getBucket(BUCKET);

  if (data) return; // bucket exists

  if (error && error.message?.includes("not found")) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 100 * 1024 * 1024, // 100 MB (videos can be large)
    });

    if (createError) {
      throw new Error(`Failed to create bucket "${BUCKET}": ${createError.message}`);
    }

    log("info", "supabase.storage.bucket_created", { bucket: BUCKET });
    return;
  }

  if (error) {
    throw new Error(`Failed to check bucket "${BUCKET}": ${error.message}`);
  }
}

/**
 * Infer file extension from a URL or content-type header.
 */
function inferExtension(url: string, contentType?: string | null): string {
  // Try content-type first
  if (contentType) {
    const map: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
    };
    const ext = map[contentType.split(";")[0].trim().toLowerCase()];
    if (ext) return ext;
  }

  // Try URL path
  const urlPath = new URL(url).pathname;
  const match = urlPath.match(/\.(\w{2,5})$/);
  if (match) return match[1].toLowerCase();

  // Default
  return "jpg";
}

/**
 * Build the storage path for a mention media file.
 *
 * Format: {brandId}/{campaignId}/{mentionAssetId}.{ext}
 */
function buildPath(
  brandId: string,
  campaignId: string,
  mentionAssetId: string,
  ext: string
): string {
  return `${brandId}/${campaignId}/${mentionAssetId}.${ext}`;
}

/**
 * Upload mention media from a URL to Supabase Storage.
 *
 * Downloads the media, then uploads it to the mention-media bucket.
 *
 * @param mentionAssetId - Unique ID for the mention asset
 * @param mediaUrl - Source URL to download from
 * @param brandId - Brand ID for path organization
 * @param campaignId - Campaign ID for path organization
 * @returns Public URL of the uploaded file
 */
export async function uploadMentionMedia(
  mentionAssetId: string,
  mediaUrl: string,
  brandId: string,
  campaignId: string
): Promise<string> {
  log("info", "supabase.storage.upload_start", {
    mentionAssetId,
    mediaUrl,
    brandId,
    campaignId,
  });

  // Download the media
  const response = await fetch(mediaUrl, {
    headers: {
      "User-Agent": "SeedScale/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download media from ${mediaUrl}: ${response.status} ${response.statusText}`
    );
  }

  const contentType = response.headers.get("content-type");
  const ext = inferExtension(mediaUrl, contentType);
  const filePath = buildPath(brandId, campaignId, mentionAssetId, ext);

  const buffer = Buffer.from(await response.arrayBuffer());

  // Ensure bucket exists
  await ensureBucket();

  const supabase = getStorageClient();

  // Upload (upsert to handle retries)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: contentType ?? `image/${ext}`,
      upsert: true,
    });

  if (error) {
    throw new Error(
      `Supabase storage upload failed for ${filePath}: ${error.message}`
    );
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  log("info", "supabase.storage.upload_success", {
    mentionAssetId,
    filePath,
    publicUrl,
    bytes: buffer.length,
  });

  return publicUrl;
}

/**
 * Get the public URL for a stored mention media file.
 */
export function getMentionMediaUrl(path: string): string {
  const supabase = getStorageClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

/**
 * Delete a mention media file from storage.
 */
export async function deleteMentionMedia(path: string): Promise<void> {
  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    log("warn", "supabase.storage.delete_failed", { path, error: error.message });
    throw new Error(`Failed to delete ${path}: ${error.message}`);
  }

  log("info", "supabase.storage.delete_success", { path });
}
