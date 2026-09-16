-- The two-step gift gate redefines shopify_orders.status: 'created' now means a REAL
-- Shopify order exists, so it is an unsafe column default. New rows start at
-- 'draft_pending' (nothing created in Shopify yet). Existing rows are left untouched.
ALTER TABLE "shopify_orders" ALTER COLUMN "status" SET DEFAULT 'draft_pending';
