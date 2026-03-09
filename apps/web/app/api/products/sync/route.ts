import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { syncProducts, getProducts } from "@/lib/shopify/products";
import { updateShopifyConnectionStatus } from "@/lib/shopify/status";

async function getCurrentBrandId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) throw new Error("Unauthorized");

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) throw new Error("User not found");

  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) throw new Error("No brand found");
  return membership.brandId;
}

/**
 * GET /api/products/sync — List synced Shopify products for the current brand.
 */
export async function GET() {
  try {
    const brandId = await getCurrentBrandId();
    const products = await getProducts(brandId);
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch products";
    const status = message === "Unauthorized" ? 401 : message === "No brand found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/products/sync — Trigger a product sync from Shopify.
 */
export async function POST() {
  try {
    const brandId = await getCurrentBrandId();
    const result = await syncProducts(brandId);
    await updateShopifyConnectionStatus(brandId, {
      lastSyncAt: new Date().toISOString(),
      lastSyncError: null,
      lastSyncedCount: result.synced,
      truncated: result.truncated,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product sync failed";
    try {
      const brandId = await getCurrentBrandId();
      await updateShopifyConnectionStatus(brandId, {
        lastSyncAt: new Date().toISOString(),
        lastSyncError: message,
        lastSyncedCount: null,
        truncated: null,
      });
    } catch {
      // ignore status update failures
    }
    const status = message === "Unauthorized" ? 401 : 500;
    console.error("[products/sync/POST]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
