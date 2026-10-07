import { prisma } from "@/lib/prisma";

/** The brand's connected Shopify store domain (e.g. my-store.myshopify.com), if any. */
export async function getShopifyStoreDomain(brandId: string): Promise<string | null> {
  const connection = await prisma.brandConnection.findFirst({
    where: { brandId, provider: "shopify", status: "connected" },
    select: { externalId: true },
  });
  return connection?.externalId ?? null;
}

/** Link to an order, or its draft if not completed yet, in Shopify admin. */
export function shopifyAdminOrderUrl(
  storeDomain: string | null,
  order: { shopifyOrderId: string | null; shopifyDraftOrderId: string | null }
): string | null {
  if (!storeDomain) return null;
  if (order.shopifyOrderId) return `https://${storeDomain}/admin/orders/${order.shopifyOrderId}`;
  if (order.shopifyDraftOrderId && !order.shopifyDraftOrderId.startsWith("pending:")) {
    return `https://${storeDomain}/admin/draft_orders/${order.shopifyDraftOrderId}`;
  }
  return null;
}
