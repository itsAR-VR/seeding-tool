# Gmail OAuth Verification Prep

## Current code path
- OAuth start route: `apps/web/app/api/auth/gmail/route.ts`
- OAuth callback route: `apps/web/app/api/auth/gmail/callback/route.ts`
- Connection surface: `apps/web/app/(platform)/settings/connections/page.tsx`

## Scopes currently requested
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/userinfo.email`

## Redirect URLs
- `${NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
- Local fallback in code when env is absent:
  - `http://localhost:3000/api/auth/gmail/callback`

## What the app uses Gmail for
- Send outreach emails from the connected Gmail account
- Read mailbox state for reply handling
- Modify Gmail state for message processing
- Read the authenticated Google email address and persist it as the connection label / alias

## Screenshots to capture
- `[PLACEHOLDER: screenshot path]` Connections page before Gmail connect
- `[PLACEHOLDER: screenshot path]` Google consent screen
- `[PLACEHOLDER: screenshot path]` Connections page after Gmail connect showing the primary sender
- `[PLACEHOLDER: screenshot path]` Inbox send flow using the connected alias

## Support / legal fields
- Support URL: `[PLACEHOLDER: support URL]`
- Privacy policy URL: `[PLACEHOLDER: privacy policy URL]`
- Terms of service URL: `[PLACEHOLDER: terms URL]`

## Identity placeholders
- App name: `[PLACEHOLDER: app name]`
- Company name: `[PLACEHOLDER: company name]`
- Logo URL: `[PLACEHOLDER: logo URL]`

## Reviewer notes
- Current operational sender for this phase: `ar@soramedia.co`
- Reconnect logic should preserve `ar@soramedia.co` as the primary alias when it already exists on the brand
- If test users remain in place during this phase, keep `ar@soramedia.co` explicitly listed in the Google test-user set

## Submission checklist
- [ ] Consent-screen app name finalized
- [ ] Support / privacy / terms URLs finalized
- [ ] Production redirect URL verified against deployed `NEXT_PUBLIC_APP_URL`
- [ ] Screenshots captured from the live production environment
- [ ] Google test-user list includes `ar@soramedia.co`
- [ ] Scope justification text written for send / read / modify usage
