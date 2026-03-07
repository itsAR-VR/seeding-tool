"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OrderRow = {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string | null;
  status: string;
  createdAt: string;
  campaignCreator: {
    id: string;
    lifecycleStatus: string;
    creator: {
      name: string | null;
      email: string | null;
    };
  };
  fulfillmentEvents: {
    trackingNumber: string | null;
    carrier: string | null;
    status: string;
  }[];
};

type EligibleCreator = {
  id: string;
  creatorId: string;
  lifecycleStatus: string;
  creator: {
    name: string | null;
    email: string | null;
  };
};

const statusColors: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  processing: "bg-yellow-100 text-yellow-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function OrdersPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [eligible, setEligible] = useState<EligibleCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [campaignId]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch creators to build order list and eligible list
      const creatorsRes = await fetch(
        `/api/campaigns/${campaignId}/creators`
      );
      if (!creatorsRes.ok) throw new Error("Failed to fetch creators");
      const creators = (await creatorsRes.json()) as Array<{
        id: string;
        creatorId: string;
        lifecycleStatus: string;
        creator: { name: string | null; email: string | null };
        shopifyOrder: OrderRow | null;
      }>;

      // Build orders from creators that have them
      const orderRows: OrderRow[] = [];
      const eligibleRows: EligibleCreator[] = [];

      for (const cc of creators) {
        if (cc.shopifyOrder) {
          orderRows.push({
            ...cc.shopifyOrder,
            campaignCreator: {
              id: cc.id,
              lifecycleStatus: cc.lifecycleStatus,
              creator: cc.creator,
            },
          });
        } else if (cc.lifecycleStatus === "address_confirmed") {
          eligibleRows.push({
            id: cc.id,
            creatorId: cc.creatorId,
            lifecycleStatus: cc.lifecycleStatus,
            creator: cc.creator,
          });
        }
      }

      setOrders(orderRows);
      setEligible(eligibleRows);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function placeOrder(creatorId: string) {
    setPlacing(creatorId);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/creators/${creatorId}/order`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to place order");
      }

      // Reload data
      await loadData();
    } catch (error) {
      console.error("Failed to place order:", error);
      alert(
        error instanceof Error ? error.message : "Failed to place order"
      );
    } finally {
      setPlacing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading orders…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">
          Manage Shopify gift orders for this campaign
        </p>
      </div>

      {/* Eligible creators — ready to place orders */}
      {eligible.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Ready to Order ({eligible.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {eligible.map((cc) => (
                <div
                  key={cc.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {cc.creator.name || cc.creator.email || "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Address confirmed
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => placeOrder(cc.creatorId)}
                    disabled={placing === cc.creatorId}
                  >
                    {placing === cc.creatorId
                      ? "Placing…"
                      : "Place Order"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Orders ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No orders yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Creator</th>
                    <th className="pb-2 pr-4 font-medium">Order ID</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Tracking</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        {order.campaignCreator.creator.name ||
                          order.campaignCreator.creator.email ||
                          "Unknown"}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {order.shopifyOrderNumber ||
                          order.shopifyOrderId}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          className={
                            statusColors[order.status] ||
                            "bg-gray-100 text-gray-800"
                          }
                        >
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {order.fulfillmentEvents?.[0]?.trackingNumber ? (
                          <span className="font-mono text-xs">
                            {order.fulfillmentEvents[0].carrier &&
                              `${order.fulfillmentEvents[0].carrier}: `}
                            {order.fulfillmentEvents[0].trackingNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
