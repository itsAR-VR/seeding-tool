# Phase 24c — HTML Email Templates

## Focus

Replace plain-text-only outreach with rich HTML emails featuring product images, branded headers, and visible unsubscribe links. The AI drafter generates structured content that gets templated into HTML layouts.

Confidence: **88%** (after corrections applied)

## Deep Sweep Corrections Applied

- [x] CRITICAL: Address ALL THREE send paths (send-pipeline.ts, inbox reply, mention-check.ts) — not just pipeline
- [x] CRITICAL: Add `bodyHtml` through entire chain: `GeneratedDraft` → `DraftToSend` → `SendEmailParams` → `buildRawEmail` → `Message` persistence
- [x] HIGH: Add `bodyHtml` to `AIDraft` model for inbox reply HTML preview
- [x] HIGH: Bulk outreach drafts are transient JSON (not AIDraft rows) — `/api/outreach/draft` returns `{ subject, body }` only; HTML must be generated at send time, not stored in AIDraft for this path
- [x] HIGH: Add HTML escaping utility for all template variable interpolation (XSS prevention)
- [x] HIGH: Gmail clips messages >102KB — add size validation, images must be URLs not data URIs
- [x] HIGH: Persist `bodyHtml` in BOTH Message creation sites (sendEmail line 241 AND send-pipeline.ts line 221)
- [x] MEDIUM: Extract unsubscribe URL generation into standalone utility (currently inside buildRawEmail)
- [x] MEDIUM: Add `bodyHtml` to `OutreachTemplate` model or wrap plain-text templates in HTML base
- [x] MEDIUM: buildRawEmail needs proper MIME boundary generation for multipart/alternative
- [x] LOW: In-Reply-To/References headers not passed by inbox reply route (threading in non-Gmail clients)

## Inputs

- `apps/web/lib/gmail/send.ts` — `buildRawEmail()` currently hardcodes `text/plain`
- `apps/web/lib/outreach/send-pipeline.ts` — `DraftToSend` type, Message creation at line 218
- `apps/web/app/api/inbox/[threadId]/send/route.ts` — second send path (inbox reply)
- `apps/web/lib/inngest/functions/mention-check.ts` — third send path (automated reminders)
- `apps/web/lib/ai/outreach-drafter.ts` — generates plain text body, `GeneratedDraft` type
- `apps/web/lib/compliance/suppression.ts` — `generateUnsubscribeToken()` for HTML footer
- Phase 22a added `List-Unsubscribe` header — HTML emails also need visible unsubscribe link in footer
- Phase 24b warmup system — cold aliases (days 1-3) should send plain text only

## Skills Available

- `backend-coding-agent` — multipart MIME, template rendering
- `frontend-coding-agent` — HTML email template design
- `tdd-guide` — test coverage
- `code-review` — post-implementation

## Work

### 0. Schema Migration

**File**: `apps/web/prisma/schema.prisma`

Add `bodyHtml String? @db.Text @map("body_html")` to:
- `AIDraft` model (for inbox reply HTML preview)

Note: `Message.bodyHtml` already exists in schema (line 945) — just needs to be written during outbound message creation. `OutreachTemplate` wraps in HTML base template at render time (no schema change needed).

### 1. HTML Escaping Utility

**New file**: `apps/web/lib/outreach/html-escape.ts`

