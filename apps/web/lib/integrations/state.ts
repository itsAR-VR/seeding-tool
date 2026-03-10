import "server-only";

import type { Prisma } from "@prisma/client";

import { decrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import {
  getAllowedCredentialTypes,
  getDefaultConnectionMethod,
  isIntegrationMethod,
  isProviderCredentialType,
  supportsMethod,
  type IntegrationMethod,
  type IntegrationProvider,
  type ProviderCredentialType,
} from "@/lib/integrations/methods";

type ConnectionDbClient = Prisma.TransactionClient | typeof prisma;

type PersistCredentialInput = {
  brandId: string;
  provider: IntegrationProvider;
  label?: string | null;
  encryptedValue: string;
  credentialType: ProviderCredentialType;
  expiresAt?: Date | null;
  isValid?: boolean;
};

type PersistConnectionInput = {
  brandId: string;
  provider: IntegrationProvider;
  status: string;
  connectionMethod: IntegrationMethod;
  externalId?: string | null;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null;
};

export function normalizeConnectionMethod(
  provider: IntegrationProvider,
  value: string | null | undefined
): IntegrationMethod {
  if (value && isIntegrationMethod(value) && supportsMethod(provider, value)) {
    return value;
  }

  return getDefaultConnectionMethod(provider);
}

export function credentialMatchesMethod(
  provider: IntegrationProvider,
  method: IntegrationMethod,
  credentialType: string | null | undefined
) {
  if (!credentialType || !isProviderCredentialType(credentialType)) {
    return false;
  }

  return getAllowedCredentialTypes(provider, method).includes(credentialType);
}

export async function upsertProviderCredential(
  tx: ConnectionDbClient,
  input: PersistCredentialInput
) {
  return tx.providerCredential.upsert({
    where: {
      brandId_provider: {
        brandId: input.brandId,
        provider: input.provider,
      },
    },
    update: {
      label: input.label ?? null,
      encryptedValue: input.encryptedValue,
      credentialType: input.credentialType,
      expiresAt: input.expiresAt ?? null,
      isValid: input.isValid ?? true,
    },
    create: {
      brandId: input.brandId,
      provider: input.provider,
      label: input.label ?? null,
      encryptedValue: input.encryptedValue,
      credentialType: input.credentialType,
      expiresAt: input.expiresAt ?? null,
      isValid: input.isValid ?? true,
    },
  });
}

export async function upsertBrandConnection(
  tx: ConnectionDbClient,
  input: PersistConnectionInput
) {
  return tx.brandConnection.upsert({
    where: {
      brandId_provider: {
        brandId: input.brandId,
        provider: input.provider,
      },
    },
    update: {
      status: input.status,
      connectionMethod: input.connectionMethod,
      externalId: input.externalId ?? null,
      metadata: input.metadata ?? undefined,
    },
    create: {
      brandId: input.brandId,
      provider: input.provider,
      status: input.status,
      connectionMethod: input.connectionMethod,
      externalId: input.externalId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function disconnectProvider(
  tx: ConnectionDbClient,
  brandId: string,
  provider: IntegrationProvider
) {
  const existingConnection = await tx.brandConnection.findFirst({
    where: { brandId, provider },
  });

  const method = normalizeConnectionMethod(
    provider,
    existingConnection?.connectionMethod
  );

  await tx.providerCredential.updateMany({
    where: { brandId, provider },
    data: { isValid: false },
  });

  await upsertBrandConnection(tx, {
    brandId,
    provider,
    status: "disconnected",
    connectionMethod: method,
    externalId: existingConnection?.externalId ?? null,
    metadata: (existingConnection?.metadata as Prisma.InputJsonValue | null) ?? undefined,
  });
}

export async function switchProviderMethod(
  brandId: string,
  provider: IntegrationProvider,
  method: IntegrationMethod
) {
  if (!supportsMethod(provider, method)) {
    throw new Error(`Method ${method} is not supported for ${provider}`);
  }

  await prisma.$transaction(async (tx) => {
    const [credential, connection] = await Promise.all([
      tx.providerCredential.findFirst({
        where: { brandId, provider },
      }),
      tx.brandConnection.findFirst({
        where: { brandId, provider },
      }),
    ]);

    const credentialStillValid =
      Boolean(credential?.isValid) &&
      credentialMatchesMethod(provider, method, credential?.credentialType);

    if (credential && credential.isValid && !credentialStillValid) {
      await tx.providerCredential.update({
        where: { id: credential.id },
        data: { isValid: false },
      });
    }

    await upsertBrandConnection(tx, {
      brandId,
      provider,
      status:
        credentialStillValid && connection?.status === "connected"
          ? "connected"
          : "disconnected",
      connectionMethod: method,
      externalId: connection?.externalId ?? null,
      metadata:
        (connection?.metadata as Prisma.InputJsonValue | null) ?? undefined,
    });
  });
}

export async function resolveProviderCredential(
  brandId: string,
  provider: IntegrationProvider
) {
  const [credential, connection] = await Promise.all([
    prisma.providerCredential.findFirst({
      where: { brandId, provider, isValid: true },
    }),
    prisma.brandConnection.findFirst({
      where: { brandId, provider },
    }),
  ]);

  const method = normalizeConnectionMethod(provider, connection?.connectionMethod);
  const matchesMethod = credentialMatchesMethod(
    provider,
    method,
    credential?.credentialType
  );

  let decryptedValue: string | null = null;
  if (credential && matchesMethod) {
    try {
      decryptedValue = decrypt(credential.encryptedValue);
    } catch {
      // Decryption can fail if APP_ENCRYPTION_KEY is misconfigured.
      // Return null so callers that only need connection status still work.
    }
  }

  return {
    provider,
    method,
    connection,
    credential,
    credentialMatchesMethod: matchesMethod,
    connected: Boolean(matchesMethod && connection?.status === "connected"),
    decryptedValue,
  };
}
