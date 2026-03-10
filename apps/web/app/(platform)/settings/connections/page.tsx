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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type ConnectionsOverviewResponse,
  type IntegrationMethod,
  type IntegrationProvider,
} from "@/lib/integrations/methods";
import { cn } from "@/lib/utils";

type ConnectionsContentProps = {
  embedded?: boolean;
  brandIdOverride?: string;
  initialReturnTo?: string;
  showSupportCta?: boolean;
};

type FlashMessage =
  | {
      tone: "success" | "error";
      text: string;
    }
  | null;

const SUPPORT_MAILTO =
  "mailto:ar@soramedia.co?subject=Seed%20Scale%20connection%20help";

const PROVIDER_GUIDES: Record<
  IntegrationProvider,
  {
    title: string;
    summary: string;
    bullets: string[];
  }
> = {
  gmail: {
    title: "Need help connecting Gmail?",
    summary:
      "Use the Gmail account you want outreach to send from. If Google blocks the flow or your workspace is not approved yet, our team can help complete the setup.",
    bullets: [
      "Start with the Gmail account you want to send from.",
      "If Google shows an approval or test-user warning, contact our team and we will help finish the connection.",
      "Once OAuth is fully approved, this will collapse down to a standard Google connect button.",
    ],
  },
  shopify: {
    title: "Need help connecting Shopify?",
    summary:
      "This manual setup needs your Shopify admin domain and an Admin API access token from your custom app.",
    bullets: [
      "Use your admin domain in the form your-store.myshopify.com.",
      "Create or open your Shopify custom app and copy the Admin API access token.",
      "Storefront domains like sleepkalm.com will not work for this admin-token flow.",
    ],
  },
  instagram: {
    title: "Need help connecting Instagram / Meta?",
    summary:
      "Connect the Instagram Business account that is linked to the correct Facebook page. If the Meta flow is not ready for your account, our team can guide you through the remaining steps.",
    bullets: [
      "Make sure the Instagram account is a Business or Creator account.",
      "Confirm that Instagram is linked to the Facebook page you want to monitor.",
      "If Meta blocks the flow or permissions are missing, contact our team for support.",
    ],
  },
  unipile: {
    title: "Need help connecting Unipile?",
    summary:
      "Use the API key from your Unipile workspace. The account ID is optional, but helps us target the exact mailbox or social account faster.",
    bullets: [
      "Copy the API key from your Unipile dashboard.",
      "Paste the account ID too if you already know which account should handle DMs.",
      "If you are unsure which account to use, contact our team and we will help map it.",
    ],
  },
};

function FeedbackBanner({ message }: { message: FlashMessage }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        message.tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800"
      )}
    >
      {message.text}
    </div>
  );
}

function MethodSelector({
  methods,
  activeMethod,
  disabled,
  onChange,
}: {
  methods: readonly IntegrationMethod[];
  activeMethod: IntegrationMethod;
  disabled: boolean;
  onChange: (method: IntegrationMethod) => void;
}) {
  if (methods.length === 1) {
    return (
      <div className="rounded-lg border bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
        Setup method: {methods[0] === "oauth" ? "OAuth" : "Manual credentials"}
      </div>
    );
  }

  return (
    <div className="inline-flex rounded-lg border bg-muted/30 p-1">
      {methods.map((method) => {
        const selected = method === activeMethod;
        return (
          <button
            key={method}
            type="button"
            disabled={disabled}
            onClick={() => onChange(method)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              disabled && "opacity-60"
            )}
          >
            {method === "oauth" ? "OAuth" : "Manual"}
          </button>
        );
      })}
    </div>
  );
}

