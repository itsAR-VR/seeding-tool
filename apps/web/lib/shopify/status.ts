import { prisma } from "@/lib/prisma";

type ShopifyConnectionMetadata = {
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  lastSyncedCount?: number | null;
  truncated?: boolean | null;
};

export type ShopifyConnectionStatus = {
  connected: boolean;
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
  const [credential, connection] = await Promise.all([
    prisma.providerCredential.findFirst({
      where: {
        brandId,
        provider: "shopify",
        isValid: true,
      },
    }),
    prisma.brandConnection.findFirst({
      where: {
        brandId,
        provider: "shopify",
      },
    }),
  ]);

  const metadata = parseMetadata(connection?.metadata);

  return {
    connected: Boolean(credential),
    storeDomain: connection?.externalId ?? credential?.label ?? undefined,
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
