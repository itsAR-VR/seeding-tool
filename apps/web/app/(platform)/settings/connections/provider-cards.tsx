"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ConnectionOverviewItem,
  type IntegrationMethod,
} from "@/lib/integrations/methods";

import {
  FeedbackBanner,
  MethodSelector,
  ProviderCardShell,
  ProviderGuide,
  type FlashMessage,
} from "./shared";

/**
 * Disconnect is never the loudest thing on the card: a quiet outline button
 * that asks once, inline, before anything happens.
 */
function DisconnectButton({
  name,
  busy,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (busy) {
    return (
      <Button variant="outline" disabled className="text-destructive">
        Disconnecting...
      </Button>
    );
  }

  if (!confirming) {
    return (
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        Disconnect
      </Button>
    );
  }

  return (
    <div role="group" aria-label={`Disconnect ${name}`} className="flex flex-wrap items-center gap-2">
      <span className="text-sm">Disconnect {name}?</span>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        Yes, disconnect
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Keep it
      </Button>
    </div>
  );
}

export function GmailConnectionCard({
  provider,
  message,
  onConnect,
}: {
  provider: ConnectionOverviewItem;
  message: FlashMessage;
  onConnect: () => void;
}) {
  return (
    <ProviderCardShell provider={provider}>
      <MethodSelector
        methods={provider.availableMethods}
        activeMethod={provider.activeMethod}
        disabled
        onChange={() => undefined}
      />
      <FeedbackBanner message={message} />
      {provider.connected ? (
        <div className="space-y-3">
          {(provider.details?.gmailAddresses?.length ?? 0) > 1 ? (
            <div className="text-sm text-muted-foreground">
              <p>Connected inboxes. Each campaign can use a different one.</p>
              <ul className="mt-1 list-disc pl-5">
                {provider.details?.gmailAddresses?.map((address) => (
                  <li key={address}>
                    <strong>{address}</strong>
                    {address === provider.details?.gmailAddress ? " (default)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your emails to creators send from this address.
            </p>
          )}
          <Button variant="outline" onClick={onConnect}>
            Connect another Gmail
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={onConnect}>
          Connect Gmail
        </Button>
      )}
      <ProviderGuide provider="gmail" />
    </ProviderCardShell>
  );
}

export function ShopifyConnectionCard({
  provider,
  message,
  switching,
  saving,
  storeDomain,
  accessToken,
  apiSecret,
  onApiSecretChange,
  oauthShop,
  onMethodChange,
  onStoreDomainChange,
  onAccessTokenChange,
  onOauthShopChange,
  onSave,
  onDisconnect,
  onSync,
  onOAuthConnect,
}: {
  provider: ConnectionOverviewItem;
  message: FlashMessage;
  switching: boolean;
  saving: boolean;
  storeDomain: string;
  accessToken: string;
  apiSecret: string;
  onApiSecretChange: (value: string) => void;
  oauthShop: string;
  onMethodChange: (method: IntegrationMethod) => void;
  onStoreDomainChange: (value: string) => void;
  onAccessTokenChange: (value: string) => void;
  onOauthShopChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDisconnect: () => void;
  onSync: () => void;
  onOAuthConnect: () => void;
}) {
  return (
    <ProviderCardShell provider={provider}>
      {!provider.connected && (
        <MethodSelector
          methods={provider.availableMethods}
          activeMethod={provider.activeMethod}
          disabled={switching}
          onChange={onMethodChange}
        />
      )}
      <FeedbackBanner message={message} />

      {provider.connected ? (
        <div className="space-y-3">
          {provider.details?.lastSyncAt && (
            <p className="text-sm text-muted-foreground">
              {typeof provider.details.lastSyncedCount === "number"
                ? `${provider.details.lastSyncedCount} products`
                : "Products"}{" "}
              last updated{" "}
              {new Date(provider.details.lastSyncAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {provider.details.truncated ? " (some were skipped)" : ""}
            </p>
          )}
          {provider.details?.lastSyncError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              Couldn&apos;t update your products: {provider.details.lastSyncError}. Try
              Update products again, or email us if it keeps happening.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onSync} disabled={saving}>
              {saving ? "Updating..." : "Update products"}
            </Button>
            <DisconnectButton name="Shopify" busy={saving} onConfirm={onDisconnect} />
          </div>
        </div>
      ) : provider.activeMethod === "manual" ? (
        <form className="space-y-3" onSubmit={onSave}>
          <div className="space-y-1">
            <Label htmlFor="shopify-store">Shopify store address</Label>
            <Input
              id="shopify-store"
              type="text"
              placeholder="your-store.myshopify.com"
              value={storeDomain}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => onStoreDomainChange(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Ends in .myshopify.com. Your public website address won&apos;t work here.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="shopify-token">Admin API access token</Label>
            <Input
              id="shopify-token"
              type="password"
              value={accessToken}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => onAccessTokenChange(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shopify-secret">API secret key</Label>
            <Input
              id="shopify-secret"
              type="password"
              value={apiSecret}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => onApiSecretChange(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Lets Shopify tell this tool when a gift order ships.
            </p>
          </div>
          <Button
            type="submit"
            disabled={saving || !storeDomain.trim() || !accessToken.trim()}
          >
            {saving ? "Connecting..." : "Connect Shopify"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Both keys stay hidden and are cleared from this form once saved.
          </p>
          <ProviderGuide provider="shopify" />
        </form>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="shopify-oauth-store">Shopify store address</Label>
          <Input
            id="shopify-oauth-store"
            type="text"
            placeholder="your-store.myshopify.com"
            value={oauthShop}
            onChange={(event) => onOauthShopChange(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={!oauthShop.trim()}
            onClick={onOAuthConnect}
          >
            Sign in with Shopify
          </Button>
          <ProviderGuide provider="shopify" />
        </div>
      )}
    </ProviderCardShell>
  );
}

export function InstagramConnectionCard({
  provider,
  message,
  loading,
  onConnect,
  onDisconnect,
}: {
  provider: ConnectionOverviewItem;
  message: FlashMessage;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <ProviderCardShell provider={provider}>
      <MethodSelector
        methods={provider.availableMethods}
        activeMethod={provider.activeMethod}
        disabled
        onChange={() => undefined}
      />
      <FeedbackBanner message={message} />
      {provider.connected ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Posts, reels, and stories that tag this account show up on the Content page.
          </p>
          <AccountPicker provider={provider} />
          <DisconnectButton name="Instagram" busy={loading} onConfirm={onDisconnect} />
        </div>
      ) : (
        <Button variant="outline" onClick={onConnect}>
          Connect Instagram
        </Button>
      )}
      <ProviderGuide provider="instagram" />
    </ProviderCardShell>
  );
}

/** Only shown to brands that already pay for Unipile and have connected it. */
export function UnipileConnectionCard({
  provider,
  message,
  saving,
  onDisconnect,
}: {
  provider: ConnectionOverviewItem;
  message: FlashMessage;
  saving: boolean;
  onDisconnect: () => void;
}) {
  return (
    <ProviderCardShell provider={provider}>
      <FeedbackBanner message={message} />
      <p className="text-sm text-muted-foreground">
        Instagram messages to creators are sent through your Unipile account.
      </p>
      <DisconnectButton name="Instagram messages" busy={saving} onConfirm={onDisconnect} />
      <ProviderGuide provider="unipile" />
    </ProviderCardShell>
  );
}

/** Lets a brand choose its Instagram account and ad account when it has several. */
function AccountPicker({ provider }: { provider: ConnectionOverviewItem }) {
  const igOptions = provider.details?.igOptions ?? [];
  const adOptions = provider.details?.adAccountOptions ?? [];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (igOptions.length <= 1 && adOptions.length <= 1) return null;

  async function save(body: { igUserId?: string; adAccountId?: string }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/connections/instagram/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Couldn't save your choice.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your choice.");
      setSaving(false);
    }
  }

  const select = "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-3 rounded-lg border p-3">
      {igOptions.length > 1 && (
        <label className="block text-sm font-medium">
          Instagram account
          <select
            className={select}
            disabled={saving}
            value={provider.details?.igUserId ?? ""}
            onChange={(e) => void save({ igUserId: e.target.value })}
          >
            {igOptions.map((o) => (
              <option key={o.igId} value={o.igId}>
                @{o.username ?? o.igId}
              </option>
            ))}
          </select>
        </label>
      )}
      {adOptions.length > 1 && (
        <label className="block text-sm font-medium">
          Ad account for new ads
          <select
            className={select}
            disabled={saving}
            value={provider.details?.adAccountId ?? ""}
            onChange={(e) => void save({ adAccountId: e.target.value })}
          >
            {adOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name ?? o.id}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
