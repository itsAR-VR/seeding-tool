# Phase 19 — Red-Team Gap Analysis

## Edge cases considered

### 1. User refreshes on done step
**Risk:** Double-call to completion API.
**Mitigation:** API is idempotent — `upsert` with `where: brandId`, sets `isComplete: true`. Multiple calls are safe. DoneStep uses a `useEffect` with a ref guard to prevent duplicate fetches in StrictMode.

### 2. BrandOnboarding record doesn't exist
**Risk:** If brand was created outside onboarding flow (or data corruption), no `BrandOnboarding` row exists.
**Mitigation:** Completion API uses `upsert` — creates the record with `isComplete: true` if it doesn't exist.

### 3. User manually navigates to /onboarding after completing
**Risk:** User re-enters onboarding flow, creates duplicate brands or confusion.
**Mitigation:** Onboarding page component checks `isComplete` via a lightweight API call on mount. If `true`, redirects to `/dashboard` immediately. This is a client-side check since the onboarding page is a client component.

### 4. Race conditions with concurrent requests
**Risk:** Two tabs hit completion API simultaneously.
**Mitigation:** `upsert` is atomic at the DB level. Both calls set the same value (`true`). No conflict possible.

### 5. User has BrandMembership but no BrandOnboarding
**Risk:** Dashboard gate queries `BrandOnboarding` and gets null.
**Mitigation:** Treat missing `BrandOnboarding` same as `isComplete: false` → redirect to onboarding. The onboarding flow will create the record naturally.

### 6. User has multiple brands
**Risk:** Which brand's onboarding state controls the gate?
**Mitigation:** Follow existing pattern — `findFirst` ordered by `createdAt: "asc"` gets the first brand. Check that brand's onboarding state. Consistent with current dashboard logic.

### 7. ConnectStep "skip" path
**Risk:** User clicks "Continue" on connect step without connecting anything.
**Mitigation:** This already works — ConnectStep's Continue button goes to `?step=done`. DoneStep marks completion. No change needed.

## Conclusion
All edge cases have clear mitigations. The core approach (idempotent upsert + client-side re-entry guard) handles the identified risks cleanly.
