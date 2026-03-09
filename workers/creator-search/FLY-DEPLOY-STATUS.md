# Fly Worker — Deploy Status

**Last verified:** 2026-03-09  
**Verified by:** podhi-orchestrator (seed-scale-fly-controller lane)

## Current State

| Item | Status | Notes |
|------|--------|-------|
| App exists on Fly | ✅ | `podhi-seeding-creator-search` |
| Region | `yyz` (Toronto) | Matches primary_region in fly.toml |
| Machine | `827037b6e57d28` (shared-cpu-1x, 1024MB) | |
| Deployed image | `deployment-01KK8SQH648MWWR9FSZ78JT287` | |
| CREATOR_SEARCH_WORKER_TOKEN secret | ✅ Deployed | Matches token in `apps/web/.env` |
| OPENAI_API_KEY secret | ✅ Deployed | |
| GET /healthz | ✅ Passes | Returns `authConfigured: true` |
| POST /v1/search — 401 (no token) | ✅ Correct | |
| POST /v1/search — authenticated | ✅ Correct | Proper 400 on missing required fields |
| App-side CREATOR_SEARCH_WORKER_BASE_URL | ✅ Set in `.env`/`.env.local` | `https://podhi-seeding-creator-search.fly.dev` |

## Primary Blocker 🔴

**Fly trial 5-minute machine kill.**  
Logs (3 occurrences today):
```
Trial machine stopping. To run for longer than 5m0s, add a credit card by visiting https://fly.io/trial.
```
The machine starts fine, health passes, then gets killed at the 5-minute mark.  
**Owner: AR** — add a credit card at https://fly.io/trial (or upgrade account).

## No Code Changes Needed

The scaffold is complete and functional. Every layer works when the machine is allowed to stay up.

## Vercel Env Vars (Secondary / Out of Scope)

The Vercel project isn't currently linked (`vercel link` needed). Once AR re-links/redeploys the web app, these two env vars must be set in Vercel production:
- `CREATOR_SEARCH_WORKER_BASE_URL=https://podhi-seeding-creator-search.fly.dev`
- `CREATOR_SEARCH_WORKER_TOKEN=<same token as Fly secret>`

Without these, the web app falls back to local OpenAI scoring (still works, just doesn't use the Fly worker).

## Gmail/OAuth Dependency

`/v1/search` does NOT require email. Gmail/OAuth sender work is fully decoupled from this worker.

## Quick Redeploy Command (if image rebuild needed)

```bash
cd workers/creator-search
/home/podhi/.fly/bin/flyctl deploy --remote-only --ha=false -a podhi-seeding-creator-search
```

## Restart Command (after credit card added)

```bash
/home/podhi/.fly/bin/flyctl machine start 827037b6e57d28 --app podhi-seeding-creator-search
```
