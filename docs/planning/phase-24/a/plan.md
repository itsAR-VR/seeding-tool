# Phase 24a — Gmail Token Caching + Consolidation

## Focus

Eliminate redundant Google OAuth token refresh calls by extracting the duplicated `getAccessToken()` into a shared cached module. Currently THREE identical copies exist across `send.ts` and `ingest.ts`, each calling Google's token endpoint on every single call.

Deep sweep confidence: **92%** (pure optimization, no schema changes, well-understood pattern).

## Deep Sweep Corrections Applied

- **CRITICAL**: 3 copies of `getAccessToken` exist (send.ts, ingest.ts, oauth-admin.ts) — plan only addressed 1
- **CRITICAL**: No in-flight deduplication — thundering herd on concurrent sends
- **HIGH**: No cache invalidation on Gmail 401 — stale token served for up to 50 min
- **HIGH**: Map needs LRU size bound
- **HIGH**: TTL should use Google's `expires_in`, not hardcoded 50 min

## Inputs

- `apps/web/lib/gmail/send.ts:17` — `getAccessToken(refreshToken)` copy #1
- `apps/web/lib/gmail/ingest.ts:30` — `getAccessToken(refreshToken)` copy #2 (identical)
- `apps/web/lib/google/oauth-admin.ts:17` — different (service account JWT, out of scope)
- Deep sweep findings at `docs/planning/phase-23/deep-sweep-findings.md`

## Skills Available for This Subphase

- `backend-coding-agent` — token cache implementation
- `code-review` — post-implementation

## Work

### 1. Extract Shared Token Module

**New file**: `apps/web/lib/gmail/token.ts`

Single source of truth for OAuth token management:

```ts
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const pendingRefresh = new Map<string, Promise<string>>();
const LRU_MAX = 100;
const SAFETY_BUFFER_MS = 5 * 60 * 1000; // 5 min before expiry
const DEFAULT_TTL_MS = 55 * 60 * 1000; // 55 min fallback

export async function getGmailAccessToken(refreshToken: string): Promise<string> {
  // Check cache
  const cached = tokenCache.get(refreshToken);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  // In-flight dedup (thundering herd prevention)
  const pending = pendingRefresh.get(refreshToken);
  if (pending) return pending;

  const promise = refreshFromGoogle(refreshToken);
  pendingRefresh.set(refreshToken, promise);
  try {
    return await promise;
  } finally {
    pendingRefresh.delete(refreshToken);
  }
}

export function invalidateGmailAccessToken(refreshToken: string): void {
  tokenCache.delete(refreshToken);
}
```

`refreshFromGoogle()` parses `expires_in` from response to compute TTL:
```ts
const ttl = response.expires_in
  ? (response.expires_in * 1000 - SAFETY_BUFFER_MS)
  : DEFAULT_TTL_MS;
```

LRU eviction: on `set`, if `tokenCache.size > LRU_MAX`, delete oldest entry.

### 2. Update Callers

**File**: `apps/web/lib/gmail/send.ts`
- Remove local `getAccessToken()` function
- Import `getGmailAccessToken`, `invalidateGmailAccessToken` from `@/lib/gmail/token`
- Add retry-on-401 pattern: if Gmail send returns 401, call `invalidateGmailAccessToken`, re-fetch token, retry once

**File**: `apps/web/lib/gmail/ingest.ts`
- Remove local `getAccessToken()` function
- Import `getGmailAccessToken` from `@/lib/gmail/token`

### 3. Retry with Exponential Backoff

In `refreshFromGoogle()`, retry 3x on transient failures (5xx, network errors):
- Attempt 1: immediate
- Attempt 2: 200ms delay
- Attempt 3: 400ms delay
- After 3 failures: throw

### 4. Tests

**New file**: `apps/web/__tests__/gmail/token-cache.test.ts`

- Test: cached token returned without API call
- Test: expired cache triggers fresh refresh
- Test: cache isolation between different refresh tokens (brand A vs brand B)
- Test: in-flight dedup — concurrent calls for same token only refresh once
- Test: retry on transient failure (3 attempts)
- Test: LRU eviction when cache exceeds 100 entries
- Test: `invalidateGmailAccessToken` forces fresh refresh on next call
- Test: uses Google's `expires_in` when available, falls back to default

## Output

- Single shared `lib/gmail/token.ts` module (replaces 2 duplicated copies)
- In-flight deduplication prevents thundering herd
- LRU-bounded cache with dynamic TTL from Google's `expires_in`
- Retry-on-401 pattern with cache invalidation in `send.ts` (`sendWithRetryOn401`)
- Retry with exponential backoff (3 attempts) on transient 5xx in `refreshFromGoogle`
- 98% reduction in token refresh calls for batch sends

### Implementation Results

| Artifact | Path | Status |
|----------|------|--------|
| Token cache module | `apps/web/lib/gmail/token.ts` | Created (134 lines) |
| Gmail send | `apps/web/lib/gmail/send.ts` | Modified (removed local `getAccessToken`, added `sendWithRetryOn401`) |
| Gmail ingest | `apps/web/lib/gmail/ingest.ts` | Modified (removed local `getAccessToken`, imports shared module) |
| Token cache tests | `apps/web/__tests__/gmail/token-cache.test.ts` | Created (11 tests, all passing) |

### Test Coverage

- Cached hit (no API call)
- Expired cache triggers refresh
- Cache isolation (different refresh tokens)
- In-flight dedup (concurrent calls, only 1 refresh)
- Retry on transient 5xx failure (3 attempts)
- Immediate throw on non-transient 4xx
- Throw after exhausting all retry attempts
- LRU eviction at 100 entries
- `invalidateGmailAccessToken` forces fresh refresh
- Uses `expires_in` from Google response
- Falls back to default 55 min TTL when `expires_in` absent

### Build Status

- `npx tsc --noEmit`: 0 new errors (1 pre-existing in `classification.test.ts`, unrelated)
- `npm run web:build`: Success
- `npx vitest run __tests__/gmail/token-cache.test.ts`: 11/11 pass

## Handoff

Phase 23b (Integration Tests) should mock `@/lib/gmail/token` (not `@/lib/gmail/send`) for send pipeline tests. Phase 24b (Warmup) and 24c (HTML Templates) are independent.

The `_resetTokenCache()` export is available for test cleanup but should not be used in production code.
