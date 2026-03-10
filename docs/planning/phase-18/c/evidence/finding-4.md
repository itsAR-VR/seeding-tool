# Finding 4 — Unsafe credential UX

## Status
Masked-input behavior already existed; phase-18 adds explicit operator-facing verification guidance and re-verifies the masked fields.

## Acceptance bar
Access tokens and API keys masked; no raw secret in page source / operator-facing UI.

## Files touched this turn
- `apps/web/app/(platform)/settings/connections/page.tsx`

## What changed
- Added helper copy under Shopify manual credentials clarifying that tokens are masked, cleared after save, and should be verified via connection state / sync status.
- Added helper copy under Unipile manual credentials clarifying that API keys stay masked and the connected-state card is the verification signal.

## Verification
### Code verification
- `apps/web/app/(platform)/settings/connections/page.tsx` contains password fields for both secrets:
  - Shopify token input at line matching `type="password"` near placeholder `Access Token`
  - Unipile API key input at line matching `type="password"` near placeholder `Unipile API Key`
- `./node_modules/.bin/eslint "app/(platform)/settings/connections/page.tsx"` ✅
- `npm run build` ✅

### Browser verification
- Connections screenshot: `/home/podhi/.openclaw/media/browser/87461b29-534e-4bdb-ab77-fde0bac6730c.png`
  - Verified masked secret fields are rendered as password inputs with placeholder-only display.
  - Verified new helper copy is visible under Shopify and Unipile credential forms.

## Remaining gap
The page still lacks a reveal toggle, which the subphase spec lists as the preferred UX. Current status is safe and clearer, but not yet the final polish target.
