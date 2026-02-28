# Audit Runbook

## Environment Variables
- RUN_ID (defaults to timestamp)
- AHA_MARKETING_BASE_URL
- AHA_PLATFORM_BASE_URL
- COMPETITOR_SITES
- CAPTURE_MODE (baseline|motion|both)
- MAX_ROUTES, MAX_DEPTH, RATE_LIMIT_MS
- ALLOW_DESTRUCTIVE, ALLOW_WRITES

## OAuth Bootstrap
Run `npm run audit:platform:bootstrap` in headed mode. Complete Google login manually, then proceed through onboarding and select sample data.

## Anti-bot Hygiene (Competitors)
- Run headed mode (HEADLESS=false)
- Use RATE_LIMIT_MS 500–1500
- If challenge detected, solve manually and rerun

## Safety Flags
- ALLOW_DESTRUCTIVE=0 by default
- ALLOW_WRITES=1 only for safe onboarding/test data