```ts
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

Used for ALL template variable interpolation (creator name, product name, brand name).

### 2. Extract Unsubscribe URL Generation

**File**: `apps/web/lib/gmail/send.ts`

Extract unsubscribe URL construction from `buildRawEmail()` into:
```ts
export function buildUnsubscribeUrl(recipientEmail: string): string
```

This lets both the MIME header and the HTML footer template use the same URL.

### 3. Add Multipart MIME Support

**File**: `apps/web/lib/gmail/send.ts`

- Add `bodyHtml?: string` to `SendEmailParams`
- Rewrite `buildRawEmail()`:
  - When `bodyHtml` is present: emit `Content-Type: multipart/alternative; boundary="..."` with both `text/plain` and `text/html` parts
  - When `bodyHtml` is absent: keep current `text/plain` behavior (backward-compatible)
  - Use `crypto.randomUUID()` for MIME boundary
  - Add email size validation: warn if final MIME > 100KB (Gmail clipping threshold)
- Persist `bodyHtml` in the Message creation inside `sendEmail()` (line 241) for inbox reply and reminder paths

### 4. Create Base HTML Template

**New file**: `apps/web/lib/outreach/templates/base.ts`

Inline CSS HTML template (email clients strip `<style>` tags) with:
- Brand header (name, optional logo URL from `BrandSettings`)
- Product image slot (URL only, no data URIs — prevents Gmail clipping)
- Body content area (accepts pre-escaped HTML)
- CTA button
- Visible unsubscribe footer with link (uses `buildUnsubscribeUrl()`)
- Total template HTML < 50KB to leave room for body content under 102KB Gmail limit

### 5. Template Variable System

**New file**: `apps/web/lib/outreach/templates/variables.ts`

Variables: `{{creator.name}}`, `{{product.name}}`, `{{product.retailValue}}`, `{{product.imageUrl}}`, `{{brand.name}}`, `{{unsubscribe.url}}`

ALL variable values pass through `escapeHtml()` before interpolation. The `{{unsubscribe.url}}` is pre-escaped (it's a URL, not user content).

### 6. Three Default Templates

**New files**: `apps/web/lib/outreach/templates/initial-outreach.ts`, `follow-up.ts`, `address-request.ts`

Each returns `{ subject: string, bodyHtml: string, bodyText: string }` given template variables. The `bodyText` is a plain-text fallback (the `text/plain` part of multipart/alternative).

### 7. Update AI Drafter

**File**: `apps/web/lib/ai/outreach-drafter.ts`

- Add `bodyHtml?: string` to `GeneratedDraft` type
- AI generates plain text body (same as today)
- At send time: wrap AI body in the base HTML template to produce `bodyHtml`
- Do NOT make the AI generate HTML directly (fragile, hard to control)

### 8. Thread bodyHtml Through Pipeline

**File**: `apps/web/lib/outreach/send-pipeline.ts`

- Add `bodyHtml?: string` to `DraftToSend` type
- At send time: if `draft.bodyHtml` is absent, generate it by wrapping `draft.body` in base template
- Persist `bodyHtml` in the Message creation at line 221 (the pipeline's own creation path)

### 9. Update Mention-Check Reminder Path

**File**: `apps/web/lib/inngest/functions/mention-check.ts`

- After `.replace()` variable interpolation on `OutreachTemplate.body`, wrap the result in the base HTML template
- Pass both `body` (plain text) and `bodyHtml` (wrapped) to `sendEmail()`
- Use `escapeHtml()` for all variable values in the template

### 10. Warmup Gate for HTML

**File**: `apps/web/lib/outreach/send-pipeline.ts`

- Check `getEffectiveDailyLimit()` tier before sending HTML
- Days 1-3 (limit=5): send plain text only (strip `bodyHtml` from params)
- Days 4+: allow HTML

### 11. Tests

- Test: multipart email has both text/plain and text/html MIME parts
- Test: plain-text-only email (no bodyHtml) still works (backward compat)
- Test: template variables are HTML-escaped
- Test: `<script>` in creator name is escaped in HTML output
- Test: unsubscribe link in HTML footer has valid HMAC token
- Test: unsubscribe URL in footer matches List-Unsubscribe header URL
- Test: email size validation warns on >100KB
- Test: base template renders valid HTML (no unclosed tags)
- Test: bodyHtml persisted in Message for outbound emails (both creation paths)
- Test: AIDraft.bodyHtml populated for inbox reply drafts
- Test: warmup days 1-3 send plain text only
- Test: mention-check reminders include HTML when alias is warmed up

## Output

**Completed 2026-04-08**

- Multipart MIME (`multipart/alternative`) with text/plain + text/html parts
- CRLF header injection prevention via `sanitize()` on all header values
- 3 default HTML templates (initial outreach, follow-up, address request) with inline CSS
- HTML escaping on all template variables (XSS prevention)
- Visible unsubscribe link in HTML footer (uses same HMAC token as List-Unsubscribe header)
- Email size warning on >100KB (Gmail clipping threshold)
- Warmup gate: days 1-3 send plain text only via `isInEarlyWarmup()`
- All 3 send paths updated (pipeline, inbox reply, mention-check reminders)
- bodyHtml persisted in Message model for both creation paths
- 36 tests pass

### Files Created
- `apps/web/lib/outreach/html-escape.ts` — `escapeHtml()` utility
- `apps/web/lib/outreach/templates/base.ts` — base HTML email template with inline CSS
- `apps/web/lib/outreach/templates/variables.ts` — template variable interpolation
- `apps/web/lib/outreach/templates/initial-outreach.ts` — initial outreach template
- `apps/web/lib/outreach/templates/follow-up.ts` — follow-up template
- `apps/web/lib/outreach/templates/address-request.ts` — address request template
- `apps/web/__tests__/outreach/html-email.test.ts` — 36 tests

### Files Modified
- `apps/web/prisma/schema.prisma` — added `bodyHtml` to AIDraft model
- `apps/web/lib/gmail/send.ts` — multipart MIME, `buildUnsubscribeUrl()` extracted, CRLF sanitization
- `apps/web/lib/ai/outreach-drafter.ts` — `bodyHtml` on GeneratedDraft type
- `apps/web/lib/outreach/send-pipeline.ts` — `bodyHtml` on DraftToSend, warmup gate, Message persistence
- `apps/web/lib/outreach/warmup.ts` — added `isInEarlyWarmup()`
- `apps/web/lib/inngest/functions/mention-check.ts` — HTML reminder wrapping, warmup gate
- `apps/web/app/api/inbox/[threadId]/send/route.ts` — passes bodyHtml through

## Handoff

Phase 24 complete. Outreach is now professional (HTML), safe (warmed up), and efficient (cached tokens). Phase 26a can use the same template system for mention notification emails.
