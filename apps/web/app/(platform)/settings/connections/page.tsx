"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/app-icon";
import { buttonVariants } from "@/components/ui/button-variants";
import { safeReturnPath } from "@/lib/safe-return-path";

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
  ConnectionStatus,
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
  // Creator search runs on Apify: ready when the company has a key or may use the shared one.
  const [searchReady, setSearchReady] = useState<boolean | null>(null);
  useEffect(() => {
    void fetch("/api/settings/apify")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { hasOwnKey?: boolean; usesShared?: boolean } | null) =>
        setSearchReady(Boolean(d?.hasOwnKey || d?.usesShared)),
      )
      .catch(() => setSearchReady(false));
  }, []);
  const [shopifyForm, setShopifyForm] = useState({
    storeDomain: "",
    accessToken: "",
    apiSecret: "",
    oauthShop: "",
  });

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");
  // Only ever send people back to a path on this site (never "javascript:" or another domain).
  const returnTo = safeReturnPath(initialReturnTo ?? searchParams.get("returnTo"));
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
          message: body?.error ?? "Couldn't load your connections.",
        });
        setOverview(null);
        return;
      }

      setOverview((await res.json()) as ConnectionsOverviewResponse);
    } catch {
      setLoadError({ status: 0, message: "Check your internet connection and try again." });
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
      gmail: "Gmail is connected.",
      instagram: "Instagram is connected.",
      shopify: "Shopify is connected.",
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
        throw new Error(await readErrorMessage(res, "Couldn't switch. Try again."));
      }

      setProviderMessage(provider, {
        tone: "success",
        text:
          method === "oauth"
            ? "Switched to signing in. Finish connecting to turn it on."
            : "Switched to pasting a token. Fill in the form below to connect.",
      });
      await refreshConnectionData();
    } catch (methodError) {
      setProviderMessage(provider, {
        tone: "error",
        text:
          methodError instanceof Error
            ? methodError.message
            : "Couldn't switch. Try again.",
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
          await readErrorMessage(res, "Couldn't disconnect Instagram. Try again.")
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
            : "Couldn't disconnect Instagram. Try again.",
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
          apiSecret: shopifyForm.apiSecret.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Couldn't connect Shopify. Check the store address and token, then try again."));
      }

      const data = (await res.json()) as { storeDomain?: string };
      const savedStoreDomain = data.storeDomain ?? shopifyForm.storeDomain.trim();

      setShopifyForm((current) => ({
        ...current,
        storeDomain: savedStoreDomain,
        accessToken: "",
        apiSecret: "",
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
            : "Couldn't connect Shopify. Check the store address and token, then try again.",
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
          await readErrorMessage(res, "Couldn't disconnect Shopify. Try again.")
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
            : "Couldn't disconnect Shopify. Try again.",
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
        throw new Error(await readErrorMessage(res, "Couldn't update your products. Try again."));
      }

      const data = (await res.json()) as {
        synced: number;
        truncated?: boolean;
      };

      setProviderMessage("shopify", {
        tone: "success",
        text: data.truncated
          ? `Updated ${data.synced} products. Some products were skipped.`
          : `Updated ${data.synced} products.`,
      });
      await refreshConnectionData();
    } catch (syncError) {
      setProviderMessage("shopify", {
        tone: "error",
        text:
          syncError instanceof Error
            ? syncError.message
            : "Couldn't update your products. Try again.",
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

  async function handleDisconnectUnipile() {
    setUnipileSaving(true);
    setProviderMessage("unipile", null);

    try {
      const res = await fetch("/api/connections/unipile", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Couldn't disconnect Instagram messages. Try again.")
        );
      }

      setProviderMessage("unipile", {
        tone: "success",
        text: "Instagram messages disconnected.",
      });
      await refreshConnectionData();
    } catch (disconnectError) {
      setProviderMessage("unipile", {
        tone: "error",
        text:
          disconnectError instanceof Error
            ? disconnectError.message
            : "Couldn't disconnect Instagram messages. Try again.",
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
  const mainProviders = [gmail, instagram, shopify].filter(Boolean);
  const connectedCount = mainProviders.filter((p) => p?.connected).length + (searchReady ? 1 : 0);
  const totalCount = mainProviders.length + 1;

  return (
    <div className={embedded ? "space-y-4" : "space-y-8"}>
      {!embedded && (
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
          <p className="mt-1 text-muted-foreground">
            The accounts this tool sends email from, creates orders in, and finds posts in.
          </p>
        </header>
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
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          That didn&apos;t connect. {errorText}
        </div>
      )}

      {!embedded && (
        <p className="font-medium">
          {connectedCount} of {totalCount} connected
          {connectedCount < totalCount ? ". Connect the rest when you're ready." : ". You're all set."}
        </p>
      )}

      <div className="grid max-w-3xl gap-4">
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

        {shopify && (
          <ShopifyConnectionCard
            provider={shopify}
            message={messages.shopify ?? null}
            switching={switchingProvider === "shopify"}
            saving={shopifySaving}
            storeDomain={shopifyForm.storeDomain}
            accessToken={shopifyForm.accessToken}
            apiSecret={shopifyForm.apiSecret}
            onApiSecretChange={(value) =>
              setShopifyForm((current) => ({ ...current, apiSecret: value }))
            }
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

        <section className="rounded-xl border bg-card" aria-labelledby="conn-search">
          <div className="flex items-start gap-4 p-5">
            <AppIcon name="search" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="conn-search" className="text-lg font-semibold">
                  Creator search
                </h2>
                <ConnectionStatus
                  connected={searchReady === true}
                  tone={searchReady === false ? "waiting" : undefined}
                  label={searchReady === null ? "Checking..." : searchReady ? "Ready" : "Needs a key"}
                />
              </div>
              <p className="text-muted-foreground">Finds creators on Instagram and Collabstr, with their emails.</p>
            </div>
          </div>
          <div className="border-t px-5 py-4">
            <Link href="/settings/creator-search" className={buttonVariants({ variant: "outline" })}>
              {searchReady ? "Manage creator search" : "Set up creator search"}
            </Link>
          </div>
        </section>

        {/* Unipile is an extra paid service. Only show it to brands that already connected it. */}
        {unipile && unipile.connected && (
          <UnipileConnectionCard
            provider={unipile}
            message={messages.unipile ?? null}
            saving={unipileSaving}
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
