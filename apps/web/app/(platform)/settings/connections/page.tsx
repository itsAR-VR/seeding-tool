"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BrandData {
  id: string;
  name: string;
  connections: Array<{
    provider: string;
    status: string;
    externalId?: string | null;
  }>;
}

function ConnectionsContent() {
  const searchParams = useSearchParams();
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unipileApiKey, setUnipileApiKey] = useState("");
  const [unipileAccountId, setUnipileAccountId] = useState("");
  const [unipileSaving, setUnipileSaving] = useState(false);
  const [unipileMessage, setUnipileMessage] = useState<string | null>(null);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  useEffect(() => {
    fetchBrand();
  }, []);

  async function fetchBrand() {
    try {
      const res = await fetch("/api/brands/current");
      if (res.ok) {
        setBrand(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function getConnection(provider: string) {
    return brand?.connections.find((c) => c.provider === provider);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
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
              onClick={() => (window.location.href = "/onboarding")}
            >
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSaveUnipile() {
    if (!brand || !unipileApiKey.trim()) return;
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
      if (res.ok) {
        setUnipileMessage("Unipile connected successfully!");
        setUnipileApiKey("");
        setUnipileAccountId("");
        fetchBrand();
      } else {
        const data = await res.json();
        setUnipileMessage(`Error: ${data.error || "Failed to save"}`);
      }
    } catch {
      setUnipileMessage("Network error saving credentials");
    } finally {
      setUnipileSaving(false);
    }
  }

  const gmailConn = getConnection("gmail");
  const shopifyConn = getConnection("shopify");
  const unipileConn = getConnection("unipile");

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
          ✅ Gmail connected successfully!
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Connection failed:{" "}
          {error === "oauth_denied"
            ? "OAuth access was denied"
            : error === "no_refresh_token"
              ? "No refresh token — try revoking access at myaccount.google.com and reconnecting"
              : error === "forbidden"
                ? "You don't have access to this brand"
                : "An error occurred. Please try again."}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Gmail */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">📧 Gmail</CardTitle>
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
                <strong>{gmailConn.externalId}</strong>
              </p>
            ) : (
              <Button
                variant="outline"
                onClick={() =>
                  (window.location.href = `/api/auth/gmail?brandId=${brand.id}`)
                }
              >
                Connect Gmail
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Shopify */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">🛍️ Shopify</CardTitle>
              <Badge variant={shopifyConn?.status === "connected" ? "default" : "secondary"}>
                {shopifyConn?.status === "connected" ? "Connected" : "Not connected"}
              </Badge>
            </div>
            <CardDescription>
              {shopifyConn?.status === "connected"
                ? `Connected to ${shopifyConn.externalId}`
                : "Automate product seeding and order fulfillment."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>
              {shopifyConn?.status === "connected"
                ? "Manage"
                : "Connect Shopify"}{" "}
              <span className="ml-2 text-xs text-muted-foreground">
                Coming soon
              </span>
            </Button>
          </CardContent>
        </Card>

        {/* Unipile (Instagram DMs) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">📱 Unipile</CardTitle>
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
            {unipileMessage && (
              <div
                className={`rounded border p-2 text-sm ${
                  unipileMessage.startsWith("Error")
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-green-200 bg-green-50 text-green-800"
                }`}
              >
                {unipileMessage}
              </div>
            )}
            {unipileConn?.status === "connected" ? (
              <p className="text-sm text-muted-foreground">
                Instagram DM integration is active. Daily limit: 20 DMs per brand.
              </p>
            ) : (
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Unipile API Key"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={unipileApiKey}
                  onChange={(e) => setUnipileApiKey(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Unipile Account ID (optional)"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={unipileAccountId}
                  onChange={(e) => setUnipileAccountId(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleSaveUnipile}
                  disabled={unipileSaving || !unipileApiKey.trim()}
                >
                  {unipileSaving ? "Saving…" : "Connect Unipile"}
                </Button>
              </div>
            )}
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
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  );
}
