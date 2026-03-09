# Creator Search Worker

Standalone Fly.io service for Playwright-based creator verification and brand-fit scoring.

## What exists now
- `server.mjs` exposes:
  - `GET /healthz`
  - `GET /readyz`
  - `POST /v1/search` with bearer auth via `CREATOR_SEARCH_WORKER_TOKEN`
- `POST /v1/search` now runs a real path:
  - accepts a pre-filtered creator list from the app
  - optionally opens profile URLs with Playwright when `profileDump` is missing
  - scores creator-brand fit with OpenAI
  - returns `{ results, analyzed }`
- Docker image uses the official Playwright base image, so browser deps are already present in the worker image

## Required secrets
- `CREATOR_SEARCH_WORKER_TOKEN`
- `OPENAI_API_KEY`

## Local run
```bash
cd workers/creator-search
export CREATOR_SEARCH_WORKER_TOKEN=dev-token
export OPENAI_API_KEY=...
npm install
npm start
```

## Local smoke test
```bash
curl -X POST http://127.0.0.1:8080/v1/search \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{
    "brandIdentity": "Sleep/wellness brand focused on nighttime routine and self-care",
    "creators": [{ "instagram": "example", "profileDump": "wellness creator" }]
  }'
```

## Fly deploy
```bash
cd workers/creator-search
/home/podhi/.fly/bin/flyctl apps create podhi-seeding-creator-search --org personal
/home/podhi/.fly/bin/flyctl secrets set CREATOR_SEARCH_WORKER_TOKEN=$(openssl rand -hex 32) OPENAI_API_KEY=... -a podhi-seeding-creator-search
/home/podhi/.fly/bin/flyctl deploy --remote-only --ha=false
```

## Important app-side wiring
The app now supports a worker-first campaign search flow in
`apps/web/lib/workers/creator-search.ts`, but the web app must still have:
- `CREATOR_SEARCH_WORKER_BASE_URL`
- `CREATOR_SEARCH_WORKER_TOKEN`

Without those env vars, campaign search falls back to local OpenAI scoring instead of the remote worker.
