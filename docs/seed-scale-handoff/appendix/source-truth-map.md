# Source Truth Map

## Evidence set used

Primary evidence for this handoff:

- `docs/seed-source-2026-03-01/Seed-Scale.txt`
- `docs/seed-source-2026-03-01/Airtable-Database-Guide.txt`
- `docs/seed-source-2026-03-01/Automations-Walkthrough-transcript.txt`
- `docs/n8n-audit-2026-03-01/workflow-node-audit.md`
- all `[AC]` workflow JSON files under `docs/n8n-audit-2026-03-01/`

## Verified `[AC]` workflow metadata

### `[AC] (1) Instagram Following [PROD]`

- file: `docs/n8n-audit-2026-03-01/-AC-1-Instagram-Following-PROD-.json`
- id: `klEpcDpBNWMOliSX`
- active: `true`
- nodes: `68`
- disabled nodes: `0`
- triggers:
  - `Schedule Trigger`
  - `Error Trigger`
- key integrations:
  - `phantombusterApi`, `apifyApi`, `openAiApi`
  - `airtableTokenApi`
  - `googleSheetsOAuth2Api`
  - `slackOAuth2Api`, `discordWebhookApi`

### `[AC] (2) Follow Up Seeding [PROD]`

- file: `docs/n8n-audit-2026-03-01/-AC-2-Follow-Up-Seeding-PROD-.json`
- id: `gt1mI7ckbbQuKuew`
- active: `true`
- nodes: `34`
- disabled nodes: `0`
- triggers:
  - `Google Sheets Trigger`
  - `Schedule Trigger`
  - `Error Trigger`
- key integrations:
  - `gmailOAuth2`
  - `airtableTokenApi`
  - `googleSheetsTriggerOAuth2Api`
  - `discordWebhookApi`

### `[AC] (3) (4) Answer Email & Get Address & Shopify [PROD]`

- file: `docs/n8n-audit-2026-03-01/-AC-3-4-Answer-Email-Get-Address-Shopify-PROD-.json`
- id: `xQu2HGg7lMhuqOsi`
- active: `true`
- nodes: `47`
- disabled nodes: `0`
- triggers:
  - `Gmail Trigger`
  - `manualTrigger` (test/manual path)
  - `Error Trigger`
- key integrations:
  - `gmailOAuth2`
  - `openAiApi`
  - `shopifyAccessTokenApi`
  - `airtableTokenApi`
  - `discordWebhookApi`

### `[AC] (7) (8) (9) Mentions [TESTING]`

- file: `docs/n8n-audit-2026-03-01/-AC-7-8-9-Mentions-TESTING-.json`
- id: `cTgOL46Fwj1o0iHu`
- active: `true`
- nodes: `52`
- disabled nodes: `0`
- triggers:
  - `Schedule Trigger`
  - `Schedule Trigger1`
  - `Shopify Trigger`
  - `Webhook`
  - `Webhook Events`
  - `Error Trigger`
- key integrations:
  - `shopifyAccessTokenApi`
  - `gmailOAuth2`
  - `openAiApi`
  - `airtableTokenApi`
  - `discordWebhookApi`
  - Cloudinary endpoint via HTTP node

### `[AC] Costs COGS + Tools - Seeding Orders`

- file: `docs/n8n-audit-2026-03-01/-AC-Costs-COGS-Tools---Seeding-Orders.json`
- id: `zjgm4l9fldEaHxav`
- active: `true`
- nodes: `6`
- disabled nodes: `0`
- trigger:
  - `Schedule Trigger`
- key integrations:
  - `httpHeaderAuth`
  - `airtableTokenApi`
  - `googleSheetsOAuth2Api`

### `[AC] Message System [Draft]`

- file: `docs/n8n-audit-2026-03-01/-AC-Message-System-Draft-.json`
- id: `zCAQ4IjyvVc1cY1k`
- active: `true`
- nodes: `38`
- disabled nodes: `2` (`Schedule Trigger`, `Schedule Trigger1`)
- triggers:
  - `Webhook`
  - `Error Trigger`
  - schedule triggers exist but disabled
