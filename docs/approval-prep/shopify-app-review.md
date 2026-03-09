# Shopify App Review Prep

## Current code path
- Manual token connect route: `apps/web/app/api/connections/shopify/route.ts`
- Product sync helper: `apps/web/lib/shopify/products.ts`
- Webhook registration helper: `apps/web/lib/shopify/webhooks.ts`
- Webhook receiver: `apps/web/app/api/webhooks/shopify/route.ts`
- Product selection surfaces:
  - `apps/web/app/(platform)/settings/connections/page.tsx`
  - `apps/web/components/product-picker.tsx`
  - `apps/web/app/(platform)/campaigns/[campaignId]/products/page.tsx`

## Access patterns used by the app
- Validate the store connection by reading `shop.json`
- Read product catalog pages from `/products.json`
- Sync product variants, price, SKU, inventory, and product imagery into the app database
- Register and receive Shopify webhooks for:
  - `orders/create`
  - `orders/fulfilled`
  - `orders/updated`
  - `fulfillments/create`
  - `fulfillments/update`

## Scope planning notes
- Minimum current read scope expectation:
  - `read_products`
  - `read_orders`
  - `read_fulfillments`
- If the public app will also create draft orders or write order state later, add:
  - `[PLACEHOLDER: additional write scopes if retained in public app]`

## Redirect / callback URLs
- Public install/callback URL: `[PLACEHOLDER: Shopify OAuth callback URL]`
- Webhook receiver URL:
  - `${NEXT_PUBLIC_APP_URL}/api/webhooks/shopify`

## Screenshots to capture
- `[PLACEHOLDER: screenshot path]` Connections page showing Shopify connect
- `[PLACEHOLDER: screenshot path]` Successful connected state with store domain
- `[PLACEHOLDER: screenshot path]` Product picker after sync
- `[PLACEHOLDER: screenshot path]` Campaign products page with selected synced products
- `[PLACEHOLDER: screenshot path]` Error state / retry sync UI

## Support / legal fields
- Support URL: `[PLACEHOLDER: support URL]`
- Privacy policy URL: `[PLACEHOLDER: privacy policy URL]`
- Terms of service URL: `[PLACEHOLDER: terms URL]`

## Identity placeholders
- App name: `[PLACEHOLDER: app name]`
- Company name: `[PLACEHOLDER: company name]`
- Logo URL: `[PLACEHOLDER: logo URL]`

## Reviewer notes
- Current production path in this phase is still manual token connect; this document prepares the public-app review package without switching the live flow yet
- Product sync now records last sync time, sync error, synced product count, and partial-sync state on the Shopify brand connection metadata
- The review package should demonstrate read-only product sync plus webhook handling before any broader public-app claims are made

## Submission checklist
- [ ] Public Shopify app identity finalized
- [ ] OAuth install/callback route finalized
- [ ] Requested scopes confirmed against live code paths
- [ ] Webhook topics confirmed against live receiver logic
- [ ] Screenshots captured from the live production environment
- [ ] Support / privacy / terms URLs finalized