function ProviderGuide({ provider }: { provider: IntegrationProvider }) {
  const guide = PROVIDER_GUIDES[provider];

  return (
    <details className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-2 text-sm">
      <summary className="cursor-pointer list-none font-medium text-foreground">
        {guide.title}
      </summary>
      <div className="mt-2 space-y-2 text-muted-foreground">
        <p>{guide.summary}</p>
        <ul className="space-y-1 pl-5 list-disc">
          {guide.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <a
          href={SUPPORT_MAILTO}
          className="inline-flex text-sm font-medium text-foreground underline underline-offset-4"
        >
          Contact our team for support
        </a>
      </div>
    </details>
  );
}

export function ConnectionsContent({
  embedded = false,
  brandIdOverride,
  initialReturnTo,
  showSupportCta = false,
}: ConnectionsContentProps = {}) {
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<ConnectionsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
        setOverview(null);
        return;
      }

      setOverview((await res.json()) as ConnectionsOverviewResponse);
    } catch {
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

  function getProvider(provider: IntegrationProvider) {
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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className={embedded ? "space-y-4" : "space-y-6"}>
        {!embedded && (
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
        )}
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No brand found. Complete onboarding first.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => {
                  window.location.href = "/onboarding";
                }}
              >
                Start Onboarding
              </Button>
              {returnTo && (
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = returnTo;
                  }}
                >
                  Back
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const gmail = getProvider("gmail");
  const instagram = getProvider("instagram");
  const shopify = getProvider("shopify");
  const unipile = getProvider("unipile");

  const errorText =
    error === "oauth_denied"
      ? "OAuth access was denied."
      : error === "no_refresh_token"
        ? "No refresh token returned. Revoke access in Google Account and reconnect."
        : error === "forbidden"
          ? "You do not have access to this brand."
          : error === "no_instagram_account"
            ? "No Instagram Business Account found. Ensure your Instagram account is connected to a Facebook Page."
            : error === "invalid_signature"
              ? "Shopify OAuth signature validation failed."
              : error === "invalid_state"
                ? "Shopify OAuth state expired. Start the connection again."
                : error
                  ? "An error occurred. Please try again."
                  : null;

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

      {showSupportCta && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/10 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Manual setup is still the default for some channels while OAuth approvals
            and public apps are still being finalized.
          </p>
          <a
            href={SUPPORT_MAILTO}
            className="inline-flex items-center justify-center rounded-lg border px-3 py-2 font-medium text-foreground"
          >
            Contact our team for support
          </a>
        </div>
      )}

      {returnTo && !embedded && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4 text-sm">
          <p className="text-muted-foreground">
            Finish connections here, then return to onboarding when you are ready.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = returnTo;
            }}
          >
            Return to Onboarding
          </Button>
        </div>
      )}

      {errorText && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Connection failed: {errorText}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {gmail && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">{gmail.label}</CardTitle>
                <Badge variant={gmail.connected ? "default" : "secondary"}>
                  {gmail.connected ? "Connected" : "Not connected"}
                </Badge>
              </div>
              <CardDescription>{gmail.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <MethodSelector
                methods={gmail.availableMethods}
                activeMethod={gmail.activeMethod}
                disabled
                onChange={() => undefined}
              />
              {gmail.connected ? (
                <p className="text-sm text-muted-foreground">
                  Outreach emails will be sent from{" "}
                  <strong>{gmail.details?.gmailAddress ?? gmail.externalId ?? "your Gmail account"}</strong>.
                </p>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    const params = new URLSearchParams({
                      brandId: brandIdOverride ?? overview.brand.id,
                    });
                    if (authReturnTo) {
                      params.set("returnTo", authReturnTo);
                    }
                    window.location.href = `/api/auth/gmail?${params.toString()}`;
                  }}
                >
                  Connect Gmail
                </Button>
              )}
              <ProviderGuide provider="gmail" />
            </CardContent>
          </Card>
        )}

        {shopify && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">{shopify.label}</CardTitle>
                <Badge variant={shopify.connected ? "default" : "secondary"}>
                  {shopify.connected ? "Connected" : "Not connected"}
                </Badge>
              </div>
              <CardDescription>{shopify.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <MethodSelector
                methods={shopify.availableMethods}
                activeMethod={shopify.activeMethod}
                disabled={switchingProvider === "shopify"}
                onChange={(method) => void handleMethodChange("shopify", method)}
              />
              <FeedbackBanner message={messages.shopify ?? null} />

              {shopify.connected ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connected store:{" "}
                    <strong>
                      {shopify.details?.storeDomain ??
                        shopify.externalId ??
                        "Unknown store"}
                    </strong>
                  </p>
                  {shopify.details?.lastSyncAt && (
                    <p className="text-sm text-muted-foreground">
                      Last sync:{" "}
                      <strong>
                        {new Date(shopify.details.lastSyncAt).toLocaleString()}
                      </strong>
                      {typeof shopify.details.lastSyncedCount === "number" &&
                        ` · ${shopify.details.lastSyncedCount} products`}
                      {shopify.details.truncated ? " · partial sync" : ""}
                    </p>
                  )}
                  {shopify.details?.lastSyncError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      Last sync failed: {shopify.details.lastSyncError}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleSyncShopify()}
                      disabled={shopifySaving}
                    >
                      {shopifySaving ? "Syncing..." : "Retry sync"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void handleDisconnectShopify()}
                      disabled={shopifySaving}
                    >
                      {shopifySaving ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                </div>
              ) : shopify.activeMethod === "manual" ? (
                <form className="space-y-2" onSubmit={(event) => void handleSaveShopify(event)}>
                  <Input
                    type="text"
                    placeholder="your-store.myshopify.com"
                    value={shopifyForm.storeDomain}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(event) =>
                      setShopifyForm((current) => ({
                        ...current,
                        storeDomain: event.target.value,
                      }))
                    }
                  />
                  <Input
                    type="password"
                    placeholder="Access Token"
                    value={shopifyForm.accessToken}
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(event) =>
                      setShopifyForm((current) => ({
                        ...current,
                        accessToken: event.target.value,
                      }))
                    }
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={
                      shopifySaving ||
                      !shopifyForm.storeDomain.trim() ||
                      !shopifyForm.accessToken.trim()
                    }
                  >
                    {shopifySaving ? "Connecting..." : "Connect manually"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Use the Shopify admin domain in the form{" "}
                    <code className="font-mono">your-store.myshopify.com</code>.
                    Storefront domains like <code className="font-mono">sleepkalm.com</code>{" "}
                    will not work with the admin token flow.
                  </p>
                  <ProviderGuide provider="shopify" />
                  <p className="text-xs text-muted-foreground">
                    Tokens are masked in the form and cleared after save. Use a fresh Admin API token, then verify the connection state and product sync result on this card.
                  </p>
                </form>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="your-store.myshopify.com"
                    value={shopifyForm.oauthShop}
                    onChange={(event) =>
                      setShopifyForm((current) => ({
                        ...current,
                        oauthShop: event.target.value,
                      }))
                    }
                  />
                  <Button
                    variant="outline"
                    disabled={!shopifyForm.oauthShop.trim()}
                    onClick={() => {
                      window.location.href = buildShopifyOAuthUrl(
                        brandIdOverride ?? overview.brand.id
                      );
                    }}
                  >
                    Connect with Shopify OAuth
                  </Button>
                  <ProviderGuide provider="shopify" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {instagram && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">{instagram.label}</CardTitle>
                <Badge variant={instagram.connected ? "default" : "secondary"}>
                  {instagram.connected ? "Connected" : "Not connected"}
                </Badge>
              </div>
              <CardDescription>{instagram.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <MethodSelector
                methods={instagram.availableMethods}
                activeMethod={instagram.activeMethod}
                disabled
                onChange={() => undefined}
              />
              <FeedbackBanner message={messages.instagram ?? null} />
              {instagram.connected ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connected account:{" "}
                    <strong>
                      @{instagram.details?.instagramUsername ?? instagram.externalId ?? "unknown"}
                    </strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tagged posts and mentions are checked every 15 minutes.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDisconnectInstagram()}
                    disabled={instagramLoading}
                  >
                    {instagramLoading ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    const params = new URLSearchParams({
                      brandId: brandIdOverride ?? overview.brand.id,
                    });
                    if (authReturnTo) {
                      params.set("returnTo", authReturnTo);
                    }
                    window.location.href = `/api/auth/instagram?${params.toString()}`;
                  }}
                >
                  Connect Instagram
                </Button>
              )}
              <ProviderGuide provider="instagram" />
            </CardContent>
          </Card>
        )}

        {unipile && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">{unipile.label}</CardTitle>
                <Badge variant={unipile.connected ? "default" : "secondary"}>
                  {unipile.connected ? "Connected" : "Not connected"}
                </Badge>
              </div>
              <CardDescription>{unipile.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <MethodSelector
                methods={unipile.availableMethods}
                activeMethod={unipile.activeMethod}
                disabled
                onChange={() => undefined}
              />
              <FeedbackBanner message={messages.unipile ?? null} />
              {unipile.connected ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Instagram DMs are active
                    {unipile.details?.accountId
                      ? ` for account ${unipile.details.accountId}`
                      : ""}.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDisconnectUnipile()}
                    disabled={unipileSaving}
                  >
                    {unipileSaving ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="Unipile API Key"
                      value={unipileForm.apiKey}
                      onChange={(event) =>
                        setUnipileForm((current) => ({
                          ...current,
                          apiKey: event.target.value,
                        }))
                      }
                    />
                    <Input
                      type="text"
                      placeholder="Unipile Account ID (optional)"
                      value={unipileForm.accountId}
                      onChange={(event) =>
                        setUnipileForm((current) => ({
                          ...current,
                          accountId: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void handleSaveUnipile()}
                    disabled={unipileSaving || !unipileForm.apiKey.trim()}
                  >
                    {unipileSaving ? "Saving..." : "Connect Unipile"}
                  </Button>
                  <ProviderGuide provider="unipile" />
                  <p className="text-xs text-muted-foreground">
                    API keys stay masked in this form. After save, use the connected state here as your verification signal before enabling DM sending.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  );
}
