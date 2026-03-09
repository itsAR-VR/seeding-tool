import { NextResponse } from "next/server";

import { getCurrentBrandMembership } from "@/lib/integrations/brand-access";
import {
  getProviderCapability,
  integrationProviders,
  type ConnectionOverviewItem,
  type ConnectionsOverviewResponse,
} from "@/lib/integrations/methods";
import { resolveProviderCredential } from "@/lib/integrations/state";
import { prisma } from "@/lib/prisma";
import { getShopifyConnectionStatus } from "@/lib/shopify/status";

export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();

    const brand = await prisma.brand.findUnique({
      where: { id: membership.brandId },
      select: {
        id: true,
        name: true,
        emailAliases: {
          select: {
            address: true,
            isPrimary: true,
          },
          orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
        },
      },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const primaryAlias = brand.emailAliases.find((alias) => alias.isPrimary);
    const shopifyStatus = await getShopifyConnectionStatus(brand.id);

    const providers = (await Promise.all(
      integrationProviders.map(async (provider) => {
        const capability = getProviderCapability(provider);
        const state = await resolveProviderCredential(brand.id, provider);
        const details: ConnectionOverviewItem["details"] = {};

        let summary = capability.description;
        let externalId = state.connection?.externalId ?? null;

        if (provider === "gmail") {
          details.gmailAddress =
            primaryAlias?.address ?? state.connection?.externalId ?? null;
          if (details.gmailAddress && state.connected) {
            summary = `Connected as ${details.gmailAddress}`;
          }
          externalId = details.gmailAddress ?? externalId;
        }

        if (provider === "instagram") {
          const metadata =
            state.connection?.metadata &&
            typeof state.connection.metadata === "object"
              ? (state.connection.metadata as { igUsername?: string | null })
              : null;
          details.instagramUsername =
            metadata?.igUsername ?? state.connection?.externalId ?? null;
          if (details.instagramUsername && state.connected) {
            summary = `Connected as @${details.instagramUsername}`;
          }
          externalId = details.instagramUsername ?? externalId;
        }

        if (provider === "shopify") {
          details.storeDomain = shopifyStatus.storeDomain ?? null;
          details.lastSyncAt = shopifyStatus.lastSyncAt ?? null;
          details.lastSyncError = shopifyStatus.lastSyncError ?? null;
          details.lastSyncedCount = shopifyStatus.lastSyncedCount ?? null;
          details.truncated = shopifyStatus.truncated ?? false;
          if (details.storeDomain && state.connected) {
            summary = `Connected to ${details.storeDomain}`;
          }
          externalId = details.storeDomain ?? externalId;
        }

        if (provider === "unipile") {
          const metadata =
            state.connection?.metadata &&
            typeof state.connection.metadata === "object"
              ? (state.connection.metadata as { accountId?: string | null })
              : null;
          details.accountId = metadata?.accountId ?? null;
          if (state.connected) {
            summary = details.accountId
              ? `Connected · account ${details.accountId}`
              : "Connected";
          }
        }

        return {
          provider,
          label: capability.label,
          description: capability.description,
          connected: state.connected,
          status: state.connection?.status ?? "disconnected",
          availableMethods: capability.methods,
          activeMethod:
            provider === "shopify" ? shopifyStatus.activeMethod : state.method,
          credentialConfigured: state.credentialMatchesMethod,
          externalId,
          summary,
          details,
        } satisfies ConnectionOverviewItem;
      })
    )) as ConnectionOverviewItem[];

    const payload: ConnectionsOverviewResponse = {
      brand: { id: brand.id, name: brand.name },
      providers,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load connections";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "User not found" || message === "No brand found"
          ? 404
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
