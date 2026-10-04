"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { orderStatusLabel } from "@/lib/shopify/order-labels";
import { Badge } from "@/components/ui/badge";

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

/** Pill colors: amber for "waiting on you", red only for real problems. */
const statusColors: Record<string, string> = {
  draft_pending: "bg-slate-100 text-slate-800",
  draft_created: "bg-amber-100 text-amber-900",
  draft_completing: "bg-amber-100 text-amber-900",
  error_needs_reconciliation: "bg-red-100 text-red-900",
  created: "bg-blue-100 text-blue-900",
  processing: "bg-blue-100 text-blue-900",
  shipped: "bg-indigo-100 text-indigo-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
};

/** Words and color for one order row. A draft is amber unless something actually broke. */
function orderPill(status: string, isDraft: boolean): { label: string; tone: string } {
  const isProblem = status === "error_needs_reconciliation" || status === "cancelled";
  if (isDraft && !isProblem) {
    return { label: "Draft, waiting for you", tone: statusColors.draft_created };
  }
  return {
    label: orderStatusLabel(status),
    tone: statusColors[status] ?? "bg-slate-100 text-slate-800",
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
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="mt-1 text-muted-foreground">
          Gift orders for this campaign. Drafts wait for you in Shopify; complete one there to ship it.
        </p>
      </header>

      {eligible.length > 0 && (
        <section aria-labelledby="eligible-heading" className="space-y-3">
          <h2 id="eligible-heading" className="text-lg font-semibold">
            Address in, order not started ({eligible.length})
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
          All orders ({orders.length})
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
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Creator</th>
                  <th className="px-5 py-3 font-medium">Shopify order</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Tracking</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">
                    <span className="sr-only">Open in Shopify</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => {
                  const isDraft = Boolean(order.shopifyDraftOrderId) && !order.shopifyOrderId;
                  const pill = orderPill(order.status, isDraft);
                  const tracking = order.fulfillmentEvents?.[0];
                  return (
                    <tr key={order.id}>
                      <td className="px-5 py-4">
                        <Link
                          href={`/creators/${order.campaignCreator.creatorId}`}
                          className="font-medium hover:underline"
                        >
                          {order.campaignCreator.creator.name ||
                            order.campaignCreator.creator.email ||
                            "Unnamed creator"}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        {(isDraft
                          ? order.shopifyDraftOrderName || order.shopifyDraftOrderId
                          : order.shopifyOrderNumber || order.shopifyOrderId) ?? "Not made yet"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={pill.tone}>{pill.label}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        {isDraft ? (
                          <span className="text-muted-foreground">Not shipped</span>
                        ) : tracking?.trackingNumber ? (
                          <span>
                            {tracking.carrier && `${tracking.carrier}: `}
                            {tracking.trackingNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No tracking yet</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {order.shopifyAdminUrl ? (
                          <a
                            href={order.shopifyAdminUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="whitespace-nowrap font-medium hover:underline"
                          >
                            {isDraft ? "Review in Shopify ↗" : "Open in Shopify ↗"}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">No link yet</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
