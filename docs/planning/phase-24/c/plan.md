# Phase 24c — HTML Email Templates

## Focus

Replace plain-text-only outreach with rich HTML emails featuring product images, branded headers, and visible unsubscribe links. The AI drafter generates structured content that gets templated into HTML layouts.

## Inputs
- `apps/web/lib/gmail/send.ts` — `buildRawEmail()` currently hardcodes `text/plain`
- `apps/web/lib/ai/outreach-drafter.ts` — generates plain text body
- Phase 22a added `List-Unsubscribe` header — HTML emails also need visible unsubscribe link in footer
- Phase 24b warmup system must be active before sending HTML from new aliases

## Skills Available for This Subphase
- `frontend-coding-agent` — HTML email template design
- `backend-coding-agent` — multipart MIME, template rendering
- `context7-docs` — React Email or MJML docs
- `code-review` — post-implementation

## Work

### 1. Add Multipart MIME Support
**File**: `apps/web/lib/gmail/send.ts`

Update `buildRawEmail()` to support `multipart/alternative` (text + HTML).

### 2. Create Base Template
**New file**: `apps/web/lib/outreach/templates/base.ts`

Inline CSS HTML template with:
- Brand header (name, optional logo URL)
- Product image slot
- Body content area
- CTA button
- Unsubscribe footer with visible link (uses same HMAC token from Phase 22a)

### 3. Template Variable System
Variables: `{{creator.name}}`, `{{product.name}}`, `{{product.retailValue}}`, `{{product.imageUrl}}`, `{{brand.name}}`, `{{unsubscribe.url}}`

### 4. 3 Default Templates
- Initial Outreach
- Follow-Up
- Address Request

### 5. Update AI Drafter
**File**: `apps/web/lib/ai/outreach-drafter.ts`

AI generates structured content (sections, not raw text). Template fills the HTML layout.

### 6. Tests
- Test: multipart email has both text/plain and text/html parts
- Test: template variables are interpolated correctly
- Test: unsubscribe link in HTML footer has valid HMAC token
- Test: HTML renders correctly (no broken tags)

## Output
- HTML emails with product images and branded design
- Visible unsubscribe link in footer
- 3 default templates
- AI drafter outputs structured content for templating

## Handoff
Phase 24 complete. Outreach is now professional (HTML), safe (warmed up), and efficient (cached tokens).
