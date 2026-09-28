import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { getShopifyStoreDomain, shopifyAdminOrderUrl } from "@/lib/shopify/admin-links";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  draft_pending: "Preparing draft",
  draft_created: "Draft, waiting for you",
  draft_completing: "Completing",
  created: "Order placed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  error_needs_reconciliation: "Needs a look",
};

export default async function OrdersPage() {
  let brandId: string;
  try {
    brandId = (await getCurrentBrandMembership()).brandId;
  } catch (error) {
    if (error instanceof BrandAccessError) return null;
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
      },
      orderBy: { createdAt: "desc" },
    }),
    getShopifyStoreDomain(brandId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">Every gift order across your campaigns.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{orders.length} orders</CardTitle>
          <CardDescription>
            Drafts wait for you in Shopify. Complete one there to ship it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No orders yet. They appear here when a creator submits their address.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Creator</th>
                  <th className="pb-2 font-medium">Campaign</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Links</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const cc = order.campaignCreator;
                  const shopifyUrl = shopifyAdminOrderUrl(storeDomain, order);
                  return (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link href={`/creators/${cc.creator.id}`} className="font-medium hover:underline">
                          {cc.creator.name ?? cc.creator.instagramHandle ?? "Unknown"}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link href={`/campaigns/${cc.campaign.id}`} className="hover:underline">
                          {cc.campaign.name}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Badge variant="outline">{STATUS_LABELS[order.status] ?? order.status}</Badge>
                      </td>
                      <td className="space-x-4 py-2">
                        {shopifyUrl && (
                          <a href={shopifyUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            Open in Shopify ↗
                          </a>
                        )}
                        {cc.conversationThread && (
                          <Link href={`/inbox/${cc.conversationThread.id}`} className="text-blue-600 hover:underline">
                            Conversation →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
