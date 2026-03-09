const SHOPIFY_API_VERSION = "2024-01";

interface WebhookEntry {
  id: number;
  topic: string;
  address: string;
  format: string;
}

interface ShopifyWebhookResponse {
  webhooks: WebhookEntry[];
}

interface ShopifyWebhookCreateResponse {
  webhook: WebhookEntry;
}

const REQUIRED_TOPICS = [
  "orders/create",
  "orders/fulfilled",
  "orders/updated",
  "fulfillments/create",
  "fulfillments/update",
] as const;

function shopifyFetch(
  storeDomain: string,
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      ...options.headers,
    },
  });
}

/**
 * List all webhooks currently registered for the store.
 */
export async function listWebhooks(
  storeDomain: string,
  accessToken: string
): Promise<WebhookEntry[]> {
  const res = await shopifyFetch(storeDomain, accessToken, "/webhooks.json");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list webhooks: ${text}`);
  }
  const data = (await res.json()) as ShopifyWebhookResponse;
  return data.webhooks || [];
}

/**
 * Register required webhooks for Seed Scale.
 * Idempotent: checks existing webhooks first, only creates missing ones.
 */
export async function registerWebhooks(
  storeDomain: string,
  accessToken: string,
  callbackBaseUrl: string
): Promise<{ created: string[]; existing: string[]; errors: string[] }> {
  const callbackUrl = `${callbackBaseUrl}/api/webhooks/shopify`;

  // Fetch existing webhooks
  const existing = await listWebhooks(storeDomain, accessToken);
  const existingTopics = new Set(
    existing
      .filter((w) => w.address === callbackUrl)
      .map((w) => w.topic)
  );

  const created: string[] = [];
  const alreadyExisting: string[] = [];
  const errors: string[] = [];

  for (const topic of REQUIRED_TOPICS) {
    if (existingTopics.has(topic)) {
      alreadyExisting.push(topic);
      continue;
    }

    try {
      const res = await shopifyFetch(
        storeDomain,
        accessToken,
        "/webhooks.json",
        {
          method: "POST",
          body: JSON.stringify({
            webhook: {
              topic,
              address: callbackUrl,
              format: "json",
            },
          }),
        }
      );

      if (res.ok) {
        const data = (await res.json()) as ShopifyWebhookCreateResponse;
        if (data.webhook?.id) {
          created.push(topic);
        }
      } else {
        const errText = await res.text();
        errors.push(`${topic}: ${errText}`);
      }
    } catch (err) {
      errors.push(
        `${topic}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return { created, existing: alreadyExisting, errors };
}

/**
 * Remove our webhooks on disconnect.
 * Only removes webhooks pointing to our callback URL.
 */
export async function cleanupWebhooks(
  storeDomain: string,
  accessToken: string,
  callbackBaseUrl: string
): Promise<{ removed: number; errors: string[] }> {
  const callbackUrl = `${callbackBaseUrl}/api/webhooks/shopify`;

  const webhooks = await listWebhooks(storeDomain, accessToken);
  const ours = webhooks.filter((w) => w.address === callbackUrl);

  let removed = 0;
  const errors: string[] = [];

  for (const webhook of ours) {
    try {
      const res = await shopifyFetch(
        storeDomain,
        accessToken,
        `/webhooks/${webhook.id}.json`,
        { method: "DELETE" }
      );

      if (res.ok || res.status === 404) {
        removed++;
      } else {
        const errText = await res.text();
        errors.push(`webhook ${webhook.id} (${webhook.topic}): ${errText}`);
      }
    } catch (err) {
      errors.push(
        `webhook ${webhook.id}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return { removed, errors };
}
