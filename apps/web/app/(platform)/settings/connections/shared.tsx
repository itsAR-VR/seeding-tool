"use client";

import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  type ConnectionOverviewItem,
  type IntegrationMethod,
  type IntegrationProvider,
} from "@/lib/integrations/methods";
import { cn } from "@/lib/utils";

export type FlashMessage =
  | {
      tone: "success" | "error";
      text: string;
    }
  | null;

export type LoadError = {
  status: number;
  message: string;
} | null;

export const SUPPORT_MAILTO =
  "mailto:ar@soramedia.co?subject=Seed%20Scale%20connection%20help";

/** One plain sentence per account: what the app uses it for. */
const PROVIDER_PURPOSE: Record<IntegrationProvider, string> = {
  gmail: "Sends your emails to creators from your own Gmail address.",
  shopify: "Creates the gift orders and shows your products to pick from.",
  instagram: "Finds the posts creators make about you, and turns approved posts into ads.",
  unipile: "Sends Instagram messages to creators. This is a separate paid service.",
};

const PROVIDER_GUIDES: Record<
  IntegrationProvider,
  {
    title: string;
    summary: string;
    bullets: string[];
  }
> = {
  gmail: {
    title: "Help connecting Gmail",
    summary: "Sign in with the Gmail account you want your creator emails to come from.",
    bullets: [
      "Google may say the app is unverified. Click Advanced, then Continue.",
      "If Google blocks you or asks for approval, email us and we'll finish it with you.",
    ],
  },
  shopify: {
    title: "Help connecting Shopify",
    summary:
      "You need your store's Shopify address and a token from a custom app in your Shopify admin.",
    bullets: [
      "Your Shopify address ends in .myshopify.com. Your public website address won't work.",
      "In Shopify admin, open Settings, then Apps, then Develop apps. Create an app and copy its Admin API access token.",
      "Copy the API secret key from the same app so order updates reach this tool.",
    ],
  },
  instagram: {
    title: "Help connecting Instagram",
    summary:
      "Sign in with Facebook and pick the Instagram account that belongs to your brand.",
    bullets: [
      "The Instagram account must be a Business or Creator account.",
      "It must be linked to your brand's Facebook page.",
      "If Facebook says a permission is missing, email us and we'll walk you through it.",
    ],
  },
  unipile: {
    title: "Help with Unipile",
    summary: "Unipile is a separate paid service. You only need it to send Instagram messages.",
    bullets: [
      "Copy the API key from your Unipile dashboard.",
      "If you're not sure which account to use, email us and we'll help.",
    ],
  },
};

/** Shared card frame: name, status in words, and what the account is for. */
export function ProviderCardShell({
  provider,
  children,
}: {
  provider: ConnectionOverviewItem;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{provider.label}</h2>
          <span
            className={cn(
              "text-sm font-medium",
              provider.connected ? "text-green-700 dark:text-green-400" : "text-muted-foreground",
            )}
          >
            {provider.connected ? "Connected" : "Not connected yet"}
          </span>
        </div>
        <p className="text-muted-foreground">{PROVIDER_PURPOSE[provider.provider]}</p>
        {provider.connected && provider.summary && provider.summary !== "Connected" && (
          <p className="text-sm font-medium">{provider.summary}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function FeedbackBanner({ message }: { message: FlashMessage }) {
  if (!message) {
    return null;
  }

  return (
    <div
      role={message.tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        message.tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800",
      )}
    >
      {message.text}
    </div>
  );
}

export function MethodSelector({
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
  // One way to connect: nothing to choose, so show nothing.
  if (methods.length === 1) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">How do you want to connect?</p>
      <div className="inline-flex rounded-lg border bg-muted/30 p-1" role="radiogroup">
        {methods.map((method) => {
          const selected = method === activeMethod;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(method)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                disabled && "opacity-60",
              )}
            >
              {method === "oauth" ? "Sign in" : "Paste a token"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProviderGuide({ provider }: { provider: IntegrationProvider }) {
  const guide = PROVIDER_GUIDES[provider];

  return (
    <details className="rounded-lg border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-foreground">{guide.title}</summary>
      <div className="mt-2 space-y-2 text-muted-foreground">
        <p>{guide.summary}</p>
        <ul className="list-disc space-y-1 pl-5">
          {guide.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <a
          href={SUPPORT_MAILTO}
          className="inline-flex text-sm font-medium text-foreground underline underline-offset-4"
        >
          Email us for help
        </a>
      </div>
    </details>
  );
}

export function ConnectionsLoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

export function ConnectionsErrorState({
  embedded,
  loadError,
  returnTo,
  onRetry,
  onReturn,
}: {
  embedded: boolean;
  loadError: LoadError;
  returnTo?: string | null;
  onRetry: () => void;
  onReturn: () => void;
}) {
  const isAuthError = loadError?.status === 401;
  const isNotFound = loadError?.status === 404;

  return (
    <div className={embedded ? "space-y-4" : "space-y-8"}>
      {!embedded && <h1 className="text-3xl font-bold tracking-tight">Connections</h1>}
      <section className="rounded-xl border bg-card py-8 text-center">
        <p className="text-muted-foreground">
          {isAuthError
            ? "You've been signed out. Refresh the page to sign in again."
            : isNotFound
              ? "You haven't set up your brand yet. Go to the dashboard to start."
              : "Couldn't load your connections. Try again in a moment."}
        </p>
        {!isAuthError && !isNotFound && loadError?.message && (
          <p className="mt-2 text-sm text-muted-foreground">Details: {loadError.message}</p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {isAuthError ? (
            <Button onClick={() => window.location.reload()}>Refresh page</Button>
          ) : isNotFound ? (
            <Button onClick={() => onReturn()}>Go to dashboard</Button>
          ) : (
            <Button onClick={onRetry}>Try again</Button>
          )}
          {returnTo && (
            <Button variant="outline" onClick={onReturn}>
              Back
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

export function ConnectionsSupportBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>Some accounts take a few manual steps to connect. If you get stuck, we can help.</p>
      <a
        href={SUPPORT_MAILTO}
        className="inline-flex items-center justify-center rounded-lg border px-3 py-2 font-medium text-foreground"
      >
        Email us for help
      </a>
    </div>
  );
}

export function ConnectionsReturnBanner({
  onReturn,
}: {
  returnTo: string;
  onReturn: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
      <p className="text-muted-foreground">
        Connect what you need here, then go back to setup.
      </p>
      <Button variant="outline" onClick={onReturn}>
        Back to setup
      </Button>
    </div>
  );
}

export function getConnectionErrorText(error: string | null) {
  return error === "oauth_denied"
    ? "Access wasn't allowed. Try connecting again and click Allow."
    : error === "no_refresh_token"
      ? "Google didn't finish the connection. Remove this app from your Google account's security settings, then connect again."
      : error === "forbidden"
        ? "You don't have access to this brand. Ask the owner to invite you."
        : error === "no_instagram_account"
          ? "We couldn't find an Instagram Business account. Link your Instagram to your Facebook page, then try again."
          : error === "invalid_signature" || error === "invalid_state"
            ? "Shopify sign-in timed out. Start connecting again."
            : error
              ? "Something went wrong. Try connecting again."
              : null;
}
