/**
 * Apify Instagram Email Finder provider.
 *
 * Uses the express_jet/instagram-email-finder actor to extract
 * contact emails from public Instagram profiles.
 */

const ACTOR_ID = "express_jet/instagram-email-finder";
const POLL_INTERVAL_MS = 5_000;
const MAX_WAIT_MS = 120_000;

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "").toLowerCase().trim();
}

type ApifyRunResponse = {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
};

type ApifyDatasetItem = {
  username?: string;
  email?: string;
  emails?: string[];
  [key: string]: unknown;
};

/**
 * Find emails for a batch of Instagram handles via Apify.
 *
 * @returns Map of normalized handle → email
 */
export async function findEmailsByInstagramHandles(
  handles: string[]
): Promise<Map<string, string>> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN is required for email enrichment");
  }

  if (handles.length === 0) {
    return new Map();
  }

  const normalized = handles.map(normalizeHandle);

  // Start actor run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: normalized.map((h) => ({
          url: `https://www.instagram.com/${h}/`,
        })),
      }),
    }
  );

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Apify actor start failed: ${startRes.status} ${errText}`);
  }

  const runData = (await startRes.json()) as ApifyRunResponse;
  const runId = runData.data.id;

  // Poll until done
  const deadline = Date.now() + MAX_WAIT_MS;
  let status = runData.data.status;

  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    if (Date.now() > deadline) {
      throw new Error(`Apify run ${runId} timed out after ${MAX_WAIT_MS}ms`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    );
    if (!pollRes.ok) continue;

    const pollData = (await pollRes.json()) as ApifyRunResponse;
    status = pollData.data.status;
  }

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify run ${runId} ended with status: ${status}`);
  }

  // Fetch dataset items
  const datasetRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}`
  );

  if (!datasetRes.ok) {
    throw new Error(`Failed to fetch Apify dataset for run ${runId}`);
  }

  const items = (await datasetRes.json()) as ApifyDatasetItem[];
  const results = new Map<string, string>();

  for (const item of items) {
    const handle = item.username
      ? normalizeHandle(item.username)
      : undefined;

    // Try email field first, then emails array
    const email = item.email || (item.emails && item.emails[0]);

    if (handle && email) {
      results.set(handle, email);
    }
  }

  return results;
}
