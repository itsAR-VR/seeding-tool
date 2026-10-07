/** Plain words for each stored ShopifyOrder.status. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
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

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}
