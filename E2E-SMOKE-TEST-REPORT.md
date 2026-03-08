# E2E Smoke Test Report — Seed Scale

**Date:** 2025-07-09  
**Environment:** localhost:3000 (Next.js 16.1.6 / Turbopack)  
**Test Account:** ar@soramedia.co (Supabase user `bc2e4a6c-3471-4df8-8de1-e9e88aab9ada`)  
**Browser:** Chromium (OpenClaw profile)

---

## 1. Login Page ✅

- **URL:** `/login`
- Login page renders correctly with Email + Password fields, "Sign in" button, and "Sign up" link
- Logged in successfully with test account (password set via Supabase admin API)
- Redirected to `/dashboard` after login
- Session cookie persists across server restarts

## 2. Dashboard ✅

- **URL:** `/dashboard`
- **4 metric cards present:**
  - Active Campaigns: 0 (of 1 total)
  - Creators in Pipeline: 0
  - Pending Interventions: 0
  - Orders in Transit: 0
- **Recent Campaigns:** Shows "Kalm v1" (draft, 0 creators, created 2026-03-07)
- **Action Queue:** "All clear — No open interventions"
- **Recent Mentions:** "No mentions yet" with empty state message
- All sections render cleanly with proper layout

## 3. Connections Page ✅

- **URL:** `/settings/connections` (via Settings → Connections)
- **All 4 integration cards present:**
  - **Gmail** — "Not connected" + "Connect Gmail" button ✅
  - **Shopify** — "Not connected" + Store domain & Access Token form + "Connect Shopify" button ✅
  - **Instagram** — "Not connected" + "Connect Instagram" button ✅ *(new OAuth card confirmed)*
  - **Unipile** — "Not connected" + API Key & Account ID form + "Connect Unipile" button ✅

## 4. Creators Page ✅

- **URL:** `/creators`
- Page loads with search/filter bar (handle/name, min/max followers, min/max views, category, source dropdown)
- **"Import CSV" button** present in top-right ✅
- **"Search Creators" button** also present ✅
- Empty state: "0 Creators — No creators found. Try adjusting your filters or import from CSV."

## 5. Campaigns Page ✅

- **URL:** `/campaigns`
- List page loads with existing campaign "Kalm v1" (draft, 0 creators, created 2026-03-07)
- **"+ New Campaign" button** present in top-right ✅
- Campaign detail page (`/campaigns/[id]`) shows:
  - Status badge (draft)
  - 7 stat cards: Total, Pending, Approved, Declined, Outreach Sent, Replied, Address
  - "Draft Outreach" and "Review Queue (0)" action buttons
  - Creators section with empty state

## 6. Mentions Page ✅

- **URL:** `/campaigns/[id]/mentions`
- Page loads with "Add Mention" button
- **Manual mention form works** — clicking "Add Mention" reveals form with:
  - Platform dropdown (Instagram)
  - Type dropdown (Post)
  - Media URL field
  - Creator selector
  - Caption (optional) field
  - Submit "Add Mention" button
  - "Cancel" button to close form
- Empty state: "All Mentions (0) — No mentions yet"
- ⚠️ **Note:** Mentions tab is not linked from the campaign detail page — only accessible via direct URL. Consider adding a tab/link on the campaign detail page.

## 7. Health Page ✅

- **URL:** `/admin/health`
- **System Health dashboard displays 4 invariant checks:**
  - 🔴 Stuck CampaignCreators (0) — ✅ None stuck
  - 🚨 Open Interventions (0) — ✅ None open
  - ⚠️ Failed Webhooks (24h) (0) — ✅ No failures
  - 📝 Stale AI Drafts (>48h) (0) — ✅ No stale drafts
- All invariants display with clear status indicators

---

## Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Login | ✅ | Clean render, successful auth |
| 2. Dashboard | ✅ | All 4 metric cards + 3 sections present |
| 3. Connections | ✅ | All 4 cards incl. new Instagram OAuth |
| 4. Creators | ✅ | Page loads, Import CSV + Search buttons present |
| 5. Campaigns | ✅ | List + detail + New Campaign button |
| 6. Mentions | ✅ | Manual form works (⚠️ no link from campaign detail) |
| 7. Health | ✅ | All 4 invariants display correctly |

**Overall: ✅ ALL TESTS PASSING**

### Minor Issues

1. **⚠️ Mentions tab not linked from campaign detail page** — The mentions page exists at `/campaigns/[id]/mentions` but there's no navigation link from the campaign detail view. Users must know the URL directly.

2. **Note:** Dev server crashed once during login (possible port conflict), but recovered cleanly with session persistence.