- key integrations:
  - `httpBearerAuth`, `httpHeaderAuth`
  - `airtableTokenApi`
  - `googleSheetsOAuth2Api`
  - `discordWebhookApi`

## Airtable source map

Known repeated base/table references in workflow exports:

- base id `appSt3GpYPstPjpl2`
- people table id `tblR6Il1syV9muGlZ`
- mentions table id `tblUloopZCJyZD2WW` (in mentions flow)
- cost table id `tbluyYSIPiTWVFvQg` (in costs flow)

Examples:

- `docs/n8n-audit-2026-03-01/-AC-3-4-Answer-Email-Get-Address-Shopify-PROD-.json:56`
- `docs/n8n-audit-2026-03-01/-AC-2-Follow-Up-Seeding-PROD-.json:553`
- `docs/n8n-audit-2026-03-01/-AC-7-8-9-Mentions-TESTING-.json:720`
- `docs/n8n-audit-2026-03-01/-AC-Costs-COGS-Tools---Seeding-Orders.json:98`

## Hardcoded brand-coupled values (sample map)

### Email and brand copy

- subject string `Kalm - Partnership!` in follow-up and reply filters:
  - `docs/n8n-audit-2026-03-01/-AC-2-Follow-Up-Seeding-PROD-.json:8`
  - `docs/n8n-audit-2026-03-01/-AC-3-4-Answer-Email-Get-Address-Shopify-PROD-.json:831`

### Product page and branded messaging

- `clubkalm.com` URL embedded in prompts/messages:
  - `docs/n8n-audit-2026-03-01/-AC-2-Follow-Up-Seeding-PROD-.json:376`
  - `docs/n8n-audit-2026-03-01/-AC-3-4-Answer-Email-Get-Address-Shopify-PROD-.json:1501`
  - `docs/n8n-audit-2026-03-01/-AC-7-8-9-Mentions-TESTING-.json:198`

### Shopify store slug and order links

- `kalmwellness` appears in URL composition:
  - `docs/n8n-audit-2026-03-01/-AC-3-4-Answer-Email-Get-Address-Shopify-PROD-.json:1581`
  - `docs/n8n-audit-2026-03-01/-AC-Costs-COGS-Tools---Seeding-Orders.json:24`

### Product and variant IDs

- product id references:
  - `docs/n8n-audit-2026-03-01/-AC-3-4-Answer-Email-Get-Address-Shopify-PROD-.json:687`
  - `docs/n8n-audit-2026-03-01/-AC-7-8-9-Mentions-TESTING-.json:3429`
- variant id references:
  - `docs/n8n-audit-2026-03-01/-AC-7-8-9-Mentions-TESTING-.json:3422`
  - `docs/n8n-audit-2026-03-01/-AC-Costs-COGS-Tools---Seeding-Orders.json:35`

### External endpoints

- OpenAI chat completions endpoint:
  - `docs/n8n-audit-2026-03-01/-AC-3-4-Answer-Email-Get-Address-Shopify-PROD-.json:2046`
  - `docs/n8n-audit-2026-03-01/-AC-3-4-Answer-Email-Get-Address-Shopify-PROD-.json:2954`
- Unipile endpoint in draft message system:
  - `docs/n8n-audit-2026-03-01/-AC-Message-System-Draft-.json:96`
  - `docs/n8n-audit-2026-03-01/-AC-Message-System-Draft-.json:179`
- Cloudinary upload endpoint:
  - `docs/n8n-audit-2026-03-01/-AC-7-8-9-Mentions-TESTING-.json:2843`

## Security and data handling observations

- Exported workflow JSON includes token-like and credential-linked values in code/params.
- Some flows include sample personal email/message payload data in exported execution snapshots.
- Immediate action: remove sensitive values from versioned artifacts and rotate exposed credentials.

## Final note

This map is intentionally operational. It is designed to let a new developer locate the exact nodes/paths that need refactor when parameterizing for new brands.
