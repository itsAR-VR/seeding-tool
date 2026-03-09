import { prisma } from "@/lib/prisma";
import { getShopifyClient } from "./client";

interface ShopifyImage {
  id: number;
  src: string;
}

interface ShopifyVariantRaw {
  id: number;
  title: string;
  price: string;
  sku: string | null;
  inventory_quantity: number | null;
  image_id: number | null;
}

interface ShopifyProductRaw {
  id: number;
  title: string;
  body_html: string | null;
  handle: string | null;
  product_type: string | null;
  status: string;
  image: { src: string } | null;
  images: ShopifyImage[];
  variants: ShopifyVariantRaw[];
}

interface ShopifyProductsResponse {
  products: ShopifyProductRaw[];
}

/** Flat variant for UI consumption */
export interface FlatProduct {
  id: string;
  shopifyId: string;
  title: string;
  description: string | null;
  handle: string | null;
  productType: string | null;
  imageUrl: string | null;
  status: string;
  variants: FlatVariant[];
  syncedAt: Date;
}

export interface FlatVariant {
  id: string;
  shopifyVariantId: string;
  title: string;
  price: string;
  sku: string | null;
  inventoryQuantity: number | null;
  imageUrl: string | null;
}

/**
 * Fetch all products from the connected Shopify store and upsert into DB.
 * Paginates via Shopify's link-header pagination.
 */
export async function syncProducts(brandId: string): Promise<{ synced: number }> {
  const client = await getShopifyClient(brandId);

  let allProducts: ShopifyProductRaw[] = [];
  let nextPageUrl: string | null = "/products.json?limit=250&status=active";

  while (nextPageUrl) {
    const res = await client.fetch(nextPageUrl);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch products: ${text}`);
    }

    const data = (await res.json()) as ShopifyProductsResponse;
    allProducts = allProducts.concat(data.products || []);

    // Parse Link header for pagination
    const linkHeader = res.headers.get("link");
    nextPageUrl = parseLinkNext(linkHeader);
  }

  const now = new Date();

  // Upsert each product and its variants
  for (const raw of allProducts) {
    const shopifyId = String(raw.id);
    const imageUrl = raw.image?.src || null;

    const product = await prisma.shopifyProduct.upsert({
      where: { brandId_shopifyId: { brandId, shopifyId } },
      create: {
        shopifyId,
        title: raw.title,
        description: stripHtml(raw.body_html),
        handle: raw.handle,
        productType: raw.product_type,
        imageUrl,
        status: raw.status || "active",
        brandId,
        syncedAt: now,
      },
      update: {
        title: raw.title,
        description: stripHtml(raw.body_html),
        handle: raw.handle,
        productType: raw.product_type,
        imageUrl,
        status: raw.status || "active",
        syncedAt: now,
      },
    });

    // Build image map for variant images
    const imageMap = new Map<number, string>();
    for (const img of raw.images || []) {
      imageMap.set(img.id, img.src);
    }

    // Upsert variants
    for (const v of raw.variants || []) {
      const shopifyVariantId = String(v.id);
      const variantImage = v.image_id ? imageMap.get(v.image_id) || null : null;

      await prisma.shopifyVariant.upsert({
        where: {
          productId_shopifyVariantId: {
            productId: product.id,
            shopifyVariantId,
          },
        },
        create: {
          shopifyVariantId,
          title: v.title,
          price: v.price,
          sku: v.sku,
          inventoryQuantity: v.inventory_quantity,
          imageUrl: variantImage,
          productId: product.id,
        },
        update: {
          title: v.title,
          price: v.price,
          sku: v.sku,
          inventoryQuantity: v.inventory_quantity,
          imageUrl: variantImage,
        },
      });
    }

    // Remove variants that no longer exist in Shopify
    const currentVariantIds = new Set(
      raw.variants.map((v) => String(v.id))
    );
    const dbVariants = await prisma.shopifyVariant.findMany({
      where: { productId: product.id },
      select: { id: true, shopifyVariantId: true },
    });
    const staleVariantIds = dbVariants
      .filter((v) => !currentVariantIds.has(v.shopifyVariantId))
      .map((v) => v.id);
    if (staleVariantIds.length > 0) {
      await prisma.shopifyVariant.deleteMany({
        where: { id: { in: staleVariantIds } },
      });
    }
  }

  // Remove products that no longer exist in Shopify
  const currentShopifyIds = new Set(allProducts.map((p) => String(p.id)));
  const dbProducts = await prisma.shopifyProduct.findMany({
    where: { brandId },
    select: { id: true, shopifyId: true },
  });
  const staleProductIds = dbProducts
    .filter((p) => !currentShopifyIds.has(p.shopifyId))
    .map((p) => p.id);
  if (staleProductIds.length > 0) {
    await prisma.shopifyProduct.deleteMany({
      where: { id: { in: staleProductIds } },
    });
  }

  return { synced: allProducts.length };
}

/**
 * Get synced products for a brand, flattened for UI.
 */
export async function getProducts(brandId: string): Promise<FlatProduct[]> {
  const products = await prisma.shopifyProduct.findMany({
    where: { brandId },
    include: { variants: true },
    orderBy: { title: "asc" },
  });

  return products.map((p) => ({
    id: p.id,
    shopifyId: p.shopifyId,
    title: p.title,
    description: p.description,
    handle: p.handle,
    productType: p.productType,
    imageUrl: p.imageUrl,
    status: p.status,
    syncedAt: p.syncedAt,
    variants: p.variants.map((v) => ({
      id: v.id,
      shopifyVariantId: v.shopifyVariantId,
      title: v.title,
      price: v.price,
      sku: v.sku,
      inventoryQuantity: v.inventoryQuantity,
      imageUrl: v.imageUrl,
    })),
  }));
}

/** Parse Shopify Link header to get next page URL (relative path). */
function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) {
      try {
        const url = new URL(match[1]);
        return url.pathname.replace(/^\/admin\/api\/[^/]+/, "") + url.search;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Strip HTML tags for clean descriptions. */
function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
