"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Feature Flags Settings Page
 *
 * Admin-only toggles for per-brand feature flags.
 * Flags fail-CLOSED: if the flag system breaks, everything is disabled.
 */

interface FeatureFlags {
  aiReplyEnabled: boolean;
  unipileDmEnabled: boolean;
  shopifyOrderEnabled: boolean;
  reminderEmailEnabled: boolean;
}

const FLAG_LABELS: Record<keyof FeatureFlags, { label: string; description: string }> = {
  aiReplyEnabled: {
    label: "AI Reply Drafts",
    description: "Enable AI-generated reply drafts for inbound messages. When disabled, all replies require manual intervention.",
  },
  unipileDmEnabled: {
    label: "Instagram DM (Unipile)",
    description: "Enable Instagram DM sending via Unipile. When disabled, DM endpoints return 403.",
  },
  shopifyOrderEnabled: {
    label: "Shopify Order Creation",
    description: "Enable automated Shopify draft order creation. When disabled, order endpoints return 403.",
  },
  reminderEmailEnabled: {
    label: "Reminder Emails",
    description: "Enable scheduled reminder emails for post-delivery follow-ups. When disabled, reminders are silently skipped.",
  },
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/feature-flags");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load flags");
        return;
      }
      const data = await res.json();
      setFlags(data.flags);
      setError(null);
    } catch {
      setError("Failed to load feature flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const toggleFlag = async (flag: keyof FeatureFlags) => {
    if (!flags) return;

    setUpdating(flag);
    try {
      const res = await fetch("/api/settings/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag, value: !flags[flag] }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update flag");
        return;
      }

      const data = await res.json();
      setFlags(data.flags);
      setError(null);
    } catch {
      setError("Failed to update feature flag");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="mb-6 text-2xl font-bold">Feature Flags</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error && !flags) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="mb-6 text-2xl font-bold">Feature Flags</h1>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-bold">Feature Flags</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Control which subsystems are active for your brand. All flags default to
        OFF (fail-closed). Enable one at a time during rollout.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {flags &&
          (Object.keys(FLAG_LABELS) as Array<keyof FeatureFlags>).map((flag) => (
            <div
              key={flag}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <h3 className="font-medium">{FLAG_LABELS[flag].label}</h3>
                <p className="text-sm text-muted-foreground">
                  {FLAG_LABELS[flag].description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleFlag(flag)}
                disabled={updating === flag}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  flags[flag] ? "bg-green-600" : "bg-gray-200"
                } ${updating === flag ? "opacity-50" : ""}`}
                aria-label={`Toggle ${FLAG_LABELS[flag].label}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                    flags[flag] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
      </div>

      <div className="mt-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <h3 className="font-medium text-yellow-800">⚠️ Fail-Closed Design</h3>
        <p className="mt-1 text-sm text-yellow-700">
          If the flag system encounters an error reading flags, all features
          default to <strong>disabled</strong>. This prevents accidental
          auto-sends or API calls if configuration is corrupted.
        </p>
      </div>
    </div>
  );
}
