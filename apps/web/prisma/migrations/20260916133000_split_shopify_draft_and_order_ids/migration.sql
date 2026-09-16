-- Allow creator gifts to stop at Shopify draft review before creating a real order.
ALTER TABLE "shopify_orders" ALTER COLUMN "shopify_order_id" DROP NOT NULL;

ALTER TABLE "shopify_orders"
ADD COLUMN "shopify_draft_order_id" TEXT,
ADD COLUMN "shopify_draft_order_name" TEXT;

CREATE UNIQUE INDEX "shopify_orders_shopify_draft_order_id_key" ON "shopify_orders"("shopify_draft_order_id");
