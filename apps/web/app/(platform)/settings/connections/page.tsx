"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
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

interface BrandData {
  id: string;
  name: string;
  connections: Array<{
    provider: string;
    status: string;
    externalId?: string | null;
  }>;
}

interface ShopifyConnectionState {
  connected: boolean;
  storeDomain?: string;
}


type FlashMessage =
  | {
      tone: "success" | "error";
      text: string;
    }
  | null;

function FeedbackBanner({ message }: { message: FlashMessage }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        message.tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      {message.text}
    </div>
  );
}

function ConnectionsContent() {
  const searchParams = useSearchParams();
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);

  const [shopifyState, setShopifyState] = useState<ShopifyConnectionState>({
    connected: false,
  });
  const [shopifyStoreDomain, setShopifyStoreDomain] = useState("");
  const [shopifyAccessToken, setShopifyAccessToken] = useState("");
  const [shopifySaving, setShopifySaving] = useState(false);
  const [shopifyMessage, setShopifyMessage] = useState<FlashMessage>(null);

  const [unipileApiKey, setUnipileApiKey] = useState("");
  const [unipileAccountId, setUnipileAccountId] = useState("");
  const [unipileSaving, setUnipileSaving] = useState(false);
  const [unipileMessage, setUnipileMessage] = useState<FlashMessage>(null);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  useEffect(() => {
    void refreshConnectionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshConnectionData() {
    setLoading(true);
    await Promise.allSettled([
      fetchBrand(),
      fetchShopifyConnection(),
    ]);
    setLoading(false);
  }

  async function fetchBrand() {
    try {
      const res = await fetch("/api/brands/current");
      if (res.ok) {
        setBrand((await res.json()) as BrandData);
      } else {
        setBrand(null);
      }
    } catch {
      setBrand(null);
    }
  }

  async function fetchShopifyConnection() {
    try {
      const res = await fetch("/api/connections/shopify");
      if (res.ok) {
        setShopifyState((await res.json()) as ShopifyConnectionState);
        return;
      }
    } catch {
      // ignore
    }
    setShopifyState({ connected: false });
  }

  function getConnection(provider: string) {
    return brand?.connections.find((connection) => connection.provider === provider);
  }

  async function readErrorMessage(res: Response, fallback: string) {
    const payload = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return payload?.error || fallback;
  }

  async function handleSaveShopify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopifyStoreDomain.trim() || !shopifyAccessToken.trim()) {
      return;
    }

    setShopifySaving(true);
    setShopifyMessage(null);

    try {
      const res = await fetch("/api/connections/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeDomain: shopifyStoreDomain.trim(),
          accessToken: shopifyAccessToken.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to connect Shopify"));
      }

      const data = (await res.json()) as ShopifyConnectionState;
      setShopifyAccessToken("");
      setShopifyState(data);
      setShopifyMessage({
        tone: "success",
        text: `Shopify connected${data.storeDomain ? ` to ${data.storeDomain}` : ""}.`,
      });
      await refreshConnectionData();
    } catch (saveError) {
      setShopifyMessage({
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
    setShopifyMessage(null);

    try {
      const res = await fetch("/api/connections/shopify", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Failed to disconnect Shopify")
        );
      }

      setShopifyState({ connected: false });
      setShopifyStoreDomain("");
      setShopifyAccessToken("");
      setShopifyMessage({ tone: "success", text: "Shopify disconnected." });
      await refreshConnectionData();
    } catch (disconnectError) {
      setShopifyMessage({
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

  async function handleSaveUnipile() {
    if (!brand || !unipileApiKey.trim()) {
      return;
    }

    setUnipileSaving(true);
    setUnipileMessage(null);

    try {
      const res = await fetch("/api/connections/unipile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: unipileApiKey.trim(),
          accountId: unipileAccountId.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to save Unipile"));
      }

      setUnipileMessage({
        tone: "success",
        text: "Unipile connected successfully.",
      });
      setUnipileApiKey("");
      setUnipileAccountId("");
      await fetchBrand();
    } catch (saveError) {
      setUnipileMessage({
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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No brand found. Complete onboarding first.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                window.location.href = "/onboarding";
              }}
            >
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const gmailConn = getConnection("gmail");
  const shopifyConn = getConnection("shopify");
  const unipileConn = getConnection("unipile");

  const shopifyConnected =
    shopifyState.connected || shopifyConn?.status === "connected";

  const shopifyDomain = shopifyState.storeDomain ?? shopifyConn?.externalId ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
        <p className="text-muted-foreground">
          Manage your connected services and integrations.
        </p>
      </div>

      {connected === "gmail" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Gmail connected successfully.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Connection failed:{" "}
          {error === "oauth_denied"
            ? "OAuth access was denied."
            : error === "no_refresh_token"
              ? "No refresh token returned. Revoke access in Google Account and reconnect."
              : error === "forbidden"
                ? "You do not have access to this brand."
                : "An error occurred. Please try again."}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Gmail</CardTitle>
              <Badge variant={gmailConn?.status === "connected" ? "default" : "secondary"}>
                {gmailConn?.status === "connected" ? "Connected" : "Not connected"}
              </Badge>
            </div>
            <CardDescription>
              {gmailConn?.status === "connected"
                ? `Connected as ${gmailConn.externalId}`
                : "Send outreach emails through your Gmail account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {gmailConn?.status === "connected" ? (
              <p className="text-sm text-muted-foreground">
                Outreach emails will be sent from{" "}
                <strong>{gmailConn.externalId}</strong>.
              </p>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = `/api/auth/gmail?brandId=${brand.id}`;
                }}
              >
                Connect Gmail
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Shopify</CardTitle>
              <Badge variant={shopifyConnected ? "default" : "secondary"}>
                {shopifyConnected ? "Connected" : "Not connected"}
              </Badge>
            </div>
            <CardDescription>
              {shopifyConnected
                ? `Connected to ${shopifyDomain}`
                : "Automate product seeding and order fulfillment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeedbackBanner message={shopifyMessage} />
            {shopifyConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connected store: <strong>{shopifyDomain}</strong>
                </p>
                <Button
                  variant="destructive"
                  onClick={handleDisconnectShopify}
                  disabled={shopifySaving}
                >
                  {shopifySaving ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            ) : (
              <form className="space-y-2" onSubmit={handleSaveShopify}>
                <Input
                  type="text"
                  placeholder="Store domain"
                  value={shopifyStoreDomain}
                  onChange={(event) => setShopifyStoreDomain(event.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Access Token"
                  value={shopifyAccessToken}
                  onChange={(event) => setShopifyAccessToken(event.target.value)}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    shopifySaving ||
                    !shopifyStoreDomain.trim() ||
                    !shopifyAccessToken.trim()
                  }
                >
                  {shopifySaving ? "Connecting..." : "Connect Shopify"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Unipile</CardTitle>
              <Badge variant={unipileConn?.status === "connected" ? "default" : "secondary"}>
                {unipileConn?.status === "connected" ? "Connected" : "Not connected"}
              </Badge>
            </div>
            <CardDescription>
              {unipileConn?.status === "connected"
                ? "Instagram DMs enabled via Unipile"
                : "Send Instagram DMs to creators via Unipile messaging API."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeedbackBanner message={unipileMessage} />
            {unipileConn?.status === "connected" ? (
              <p className="text-sm text-muted-foreground">
                Instagram DM integration is active. Daily limit: 20 DMs per brand.
              </p>
            ) : null}
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Unipile API Key"
                value={unipileApiKey}
                onChange={(event) => setUnipileApiKey(event.target.value)}
              />
              <Input
                type="text"
                placeholder="Unipile Account ID (optional)"
                value={unipileAccountId}
                onChange={(event) => setUnipileAccountId(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleSaveUnipile}
              disabled={unipileSaving || !unipileApiKey.trim()}
            >
              {unipileSaving ? "Saving..." : "Connect Unipile"}
            </Button>
          </CardContent>
        </Card>
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
