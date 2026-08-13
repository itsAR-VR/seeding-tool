# Phase 27c — Feature Flag Presets + Fixes

## Focus

Fix the feature flag allowlist mismatch and add automation presets so new brands don't start with everything disabled. Currently 8 of 9 flags default OFF — a new brand gets zero automation out of the box.

Confidence: **90%**

## Deep Sweep Corrections Applied

- [x] CRITICAL: API route validFlags has 9 entries, missing `instagramMentionPollEnabled`. `setFeatureFlag()` has 10. Settings UI has its own duplicate FeatureFlags interface with 9. THREE SEPARATE ALLOWLISTS that are already out of sync.
- [x] HIGH: `identityAutoLinkEnabled` merges identity records permanently without review. EXCLUDE from all presets. Only available as manual toggle after brand validates identity review queue.
- [x] HIGH: `instagramMentionPollEnabled` defaults TRUE — the only fail-OPEN flag. Document this exception explicitly. Keep it true in all presets (turning it off breaks mention detection).
- [x] HIGH: Settings UI (`page.tsx`) redeclares its own `FeatureFlags` interface instead of importing. Fix: import from `lib/feature-flags.ts`.
- [x] MEDIUM: `embeddingScoringEnabled` does NOT exist in code (Phase 25c deferred). Do NOT include in any preset.
- [x] MEDIUM: `portfolioOptimizerEnabled` requires `decisionEngineScoringEnabled` to also be true (seed-list route checks both). Presets must enable both or neither.
- [x] MEDIUM: No bulk-set function exists. `setFeatureFlag()` does read-modify-write per flag. Add `applyPreset()` function that does a single read-modify-write for all flags atomically.
- [x] MEDIUM: Onboarding step insertion shifts `currentStep` integer for in-progress onboardings. Add migration guard or append preset step at the end instead of inserting in the middle.
- [x] LOW: `getFeatureFlags()` returns inconsistent values for `instagramMentionPollEnabled` depending on whether BrandSettings exists vs metadata is empty.

## Inputs

- `apps/web/lib/feature-flags.ts` — `FeatureFlags` interface, `DEFAULT_FLAGS`, `getFeatureFlags()`, `setFeatureFlag()`
- `apps/web/app/api/settings/feature-flags/route.ts` — PATCH endpoint with hardcoded `validFlags` array (9 entries, missing `instagramMentionPollEnabled`)
- `apps/web/app/(platform)/onboarding/page.tsx` — onboarding flow
- `apps/web/app/(platform)/settings/feature-flags/page.tsx` — feature flags settings page (redeclares its own `FeatureFlags` interface)

## Skills Available

- `backend-coding-agent`, `tdd-guide`, `code-review`

## Work

### 1. Fix Allowlist Mismatch (Single Source of Truth)

**File**: `apps/web/lib/feature-flags.ts`

Create a `VALID_FLAG_NAMES` constant exported from `feature-flags.ts`:
```ts
export const VALID_FLAG_NAMES = Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[];
```

Use this in both the API route validation and `setFeatureFlag()`.

**File**: `apps/web/app/api/settings/feature-flags/route.ts`

Replace the hardcoded `validFlags` array with:
```ts
import { VALID_FLAG_NAMES } from "@/lib/feature-flags";
// Remove: const validFlags = [...];
// Use: VALID_FLAG_NAMES in the validation check
```

**File**: `apps/web/app/(platform)/settings/feature-flags/page.tsx`

Remove the local `FeatureFlags` interface redeclaration. Import from the canonical source:
```ts
import type { FeatureFlags } from "@/lib/feature-flags";
```

This eliminates all three separate allowlists and creates a single source of truth.

### 2. Add Preset System

**File**: `apps/web/lib/feature-flags.ts`

```ts
/**
 * Feature flag presets for different automation levels.
 *
 * EXCLUDED from all presets:
 * - identityAutoLinkEnabled: merges identity records permanently without review.
 *   Only available as manual toggle after brand validates identity review queue.
 * - embeddingScoringEnabled: does NOT exist in code (Phase 25c deferred).
 *
 * ALWAYS TRUE in all presets:
 * - instagramMentionPollEnabled: the only fail-OPEN flag. Turning it off breaks
 *   mention detection entirely. Defaults true in DEFAULT_FLAGS.
 *
 * DEPENDENCY: portfolioOptimizerEnabled requires decisionEngineScoringEnabled
 * (seed-list route checks both). Presets enable both or neither.
 */
export const FLAG_PRESETS = {
  manual: {
    ...DEFAULT_FLAGS,
    // All false except instagramMentionPollEnabled (true via DEFAULT_FLAGS)
  },
  assisted: {
    ...DEFAULT_FLAGS,
    decisionEngineScoringEnabled: true,
    shopifyOrderEnabled: true,
    reminderEmailEnabled: true,
    aiReplyEnabled: true,
    outcomeLearningEnabled: true,
    instagramMentionPollEnabled: true,
  },
  autonomous: {
    ...DEFAULT_FLAGS,
    decisionEngineScoringEnabled: true,
    identityGraphEnabled: true,
    // identityAutoLinkEnabled intentionally EXCLUDED — requires manual review
    portfolioOptimizerEnabled: true,  // requires decisionEngineScoringEnabled (both enabled)
    shopifyOrderEnabled: true,
    reminderEmailEnabled: true,
    aiReplyEnabled: true,
    outcomeLearningEnabled: true,
    instagramMentionPollEnabled: true,
  },
} as const satisfies Record<string, FeatureFlags>;

export type FlagPreset = keyof typeof FLAG_PRESETS;
```

