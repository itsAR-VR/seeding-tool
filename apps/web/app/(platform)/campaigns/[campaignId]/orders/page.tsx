"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OrdersTable, ordersHeading, type OrderTableRow } from "@/app/(platform)/orders/_components/orders-table";

type OrderRow = {
  id: string;
  shopifyOrderId: string | null;
  shopifyOrderNumber: string | null;
  shopifyDraftOrderId: string | null;
  shopifyDraftOrderName: string | null;
  shopifyAdminUrl?: string | null;
  status: string;
  createdAt: string;
  campaignCreator: {
    id: string;
    creatorId: string;
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

function toTableRow(order: OrderRow): OrderTableRow {
  const creator = order.campaignCreator.creator;
  return {
    id: order.id,
    status: order.status,
    shopifyOrderId: order.shopifyOrderId,
    shopifyOrderNumber: order.shopifyOrderNumber,
    shopifyDraftOrderId: order.shopifyDraftOrderId,
    shopifyDraftOrderName: order.shopifyDraftOrderName,
    createdAt: order.createdAt,
    adminUrl: order.shopifyAdminUrl ?? null,
    creator: { id: order.campaignCreator.creatorId, name: creator.name || creator.email || "Unnamed creator" },
    tracking: order.fulfillmentEvents?.[0] ?? null,
  };
}

export default function OrdersPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [eligible, setEligible] = useState<EligibleCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
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
              creatorId: cc.creatorId,
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
      setLoadError("Couldn't load orders. Refresh the page to try again.");
    } finally {
      setLoading(false);
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
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Orders</h2>
        <p className="mt-1 text-muted-foreground">
          Gift orders for this campaign. Drafts wait for you in Shopify; complete one there to ship it.
        </p>
      </header>

      {eligible.length > 0 && (
        <section aria-labelledby="eligible-heading" className="space-y-3">
          <h2 id="eligible-heading" className="text-lg font-semibold">
            Address received, order not started ({eligible.length})
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {eligible.map((cc) => (
              <li key={cc.id} className="px-5 py-4">
                <Link href={`/creators/${cc.creatorId}`} className="font-medium hover:underline">
                  {cc.creator.name || cc.creator.email || "Unnamed creator"}
                </Link>
                <p className="text-sm text-muted-foreground">
                  We have their address. The Shopify draft order isn&apos;t made yet.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="orders-heading" className="space-y-3">
        <h2 id="orders-heading" className="text-lg font-semibold">
          {ordersHeading(orders)}
        </h2>
        {loadError ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
            {loadError}
          </p>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border bg-card p-5 text-muted-foreground">
            No orders yet. An order starts when a creator sends their address. Make sure Shopify is
            connected in{" "}
            <Link href="/settings/connections" className="font-medium text-foreground underline">
              Settings &gt; Connections
            </Link>
            .
          </div>
        ) : (
          <OrdersTable orders={orders.map(toTableRow)} />
        )}
      </section>
    </div>
  );
}
