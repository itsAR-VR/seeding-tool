import Link from "next/link";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { formatDate } from "@/lib/format/date";
import { orderStatusLabel } from "@/lib/shopify/order-labels";

/** One gift order, shaped the same for the main Orders page and a campaign's Orders tab. */
export type OrderTableRow = {
  id: string;
  status: string;
  shopifyOrderId: string | null;
  shopifyOrderNumber: string | null;
  shopifyDraftOrderId: string | null;
  shopifyDraftOrderName: string | null;
  createdAt: Date | string;
  adminUrl: string | null;
  creator: { id: string; name: string };
  campaign?: { id: string; name: string };
  tracking: { carrier: string | null; trackingNumber: string | null } | null;
  conversationId?: string | null;
};

const PROBLEM_STATUSES = new Set(["error_needs_reconciliation"]);
const CLOSED_STATUSES = new Set(["cancelled"]);
const DRAFT_STATUSES = new Set(["draft_pending", "draft_created", "draft_completing"]);

function isDraftOrder(order: Pick<OrderTableRow, "status" | "shopifyOrderId" | "shopifyDraftOrderId">): boolean {
  return DRAFT_STATUSES.has(order.status) || (Boolean(order.shopifyDraftOrderId) && !order.shopifyOrderId);
}

/**
 * Words and tone for one order: drafts wait on you, sent orders are good,
 * cancelled is neutral, and only a real error is a problem.
 */
export function orderPill(
  order: Pick<OrderTableRow, "status" | "shopifyOrderId" | "shopifyDraftOrderId">,
): { label: string; tone: StatusTone } {
  if (PROBLEM_STATUSES.has(order.status)) return { label: orderStatusLabel(order.status), tone: "problem" };
  if (CLOSED_STATUSES.has(order.status)) return { label: orderStatusLabel(order.status), tone: "neutral" };
  if (isDraftOrder(order)) {
    return {
      label: order.status === "draft_pending" ? orderStatusLabel(order.status) : "Draft, waiting for you",
      tone: "waiting",
    };
  }
  return { label: orderStatusLabel(order.status), tone: "good" };
}

export function OrdersTable({ orders, showCampaign = false }: { orders: readonly OrderTableRow[]; showCampaign?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-5 py-3 font-medium">Creator</th>
            {showCampaign && <th className="px-5 py-3 font-medium">Campaign</th>}
            <th className="px-5 py-3 font-medium">Shopify order</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Tracking</th>
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">
              <span className="sr-only">Links</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((order) => {
            const draft = isDraftOrder(order);
            const pill = orderPill(order);
            const orderName = draft
              ? order.shopifyDraftOrderName || order.shopifyDraftOrderId
              : order.shopifyOrderNumber || order.shopifyOrderId;
            return (
              <tr key={order.id}>
                <td className="px-5 py-4">
                  <Link href={`/creators/${order.creator.id}`} className="font-medium hover:underline">
                    {order.creator.name}
                  </Link>
                </td>
                {showCampaign && (
                  <td className="px-5 py-4">
                    {order.campaign ? (
                      <Link href={`/campaigns/${order.campaign.id}/orders`} className="hover:underline">
                        {order.campaign.name}
                      </Link>
                    ) : null}
                  </td>
                )}
                <td className="px-5 py-4">
                  {orderName && !orderName.startsWith("pending:") ? (
                    orderName
                  ) : (
                    <span className="text-muted-foreground">Not made yet</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                </td>
                <td className="px-5 py-4">
                  {draft ? (
                    <span className="text-muted-foreground">Not shipped</span>
                  ) : order.tracking?.trackingNumber ? (
                    <span>
                      {order.tracking.carrier && `${order.tracking.carrier}: `}
                      {order.tracking.trackingNumber}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No tracking yet</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(order.createdAt)}</td>
                <td className="px-5 py-4 text-right">
                  <span className="flex justify-end gap-4 whitespace-nowrap font-medium">
                    {order.conversationId && (
                      <Link href={`/inbox/${order.conversationId}`} className="hover:underline">
                        Conversation
                      </Link>
                    )}
                    {order.adminUrl ? (
                      <a href={order.adminUrl} target="_blank" rel="noreferrer" className="hover:underline">
                        {draft ? "Review in Shopify ↗" : "Open in Shopify ↗"}
                      </a>
                    ) : (
                      <span className="font-normal text-muted-foreground">No Shopify link yet</span>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
