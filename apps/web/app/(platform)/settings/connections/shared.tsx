"use client";

import { Button } from "@/components/ui/button";
import {
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

export function FeedbackBanner({ message }: { message: FlashMessage }) {
  if (!message) {
    return null;
  }

  return (
    <div
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
              disabled && "opacity-60",
            )}
          >
            {method === "oauth" ? "OAuth" : "Manual"}
          </button>
        );
      })}
    </div>
  );
}

export function ProviderGuide({ provider }: { provider: IntegrationProvider }) {
  const guide = PROVIDER_GUIDES[provider];

  return (
    <details className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-2 text-sm">
      <summary className="cursor-pointer list-none font-medium text-foreground">
        {guide.title}
      </summary>
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
          Contact our team for support
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
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded && <h1 className="text-3xl font-bold tracking-tight">Connections</h1>}
      <div className="rounded-xl border bg-card">
        <div className="py-8 text-center">
          <p className="text-muted-foreground">
            {isAuthError
              ? "Your session has expired. Please refresh the page or log in again."
              : isNotFound
                ? "No brand found. Visit the dashboard to get started."
                : "Something went wrong loading your connections. Please try again."}
          </p>
          {!isAuthError && !isNotFound && loadError?.message && (
            <p className="mt-2 text-xs text-muted-foreground/70">
              Error: {loadError.message}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {isAuthError ? (
              <Button onClick={() => window.location.reload()}>Refresh page</Button>
            ) : isNotFound ? (
              <Button onClick={() => onReturn()}>Go to Dashboard</Button>
            ) : (
              <Button onClick={onRetry}>Retry</Button>
            )}
            {returnTo && (
              <Button variant="outline" onClick={onReturn}>
                Back
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConnectionsSupportBanner() {
  return (
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
  );
}

export function ConnectionsReturnBanner({
  returnTo,
  onReturn,
}: {
  returnTo: string;
  onReturn: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4 text-sm">
      <p className="text-muted-foreground">
        Finish connections here, then return to onboarding when you are ready.
      </p>
      <Button variant="outline" onClick={onReturn}>
        Return to Onboarding
      </Button>
    </div>
  );
}

export function getConnectionErrorText(error: string | null) {
  return error === "oauth_denied"
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
}
