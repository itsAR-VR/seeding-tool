"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  type ConnectionOverviewItem,
  type ConnectionsOverviewResponse,
  type IntegrationMethod,
  type IntegrationProvider,
} from "@/lib/integrations/methods";
import {
  GmailConnectionCard,
  InstagramConnectionCard,
  ShopifyConnectionCard,
  UnipileConnectionCard,
} from "./provider-cards";
import {
  ConnectionsErrorState,
  ConnectionsLoadingState,
  ConnectionsReturnBanner,
  ConnectionsSupportBanner,
  getConnectionErrorText,
  type FlashMessage,
  type LoadError,
} from "./shared";

type ConnectionsContentProps = {
  embedded?: boolean;
  brandIdOverride?: string;
  initialReturnTo?: string;
  showSupportCta?: boolean;
};

function ConnectionsContent({
  embedded = false,
  brandIdOverride,
  initialReturnTo,
  showSupportCta = false,
}: ConnectionsContentProps = {}) {
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<ConnectionsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const [messages, setMessages] = useState<
    Partial<Record<IntegrationProvider, FlashMessage>>
  >({});
  const [switchingProvider, setSwitchingProvider] =
    useState<IntegrationProvider | null>(null);
  const [shopifySaving, setShopifySaving] = useState(false);
  const [instagramLoading, setInstagramLoading] = useState(false);
  const [unipileSaving, setUnipileSaving] = useState(false);
  const [shopifyForm, setShopifyForm] = useState({
    storeDomain: "",
    accessToken: "",
    oauthShop: "",
  });
  const [unipileForm, setUnipileForm] = useState({
    apiKey: "",
    accountId: "",
  });

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");
  const returnTo = initialReturnTo ?? searchParams.get("returnTo");
  const authReturnTo = useMemo(() => {
    if (!returnTo) {
      return undefined;
    }
    const params = new URLSearchParams({
      returnTo,
      ...(brandIdOverride ? { brandId: brandIdOverride } : {}),
    });
    return `/settings/connections?${params.toString()}`;
  }, [brandIdOverride, returnTo]);

  const refreshConnectionData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (brandIdOverride) {
        params.set("brandId", brandIdOverride);
      }
      const res = await fetch(
        params.size > 0
          ? `/api/connections/overview?${params.toString()}`
          : "/api/connections/overview"
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setLoadError({
          status: res.status,
          message: body?.error ?? "Failed to load connections",
        });
        setOverview(null);
        return;
      }

      setOverview((await res.json()) as ConnectionsOverviewResponse);
    } catch {
      setLoadError({ status: 0, message: "Network error" });
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [brandIdOverride]);

  useEffect(() => {
    void refreshConnectionData();
  }, [refreshConnectionData]);

  useEffect(() => {
    if (!connected) {
      return;
    }

    const provider = connected as IntegrationProvider;
    const textByProvider: Partial<Record<IntegrationProvider, string>> = {
      gmail: "Gmail connected successfully.",
      instagram: "Instagram connected successfully.",
      shopify: "Shopify connected successfully.",
    };

    if (textByProvider[provider]) {
      setMessages((current) => ({
        ...current,
        [provider]: {
          tone: "success",
          text: textByProvider[provider]!,
        },
      }));
    }
  }, [connected]);

  function setProviderMessage(provider: IntegrationProvider, message: FlashMessage) {
    setMessages((current) => ({
      ...current,
      [provider]: message,
    }));
  }

  function getProvider(provider: IntegrationProvider): ConnectionOverviewItem | null {
    return overview?.providers.find((item) => item.provider === provider) ?? null;
  }

  async function readErrorMessage(res: Response, fallback: string) {
    const payload = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;

    return payload?.error || fallback;
  }

  async function handleMethodChange(
    provider: IntegrationProvider,
    method: IntegrationMethod
  ) {
    setSwitchingProvider(provider);
    setProviderMessage(provider, null);

    try {
      const res = await fetch(`/api/connections/${provider}/method`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to switch method"));
      }

      setProviderMessage(provider, {
        tone: "success",
        text:
          method === "oauth"
            ? "Switched to OAuth. Finish reconnecting to activate this provider."
            : "Switched to manual credentials. Finish setup to activate this provider.",
      });
      await refreshConnectionData();
    } catch (methodError) {
      setProviderMessage(provider, {
        tone: "error",
        text:
          methodError instanceof Error
            ? methodError.message
            : "Failed to switch connection method.",
      });
    } finally {
      setSwitchingProvider(null);
    }
  }

  async function handleDisconnectInstagram() {
    setInstagramLoading(true);
    setProviderMessage("instagram", null);

    try {
      const res = await fetch("/api/connections/instagram", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Failed to disconnect Instagram")
        );
      }

      setProviderMessage("instagram", {
        tone: "success",
        text: "Instagram disconnected.",
      });
      await refreshConnectionData();
    } catch (disconnectError) {
      setProviderMessage("instagram", {
        tone: "error",
        text:
          disconnectError instanceof Error
            ? disconnectError.message
            : "Failed to disconnect Instagram.",
      });
    } finally {
      setInstagramLoading(false);
    }
  }

  async function handleSaveShopify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopifyForm.storeDomain.trim() || !shopifyForm.accessToken.trim()) {
      return;
    }

    setShopifySaving(true);
    setProviderMessage("shopify", null);

    try {
      const res = await fetch("/api/connections/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeDomain: shopifyForm.storeDomain.trim(),
          accessToken: shopifyForm.accessToken.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to connect Shopify"));
      }

      const data = (await res.json()) as { storeDomain?: string };
      const savedStoreDomain = data.storeDomain ?? shopifyForm.storeDomain.trim();

      setShopifyForm((current) => ({
        ...current,
        storeDomain: savedStoreDomain,
        accessToken: "",
      }));
      setProviderMessage("shopify", {
        tone: "success",
        text: `Shopify connected to ${savedStoreDomain}.`,
      });
      await refreshConnectionData();
    } catch (saveError) {
      setProviderMessage("shopify", {
        tone: "error",
        text:
          saveError instanceof Error
            ? saveError.message
            : "Failed to connect Shopify.",
      });
    } finally {
      setShopifySaving(false);
    }
  }

  async function handleDisconnectShopify() {
    setShopifySaving(true);
    setProviderMessage("shopify", null);

    try {
      const res = await fetch("/api/connections/shopify", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Failed to disconnect Shopify")
        );
      }

      setProviderMessage("shopify", {
        tone: "success",
        text: "Shopify disconnected.",
      });
      await refreshConnectionData();
    } catch (disconnectError) {
      setProviderMessage("shopify", {
        tone: "error",
        text:
          disconnectError instanceof Error
            ? disconnectError.message
            : "Failed to disconnect Shopify.",
      });
    } finally {
      setShopifySaving(false);
    }
  }

  async function handleSyncShopify() {
    setShopifySaving(true);
    setProviderMessage("shopify", null);

    try {
      const res = await fetch("/api/products/sync", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to sync products"));
      }

      const data = (await res.json()) as {
        synced: number;
        truncated?: boolean;
      };

      setProviderMessage("shopify", {
        tone: "success",
        text: data.truncated
          ? `Shopify sync completed with a partial catalog (${data.synced} products).`
          : `Shopify sync completed (${data.synced} products).`,
      });
      await refreshConnectionData();
    } catch (syncError) {
      setProviderMessage("shopify", {
        tone: "error",
        text:
          syncError instanceof Error
            ? syncError.message
            : "Failed to sync products.",
      });
    } finally {
      setShopifySaving(false);
    }
  }

  function buildShopifyOAuthUrl(brandId: string) {
    const params = new URLSearchParams({
      brandId,
      shop: shopifyForm.oauthShop.trim(),
    });

    if (authReturnTo) {
      params.set("returnTo", authReturnTo);
    }

    return `/api/auth/shopify?${params.toString()}`;
  }

  async function handleSaveUnipile() {
    if (!overview?.brand.id || !unipileForm.apiKey.trim()) {
      return;
    }

    setUnipileSaving(true);
    setProviderMessage("unipile", null);

    try {
      const res = await fetch("/api/connections/unipile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: unipileForm.apiKey.trim(),
          accountId: unipileForm.accountId.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to save Unipile"));
      }

      setProviderMessage("unipile", {
        tone: "success",
        text: "Unipile connected successfully.",
      });
      setUnipileForm({ apiKey: "", accountId: "" });
      await refreshConnectionData();
    } catch (saveError) {
      setProviderMessage("unipile", {
        tone: "error",
        text:
          saveError instanceof Error
            ? saveError.message
            : "Network error saving credentials.",
      });
    } finally {
      setUnipileSaving(false);
    }
  }

  async function handleDisconnectUnipile() {
    setUnipileSaving(true);
    setProviderMessage("unipile", null);

    try {
      const res = await fetch("/api/connections/unipile", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Failed to disconnect Unipile")
        );
      }

      setProviderMessage("unipile", {
        tone: "success",
        text: "Unipile disconnected.",
      });
      await refreshConnectionData();
    } catch (disconnectError) {
      setProviderMessage("unipile", {
        tone: "error",
        text:
          disconnectError instanceof Error
            ? disconnectError.message
            : "Failed to disconnect Unipile.",
      });
    } finally {
      setUnipileSaving(false);
    }
  }

  if (loading) return <ConnectionsLoadingState />;

  if (!overview) {
    return (
      <ConnectionsErrorState
        embedded={embedded}
        loadError={loadError}
        returnTo={returnTo}
        onRetry={() => void refreshConnectionData()}
        onReturn={() => {
          window.location.href = returnTo ?? "/dashboard";
        }}
      />
    );
  }

  const gmail = getProvider("gmail");
  const instagram = getProvider("instagram");
  const shopify = getProvider("shopify");
  const unipile = getProvider("unipile");

  const errorText = getConnectionErrorText(error);

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground">
            Manage your connected services and choose how each provider authenticates.
          </p>
        </div>
      )}

      {showSupportCta && <ConnectionsSupportBanner />}

      {returnTo && !embedded && (
        <ConnectionsReturnBanner
          returnTo={returnTo}
          onReturn={() => {
            window.location.href = returnTo;
          }}
        />
      )}

      {errorText && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Connection failed: {errorText}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {gmail && (
          <GmailConnectionCard
            provider={gmail}
            message={messages.gmail ?? null}
            onConnect={() => {
              const params = new URLSearchParams({
                brandId: brandIdOverride ?? overview.brand.id,
              });
              if (authReturnTo) {
                params.set("returnTo", authReturnTo);
              }
              window.location.href = `/api/auth/gmail?${params.toString()}`;
            }}
          />
        )}

        {shopify && (
          <ShopifyConnectionCard
            provider={shopify}
            message={messages.shopify ?? null}
            switching={switchingProvider === "shopify"}
            saving={shopifySaving}
            storeDomain={shopifyForm.storeDomain}
            accessToken={shopifyForm.accessToken}
            oauthShop={shopifyForm.oauthShop}
            onMethodChange={(method) => void handleMethodChange("shopify", method)}
            onStoreDomainChange={(value) =>
              setShopifyForm((current) => ({ ...current, storeDomain: value }))
            }
            onAccessTokenChange={(value) =>
              setShopifyForm((current) => ({ ...current, accessToken: value }))
            }
            onOauthShopChange={(value) =>
              setShopifyForm((current) => ({ ...current, oauthShop: value }))
            }
            onSave={(event) => void handleSaveShopify(event)}
            onDisconnect={() => void handleDisconnectShopify()}
            onSync={() => void handleSyncShopify()}
            onOAuthConnect={() => {
              window.location.href = buildShopifyOAuthUrl(
                brandIdOverride ?? overview.brand.id,
              );
            }}
          />
        )}

        {instagram && (
          <InstagramConnectionCard
            provider={instagram}
            message={messages.instagram ?? null}
            loading={instagramLoading}
            onConnect={() => {
              const params = new URLSearchParams({
                brandId: brandIdOverride ?? overview.brand.id,
              });
              if (authReturnTo) {
                params.set("returnTo", authReturnTo);
              }
              window.location.href = `/api/auth/instagram?${params.toString()}`;
            }}
            onDisconnect={() => void handleDisconnectInstagram()}
          />
        )}

        {unipile && (
          <UnipileConnectionCard
            provider={unipile}
            message={messages.unipile ?? null}
            saving={unipileSaving}
            apiKey={unipileForm.apiKey}
            accountId={unipileForm.accountId}
            onApiKeyChange={(value) =>
              setUnipileForm((current) => ({ ...current, apiKey: value }))
            }
            onAccountIdChange={(value) =>
              setUnipileForm((current) => ({ ...current, accountId: value }))
            }
            onSave={() => void handleSaveUnipile()}
            onDisconnect={() => void handleDisconnectUnipile()}
          />
        )}
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<ConnectionsLoadingState />}>
      <ConnectionsContent />
    </Suspense>
  );
}
