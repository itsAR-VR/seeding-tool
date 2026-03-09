import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { log } from "@/lib/logger";

/**
 * Cloudinary media integration client.
 *
 * Initializes the Cloudinary SDK with env credentials and provides
 * helpers for uploading, optimizing, and deleting media assets.
 *
 * Default upload folder: seed-scale/mentions/
 */

// Configure Cloudinary SDK on module load
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const DEFAULT_FOLDER = "seed-scale/mentions";

export interface UploadOptions {
  folder?: string;
  publicId?: string;
  resourceType?: "image" | "video" | "raw" | "auto";
  tags?: string[];
  transformation?: Record<string, unknown>;
}

/**
 * Upload media from a URL to Cloudinary.
 *
 * Useful for archiving Instagram/social media posts where URLs may expire.
 *
 * @param url - Source media URL
 * @param options - Upload options (folder, publicId, resourceType, tags)
 * @returns Cloudinary upload response
 */
export async function uploadFromUrl(
  url: string,
  options?: UploadOptions
): Promise<UploadApiResponse> {
  const folder = options?.folder ?? DEFAULT_FOLDER;
  const resourceType = options?.resourceType ?? "auto";

  log("info", "cloudinary.upload_from_url", { url, folder, resourceType });

  try {
    const result = await cloudinary.uploader.upload(url, {
      folder,
      resource_type: resourceType,
      ...(options?.publicId ? { public_id: options.publicId } : {}),
      ...(options?.tags ? { tags: options.tags } : {}),
      ...(options?.transformation
        ? { transformation: options.transformation }
        : {}),
    });

    log("info", "cloudinary.upload_success", {
      publicId: result.public_id,
      url: result.secure_url,
      bytes: result.bytes,
    });

    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    log("error", "cloudinary.upload_failed", { url, error: errMsg });
    throw new Error(`Cloudinary upload failed: ${errMsg}`);
  }
}

/**
 * Generate an optimized delivery URL for a Cloudinary asset.
 *
 * @param publicId - The Cloudinary public ID
 * @param transforms - Optional transformations (width, height, crop, quality, format)
 * @returns Optimized URL string
 */
export function getOptimizedUrl(
  publicId: string,
  transforms?: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
    fetchFormat?: string;
  }
): string {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      {
        quality: transforms?.quality ?? "auto",
        fetch_format: transforms?.fetchFormat ?? transforms?.format ?? "auto",
        ...(transforms?.width ? { width: transforms.width } : {}),
        ...(transforms?.height ? { height: transforms.height } : {}),
        ...(transforms?.crop ? { crop: transforms.crop } : {}),
      },
    ],
  });
}

/**
 * Delete a Cloudinary asset by public ID.
 *
 * @param publicId - The Cloudinary public ID
 * @param resourceType - Type of resource (default: "image")
 */
export async function deleteAsset(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
): Promise<{ result: string }> {
  log("info", "cloudinary.delete", { publicId, resourceType });

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    log("info", "cloudinary.delete_result", { publicId, result: result.result });

    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    log("error", "cloudinary.delete_failed", { publicId, error: errMsg });
    throw new Error(`Cloudinary delete failed: ${errMsg}`);
  }
}

export { cloudinary };