### 3. Add Bulk-Set Function

**File**: `apps/web/lib/feature-flags.ts`

`setFeatureFlag()` does read-modify-write per flag, which means applying a preset with 8 flags would do 8 separate read-modify-write cycles. Add an atomic `applyPreset()` function:

```ts
export async function applyPreset(
  brandId: string,
  preset: FlagPreset
): Promise<FeatureFlags> {
  const flags = FLAG_PRESETS[preset];
  const settings = await prisma.brandSettings.findUnique({
    where: { brandId },
  });

  const currentMetadata = (settings?.metadata as Record<string, unknown>) ?? {};

  await prisma.brandSettings.upsert({
    where: { brandId },
    update: {
      metadata: {
        ...currentMetadata,
        featureFlags: { ...flags },
      },
    },
    create: {
      brandId,
      metadata: { featureFlags: { ...flags } },
    },
  });

  return { ...flags };
}
```

This replaces all flags in a single database write instead of N separate writes.

### 4. Add Preset API Endpoint

**New route**: `apps/web/app/api/settings/feature-flags/preset/route.ts`

`POST` — accepts `{ preset: "manual" | "assisted" | "autonomous" }`:
- Validate preset name against `FLAG_PRESETS` keys
- Call `applyPreset()` (single atomic write)
- Return the applied flags
- Auth via `getCurrentBrandMembership()` + `requireAdminAccess()`

### 5. Add Onboarding Step

**File**: `apps/web/app/(platform)/onboarding/page.tsx`

**Append** the preset step at the END of the onboarding flow (do NOT insert in the middle — inserting shifts the `currentStep` integer for in-progress onboardings and would break their progress).

Presents the three presets:

- **Manual** — "You control everything. AI suggests, you decide."
- **Assisted** (recommended) — "AI scores creators, drafts replies, and creates orders. You review before sending."
- **Autonomous** — "Full automation. AI handles scoring, replies, orders, and follow-ups with minimal oversight."

Note: `identityAutoLinkEnabled` is not mentioned in preset descriptions. It remains a manual toggle accessible only in Settings > Feature Flags after the brand has reviewed their identity queue.

Default selection: Assisted. One-click apply via `applyPreset()`.

### 6. Fix instagramMentionPollEnabled Inconsistency

**File**: `apps/web/lib/feature-flags.ts`

In `getFeatureFlags()`, ensure that when BrandSettings exists but `metadata.featureFlags` is empty/undefined, `instagramMentionPollEnabled` still returns `true` (from `DEFAULT_FLAGS`). Currently the function may return inconsistent values depending on whether BrandSettings exists vs metadata is empty. Ensure the spread order is `{ ...DEFAULT_FLAGS, ...storedFlags }` so defaults always fill in missing keys.

### 7. Tests

- Test: VALID_FLAG_NAMES matches all keys in FeatureFlags interface
- Test: Settings UI imports FeatureFlags from lib/feature-flags (no local redeclaration)
- Test: API route uses VALID_FLAG_NAMES (no hardcoded array)
- Test: preset "manual" sets all flags to defaults (all false except `instagramMentionPollEnabled: true`)
- Test: preset "assisted" enables 6 flags (decisionEngineScoring, shopifyOrder, reminderEmail, aiReply, outcomeLearning, instagramMentionPoll)
- Test: preset "autonomous" enables 8 flags (assisted + identityGraph, portfolioOptimizer) but NOT identityAutoLinkEnabled
- Test: `identityAutoLinkEnabled` is false in ALL presets
- Test: `embeddingScoringEnabled` is NOT present in any preset
- Test: `portfolioOptimizerEnabled` and `decisionEngineScoringEnabled` are always enabled together
- Test: invalid preset name returns 400
- Test: preset endpoint requires admin access
- Test: `applyPreset()` writes all flags in a single database operation
- Test: preset API actually updates BrandSettings.metadata.featureFlags
- Test: `getFeatureFlags()` returns `instagramMentionPollEnabled: true` when metadata is empty
- Test: Onboarding step appended at end (does not shift existing step indices)

## Output

(empty — to be filled after implementation)

## Handoff

With presets, new brands get working automation from day one. The "Assisted" preset is the recommended default — it enables the core automation loop (scoring → outreach → reply processing → orders → reminders → outcome learning) while keeping human review at each step. `identityAutoLinkEnabled` remains manual-only to prevent irreversible identity merges without review.
