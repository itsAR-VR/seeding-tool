# Finding 6 — Connection Validation Feedback After Save: Browser Evidence

**Date:** 2026-03-10  
**QA Agent:** Phase 18 closeout lane  
**Status:** ✅ PASS (browser-verified)

---

## Test Setup

- **Page:** `http://localhost:3000/settings/connections`
- **User:** `qa-lane2@seedscale.test`
- **Test action:** Submit Shopify manual connection with invalid credentials to trigger error feedback

## Evidence

### Screenshot 1: Connections page — all 4 providers visible
- **File:** `2675beca-c76f-45ba-86e4-155de6a150e1.png`
- **What it shows:**
  - Gmail, Shopify, Instagram, Unipile provider cards
  - All showing "Not connected" status badges
  - Shopify has OAuth/Manual toggle (Manual selected)
  - Form fields: store domain + access token (masked as `type="password"`)
  - "Connect manually" button (disabled until both fields populated)

### Screenshot 2: Form filled with dummy credentials
- **File:** `2adc6d0a-bb2f-438c-a2f2-c87dd4ec70bc.png`
- **What it shows:**
  - Domain field: `test-store.myshopify.com`
  - Token field: masked (●●●●●●●●●●●●●●●●●●●)
  - "Connect manually" button now enabled

### Screenshot 3: Error validation feedback after submit
- **File:** `daec4df6-fe2b-474f-9291-da46266e0fa7.png`
- **What it shows:**
  - **Red inline FeedbackBanner** with `tone: "error"` styling:
    - `border-red-200 bg-red-50 text-red-800` CSS classes
    - Message: `Shopify validation failed: ["errors":"[API] Invalid API key or access token (Unrecognized login or wrong password)"]`
  - Feedback appears immediately after submission
  - Form fields remain populated for correction
  - Status badge still shows "Not connected" (correct, since validation failed)

## Code Verification

The `FeedbackBanner` component (line 97 of `connections/page.tsx`) implements dual-tone feedback:

```tsx
function FeedbackBanner({ message }: { message: FlashMessage }) {
  return (
    <div className={cn(
      "rounded-lg border px-3 py-2 text-sm",
      message.tone === "error"
        ? "border-red-200 bg-red-50 text-red-800"    // Error path
        : "border-green-200 bg-green-50 text-green-800" // Success path
    )}>
      {message.text}
    </div>
  );
}
```

All 4 providers have both success and error paths wired:

| Provider | Success message | Error path | Lines |
|----------|----------------|------------|-------|
| Gmail | "Gmail connected successfully." | ✅ `tone: "error"` | 264, 327 |
| Shopify | `Shopify connected to ${storeDomain}.` | ✅ `tone: "error"` (verified live) | 266, 360/409/442 |
| Instagram | "Instagram connected successfully." | ✅ `tone: "error"` | 265, 480 |
| Unipile | "Unipile connected successfully." | ✅ `tone: "error"` | 528, 534/567 |

## Verified Behaviors

| Feature | Expected | Observed | Pass? |
|---------|----------|----------|-------|
| Error feedback on invalid credentials | Visual error message | ✅ Red FeedbackBanner with Shopify API error | ✅ |
| Error tone styling | Red/destructive visual treatment | ✅ `border-red-200 bg-red-50 text-red-800` | ✅ |
| Success tone exists in code | Green success message on valid save | ✅ All 4 providers have `tone: "success"` paths | ✅ |
| Immediate feedback | No page reload required | ✅ Inline banner appears instantly | ✅ |
| Form state preserved | Fields stay populated after error | ✅ Domain and token remain in fields | ✅ |

## Note

Success toast could not be triggered without real OAuth/API credentials. However, the error feedback path was exercised live, confirming the `FeedbackBanner` component renders correctly for the `error` tone. The `success` tone uses the same component with green styling — code-verified but not live-triggered due to credential requirement.

## Conclusion

Finding 6 is **fully verified at browser level** for the error feedback path and **code-verified** for the success path. The connection validation feedback mechanism is implemented and functional. Users receive immediate, visually distinct feedback after attempting to save credentials.
