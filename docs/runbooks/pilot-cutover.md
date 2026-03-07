# Pilot Brand Cutover Runbook

## Pilot Brand: Kalm

---

## Pre-Launch Checklist

### Environment Variables (Vercel)
- [ ] `DATABASE_URL` — Supabase PostgreSQL connection string
- [ ] `DIRECT_URL` — Supabase direct connection (for migrations)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- [ ] `OPENAI_API_KEY` — OpenAI API key for AI classification/drafts
- [ ] `STRIPE_SECRET_KEY` — Stripe API key
- [ ] `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- [ ] `SHOPIFY_WEBHOOK_SECRET` — Shopify webhook HMAC secret
- [ ] `APP_ENCRYPTION_KEY` — 32-byte hex key for credential encryption
- [ ] `SENTRY_DSN` — Sentry error tracking DSN (create free account first)
- [ ] `INNGEST_APP_ID` — Inngest app identifier (default: "seed-scale")
- [ ] `INNGEST_EVENT_KEY` — Inngest event key (if using hosted Inngest)

### Webhook Registration
- [ ] **Stripe**: Register webhook endpoint `https://<domain>/api/billing/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] **Shopify**: Register webhook endpoint `https://<domain>/api/webhooks/shopify`
  - Topics: `orders/create`, `orders/fulfilled`, `orders/updated`, `fulfillments/create`, `fulfillments/update`
- [ ] **Gmail**: Register Pub/Sub push subscription to `https://<domain>/api/gmail/webhook`
  - Grant publish access to `gmail-api-push@system.gserviceaccount.com`

### Auth Configuration
- [ ] Supabase redirect URL set to production domain
- [ ] Test user added to Google OAuth consent screen (if in testing mode)
- [ ] Email templates configured in Supabase Auth

### Database
- [ ] Run `npx prisma migrate deploy` against production DB
- [ ] Verify schema matches with `npx prisma validate`

---

## Rollout Procedure

### Step 1: Import Airtable Data
```bash
# Export Airtable "Instagram Influencers" table as JSON
# Run migration in dry-run mode first:
npx tsx apps/web/scripts/migrate-airtable.ts \
  --input ./airtable-export.json \
  --org-id <orgId> \
  --campaign-id <campaignId> \
  --dry-run

# Verify counts match expected totals
# Then run for real:
npx tsx apps/web/scripts/migrate-airtable.ts \
  --input ./airtable-export.json \
  --org-id <orgId> \
  --campaign-id <campaignId>
```

### Step 2: Verify Import
- [ ] Creator count matches Airtable source
- [ ] CampaignCreator lifecycle statuses map correctly
- [ ] No errors in migration output
- [ ] Spot-check 5-10 records in platform UI

### Step 3: Enable Feature Flags (one by one)
Navigate to **Settings → Feature Flags** in the platform.

**Order of enablement:**
1. `aiReplyEnabled` — Start with AI drafts (human reviews before send)
2. `shopifyOrderEnabled` — Enable order creation for address-confirmed creators
3. `reminderEmailEnabled` — Enable post-delivery reminders
4. `unipileDmEnabled` — Enable Instagram DM (last — highest risk)

**Between each flag:**
- Wait 1-2 hours
- Check `/admin/health` dashboard
- Check Intervention queue for unexpected items
- Verify no auto-sends occurred

### Step 4: Monitor Health Page
Check `/admin/health` for:
- [ ] Zero stuck CampaignCreators (allow 24h for pipeline to catch up)
- [ ] Open Interventions are expected (AI unavailable, low confidence, etc.)
- [ ] No failed webhooks in last 24h
- [ ] No stale AI drafts older than 48h

### Step 5: Production Verification
- [ ] Send a test outreach email → confirm delivery
- [ ] Simulate a reply → confirm AI draft appears in inbox
- [ ] Confirm draft stays as "draft" until human action
- [ ] Place a test Shopify order → confirm webhook processes
- [ ] Check structured logs in Vercel (JSON format)

---

## Rollback Procedure

### Immediate Rollback (no deploy needed)
1. Navigate to **Settings → Feature Flags**
2. Set ALL flags to `false`:
   - `aiReplyEnabled` → OFF
   - `unipileDmEnabled` → OFF
   - `shopifyOrderEnabled` → OFF
   - `reminderEmailEnabled` → OFF
3. Verify flags are disabled via `GET /api/settings/feature-flags`

### Post-Rollback Checks
- [ ] Check Intervention queue — resolve any pending items
- [ ] Check for in-flight Inngest functions (they may complete even after flag disable)
- [ ] Verify no new outbound messages were sent after rollback
- [ ] Export current state for audit if needed

### Full Rollback (data)
If data corruption is suspected:
1. Stop all Inngest functions (via Inngest dashboard)
2. Take database snapshot
3. Assess which records need cleanup
4. Use Prisma Studio (`npx prisma studio`) for targeted fixes

---

## Incident Response

### AI Auto-Send Detected
**Severity: Critical**
1. Immediately disable `aiReplyEnabled` flag
2. Query `AIDraft` table for any with `status = "sent"` + recent `approvedAt`
3. Check if human approval was genuinely given or if there's a bug
4. Review audit trail in `ActivityLog`

### Duplicate Orders
**Severity: High**
1. Disable `shopifyOrderEnabled` flag
2. Check `ShopifyOrder` for duplicate `campaignCreatorId` entries
3. Cancel duplicate orders via Shopify Admin
4. Check webhook dedup — `WebhookEvent.externalEventId` should be unique

### Unipile Rate Limit Exceeded
**Severity: Medium**
1. Disable `unipileDmEnabled` flag
2. Check `SendingMetric` for the day
3. Wait for daily reset (midnight UTC)
4. Re-enable after verifying rate limit logic

---

## Contacts
- Platform owner: [fill in]
- Shopify admin: [fill in]
- Gmail workspace admin: [fill in]
- On-call engineer: [fill in]
