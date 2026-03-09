import { prisma } from "@/lib/prisma";
import type { IntegrationMethod } from "@/lib/integrations/methods";
import { resolveProviderCredential } from "@/lib/integrations/state";

type ShopifyConnectionMetadata = {
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  lastSyncedCount?: number | null;
  truncated?: boolean | null;
};

export type ShopifyConnectionStatus = {
  connected: boolean;
  activeMethod: IntegrationMethod;
  storeDomain?: string;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  lastSyncedCount?: number | null;
  truncated?: boolean;
};

function parseMetadata(raw: unknown): ShopifyConnectionMetadata {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const metadata = raw as ShopifyConnectionMetadata;

  return {
    lastSyncAt:
      typeof metadata.lastSyncAt === "string" ? metadata.lastSyncAt : null,
    lastSyncError:
      typeof metadata.lastSyncError === "string"
        ? metadata.lastSyncError
        : null,
    lastSyncedCount:
      typeof metadata.lastSyncedCount === "number"
        ? metadata.lastSyncedCount
        : null,
    truncated:
      typeof metadata.truncated === "boolean" ? metadata.truncated : null,
  };
}

export async function getShopifyConnectionStatus(
  brandId: string
): Promise<ShopifyConnectionStatus> {
  const resolved = await resolveProviderCredential(brandId, "shopify");
  const connection = resolved.connection;

  const metadata = parseMetadata(connection?.metadata);

  return {
    connected: resolved.connected,
    activeMethod: resolved.method,
    storeDomain:
      connection?.externalId ?? resolved.credential?.label ?? undefined,
    lastSyncAt: metadata.lastSyncAt ?? null,
    lastSyncError: metadata.lastSyncError ?? null,
    lastSyncedCount: metadata.lastSyncedCount ?? null,
    truncated: metadata.truncated ?? false,
  };
}

export async function updateShopifyConnectionStatus(
  brandId: string,
  next: {
    lastSyncAt?: string | null;
    lastSyncError?: string | null;
    lastSyncedCount?: number | null;
    truncated?: boolean | null;
  }
) {
  const existing = await prisma.brandConnection.findFirst({
    where: {
      brandId,
      provider: "shopify",
    },
  });

  if (!existing) {
    return;
  }

  const current = parseMetadata(existing.metadata);

  await prisma.brandConnection.update({
    where: { id: existing.id },
    data: {
      metadata: {
        ...current,
        ...next,
      },
    },
  });
}
