# Phase 21a — Forecasting Extraction: Surgical Removal from Mixed Files

## Focus

Remove all forecasting references from the 9 files that have both forecasting and Phase 20 changes mixed together. After this subphase, no committed file will import from `lib/forecasting/` or reference forecast models.

## Inputs

- Phase 20 review: `docs/planning/phase-20/review.md`
- Root plan mixed-file table listing exact lines to remove per file
- Current file contents (read before each edit)

## Skills Available for This Subphase

- `backend-coding-agent` — schema + API edits

## Work

### 1. `apps/web/prisma/schema.prisma`

Remove:
- 7 forecast relation lines from Brand model (`forecastSettings`, `forecastRuns`, `forecastVersions`, `forecastSourceSnapshots`, `forecastMergeReviews`, `forecastValidationIssues`, `forecastExportArtifacts`)
- `forecast_refresh |` from the Automation.type comment
- All 7 forecast model blocks: ForecastSettings, ForecastRun, ForecastSourceSnapshot, ForecastVersion, ForecastMergeReview, ForecastValidationIssue, ForecastExportArtifact (lines 1273-1476)

Verify: `npx prisma validate` passes after edits.

### 2. `apps/web/app/api/inngest/route.ts`

Remove:
- `import { processRequestedForecastRun } from "@/lib/inngest/functions/process-forecast-run";` (line 20)
- `processRequestedForecastRun,` from the functions array (line 41)

Keep: `collectDailySnapshots` and `computeAuthenticity` imports + array entries.

### 3. `apps/web/app/(platform)/layout.tsx`

Remove:
- `{ href: "/forecast", label: "Forecast", icon: "📈" },` from navItems (line 9)

### 4. `apps/web/app/(platform)/settings/page.tsx`

Remove the forecast settings link object from settingsLinks array:
```
{
  href: "/settings/forecast",
  title: "Forecast",
  description: "Configure workbook parity, forecast mailbox triggers, and source connectors.",
  icon: "📈",
},
```

### 5. `apps/web/app/(platform)/settings/connections/page.tsx`

Remove the 4 forecast provider guide blocks: `google_ads`, `meta_ads`, `amazon_seller_central`, `google_sheets`.

### 6. `apps/web/lib/inngest/functions/run-automation.ts`

Remove:
- `import { forecastAutomationType } from "@/lib/forecasting/constants";` (line 5)
- `import { requestForecastRun } from "@/lib/forecasting/service";` (line 6)
- The entire `else if (automation.type === forecastAutomationType)` block (lines 137-157)

### 7. `apps/web/app/api/gmail/webhook/route.ts`

Remove:
- Lines 9-13: the 3 forecast imports (`isAuthorizedForecastSender`, `processForecastRun`, `requestForecastRun`)
- Lines 87-126: the forecast email trigger block inside `if (!thread)` — the `forecastSettings` query, `isAuthorizedForecastSender` check, `requestForecastRun` call, inngest send fallback
- Lines 340-350: `extractEmailAddress` helper function (only used by forecast block)

Keep:
- `recordOutcomeEvent` import (line 8)
- All 3 `recordOutcomeEvent` calls (address_confirmed, reply_received positive, reply_received negative)
- The `continue;` statement for the no-thread case

The `if (!thread)` block should simplify to just `continue;` after removing the forecast logic.

### 8. `apps/web/lib/integrations/methods.ts`

Remove the `google_ads`, `meta_ads`, `amazon_seller_central`, `google_sheets` entries from:
- `integrationProviders` object
- `providerCapabilities` object (if present)
- `allowedCredentialTypesByMethod` object (if present)

### 9. `apps/web/package.json`

Remove `"xlsx": "^0.18.5"` from dependencies.

Then run `cd apps/web && npm install` to regenerate `package-lock.json`.

## Output

- 9 files edited with all forecasting references removed
- `package-lock.json` regenerated without xlsx
- `npx prisma validate` passes

## Handoff

Phase 21b takes the cleaned codebase, runs full verification (build, lint, tests), stages only Phase 20 files, and creates the commit.
