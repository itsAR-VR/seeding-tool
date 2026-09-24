"use client";

import type { FormEvent } from "react";

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
  type ConnectionOverviewItem,
  type IntegrationMethod,
} from "@/lib/integrations/methods";

import {
  FeedbackBanner,
  MethodSelector,
  ProviderGuide,
  type FlashMessage,
} from "./shared";

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{provider.label}</CardTitle>
          <Badge variant={provider.connected ? "default" : "secondary"}>
            {provider.connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        <CardDescription>{provider.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
                <p>Connected inboxes (pick one per campaign on its Outreach page):</p>
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
                Outreach emails will be sent from{" "}
                <strong>
                  {provider.details?.gmailAddress ??
                    provider.externalId ??
                    "your Gmail account"}
                </strong>
                .
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
      </CardContent>
    </Card>
  );
}

export function ShopifyConnectionCard({
  provider,
  message,
  switching,
  saving,
  storeDomain,
  accessToken,
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{provider.label}</CardTitle>
          <Badge variant={provider.connected ? "default" : "secondary"}>
            {provider.connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        <CardDescription>{provider.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <MethodSelector
          methods={provider.availableMethods}
          activeMethod={provider.activeMethod}
          disabled={switching}
          onChange={onMethodChange}
        />
        <FeedbackBanner message={message} />

        {provider.connected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connected store:{" "}
              <strong>
                {provider.details?.storeDomain ?? provider.externalId ?? "Unknown store"}
              </strong>
            </p>
            {provider.details?.lastSyncAt && (
              <p className="text-sm text-muted-foreground">
                Last sync:{" "}
                <strong>
                  {new Date(provider.details.lastSyncAt).toLocaleString()}
                </strong>
                {typeof provider.details.lastSyncedCount === "number" &&
                  ` · ${provider.details.lastSyncedCount} products`}
                {provider.details.truncated ? " · partial sync" : ""}
              </p>
            )}
            {provider.details?.lastSyncError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Last sync failed: {provider.details.lastSyncError}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onSync} disabled={saving}>
                {saving ? "Syncing..." : "Retry sync"}
              </Button>
              <Button variant="destructive" onClick={onDisconnect} disabled={saving}>
                {saving ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          </div>
        ) : provider.activeMethod === "manual" ? (
          <form className="space-y-2" onSubmit={onSave}>
            <Input
              type="text"
              placeholder="your-store.myshopify.com"
              value={storeDomain}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => onStoreDomainChange(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Access Token"
              value={accessToken}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => onAccessTokenChange(event.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={saving || !storeDomain.trim() || !accessToken.trim()}
            >
              {saving ? "Connecting..." : "Connect manually"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Use the Shopify admin domain in the form{" "}
              <code className="font-mono">your-store.myshopify.com</code>.
              Storefront domains like <code className="font-mono">sleepkalm.com</code>{" "}
              will not work with the admin token flow.
            </p>
            <ProviderGuide provider="shopify" />
            <p className="text-xs text-muted-foreground">
              Tokens are masked in the form and cleared after save. Use a fresh
              Admin API token, then verify the connection state and product sync
              result on this card.
            </p>
          </form>
        ) : (
          <div className="space-y-2">
            <Input
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
              Connect with Shopify OAuth
            </Button>
            <ProviderGuide provider="shopify" />
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{provider.label}</CardTitle>
          <Badge variant={provider.connected ? "default" : "secondary"}>
            {provider.connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        <CardDescription>{provider.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
              Connected account:{" "}
              <strong>
                @{provider.details?.instagramUsername ?? provider.externalId ?? "unknown"}
              </strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Tagged posts and mentions are checked every 15 minutes.
            </p>
            <Button variant="destructive" onClick={onDisconnect} disabled={loading}>
              {loading ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={onConnect}>
            Connect Instagram
          </Button>
        )}
        <ProviderGuide provider="instagram" />
      </CardContent>
    </Card>
  );
}

export function UnipileConnectionCard({
  provider,
  message,
  saving,
  apiKey,
  accountId,
  onApiKeyChange,
  onAccountIdChange,
  onSave,
  onDisconnect,
}: {
  provider: ConnectionOverviewItem;
  message: FlashMessage;
  saving: boolean;
  apiKey: string;
  accountId: string;
  onApiKeyChange: (value: string) => void;
  onAccountIdChange: (value: string) => void;
  onSave: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{provider.label}</CardTitle>
          <Badge variant={provider.connected ? "default" : "secondary"}>
            {provider.connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        <CardDescription>{provider.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
              Instagram DMs are active
              {provider.details?.accountId
                ? ` for account ${provider.details.accountId}`
                : ""}
              .
            </p>
            <Button variant="destructive" onClick={onDisconnect} disabled={saving}>
              {saving ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Unipile API Key"
                value={apiKey}
                onChange={(event) => onApiKeyChange(event.target.value)}
              />
              <Input
                type="text"
                placeholder="Unipile Account ID (optional)"
                value={accountId}
                onChange={(event) => onAccountIdChange(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={onSave}
              disabled={saving || !apiKey.trim()}
            >
              {saving ? "Saving..." : "Connect Unipile"}
            </Button>
            <ProviderGuide provider="unipile" />
            <p className="text-xs text-muted-foreground">
              API keys stay masked in this form. After save, use the connected
              state here as your verification signal before enabling DM sending.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
