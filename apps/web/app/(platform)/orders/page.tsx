import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { getShopifyStoreDomain, shopifyAdminOrderUrl } from "@/lib/shopify/admin-links";
import { OrdersTable, type OrderTableRow } from "./_components/orders-table";

export default async function OrdersPage() {
  let brandId: string;
  try {
    brandId = (await getCurrentBrandMembership()).brandId;
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return (
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t find your company. Sign out and back in, or ask your team owner for an invite.
          </p>
        </div>
      );
    }
    throw error;
  }

  const [orders, storeDomain] = await Promise.all([
    prisma.shopifyOrder.findMany({
      where: { campaignCreator: { campaign: { brandId } } },
      include: {
        campaignCreator: {
          include: {
            creator: { select: { id: true, name: true, instagramHandle: true } },
            campaign: { select: { id: true, name: true } },
            conversationThread: { select: { id: true } },
          },
        },
        fulfillmentEvents: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { carrier: true, trackingNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getShopifyStoreDomain(brandId),
  ]);

  const rows: OrderTableRow[] = orders.map((order) => {
    const cc = order.campaignCreator;
    return {
      id: order.id,
      status: order.status,
      shopifyOrderId: order.shopifyOrderId,
      shopifyOrderNumber: order.shopifyOrderNumber,
      shopifyDraftOrderId: order.shopifyDraftOrderId,
      shopifyDraftOrderName: order.shopifyDraftOrderName,
      createdAt: order.createdAt,
      adminUrl: shopifyAdminOrderUrl(storeDomain, order),
      creator: { id: cc.creator.id, name: cc.creator.name ?? cc.creator.instagramHandle ?? "Unnamed creator" },
      campaign: cc.campaign,
      tracking: order.fulfillmentEvents[0] ?? null,
      conversationId: cc.conversationThread?.id ?? null,
    };
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="mt-1 text-muted-foreground">
          Every gift order across your campaigns. Drafts wait for you in Shopify; complete one there to ship it.
        </p>
      </header>

      <section aria-labelledby="orders-heading" className="space-y-3">
        <h2 id="orders-heading" className="text-lg font-semibold">
          {rows.length} {rows.length === 1 ? "order" : "orders"}
        </h2>
        {rows.length === 0 ? (
          <div className="space-y-2 rounded-xl border bg-card p-5">
            <p className="text-muted-foreground">No orders yet. They appear here when a creator sends their address.</p>
            {!storeDomain && (
              <p>
                Gift orders are made in Shopify.{" "}
                <Link href="/settings/connections" className="font-medium underline">
                  Connect Shopify in Settings &gt; Connections
                </Link>{" "}
                before your first creator says yes.
              </p>
            )}
          </div>
        ) : (
          <OrdersTable orders={rows} showCampaign />
        )}
      </section>
    </div>
  );
}
